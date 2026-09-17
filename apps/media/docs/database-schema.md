# Database Schema — Media Hub Studio

> **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite)
> **Access**: Cloudflare D1 REST API (`src/lib/d1.ts`) — media runs as a
> plain Node/Docker container, not a Cloudflare Worker, so it has no native
> D1 binding and talks to D1 over HTTPS instead.
> **Env vars**: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_D1_API_TOKEN`
> **Local dev fallback**: when those vars are unset, `src/lib/d1.ts` runs the same
> SQL against a local SQLite file (`env.localD1Path`, default `.data/local-d1.sqlite`,
> gitignored) via Node's built-in `node:sqlite` — no cloud calls, no separate driver.

---

## Overview

Personal mode uses the database for two things:

1. `media_items` stores saved personal video links.
2. `personal_access_keys` stores the hashed access key for the protected `/omoinjm` route.

When a user submits a URL in Personal mode, the server action (`addMediaItem`) resolves metadata, checks object storage for pre-generated transcript/notes files, persists the record in `media_items`, and optionally runs AI categorization in the background.

Public mode does not write media rows to this table; it stores media items in encrypted browser storage instead. Public-mode storage/API credentials and AI keys are also kept in encrypted browser storage, and generated transcript/notes files are uploaded to `public-media/{platform}/{videoId}/` in object storage.

```
URL submitted
     │
     ▼
extractPlatformAndId()  ──►  platform + videoId
     │
     ▼
fetchVideoMeta()  (noembed.com oEmbed)  ──►  title, thumbnailUrl, authorName
     │
     ▼
checkBlobFiles()  (object storage)  ──►  transcriptUrl, notesUrl
     │
     ▼
dbUpsertMediaItem()  ──►  INSERT / UPDATE  media_items
     │
     ▼  (if transcriptUrl exists)
categorizeTranscript()  (GPT-4o-mini)  ──►  dbUpdateCategory()
```

---

## Table: `knowledge_bases`

### DDL

```sql
CREATE TABLE knowledge_bases (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

`id` is a v4 UUID generated in application code (`crypto.randomUUID()`) — D1/SQLite has no `gen_random_uuid()` default, so it's always supplied explicitly on insert. `created_at`/`updated_at` are ISO 8601 strings generated in application code (`new Date().toISOString()`), not SQL-side defaults — this keeps timestamp formatting unambiguous and reliably parseable, since D1/SQLite has no native `TIMESTAMPTZ` type.

---

## Table: `media_items`

### DDL

```sql
CREATE TABLE media_items (
  id                TEXT PRIMARY KEY,
  knowledge_base_id TEXT NOT NULL,
  url               TEXT NOT NULL,
  platform          TEXT NOT NULL,
  video_id          TEXT NOT NULL,
  title             TEXT NOT NULL,
  thumbnail_url     TEXT,
  author_name       TEXT,
  transcript_url    TEXT,
  notes_url         TEXT,
  category          TEXT,
  tags              TEXT, -- JSON-serialized array
  created_at        TEXT NOT NULL,
  deleted_at        TEXT
);

CREATE UNIQUE INDEX media_items_knowledge_base_url_idx
  ON media_items (knowledge_base_id, url);
```

### Column Reference

| Column             | Type   | Nullable | Description |
|---------------------|--------|----------|-------------|
| `id`                | `TEXT` | NO       | Unique row identifier (UUID string, generated in app code). |
| `knowledge_base_id` | `TEXT` | NO       | Which knowledge base this item belongs to. Part of the dedup key (unique with `url`). |
| `url`               | `TEXT` | NO       | Original submitted video URL. Unique per knowledge base — used as the dedup key on upsert. |
| `platform`          | `TEXT` | NO       | Detected platform. See [Platform Values](#platform-values). |
| `video_id`          | `TEXT` | NO       | Platform-native video identifier extracted from the URL. |
| `title`             | `TEXT` | NO       | Video title from noembed.com oEmbed response. Defaults to `"Untitled"` if oEmbed fails. |
| `thumbnail_url`     | `TEXT` | YES      | Thumbnail image URL from oEmbed response. |
| `author_name`       | `TEXT` | YES      | Channel / account name from oEmbed response. |
| `transcript_url`    | `TEXT` | YES      | Absolute URL to the `.txt` transcript file in object storage. `NULL` if not yet generated. |
| `notes_url`         | `TEXT` | YES      | Absolute URL to the `.md` notes file in object storage. `NULL` if not yet generated. |
| `category`          | `TEXT` | YES      | AI-assigned primary category (max 60 chars). Set asynchronously after insert. |
| `tags`              | `TEXT` | YES      | AI-assigned tags, JSON-serialized array (up to 6 items). Parsed back to `string[]` in `rowToItem()`. |
| `created_at`        | `TEXT` | NO       | ISO 8601 row creation timestamp. Used for default sort order (`ORDER BY created_at DESC`). |
| `deleted_at`        | `TEXT` | YES      | Soft-delete marker (ISO 8601). Rows with a value here stay in the database but are hidden from normal dashboard reads. |

---

## Table: `personal_access_keys`

### DDL

```sql
CREATE TABLE personal_access_keys (
  slot       TEXT PRIMARY KEY,
  salt       TEXT NOT NULL,
  key_hash   TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Purpose

- The app uses this table to protect the `/omoinjm` route.
- The first visit to `/omoinjm` can create the initial key through the in-app setup flow.
- The raw key is never stored. Verification is done by hashing the submitted key with the stored salt and comparing it to `key_hash`.

---

## Platform Values

Detected by `extractPlatformAndId()` in `src/lib/metadata.ts` via URL pattern matching.

| Value         | Source URL Pattern | Example `video_id` format |
|---------------|--------------------|---------------------------|
| `youtube`     | `youtube.com/watch?v=`, `youtube.com/shorts/`, `youtu.be/` | `dQw4w9WgXcQ` (11 chars) |
| `instagram`   | `instagram.com/reel/`, `instagram.com/p/` | `C1a2b3D4e5F` |
| `tiktok`      | `tiktok.com/@{user}/video/` | `7301234567890123456` (numeric) |
| `twitter`     | `twitter.com/{user}/status/`, `x.com/{user}/status/` | `1234567890123456789` (numeric) |
| `vimeo`       | `vimeo.com/{id}`, `vimeo.com/video/{id}`, `vimeo.com/channels/{ch}/{id}` | `123456789` (numeric) |
| `unknown`     | Any URL that doesn't match above | 11-char UUID slice |

---

## Blob Storage Layout

Blob files are stored in object storage under the following path convention (checked by `checkBlobFiles()` in `src/lib/blob-utils.ts`):

```
njmtech-blob-api/yt-transcribe/{platform}/{videoId}/
├── {videoId}.txt   →  transcript_url
└── {videoId}.md    →  notes_url
```

- A `.txt` file presence sets `transcript_url` and triggers AI categorization.
- A `.md` file presence sets `notes_url`.
- Both are optional — records can be saved without either.

---

## Category Values

Assigned by `categorizeTranscript()` in `src/lib/categorize.ts` using `gpt-4o-mini` via the GitHub Models inference endpoint. The model is prompted to return one of these suggested categories (but may produce variations):

| Category              |
|-----------------------|
| Business & Sales      |
| Technology            |
| Personal Development  |
| Entertainment         |
| Health & Fitness      |
| Education             |
| Finance               |
| Marketing             |

Category is capped at **60 characters**. Tags are lowercase, 1–2 words, and capped at **6 per item**.

---

## Key Queries

All queries run through the tagged-template `sql` helper in `src/lib/d1.ts`, which mirrors the Neon driver's calling convention (`sql\`SELECT ... WHERE id = ${id}\``) but sends the statement + bound params to D1's REST API instead of a direct Postgres connection.

### Fetch all items in a knowledge base (default view)
```sql
SELECT id, knowledge_base_id, url, platform, video_id, title, thumbnail_url, author_name,
       transcript_url, notes_url, category, tags, created_at, deleted_at
FROM media_items
WHERE knowledge_base_id = ? AND deleted_at IS NULL
ORDER BY created_at DESC;
```

### Lookup by URL (dedup check before insert)
```sql
SELECT * FROM media_items WHERE knowledge_base_id = ? AND url = ? AND deleted_at IS NULL;
```

### Upsert on submission
```sql
INSERT INTO media_items (id, knowledge_base_id, url, platform, video_id, title, thumbnail_url, author_name, transcript_url, notes_url, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (knowledge_base_id, url) DO UPDATE SET
  platform       = excluded.platform,
  video_id       = excluded.video_id,
  title          = excluded.title,
  thumbnail_url  = excluded.thumbnail_url,
  author_name    = excluded.author_name,
  transcript_url = excluded.transcript_url,
  notes_url      = excluded.notes_url,
  deleted_at     = NULL
RETURNING *;
```

### Soft delete from the UI
```sql
UPDATE media_items
SET deleted_at = ?
WHERE id = ? AND deleted_at IS NULL;
```

### Update category and tags after AI classification
```sql
UPDATE media_items
SET category = ?, tags = ?
WHERE id = ?;
```

---

## TypeScript Interface

Defined in `src/types/media.ts`. Maps directly to the DB row via `rowToItem()` in `src/lib/db.ts`.

```typescript
export type Platform = "youtube" | "tiktok" | "instagram" | "twitter" | "unknown";

export interface MediaItem {
  id: string;
  knowledgeBaseId: string;
  url: string;
  platform: Platform;
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  authorName: string | null;
  transcriptUrl: string | null;
  notesUrl: string | null;
  category: string | null;
  tags: string[];       // parsed from the tags TEXT column (JSON array)
  createdAt: string;    // ISO date, sliced to YYYY-MM-DD
}
```

---

## Notes

- `tags` is stored as JSON-serialized `TEXT` and parsed/serialized at the application boundary (`rowToItem()` / `dbUpdateCategory()`) — D1/SQLite has no native array type.
- `id`, `created_at`, `updated_at` are always generated in application code (`crypto.randomUUID()`, `new Date().toISOString()`), never left to SQL-side defaults.
- `created_at` is truncated to `YYYY-MM-DD` in `rowToItem()` before being exposed to the UI.
- The upsert strategy means re-submitting a URL refreshes metadata (title, thumbnail, blob URLs) but **preserves** `category` and `tags` unless `dbUpdateCategory` is called again.
- Re-submitting a soft-deleted URL clears `deleted_at`, so the existing row reappears instead of creating a duplicate.
- Schema is applied once via `wrangler d1 execute njmtech-media --remote --file=schema.d1.sql`; `ensureSchema()` in `db.ts` also runs the same `CREATE TABLE IF NOT EXISTS` statements at app startup as a safety net.
