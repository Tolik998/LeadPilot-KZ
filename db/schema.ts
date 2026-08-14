import { sql } from "drizzle-orm";
import { bigint, bigserial, boolean, doublePrecision, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const leads = pgTable("leads", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull().default("Cafe"),
  city: text("city").notNull().default(""),
  address: text("address").notNull().default(""),
  phone: text("phone").notNull().default(""),
  whatsapp: text("whatsapp").notNull().default(""),
  website: text("website").notNull().default(""),
  instagram: text("instagram").notNull().default(""),
  sourceUrl: text("source_url").notNull().default(""),
  sourceId: text("source_id").notNull().default(""),
  rating: doublePrecision("rating"),
  reviewsCount: integer("reviews_count").notNull().default(0),
  reviewsCheckedAt: timestamp("reviews_checked_at", { withTimezone: true, mode: "string" }),
  hasSite: boolean("has_site").notNull().default(false),
  status: text("status").notNull().default("new"),
  notes: text("notes").notNull().default(""),
  lastContactedAt: timestamp("last_contacted_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const threadsSettings = pgTable("threads_settings", {
  id: integer("id").primaryKey().default(1),
  performerName: text("performer_name").notNull().default(""),
  services: text("services").notNull().default(""),
  prices: text("prices").notNull().default(""),
  timelines: text("timelines").notNull().default(""),
  portfolioUrl: text("portfolio_url").notNull().default(""),
  exampleUrl: text("example_url").notNull().default(""),
  whatsapp: text("whatsapp").notNull().default(""),
  ctaText: text("cta_text").notNull().default(""),
  threadsUserId: text("threads_user_id").notNull().default(""),
  threadsUsername: text("threads_username").notNull().default(""),
  tokenEncrypted: text("token_encrypted").notNull().default(""),
  tokenIv: text("token_iv").notNull().default(""),
  tokenAuthTag: text("token_auth_tag").notNull().default(""),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true, mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const threadsContentPlans = pgTable("threads_content_plans", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  durationDays: integer("duration_days").notNull(),
  postsPerDay: integer("posts_per_day").notNull(),
  niche: text("niche").notNull(),
  city: text("city").notNull().default(""),
  service: text("service").notNull(),
  startDate: timestamp("start_date", { withTimezone: true, mode: "string" }).notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const threadsDrafts = pgTable("threads_drafts", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  contentPlanId: bigint("content_plan_id", { mode: "number" }).references(() => threadsContentPlans.id, { onDelete: "set null" }),
  niche: text("niche").notNull(),
  city: text("city").notNull().default(""),
  service: text("service").notNull(),
  format: text("format").notNull().default("single"),
  goal: text("goal").notNull().default("reach"),
  category: text("category").notNull().default("problem"),
  topic: text("topic").notNull(),
  messages: jsonb("messages").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  firstLines: jsonb("first_lines").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  ctas: jsonb("ctas").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  alternativeText: text("alternative_text").notNull().default(""),
  status: text("status").notNull().default("draft"),
  plannedFor: timestamp("planned_for", { withTimezone: true, mode: "string" }),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "string" }),
  publishedAt: timestamp("published_at", { withTimezone: true, mode: "string" }),
  rootThreadsPostId: text("root_threads_post_id").notNull().default(""),
  threadsPostIds: jsonb("threads_post_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  lastError: text("last_error").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const threadsQueue = pgTable("threads_queue", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  publicationId: bigint("publication_id", { mode: "number" }).notNull().references(() => threadsDrafts.id, { onDelete: "cascade" }),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "string" }).notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true, mode: "string" }),
  lockedAt: timestamp("locked_at", { withTimezone: true, mode: "string" }),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
  lastError: text("last_error").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_threads_queue_publication").on(table.publicationId),
]);

export const threadsAnalytics = pgTable("threads_analytics", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  publicationId: bigint("publication_id", { mode: "number" }).notNull().references(() => threadsDrafts.id, { onDelete: "cascade" }),
  trackingSlug: text("tracking_slug").notNull(),
  destinationUrl: text("destination_url").notNull().default(""),
  views: integer("views").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  replies: integer("replies").notNull().default(0),
  reposts: integer("reposts").notNull().default(0),
  linkClicks: integer("link_clicks").notNull().default(0),
  manualLeads: integer("manual_leads").notNull().default(0),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_threads_analytics_publication").on(table.publicationId),
  uniqueIndex("idx_threads_analytics_slug").on(table.trackingSlug),
]);

export const threadsPublishLogs = pgTable("threads_publish_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  publicationId: bigint("publication_id", { mode: "number" }).references(() => threadsDrafts.id, { onDelete: "cascade" }),
  queueId: bigint("queue_id", { mode: "number" }).references(() => threadsQueue.id, { onDelete: "set null" }),
  level: text("level").notNull().default("info"),
  action: text("action").notNull(),
  message: text("message").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().default(sql`CURRENT_TIMESTAMP`),
});
