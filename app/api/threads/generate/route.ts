import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { threadsDrafts } from "../../../../db/schema";
import { generateContent, regeneratePart } from "../../../../lib/threads/content";
import { createDraft, getThreadsSettingsRow, offerSettings } from "../../../../lib/threads/data";
import { cleanTextArray, errorResponse, parseGenerationInput, parsePositiveId } from "../../../../lib/threads/validation";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const input = parseGenerationInput(payload);
    const settings = await getThreadsSettingsRow();
    if (payload.mode === "part") {
      const publicationId = parsePositiveId(payload.publicationId);
      const partIndex = Number(payload.partIndex);
      const [draft] = await getDb().select().from(threadsDrafts).where(eq(threadsDrafts.id, publicationId)).limit(1);
      if (!draft) return Response.json({ error: "Черновик не найден" }, { status: 404 });
      if (!Number.isInteger(partIndex) || partIndex < 0 || partIndex >= draft.messages.length) {
        return Response.json({ error: "Некорректная часть ветки" }, { status: 400 });
      }
      const current = cleanTextArray(payload.messages, 7, 500);
      const messages = regeneratePart(input, offerSettings(settings), current.length ? current : draft.messages, partIndex);
      const [updated] = await getDb().update(threadsDrafts).set({ messages, updatedAt: new Date().toISOString() }).where(eq(threadsDrafts.id, publicationId)).returning();
      return Response.json({ post: updated });
    }
    const generated = generateContent(input, offerSettings(settings), Date.now() % 997);
    const post = await createDraft(input, generated);
    return Response.json({ post, coldTopics: generated.coldTopics }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
