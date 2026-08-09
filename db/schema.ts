import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const leads = sqliteTable("leads", {
  id: integer("id").primaryKey({ autoIncrement: true }),
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
  rating: real("rating"),
  hasSite: integer("has_site", { mode: "boolean" }).notNull().default(false),
  status: text("status").notNull().default("new"),
  notes: text("notes").notNull().default(""),
  lastContactedAt: text("last_contacted_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
