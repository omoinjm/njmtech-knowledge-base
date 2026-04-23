# Database Schema — Media Hub Studio

> **Database**: [Neon](https://neon.tech) (serverless Postgres)  
> **Driver**: `@neondatabase/serverless` via `neon()` tagged-template SQL client  
> **Env var**: `POSTGRES_URL`

---

## Overview

Personal mode uses the database for two things:

1. `media_items` stores saved personal video links.
2. `personal_access_keys` stores the hashed access key for the protected `/omoinjm` route.

When a user submits a URL in Personal mode, the server action (`addMediaItem`) resolves metadata, checks Vercel Blob storage for pre-generated transcript/notes files, persists the record in `media_items`, and optionally runs AI categorization in the background.

Public mode does not write media rows to this table; it stores media items in encrypted browser storage instead. Public-mode Blob tokens and AI keys are also kept in encrypted browser storage, and generated transcript/notes files are uploaded to `public-media/{platform}/{videoId}/` in Vercel Blob.

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
checkBlobFiles()  (Vercel Blob)  ──►  transcriptUrl, notesUrl
     │
     ▼
dbUpsertMediaItem()  ──►  INSERT / UPDATE  media_items
     │
     ▼  (if transcriptUrl exists)
categorizeTranscript()  (GPT-4o-mini)  ──►  dbUpdateCategory()
```

---

## Table: `media_items`

### DDL

```sql
CREATE TABLE media_items (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  url           TEXT        NOT NULL UNIQUE,
  platform      TEXT        NOT NULL,
  video_id      TEXT        NOT NULL,
  title         TEXT        NOT NULL,
  thumbnail_url TEXT,
  author_name   TEXT,
  transcript_url TEXT,
  notes_url     TEXT,
  category      TEXT,
  tags          TEXT[],
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
```

### Column Reference

| Column          | Type          | Nullable | Default                    | Description |
|-----------------|---------------|----------|----------------------------|-------------|
| `id`            | `TEXT`        | NO       | `gen_random_uuid()::text`  | Unique row identifier (UUID string). |
| `url`           | `TEXT`        | NO       | —                          | Original submitted video URL. Must be unique — used as the dedup key on upsert. |
| `platform`      | `TEXT`        | NO       | —                          | Detected platform. See [Platform Values](#platform-values). |
| `video_id`      | `TEXT`        | NO       | —                          | Platform-native video identifier extracted from the URL. Falls back to a random 11-char UUID slice for unknown platforms. |
| `title`         | `TEXT`        | NO       | —                          | Video title from noembed.com oEmbed response. Defaults to `"Untitled"` if oEmbed fails. |
| `thumbnail_url` | `TEXT`        | YES      | `NULL`                     | Thumbnail image URL from oEmbed response. |
| `author_name`   | `TEXT`        | YES      | `NULL`                     | Channel / account name from oEmbed response. |
| `transcript_url`| `TEXT`        | YES      | `NULL`                     | Absolute URL to the `.txt` transcript file in Vercel Blob. `NULL` if not yet generated. |
| `notes_url`     | `TEXT`        | YES      | `NULL`                     | Absolute URL to the `.md` notes file in Vercel Blob. `NULL` if not yet generated. |
| `category`      | `TEXT`        | YES      | `NULL`                     | AI-assigned primary category (max 60 chars). Set asynchronously after insert. See [Category Values](#category-values). |
| `tags`          | `TEXT[]`      | YES      | `NULL`                     | AI-assigned tags array (up to 6 items, lowercase, 1-2 words each). Set asynchronously after insert. |
| `created_at`    | `TIMESTAMPTZ` | NO       | `now()`                    | Row creation timestamp. Used for default sort order (`ORDER BY created_at DESC`). |
| `deleted_at`    | `TIMESTAMPTZ` | YES      | `NULL`                     | Soft-delete marker. Rows with a value here stay in the database but are hidden from normal dashboard reads. |

### Indexes & Constraints

```sql
-- Enforced by PRIMARY KEY
-- url uniqueness drives the ON CONFLICT upsert strategy
ALTER TABLE media_items ADD CONSTRAINT media_items_url_key UNIQUE (url);

-- Recommended index for URL lookups (used by dbGetByUrl on every submission)
CREATE INDEX IF NOT EXISTS media_items_url_idx ON media_items (url);

-- Optional: index for filtering by platform or category
CREATE INDEX IF NOT EXISTS media_items_platform_idx ON media_items (platform);
CREATE INDEX IF NOT EXISTS media_items_category_idx ON media_items (category);
```

---

## Table: `personal_access_keys`

### DDL

```sql
CREATE TABLE personal_access_keys (
  slot       TEXT PRIMARY KEY,
  salt       TEXT NOT NULL,
  key_hash   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

Blob files are stored in Vercel Blob under the following path convention (checked by `checkBlobFiles()` in `src/lib/blob-utils.ts`):

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

### Fetch all items (default view)
```sql
SELECT id, url, platform, video_id, title, thumbnail_url, author_name,
       transcript_url, notes_url, category, tags, created_at
FROM media_items
WHERE deleted_at IS NULL
ORDER BY created_at DESC;
```

### Lookup by URL (dedup check before insert)
```sql
SELECT * FROM media_items WHERE url = $1 AND deleted_at IS NULL;
```

### Upsert on submission
```sql
INSERT INTO media_items (url, platform, video_id, title, thumbnail_url, author_name, transcript_url, notes_url)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (url) DO UPDATE SET
  platform       = EXCLUDED.platform,
  video_id       = EXCLUDED.video_id,
  title          = EXCLUDED.title,
  thumbnail_url  = EXCLUDED.thumbnail_url,
  author_name    = EXCLUDED.author_name,
  transcript_url = EXCLUDED.transcript_url,
  notes_url      = EXCLUDED.notes_url,
  deleted_at     = NULL
RETURNING *;
```

### Soft delete from the UI
```sql
UPDATE media_items
SET deleted_at = NOW()
WHERE id = $1 AND deleted_at IS NULL;
```

### Update category and tags after AI classification
```sql
UPDATE media_items
SET category = $1, tags = $2
WHERE id = $3;
```

---

## TypeScript Interface

Defined in `src/types/media.ts`. Maps directly to the DB row via `rowToItem()` in `src/lib/db.ts`.

```typescript
export type Platform = "youtube" | "tiktok" | "instagram" | "twitter" | "unknown";

export interface MediaItem {
  id: string;            // maps to id
  url: string;           // maps to url
  platform: Platform;    // maps to platform
  videoId: string;       // maps to video_id
  title: string;         // maps to title
  thumbnailUrl: string | null;   // maps to thumbnail_url
  authorName: string | null;     // maps to author_name
  transcriptUrl: string | null;  // maps to transcript_url
  notesUrl: string | null;       // maps to notes_url
  category: string | null;       // maps to category
  tags: string[];                // maps to tags (null coalesced to [])
  createdAt: string;             // maps to created_at (ISO date, sliced to YYYY-MM-DD)
}
```

---

## Notes

- `tags` is stored as a native Postgres `TEXT[]` array. The Neon driver serializes it automatically.
- `created_at` is truncated to `YYYY-MM-DD` in `rowToItem()` before being exposed to the UI.
- Cache invalidation uses Next.js `revalidateTag("media")` — the cache tag `"media"` corresponds to the `getMediaItems` cached function.
- The upsert strategy means re-submitting a URL refreshes metadata (title, thumbnail, blob URLs) but **preserves** `category` and `tags` unless `dbUpdateCategory` is called again.
- Re-submitting a soft-deleted URL clears `deleted_at`, so the existing row reappears instead of creating a duplicate.
