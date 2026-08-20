import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { ensureSchema } from "../../../db/runtime";
import { leads } from "../../../db/schema";

const allowedStatuses = new Set([
  "new",
  "contacted",
  "contacted2",
  "contacted3",
  "replied",
  "demo",
  "client",
  "declined",
]);

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function values(payload: Record<string, unknown>) {
  const status = clean(payload.status, 30);
  return {
    name: clean(payload.name, 160),
    category: clean(payload.category, 80) || "Кафе",
    city: clean(payload.city, 100),
    address: clean(payload.address, 240),
    phone: clean(payload.phone, 40),
    whatsapp: clean(payload.whatsapp, 40),
    website: clean(payload.website, 300),
    instagram: clean(payload.instagram, 200),
    sourceUrl: clean(payload.sourceUrl, 400),
    sourceId: clean(payload.sourceId, 100),
    rating: typeof payload.rating === "number" && Number.isFinite(payload.rating) ? payload.rating : null,
    reviewsCount: typeof payload.reviewsCount === "number" && Number.isFinite(payload.reviewsCount)
      ? Math.max(0, Math.trunc(payload.reviewsCount))
      : 0,
    reviewsCheckedAt: typeof payload.reviewsCheckedAt === "string" ? payload.reviewsCheckedAt.slice(0, 40) : null,
    hasSite: Boolean(payload.hasSite || clean(payload.website)),
    status: allowedStatuses.has(status) ? status : "new",
    notes: clean(payload.notes, 1500),
    updatedAt: new Date().toISOString(),
  };
}

export async function GET() {
  try {
    await ensureSchema();
    const rows = await getDb().select().from(leads).orderBy(desc(leads.createdAt), desc(leads.id)).limit(2000);
    return Response.json({ leads: rows });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const payload = (await request.json()) as Record<string, unknown>;
    const row = values(payload);
    if (!row.name) return Response.json({ error: "Укажите название заведения" }, { status: 400 });
    const [created] = await getDb().insert(leads).values(row).returning();
    return Response.json({ lead: created }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureSchema();
    const payload = (await request.json()) as Record<string, unknown>;
    const id = Number(payload.id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Некорректный ID" }, { status: 400 });
    const current = await getDb().select().from(leads).where(eq(leads.id, id)).limit(1);
    if (!current[0]) return Response.json({ error: "Запись не найдена" }, { status: 404 });
    const next = values({ ...current[0], ...payload });
    const [updated] = await getDb().update(leads).set({
      ...next,
      name: next.name || current[0].name,
      lastContactedAt: typeof payload.lastContactedAt === "string" ? payload.lastContactedAt.slice(0, 40) : current[0].lastContactedAt,
    }).where(eq(leads.id, id)).returning();
    return Response.json({ lead: updated });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureSchema();
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Некорректный ID" }, { status: 400 });
    await getDb().delete(leads).where(eq(leads.id, id));
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database error" }, { status: 500 });
  }
}
