import { and, asc, eq, inArray, lte, or } from "drizzle-orm";
import { getDb } from "../../db";
import { ensureSchema } from "../../db/runtime";
import { threadsAnalytics, threadsDrafts, threadsPublishLogs, threadsQueue } from "../../db/schema";
import { decryptToken } from "./crypto";
import { getThreadsSettingsRow } from "./data";

const graphBase = process.env.THREADS_GRAPH_URL || "https://graph.threads.net/v1.0";

type GraphApiError = {
  message?: string;
  code?: number;
  error_subcode?: number;
  type?: string;
  fbtrace_id?: string;
};

function graphErrorMessage(error: GraphApiError | undefined, status: number) {
  const original = error?.message || `Threads API вернул HTTP ${status}`;
  if (
    /API access blocked/i.test(original) ||
    [10, 200].includes(error?.code || 0)
  ) {
    return "Meta заблокировала доступ приложения к Threads API. Переподключите аккаунт Threads; если ошибка останется, проверьте разрешения threads_content_publish и threads_manage_insights в Meta App Dashboard.";
  }
  if (status === 401 || error?.code === 190) {
    return "Сессия Threads недействительна или истекла. Переподключите аккаунт Threads в настройках.";
  }
  return original;
}

export class ThreadsApiError extends Error {
  temporary: boolean;
  status: number;
  code: number;
  subcode: number;
  authorizationBlocked: boolean;

  constructor(
    error: GraphApiError | undefined,
    status: number,
    temporary: boolean,
  ) {
    super(graphErrorMessage(error, status));
    this.name = "ThreadsApiError";
    this.status = status;
    this.temporary = temporary;
    this.code = error?.code || 0;
    this.subcode = error?.error_subcode || 0;
    this.authorizationBlocked =
      status === 401 ||
      [10, 190, 200].includes(this.code) ||
      /API access blocked/i.test(error?.message || "");
  }
}

async function graphPost(path: string, token: string, body: Record<string, string>) {
  const response = await fetch(`${graphBase}/${path.replace(/^\//, "")}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...body, access_token: token }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as { id?: string; error?: GraphApiError };
  if (!response.ok || payload.error) {
    const temporary = response.status === 429 || response.status >= 500 || [1, 2, 4, 17, 32, 341, 613].includes(payload.error?.code || 0);
    throw new ThreadsApiError(payload.error, response.status, temporary);
  }
  return payload;
}

async function graphGet(path: string, token: string) {
  const response = await fetch(`${graphBase}/${path.replace(/^\//, "")}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown> & { error?: GraphApiError };
  if (!response.ok || payload.error) {
    const temporary = response.status === 429 || response.status >= 500 || [1, 2, 4, 17, 32, 341, 613].includes(payload.error?.code || 0);
    throw new ThreadsApiError(payload.error, response.status, temporary);
  }
  return payload;
}

async function logResult(publicationId: number, queueId: number | null, level: string, action: string, message: string, details: Record<string, unknown> = {}) {
  await getDb().insert(threadsPublishLogs).values({ publicationId, queueId: queueId || undefined, level, action, message: message.slice(0, 2000), details });
}

function trackingUrl(origin: string, slug: string) {
  const configured = process.env.THREADS_PUBLIC_URL?.replace(/\/$/, "");
  return `${configured || origin.replace(/\/$/, "")}/t/${slug}`;
}

export async function publishDraft(publicationId: number, queueId: number | null, origin: string) {
  await ensureSchema();
  const db = getDb();
  const [draft] = await db.select().from(threadsDrafts).where(eq(threadsDrafts.id, publicationId)).limit(1);
  if (!draft) throw new Error("Публикация не найдена");
  if (draft.status === "published") return draft;
  const messages = Array.isArray(draft.messages) ? draft.messages.filter(Boolean) : [];
  if (!messages.length) throw new Error("В публикации нет текста");
  if (messages.length > 7 || messages.some((message) => message.length > 500)) {
    throw new Error("Threads принимает до 7 частей, каждая не длиннее 500 символов");
  }
  const settings = await getThreadsSettingsRow();
  if (!settings.threadsUserId || !settings.tokenEncrypted) throw new Error("Сначала подключите аккаунт Threads в настройках");
  if (settings.tokenExpiresAt && new Date(settings.tokenExpiresAt).getTime() <= Date.now()) {
    throw new Error("Токен Threads истёк. Подключите аккаунт заново");
  }
  const token = decryptToken({ encrypted: settings.tokenEncrypted, iv: settings.tokenIv, authTag: settings.tokenAuthTag });
  const [analytics] = await db.select().from(threadsAnalytics).where(eq(threadsAnalytics.publicationId, publicationId)).limit(1);
  const link = analytics ? trackingUrl(origin, analytics.trackingSlug) : (settings.exampleUrl || settings.portfolioUrl);
  const publishedIds = Array.isArray(draft.threadsPostIds) ? [...draft.threadsPostIds] : [];
  let replyToId = publishedIds.at(-1) || "";

  await db.update(threadsDrafts).set({ status: "publishing", lastError: "", updatedAt: new Date().toISOString() }).where(eq(threadsDrafts.id, publicationId));
  await logResult(publicationId, queueId, "info", "publish_started", "Публикация передана в Threads API", { parts: messages.length, resumedFrom: publishedIds.length });

  for (let index = publishedIds.length; index < messages.length; index += 1) {
    const text = messages[index].replaceAll("{tracking_url}", link || "").trim();
    const published = await graphPost("me/threads", token, {
      media_type: "TEXT",
      text,
      auto_publish_text: "true",
      ...(replyToId ? { reply_to_id: replyToId } : {}),
    });
    if (!published.id) throw new Error("Threads API не вернул ID опубликованного сообщения");
    publishedIds.push(published.id);
    replyToId = published.id;
    await db.update(threadsDrafts).set({
      threadsPostIds: publishedIds,
      rootThreadsPostId: publishedIds[0],
      updatedAt: new Date().toISOString(),
    }).where(eq(threadsDrafts.id, publicationId));
    await logResult(publicationId, queueId, "info", "part_published", `Опубликована часть ${index + 1} из ${messages.length}`, { threadsPostId: published.id });
  }

  const now = new Date().toISOString();
  const [completed] = await db.update(threadsDrafts).set({
    status: "published",
    publishedAt: now,
    rootThreadsPostId: publishedIds[0] || "",
    threadsPostIds: publishedIds,
    lastError: "",
    updatedAt: now,
  }).where(eq(threadsDrafts.id, publicationId)).returning();
  await logResult(publicationId, queueId, "success", "publish_completed", "Публикация успешно размещена", { threadsPostIds: publishedIds });
  return completed;
}

export async function processQueue(options: { queueId?: number; origin: string; limit?: number }) {
  await ensureSchema();
  const db = getDb();
  const now = new Date().toISOString();
  const stale = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const dueCondition = options.queueId
    ? eq(threadsQueue.id, options.queueId)
    : or(
        and(eq(threadsQueue.status, "pending"), lte(threadsQueue.scheduledAt, now)),
        and(eq(threadsQueue.status, "retry"), lte(threadsQueue.nextAttemptAt, now)),
        and(eq(threadsQueue.status, "processing"), lte(threadsQueue.lockedAt, stale)),
      );
  const items = await db.select().from(threadsQueue).where(dueCondition).orderBy(asc(threadsQueue.scheduledAt)).limit(options.limit || 10);
  const results: Array<{ id: number; ok: boolean; retry?: boolean; error?: string }> = [];

  for (const item of items) {
    if (!["pending", "retry", "processing"].includes(item.status)) continue;
    const [claimed] = await db.update(threadsQueue).set({ status: "processing", lockedAt: now, updatedAt: now })
      .where(and(eq(threadsQueue.id, item.id), inArray(threadsQueue.status, ["pending", "retry", "processing"]))).returning();
    if (!claimed) continue;
    try {
      await publishDraft(item.publicationId, item.id, options.origin);
      const completedAt = new Date().toISOString();
      await db.update(threadsQueue).set({ status: "published", completedAt, lockedAt: null, lastError: "", updatedAt: completedAt }).where(eq(threadsQueue.id, item.id));
      results.push({ id: item.id, ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Неизвестная ошибка публикации";
      const attempts = item.attempts + 1;
      const retry = error instanceof ThreadsApiError && error.temporary && attempts < item.maxAttempts;
      const nextAttemptAt = retry ? new Date(Date.now() + (5 * 60 * 1000 * (2 ** (attempts - 1)))).toISOString() : null;
      await db.update(threadsQueue).set({
        status: retry ? "retry" : "failed",
        attempts,
        nextAttemptAt,
        lockedAt: null,
        lastError: message.slice(0, 2000),
        updatedAt: new Date().toISOString(),
      }).where(eq(threadsQueue.id, item.id));
      await db.update(threadsDrafts).set({
        status: retry ? "queued" : "failed",
        lastError: message.slice(0, 2000),
        updatedAt: new Date().toISOString(),
      }).where(eq(threadsDrafts.id, item.publicationId));
      await logResult(
        item.publicationId,
        item.id,
        "error",
        retry ? "publish_retry" : "publish_failed",
        message,
        {
          attempts,
          nextAttemptAt,
          ...(error instanceof ThreadsApiError
            ? { status: error.status, code: error.code, subcode: error.subcode }
            : {}),
        },
      );
      results.push({ id: item.id, ok: false, retry, error: message });
    }
  }
  return results;
}

function metricValue(payload: Record<string, unknown>, name: string) {
  const data = Array.isArray(payload.data) ? payload.data as Array<Record<string, unknown>> : [];
  const metric = data.find((item) => item.name === name);
  const values = Array.isArray(metric?.values) ? metric.values as Array<Record<string, unknown>> : [];
  const direct = values.at(-1)?.value;
  const totalValue = metric?.total_value as Record<string, unknown> | undefined;
  const value = typeof direct === "number" ? direct : totalValue?.value;
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export async function syncInsights(limit = 20, staleOnly = false) {
  await ensureSchema();
  const db = getDb();
  const settings = await getThreadsSettingsRow();
  if (!settings.threadsUserId || !settings.tokenEncrypted) throw new Error("Сначала подключите аккаунт Threads в настройках");
  const token = decryptToken({ encrypted: settings.tokenEncrypted, iv: settings.tokenIv, authTag: settings.tokenAuthTag });
  const candidates = await db.select({ post: threadsDrafts, analytics: threadsAnalytics })
    .from(threadsDrafts)
    .innerJoin(threadsAnalytics, eq(threadsAnalytics.publicationId, threadsDrafts.id))
    .where(eq(threadsDrafts.status, "published"))
    .orderBy(asc(threadsAnalytics.lastSyncedAt))
    .limit(limit);
  const threshold = Date.now() - 6 * 60 * 60 * 1000;
  let synced = 0;
  for (const row of candidates) {
    if (!row.post.rootThreadsPostId) continue;
    if (staleOnly && row.analytics.lastSyncedAt && new Date(row.analytics.lastSyncedAt).getTime() > threshold) continue;
    try {
      const payload = await graphGet(`${row.post.rootThreadsPostId}/insights?metric=views,likes,replies,reposts`, token);
      const now = new Date().toISOString();
      await db.update(threadsAnalytics).set({
        views: metricValue(payload, "views"),
        likes: metricValue(payload, "likes"),
        replies: metricValue(payload, "replies"),
        reposts: metricValue(payload, "reposts"),
        lastSyncedAt: now,
        updatedAt: now,
      }).where(eq(threadsAnalytics.id, row.analytics.id));
      synced += 1;
    } catch (error) {
      await logResult(
        row.post.id,
        null,
        "error",
        "insights_sync_failed",
        error instanceof Error ? error.message : "Ошибка синхронизации аналитики",
        error instanceof ThreadsApiError
          ? { status: error.status, code: error.code, subcode: error.subcode }
          : {},
      );
      if (error instanceof ThreadsApiError && error.authorizationBlocked) {
        throw error;
      }
    }
  }
  return { synced };
}
