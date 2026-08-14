import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { ensureSchema } from "../../../../db/runtime";
import { threadsAnalytics } from "../../../../db/schema";
import { syncInsights } from "../../../../lib/threads/api";
import { errorResponse, parsePositiveId } from "../../../../lib/threads/validation";

export async function POST() {
  try {
    return Response.json(await syncInsights(30));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureSchema();
    const payload = await request.json() as Record<string, unknown>;
    const publicationId = parsePositiveId(payload.publicationId);
    const manualLeads = Number(payload.manualLeads);
    if (!Number.isInteger(manualLeads) || manualLeads < 0 || manualLeads > 1_000_000) throw new Error("Количество заявок должно быть целым неотрицательным числом");
    const [analytics] = await getDb().update(threadsAnalytics).set({ manualLeads, updatedAt: new Date().toISOString() })
      .where(eq(threadsAnalytics.publicationId, publicationId)).returning();
    if (!analytics) return Response.json({ error: "Аналитика публикации не найдена" }, { status: 404 });
    return Response.json({ analytics });
  } catch (error) {
    return errorResponse(error);
  }
}
