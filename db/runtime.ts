import { env } from "cloudflare:workers";

export async function ensureSchema() {
  const db = env.DB;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      rating REAL,
      has_site INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'new',
      notes TEXT NOT NULL DEFAULT '',
      last_contacted_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_source_id ON leads(source_id) WHERE source_id != ''"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_leads_status_city ON leads(status, city)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone) WHERE phone != ''"),
  ]);
}
