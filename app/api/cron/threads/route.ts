import { processQueue, syncInsights } from "../../../../lib/threads/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function origin(request: Request) {
  return process.env.THREADS_PUBLIC_URL || new URL(request.url).origin;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET не настроен" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const queue = await processQueue({ origin: origin(request), limit: 10 });
  let insights: { synced: number } | { synced: number; skipped: string } = { synced: 0 };
  try {
    insights = await syncInsights(10, true);
  } catch (error) {
    insights = { synced: 0, skipped: error instanceof Error ? error.message : "Ошибка аналитики" };
  }
  return Response.json({ ok: true, queue, insights, ranAt: new Date().toISOString() });
}
