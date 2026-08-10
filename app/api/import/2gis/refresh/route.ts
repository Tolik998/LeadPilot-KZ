import { and, eq, ne, sql } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { ensureSchema } from "../../../../../db/runtime";
import { leads } from "../../../../../db/schema";
import { reviewStats, type Reviews } from "../reviews";

type Item = { id?: string; reviews?: Reviews };

function chunks<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const payload = (await request.json()) as { apiKey?: string; minReviews?: number };
    const apiKey = payload.apiKey?.trim();
    const minReviews = Math.max(0, Math.min(10000, Math.trunc(Number(payload.minReviews) || 0)));
    if (!apiKey) return Response.json({ error: "Укажите API‑ключ 2ГИС" }, { status: 400 });

    const db = getDb();
    const current = await db
      .select({ id: leads.id, sourceId: leads.sourceId })
      .from(leads)
      .where(and(eq(leads.status, "new"), ne(leads.sourceId, "")))
      .limit(500);

    let updated = 0;
    let aboveThreshold = 0;
    let belowThreshold = 0;
    let missing = 0;

    for (const batch of chunks(current, 20)) {
      const url = new URL("https://catalog.api.2gis.com/3.0/items/byid");
      url.searchParams.set("id", batch.map((lead) => lead.sourceId).join(","));
      url.searchParams.set("fields", "items.reviews");
      url.searchParams.set("key", apiKey);
      let response: Response;
      try {
        response = await fetch(url, { headers: { Accept: "application/json" } });
      } catch {
        throw new Error("Не удалось подключиться к 2ГИС. Повторите попытку позже.");
      }
      const data = (await response.json()) as {
        meta?: { code?: number; error?: { message?: string } };
        result?: { items?: Item[] };
      };
      if (!response.ok || (data.meta?.code && data.meta.code !== 200)) {
        throw new Error(data.meta?.error?.message || "2ГИС отклонил обновление статистики");
      }

      const bySourceId = new Map((data.result?.items || []).map((item) => [item.id || "", item]));
      const updates: Array<{ id: number; rating: number | null; reviewsCount: number }> = [];
      for (const lead of batch) {
        const item = bySourceId.get(lead.sourceId);
        if (!item) {
          missing += 1;
          continue;
        }
        const stats = reviewStats(item.reviews);
        if (stats.count >= minReviews) aboveThreshold += 1;
        else belowThreshold += 1;
        updates.push({ id: lead.id, rating: stats.rating, reviewsCount: stats.count });
      }

      if (updates.length > 0) {
        const values = sql.join(
          updates.map((item) => sql`(${item.id}::bigint, ${item.rating}::double precision, ${item.reviewsCount}::integer)`),
          sql`, `,
        );
        await db.execute(sql`
          UPDATE leads AS target
          SET rating = source.rating,
              reviews_count = source.reviews_count,
              reviews_checked_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          FROM (VALUES ${values}) AS source(id, rating, reviews_count)
          WHERE target.id = source.id
        `);
        updated += updates.length;
      }
    }

    return Response.json({ checked: current.length, updated, aboveThreshold, belowThreshold, missing, minReviews });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Refresh error" }, { status: 500 });
  }
}
