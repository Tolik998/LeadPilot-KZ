import { randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { ensureSchema } from "../../db/runtime";
import { threadsAnalytics, threadsDrafts, threadsSettings } from "../../db/schema";
import type { GeneratedContent, OfferSettings } from "./content";
import type { GenerationInput, ThreadsCategory } from "./validation";

export async function getThreadsSettingsRow() {
  await ensureSchema();
  const [settings] = await getDb().select().from(threadsSettings).where(eq(threadsSettings.id, 1)).limit(1);
  if (settings) return settings;
  const [created] = await getDb().insert(threadsSettings).values({ id: 1 }).returning();
  return created;
}

export function publicSettings(settings: Awaited<ReturnType<typeof getThreadsSettingsRow>>) {
  return {
    id: settings.id,
    performerName: settings.performerName,
    services: settings.services,
    prices: settings.prices,
    timelines: settings.timelines,
    portfolioUrl: settings.portfolioUrl,
    exampleUrl: settings.exampleUrl,
    whatsapp: settings.whatsapp,
    ctaText: settings.ctaText,
    connected: Boolean(settings.threadsUserId && settings.tokenEncrypted),
    threadsUsername: settings.threadsUsername,
    tokenExpiresAt: settings.tokenExpiresAt,
    updatedAt: settings.updatedAt,
  };
}

export function offerSettings(settings: Awaited<ReturnType<typeof getThreadsSettingsRow>>): OfferSettings {
  return publicSettings(settings);
}

export async function createDraft(
  input: GenerationInput,
  generated: GeneratedContent,
  options: { contentPlanId?: number; plannedFor?: string; category?: ThreadsCategory } = {},
) {
  await ensureSchema();
  const db = getDb();
  const now = new Date().toISOString();
  const [draft] = await db.insert(threadsDrafts).values({
    contentPlanId: options.contentPlanId,
    niche: input.niche,
    city: input.city,
    service: input.service,
    format: input.format,
    goal: input.goal,
    category: options.category || generated.category,
    topic: generated.topic,
    messages: generated.messages,
    firstLines: generated.firstLines,
    ctas: generated.ctas,
    alternativeText: generated.alternativeText,
    status: "draft",
    plannedFor: options.plannedFor,
    updatedAt: now,
  }).returning();
  const settings = await getThreadsSettingsRow();
  const destinationUrl = settings.exampleUrl || settings.portfolioUrl;
  const [analytics] = await db.insert(threadsAnalytics).values({
    publicationId: draft.id,
    trackingSlug: randomBytes(8).toString("base64url"),
    destinationUrl,
    updatedAt: now,
  }).returning();
  return { ...draft, analytics };
}

export async function latestThreadsData() {
  await ensureSchema();
  const db = getDb();
  const [posts, analytics] = await Promise.all([
    db.select().from(threadsDrafts).orderBy(desc(threadsDrafts.createdAt), desc(threadsDrafts.id)).limit(500),
    db.select().from(threadsAnalytics).orderBy(desc(threadsAnalytics.updatedAt)).limit(500),
  ]);
  return { posts, analytics };
}
