import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { ensureSchema } from "../../../../../db/runtime";
import { threadsContentPlans, threadsDrafts, threadsSettings } from "../../../../../db/schema";
import { getThreadsSettingsRow } from "../../../../../lib/threads/data";
import { signedRequestUserId, verifyMetaSignedRequest } from "../../../../../lib/threads/signed-request";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code") || "";
  return Response.json({ status: "completed", confirmation_code: code });
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const payload = await verifyMetaSignedRequest(request);
    const userId = signedRequestUserId(payload);
    const settings = await getThreadsSettingsRow();
    if (userId && settings.threadsUserId && userId !== settings.threadsUserId) {
      return Response.json({ error: "Пользователь Threads не совпадает" }, { status: 403 });
    }

    const db = getDb();
    await db.delete(threadsDrafts);
    await db.delete(threadsContentPlans);
    await db.update(threadsSettings).set({
      performerName: "",
      services: "",
      prices: "",
      timelines: "",
      portfolioUrl: "",
      exampleUrl: "",
      whatsapp: "",
      ctaText: "",
      threadsUserId: "",
      threadsUsername: "",
      tokenEncrypted: "",
      tokenIv: "",
      tokenAuthTag: "",
      tokenExpiresAt: null,
      updatedAt: new Date().toISOString(),
    }).where(eq(threadsSettings.id, 1));

    const confirmationCode = randomBytes(16).toString("hex");
    const origin = process.env.THREADS_PUBLIC_URL || new URL(request.url).origin;
    return Response.json({
      url: `${origin.replace(/\/$/, "")}/api/threads/oauth/delete?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Неверный запрос Meta" }, { status: 401 });
  }
}
