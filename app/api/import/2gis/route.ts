import { eq, or } from "drizzle-orm";
import { getDb } from "../../../../db";
import { ensureSchema } from "../../../../db/runtime";
import { leads } from "../../../../db/schema";

type Contact = { type?: string; value?: string; text?: string; url?: string };
type Item = {
  id?: string;
  name?: string;
  address_name?: string;
  full_name?: string;
  type?: string;
  purpose_name?: string;
  reviews?: { general_rating?: number };
  contact_groups?: Array<{ contacts?: Contact[] }>;
};

function contact(items: Contact[], types: string[]) {
  const match = items.find((item) => types.includes((item.type || "").toLowerCase()));
  return match?.value || match?.text || match?.url || "";
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const payload = (await request.json()) as { apiKey?: string; city?: string; query?: string; pages?: number };
    const apiKey = payload.apiKey?.trim();
    const city = payload.city?.trim().slice(0, 100) || "Кызылорда";
    const query = payload.query?.trim().slice(0, 120) || "кафе ресторан";
    const pages = Math.max(1, Math.min(5, Number(payload.pages) || 1));
    if (!apiKey) return Response.json({ error: "Укажите API‑ключ 2ГИС" }, { status: 400 });

    const collected: Item[] = [];
    for (let page = 1; page <= pages; page += 1) {
      const url = new URL("https://catalog.api.2gis.com/3.0/items");
      url.searchParams.set("q", `${query} ${city}`);
      url.searchParams.set("type", "branch");
      url.searchParams.set("has_site", "false");
      url.searchParams.set("page_size", "10");
      url.searchParams.set("page", String(page));
      url.searchParams.set("fields", "items.address,items.reviews,items.contact_groups");
      url.searchParams.set("key", apiKey);
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      const data = (await response.json()) as { meta?: { code?: number; error?: { message?: string } }; result?: { items?: Item[] } };
      if (!response.ok || (data.meta?.code && data.meta.code !== 200)) {
        throw new Error(data.meta?.error?.message || "2ГИС отклонил запрос. Проверьте API‑ключ и доступ к контактам.");
      }
      collected.push(...(data.result?.items || []));
    }

    const db = getDb();
    let added = 0;
    let skipped = 0;
    let updated = 0;
    let withContacts = 0;
    for (const item of collected) {
      const sourceId = item.id || "";
      const name = item.name?.trim() || "";
      if (!name) continue;
      const contacts = (item.contact_groups || []).flatMap((group) => group.contacts || []);
      const phone = contact(contacts, ["phone"]);
      if (phone) withContacts += 1;
      const website = contact(contacts, ["website", "url"]);
      const instagram = contact(contacts, ["instagram"]);
      const duplicate = sourceId
        ? await db.select().from(leads).where(or(eq(leads.sourceId, sourceId), phone ? eq(leads.phone, phone) : eq(leads.sourceId, sourceId))).limit(1)
        : phone
          ? await db.select().from(leads).where(eq(leads.phone, phone)).limit(1)
          : [];
      if (duplicate.length) {
        const existing = duplicate[0];
        const nextPhone = existing.phone || phone;
        const nextWhatsApp = existing.whatsapp || phone;
        const nextWebsite = existing.website || website;
        const nextInstagram = existing.instagram || instagram;
        const hasNewContacts = nextPhone !== existing.phone || nextWhatsApp !== existing.whatsapp || nextWebsite !== existing.website || nextInstagram !== existing.instagram;
        if (hasNewContacts) {
          await db.update(leads).set({
            phone: nextPhone,
            whatsapp: nextWhatsApp,
            website: nextWebsite,
            instagram: nextInstagram,
            hasSite: Boolean(nextWebsite),
            notes: existing.notes.includes("добавьте рабочий номер") ? "Контакты обновлены из 2ГИС — проверьте WhatsApp перед отправкой." : existing.notes,
            updatedAt: new Date().toISOString(),
          }).where(eq(leads.id, existing.id));
          updated += 1;
        } else {
          skipped += 1;
        }
        continue;
      }
      await db.insert(leads).values({
        name,
        category: item.purpose_name || "Кафе / ресторан",
        city,
        address: item.address_name || item.full_name || "",
        phone,
        whatsapp: phone,
        website,
        instagram,
        sourceUrl: sourceId ? `https://2gis.kz/search/${encodeURIComponent(name)}/firm/${sourceId}` : "",
        sourceId,
        rating: item.reviews?.general_rating ?? null,
        hasSite: Boolean(website),
        status: "new",
        notes: phone ? "Найдено по фильтру 2ГИС «без сайта» — проверьте WhatsApp перед отправкой." : "Найдено по фильтру 2ГИС «без сайта» — добавьте рабочий номер.",
        updatedAt: new Date().toISOString(),
      });
      added += 1;
    }
    return Response.json({ added, updated, skipped, total: collected.length, withContacts });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Import error" }, { status: 500 });
  }
}
