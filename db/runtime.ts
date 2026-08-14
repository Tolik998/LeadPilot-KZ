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

  await sql`CREATE TABLE IF NOT EXISTS threads_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    performer_name TEXT NOT NULL DEFAULT '', services TEXT NOT NULL DEFAULT '', prices TEXT NOT NULL DEFAULT '',
    timelines TEXT NOT NULL DEFAULT '', portfolio_url TEXT NOT NULL DEFAULT '', example_url TEXT NOT NULL DEFAULT '',
    whatsapp TEXT NOT NULL DEFAULT '', cta_text TEXT NOT NULL DEFAULT '', threads_user_id TEXT NOT NULL DEFAULT '',
    threads_username TEXT NOT NULL DEFAULT '', token_encrypted TEXT NOT NULL DEFAULT '', token_iv TEXT NOT NULL DEFAULT '',
    token_auth_tag TEXT NOT NULL DEFAULT '', token_expires_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`;
  await sql`INSERT INTO threads_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`;
  await sql`CREATE TABLE IF NOT EXISTS threads_content_plans (
    id BIGSERIAL PRIMARY KEY, duration_days INTEGER NOT NULL, posts_per_day INTEGER NOT NULL,
    niche TEXT NOT NULL, city TEXT NOT NULL DEFAULT '', service TEXT NOT NULL, start_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`;
  await sql`CREATE TABLE IF NOT EXISTS threads_drafts (
    id BIGSERIAL PRIMARY KEY, content_plan_id BIGINT REFERENCES threads_content_plans(id) ON DELETE SET NULL,
    niche TEXT NOT NULL, city TEXT NOT NULL DEFAULT '', service TEXT NOT NULL, format TEXT NOT NULL DEFAULT 'single',
    goal TEXT NOT NULL DEFAULT 'reach', category TEXT NOT NULL DEFAULT 'problem', topic TEXT NOT NULL,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb, first_lines JSONB NOT NULL DEFAULT '[]'::jsonb,
    ctas JSONB NOT NULL DEFAULT '[]'::jsonb, alternative_text TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft',
    planned_for TIMESTAMPTZ, scheduled_at TIMESTAMPTZ, published_at TIMESTAMPTZ,
    root_threads_post_id TEXT NOT NULL DEFAULT '', threads_post_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_error TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`;
  await sql`CREATE TABLE IF NOT EXISTS threads_queue (
    id BIGSERIAL PRIMARY KEY, publication_id BIGINT NOT NULL REFERENCES threads_drafts(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3, next_attempt_at TIMESTAMPTZ, locked_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
    last_error TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_threads_queue_publication ON threads_queue(publication_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_threads_queue_due ON threads_queue(status, scheduled_at, next_attempt_at)`;
  await sql`CREATE TABLE IF NOT EXISTS threads_analytics (
    id BIGSERIAL PRIMARY KEY, publication_id BIGINT NOT NULL REFERENCES threads_drafts(id) ON DELETE CASCADE,
    tracking_slug TEXT NOT NULL, destination_url TEXT NOT NULL DEFAULT '', views INTEGER NOT NULL DEFAULT 0,
    likes INTEGER NOT NULL DEFAULT 0, replies INTEGER NOT NULL DEFAULT 0, reposts INTEGER NOT NULL DEFAULT 0,
    link_clicks INTEGER NOT NULL DEFAULT 0, manual_leads INTEGER NOT NULL DEFAULT 0, last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_threads_analytics_publication ON threads_analytics(publication_id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_threads_analytics_slug ON threads_analytics(tracking_slug)`;
  await sql`CREATE TABLE IF NOT EXISTS threads_publish_logs (
    id BIGSERIAL PRIMARY KEY, publication_id BIGINT REFERENCES threads_drafts(id) ON DELETE CASCADE,
    queue_id BIGINT REFERENCES threads_queue(id) ON DELETE SET NULL, level TEXT NOT NULL DEFAULT 'info',
    action TEXT NOT NULL, message TEXT NOT NULL, details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_threads_drafts_status ON threads_drafts(status, created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_threads_drafts_plan ON threads_drafts(content_plan_id, planned_for)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_threads_logs_publication ON threads_publish_logs(publication_id, created_at DESC)`;
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
