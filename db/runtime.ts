import { neon } from "@neondatabase/serverless";

let schemaPromise: Promise<void> | null = null;

function connectionString() {
  const value = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
  if (!value) throw new Error("Database is not configured. Set DATABASE_URL in Vercel.");
  return value;
}

async function initializeSchema() {
  const sql = neon(connectionString());
  await sql`CREATE TABLE IF NOT EXISTS leads (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Кафе',
    city TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    whatsapp TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    instagram TEXT NOT NULL DEFAULT '',
    source_url TEXT NOT NULL DEFAULT '',
    source_id TEXT NOT NULL DEFAULT '',
    rating DOUBLE PRECISION,
    reviews_count INTEGER NOT NULL DEFAULT 0,
    reviews_checked_at TIMESTAMPTZ,
    has_site BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'new',
    notes TEXT NOT NULL DEFAULT '',
    last_contacted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS reviews_count INTEGER NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS reviews_checked_at TIMESTAMPTZ`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_source_id ON leads(source_id) WHERE source_id != ''`;
  await sql`CREATE INDEX IF NOT EXISTS idx_leads_status_city ON leads(status, city)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone) WHERE phone != ''`;
}

export async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = initializeSchema().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}
