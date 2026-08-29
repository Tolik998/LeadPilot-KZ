import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { ensureSchema } from "../../../../db/runtime";
import { threadsAnalytics, threadsContentPlans, threadsDrafts, threadsQueue } from "../../../../db/schema";
import { generateContent, topicFor } from "../../../../lib/threads/content";
import { getThreadsSettingsRow, offerSettings } from "../../../../lib/threads/data";
import { errorResponse, parseGenerationInput, parsePositiveId, THREAD_CATEGORIES, type ThreadsCategory } from "../../../../lib/threads/validation";

function categoryCounts(total: number) {
  const shares: Array<[ThreadsCategory, number]> = [["problem", .4], ["solution", .3], ["capability", .2], ["offer", .1]];
  const rows = shares.map(([category, share]) => ({ category, value: total * share, count: Math.floor(total * share) }));
  const remaining = total - rows.reduce((sum, row) => sum + row.count, 0);
  rows.sort((left, right) => (right.value - right.count) - (left.value - left.count));
  for (let index = 0; index < remaining; index += 1) rows[index % rows.length].count += 1;
  return new Map(rows.map((row) => [row.category, row.count]));
}

function categorySequence(counts: Map<ThreadsCategory, number>, total: number) {
  const used = new Map<ThreadsCategory, number>(THREAD_CATEGORIES.map((category) => [category, 0]));
  const sequence: ThreadsCategory[] = [];
  for (let position = 0; position < total; position += 1) {
    const available = THREAD_CATEGORIES.filter((category) => (used.get(category) || 0) < (counts.get(category) || 0));
    available.sort((left, right) => {
      const leftNeed = ((counts.get(left) || 0) * (position + 1) / total) - (used.get(left) || 0);
      const rightNeed = ((counts.get(right) || 0) * (position + 1) / total) - (used.get(right) || 0);
      return rightNeed - leftNeed;
    });
    const selected = available[0];
    sequence.push(selected);
    used.set(selected, (used.get(selected) || 0) + 1);
  }
  return sequence;
}

function plannedIso(startDate: string, day: number, slot: number) {
  const [year, month, date] = startDate.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, date + day, slot === 0 ? 5 : 12, 0, 0);
  return new Date(utc).toISOString();
}

type DraftRow = typeof threadsDrafts.$inferSelect;
type SettingsRow = Awaited<ReturnType<typeof getThreadsSettingsRow>>;

function requireThreadsConnection(settings: SettingsRow) {
  if (!settings.threadsUserId || !settings.tokenEncrypted) {
    throw new Error("Укажите подключённый аккаунт Threads в настройках");
  }
  if (
    settings.tokenExpiresAt &&
    new Date(settings.tokenExpiresAt).getTime() <= Date.now()
  ) {
    throw new Error("Укажите действующее подключение Threads: текущий токен истёк");
  }
}

async function queueFuturePlanPosts(posts: DraftRow[], settings: SettingsRow) {
  requireThreadsConnection(settings);
  const db = getDb();
  const now = new Date().toISOString();
  const cutoff = Date.now() + 30_000;
  let scheduled = 0;
  let skippedPast = 0;
  let alreadyQueued = 0;

  for (const post of posts) {
    if (["published", "publishing"].includes(post.status)) continue;
    if (post.status === "queued") {
      alreadyQueued += 1;
      continue;
    }
    if (!post.plannedFor || new Date(post.plannedFor).getTime() <= cutoff) {
      skippedPast += 1;
      continue;
    }
    await db
      .insert(threadsQueue)
      .values({
        publicationId: post.id,
        scheduledAt: post.plannedFor,
        status: "pending",
        attempts: 0,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: threadsQueue.publicationId,
        set: {
          scheduledAt: post.plannedFor,
          status: "pending",
          attempts: 0,
          nextAttemptAt: null,
          lastError: "",
          updatedAt: now,
        },
      });
    await db
      .update(threadsDrafts)
      .set({
        status: "queued",
        scheduledAt: post.plannedFor,
        lastError: "",
        updatedAt: now,
      })
      .where(eq(threadsDrafts.id, post.id));
    scheduled += 1;
  }

  return { scheduled, skippedPast, alreadyQueued };
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const payload = await request.json() as Record<string, unknown>;
    const durationDays = Number(payload.durationDays);
    const postsPerDay = Number(payload.postsPerDay);
    if (![7, 30].includes(durationDays)) throw new Error("Выберите план на 7 или 30 дней");
    if (![1, 2].includes(postsPerDay)) throw new Error("Количество публикаций в день: 1 или 2");
    const input = parseGenerationInput({ ...payload, format: payload.format || "single", goal: payload.goal || "reach" });
    const startDate = typeof payload.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(payload.startDate)
      ? payload.startDate
      : new Date().toISOString().slice(0, 10);
    const db = getDb();
    const now = new Date().toISOString();
    const settings = await getThreadsSettingsRow();
    if (payload.autoPost === true) requireThreadsConnection(settings);
    const [plan] = await db.insert(threadsContentPlans).values({
      durationDays, postsPerDay, niche: input.niche, city: input.city, service: input.service,
      startDate: plannedIso(startDate, 0, 0), status: "active", updatedAt: now,
    }).returning();
    const total = durationDays * postsPerDay;
    const counts = categoryCounts(total);
    const categories = categorySequence(counts, total);
    const seen = new Set<string>();
    const draftValues = categories.map((category, index) => {
      const day = Math.floor(index / postsPerDay);
      const slot = index % postsPerDay;
      const format = index % 4 === 3 ? "thread" : input.format;
      const itemInput = { ...input, format };
      const generated = generateContent(itemInput, offerSettings(settings), index, category);
      let topic = topicFor(category, index, itemInput);
      const key = topic.toLocaleLowerCase("ru").replace(/[^а-яa-z0-9]+/g, " ").trim();
      if (seen.has(key)) topic = `${topic}: дополнительный ракурс ${day + 1}`;
      seen.add(topic.toLocaleLowerCase("ru").replace(/[^а-яa-z0-9]+/g, " ").trim());
      return {
        contentPlanId: plan.id, niche: input.niche, city: input.city, service: input.service,
        format, goal: input.goal, category, topic, messages: generated.messages,
        firstLines: generated.firstLines, ctas: generated.ctas, alternativeText: generated.alternativeText,
        status: "draft", plannedFor: plannedIso(startDate, day, slot), updatedAt: now,
      };
    });
    const drafts = await db.insert(threadsDrafts).values(draftValues).returning();
    const destinationUrl = settings.exampleUrl || settings.portfolioUrl;
    await db.insert(threadsAnalytics).values(drafts.map((draft) => ({
      publicationId: draft.id,
      trackingSlug: randomBytes(8).toString("base64url"),
      destinationUrl,
      updatedAt: now,
    })));
    const autoPost = payload.autoPost === true
      ? await queueFuturePlanPosts(drafts, settings)
      : { scheduled: 0, skippedPast: 0, alreadyQueued: 0 };
    return Response.json(
      { plan, posts: drafts, duplicateCount: total - seen.size, autoPost },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureSchema();
    const payload = await request.json() as Record<string, unknown>;
    const id = parsePositiveId(payload.id);
    if (payload.action !== "enable_autopost") {
      throw new Error("Некорректное действие для контент-плана");
    }
    const db = getDb();
    const [plan] = await db
      .select()
      .from(threadsContentPlans)
      .where(eq(threadsContentPlans.id, id))
      .limit(1);
    if (!plan) {
      return Response.json({ error: "Контент-план не найден" }, { status: 404 });
    }
    const posts = await db
      .select()
      .from(threadsDrafts)
      .where(eq(threadsDrafts.contentPlanId, id));
    const autoPost = await queueFuturePlanPosts(
      posts,
      await getThreadsSettingsRow(),
    );
    return Response.json({ plan, autoPost });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureSchema();
    const id = parsePositiveId(new URL(request.url).searchParams.get("id"));
    const [deleted] = await getDb().delete(threadsContentPlans).where(eq(threadsContentPlans.id, id)).returning();
    if (!deleted) return Response.json({ error: "Контент-план не найден" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
