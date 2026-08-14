import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../../../../db";
import { ensureSchema } from "../../../../db/runtime";
import { threadsDrafts, threadsQueue } from "../../../../db/schema";
import { cleanText, cleanTextArray, errorResponse, parseDate, parsePositiveId, THREAD_FORMATS, THREAD_GOALS } from "../../../../lib/threads/validation";

export async function PATCH(request: Request) {
  try {
    await ensureSchema();
    const payload = await request.json() as Record<string, unknown>;
    const id = parsePositiveId(payload.id);
    const db = getDb();
    const [current] = await db.select().from(threadsDrafts).where(eq(threadsDrafts.id, id)).limit(1);
    if (!current) return Response.json({ error: "Публикация не найдена" }, { status: 404 });
    const action = cleanText(payload.action, 30) || "save";
    const now = new Date().toISOString();

    if (action === "schedule") {
      if (current.status === "published") return Response.json({ error: "Опубликованный пост нельзя поставить в очередь повторно" }, { status: 409 });
      const scheduledAt = parseDate(payload.scheduledAt, "дату и время публикации");
      if (new Date(scheduledAt).getTime() < Date.now() - 30_000) return Response.json({ error: "Время публикации уже прошло" }, { status: 400 });
      await db.insert(threadsQueue).values({ publicationId: id, scheduledAt, status: "pending", attempts: 0, updatedAt: now })
        .onConflictDoUpdate({ target: threadsQueue.publicationId, set: { scheduledAt, status: "pending", attempts: 0, nextAttemptAt: null, lastError: "", updatedAt: now } });
      const [updated] = await db.update(threadsDrafts).set({ status: "queued", scheduledAt, lastError: "", updatedAt: now }).where(eq(threadsDrafts.id, id)).returning();
      return Response.json({ post: updated });
    }

    if (action === "cancel_queue") {
      await db.delete(threadsQueue).where(and(eq(threadsQueue.publicationId, id), ne(threadsQueue.status, "published")));
      const [updated] = await db.update(threadsDrafts).set({ status: "draft", scheduledAt: null, lastError: "", updatedAt: now }).where(eq(threadsDrafts.id, id)).returning();
      return Response.json({ post: updated });
    }

    if (["published", "publishing"].includes(current.status)) {
      return Response.json({ error: "Опубликованный текст нельзя изменить" }, { status: 409 });
    }
    const messages = cleanTextArray(payload.messages, 7, 500);
    if (!messages.length) throw new Error("Текст публикации не может быть пустым");
    const format = cleanText(payload.format, 20) || current.format;
    const goal = cleanText(payload.goal, 20) || current.goal;
    if (!THREAD_FORMATS.includes(format as never)) throw new Error("Формат публикации не поддерживается");
    if (!THREAD_GOALS.includes(goal as never)) throw new Error("Цель публикации не поддерживается");
    if (format === "single" && messages.length !== 1) throw new Error("Одиночный пост должен состоять из одной части");
    const [updated] = await db.update(threadsDrafts).set({
      topic: cleanText(payload.topic, 240) || current.topic,
      messages,
      firstLines: cleanTextArray(payload.firstLines, 10, 500),
      ctas: cleanTextArray(payload.ctas, 3, 500),
      alternativeText: cleanText(payload.alternativeText, 500),
      format,
      goal,
      status: current.status === "failed" ? "draft" : current.status,
      lastError: "",
      updatedAt: now,
    }).where(eq(threadsDrafts.id, id)).returning();
    return Response.json({ post: updated });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureSchema();
    const id = parsePositiveId(new URL(request.url).searchParams.get("id"));
    const db = getDb();
    const [current] = await db.select().from(threadsDrafts).where(eq(threadsDrafts.id, id)).limit(1);
    if (!current) return Response.json({ error: "Публикация не найдена" }, { status: 404 });
    if (["published", "publishing"].includes(current.status)) {
      return Response.json({ error: "Опубликованную публикацию нельзя удалить из журнала LeadPilot" }, { status: 409 });
    }
    await db.delete(threadsDrafts).where(eq(threadsDrafts.id, id));
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
