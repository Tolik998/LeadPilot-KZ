import { eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { ensureSchema } from "../../../../../../db/runtime";
import { threadsDrafts, threadsQueue } from "../../../../../../db/schema";
import { processQueue } from "../../../../../../lib/threads/api";
import { errorResponse, parsePositiveId } from "../../../../../../lib/threads/validation";

function requestOrigin(request: Request) {
  return process.env.THREADS_PUBLIC_URL || new URL(request.url).origin;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const id = parsePositiveId((await context.params).id);
    const db = getDb();
    const [draft] = await db.select().from(threadsDrafts).where(eq(threadsDrafts.id, id)).limit(1);
    if (!draft) return Response.json({ error: "Публикация не найдена" }, { status: 404 });
    if (draft.status === "published") return Response.json({ post: draft });
    const now = new Date().toISOString();
    const [queue] = await db.insert(threadsQueue).values({ publicationId: id, scheduledAt: now, status: "pending", attempts: 0, updatedAt: now })
      .onConflictDoUpdate({ target: threadsQueue.publicationId, set: { scheduledAt: now, status: "pending", attempts: 0, nextAttemptAt: null, lastError: "", updatedAt: now } })
      .returning();
    await db.update(threadsDrafts).set({ status: "queued", scheduledAt: now, lastError: "", updatedAt: now }).where(eq(threadsDrafts.id, id));
    const results = await processQueue({ queueId: queue.id, origin: requestOrigin(request), limit: 1 });
    const result = results[0];
    const [post] = await db.select().from(threadsDrafts).where(eq(threadsDrafts.id, id)).limit(1);
    if (!result?.ok) {
      return Response.json({ error: result?.error || "Не удалось опубликовать", retryScheduled: result?.retry, post }, { status: result?.retry ? 202 : 502 });
    }
    return Response.json({ post });
  } catch (error) {
    return errorResponse(error);
  }
}
