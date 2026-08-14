import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { threadsSettings } from "../../../../../db/schema";
import { getThreadsSettingsRow } from "../../../../../lib/threads/data";
import { signedRequestUserId, verifyMetaSignedRequest } from "../../../../../lib/threads/signed-request";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, endpoint: "threads-deauthorize" });
}

export async function POST(request: Request) {
  try {
    const payload = await verifyMetaSignedRequest(request);
    const userId = signedRequestUserId(payload);
    const settings = await getThreadsSettingsRow();
    if (userId && settings.threadsUserId && userId !== settings.threadsUserId) {
      return Response.json({ error: "Пользователь Threads не совпадает" }, { status: 403 });
    }
    await getDb().update(threadsSettings).set({
      threadsUserId: "",
      threadsUsername: "",
      tokenEncrypted: "",
      tokenIv: "",
      tokenAuthTag: "",
      tokenExpiresAt: null,
      updatedAt: new Date().toISOString(),
    }).where(eq(threadsSettings.id, 1));
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Неверный запрос Meta" }, { status: 401 });
  }
}
