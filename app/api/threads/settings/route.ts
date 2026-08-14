import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { threadsSettings } from "../../../../db/schema";
import { getThreadsSettingsRow, publicSettings } from "../../../../lib/threads/data";
import { cleanText, cleanUrl, errorResponse } from "../../../../lib/threads/validation";

export async function GET() {
  try {
    return Response.json({ settings: publicSettings(await getThreadsSettingsRow()) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await getThreadsSettingsRow();
    const payload = await request.json() as Record<string, unknown>;
    const now = new Date().toISOString();
    const [settings] = await getDb().update(threadsSettings).set({
      performerName: cleanText(payload.performerName, 120),
      services: cleanText(payload.services, 1000),
      prices: cleanText(payload.prices, 500),
      timelines: cleanText(payload.timelines, 500),
      portfolioUrl: cleanUrl(payload.portfolioUrl),
      exampleUrl: cleanUrl(payload.exampleUrl),
      whatsapp: cleanText(payload.whatsapp, 80),
      ctaText: cleanText(payload.ctaText, 500),
      updatedAt: now,
    }).where(eq(threadsSettings.id, 1)).returning();
    return Response.json({ settings: publicSettings(settings) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  try {
    await getThreadsSettingsRow();
    const [settings] = await getDb().update(threadsSettings).set({
      threadsUserId: "", threadsUsername: "", tokenEncrypted: "", tokenIv: "", tokenAuthTag: "", tokenExpiresAt: null,
      updatedAt: new Date().toISOString(),
    }).where(eq(threadsSettings.id, 1)).returning();
    return Response.json({ settings: publicSettings(settings) });
  } catch (error) {
    return errorResponse(error);
  }
}
