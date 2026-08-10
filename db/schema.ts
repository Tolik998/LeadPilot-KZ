import { sql } from "drizzle-orm";
import { bigserial, boolean, doublePrecision, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

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
