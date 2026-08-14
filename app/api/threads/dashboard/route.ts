import { desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { ensureSchema } from "../../../../db/runtime";
import { threadsAnalytics, threadsContentPlans, threadsDrafts, threadsPublishLogs, threadsQueue } from "../../../../db/schema";
import { getThreadsSettingsRow, publicSettings } from "../../../../lib/threads/data";
import { errorResponse } from "../../../../lib/threads/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSchema();
    const db = getDb();
    const [posts, plans, queue, analytics, logs, settings] = await Promise.all([
      db.select().from(threadsDrafts).orderBy(desc(threadsDrafts.createdAt), desc(threadsDrafts.id)).limit(500),
      db.select().from(threadsContentPlans).orderBy(desc(threadsContentPlans.createdAt)).limit(20),
      db.select().from(threadsQueue).orderBy(desc(threadsQueue.scheduledAt)).limit(200),
      db.select().from(threadsAnalytics).orderBy(desc(threadsAnalytics.updatedAt)).limit(500),
      db.select().from(threadsPublishLogs).orderBy(desc(threadsPublishLogs.createdAt)).limit(100),
      getThreadsSettingsRow(),
    ]);
    const analyticsByPost = new Map(analytics.map((item) => [item.publicationId, item]));
    const published = posts.filter((post) => post.status === "published");
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weeklyPosts = published.filter((post) => post.publishedAt && new Date(post.publishedAt).getTime() >= weekAgo);
    const ranked = (weeklyPosts.length ? weeklyPosts : published).map((post) => {
      const stats = analyticsByPost.get(post.id);
      const score = (stats?.likes || 0) + (stats?.replies || 0) * 3 + (stats?.reposts || 0) * 2 + (stats?.linkClicks || 0) * 2 + (stats?.manualLeads || 0) * 5;
      return { post, stats, score };
    }).sort((left, right) => right.score - left.score);
    const best = ranked[0];
    const weeklyReport = best && best.score > 0 ? {
      generatedAt: new Date().toISOString(),
      headline: `Лучше всего сработала тема «${best.post.topic}»`,
      recommendation: `В новом плане сохраните механику первой строки «${best.post.messages[0]?.split("\n")[0]}» и развивайте категорию «${best.post.category}», меняя конкретную проблему и решение.`,
      publicationId: best.post.id,
    } : {
      generatedAt: new Date().toISOString(),
      headline: "Для недельного разбора пока недостаточно реакций",
      recommendation: "Опубликуйте несколько согласованных материалов. После появления просмотров и реакций LeadPilot выделит сильные темы и первые строки.",
      publicationId: null,
    };
    return Response.json({ posts, plans, queue, analytics, logs, settings: publicSettings(settings), weeklyReport });
  } catch (error) {
    return errorResponse(error);
  }
}
