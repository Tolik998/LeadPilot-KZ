import { eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { ensureSchema } from "../../../db/runtime";
import { threadsAnalytics } from "../../../db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  await ensureSchema();
  const slug = (await context.params).slug.slice(0, 100);
  const db = getDb();
  const [analytics] = await db.select().from(threadsAnalytics).where(eq(threadsAnalytics.trackingSlug, slug)).limit(1);
  if (!analytics?.destinationUrl) return new Response("Ссылка не настроена", { status: 404 });
  await db.update(threadsAnalytics).set({
    linkClicks: sql`${threadsAnalytics.linkClicks} + 1`,
    updatedAt: new Date().toISOString(),
  }).where(eq(threadsAnalytics.id, analytics.id));
  return Response.redirect(analytics.destinationUrl, 302);
}
