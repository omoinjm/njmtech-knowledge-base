-- njmtech-media D1 schema (SQLite). Fresh start — no migration from the
-- retired Neon/Postgres database. Applied once via:
--   wrangler d1 execute njmtech-media --remote --file=schema.d1.sql

CREATE TABLE IF NOT EXISTS knowledge_bases (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_items (
  id TEXT PRIMARY KEY,
  knowledge_base_id TEXT NOT NULL,
  url TEXT NOT NULL,
  platform TEXT NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  author_name TEXT,
  transcript_url TEXT,
  notes_url TEXT,
  category TEXT,
  tags TEXT, -- JSON-serialized array (D1/SQLite has no native array type)
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS media_items_knowledge_base_url_idx
  ON media_items (knowledge_base_id, url);

CREATE TABLE IF NOT EXISTS personal_access_keys (
  slot TEXT PRIMARY KEY,
  salt TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
