# njmtech.media

A media dashboard for saving and organizing social media video links. Paste a YouTube, TikTok, Instagram, Vimeo, or X/Twitter URL and the app automatically extracts metadata, surfaces any pre-generated transcripts and notes from Blob storage, and uses AI to categorize the content — all without leaving the page.

---

## Features

- **Multi-platform support** — YouTube, TikTok, Instagram, Vimeo, and X/Twitter
- **Two storage modes** — Personal mode uses the shared Neon-backed app data; Public mode keeps media items in encrypted browser storage on the current device
- **Inline playback** — YouTube and TikTok videos play directly in the card; other platforms open in a new tab
- **Metadata extraction** — title, thumbnail, and author pulled via oEmbed (noembed.com)
- **Transcript & notes linking** — automatically checks Vercel Blob for pre-generated `.txt` transcripts and `.md` notes
- **AI categorization** — GPT-4o-mini assigns a primary category and up to 6 tags from the transcript; runs automatically in the background when a transcript is available, or on-demand via the Categorize button
- **Category tabs** — items are grouped into filterable tabs that appear as categories are assigned
- **Persistent storage** — all items stored in a Neon (serverless Postgres) database with upsert on re-submission

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS, shadcn/ui, Framer Motion |
| Database | Neon (serverless Postgres) via `@neondatabase/serverless` |
| Blob storage | Vercel Blob |
| AI | GPT-4o-mini via GitHub Models inference endpoint |
| Metadata | noembed.com oEmbed API |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Neon](https://neon.tech) database
- A [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) store
- A [GitHub Models](https://github.com/marketplace/models) token (for AI categorization)

### Environment Variables

The app supports two modes for secrets:

**Option A — Infisical (recommended for staging/prod)**

Store `POSTGRES_URL`, `BLOB_READ_WRITE_TOKEN`, and `GITHUB_TOKEN` as secrets inside Infisical, then provide only the bootstrap credentials locally:

```env
# .env.local — bootstrap only
INFISICAL_CLIENT_ID=your_machine_identity_client_id
INFISICAL_CLIENT_SECRET=your_machine_identity_client_secret
INFISICAL_PROJECT_ID=your_infisical_project_id
INFISICAL_ENVIRONMENT=dev          # dev | staging | prod (default: dev)
INFISICAL_SITE_URL=                # optional: self-hosted instance URL
```

At server startup, `src/instrumentation.ts` authenticates with Infisical using Universal Auth and injects all project secrets into `process.env` before any requests are handled.

**Option B — plain `.env.local` (local dev without Infisical)**

If none of the `INFISICAL_*` vars are present, the app falls back to whatever is already in the environment:

```env
# .env.local
POSTGRES_URL=your_neon_connection_string
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
GITHUB_TOKEN=your_github_models_token
```

### App Modes

- **Public mode** lives at `/` and is the default experience. It still uses the server for metadata/blob/categorization helpers, but the media records themselves are stored in encrypted browser storage and never written to the app database.
- Public mode also has a **Public settings** dialog where each user can choose their own transcript provider and notes provider, then store the related Blob/API tokens in encrypted browser storage. Once saved, the app caches a restore link and QR code so the same settings can be imported on another browser or device, but restoring them requires the separate passphrase used when the QR code was generated.
- **Personal mode** lives at `/omoinjm`. It uses the normal server-backed flow: metadata is resolved on the server, items are persisted to Neon, blob links are attached, and AI categorization writes back to the shared database row.
- The first visit to `/omoinjm` shows a setup form to create the personal access key. The raw key is never stored; a hash and salt are stored in the database and future visits prompt for that key before the route is unlocked.

### Database Setup

Run the following against your Neon database to create the required table for **Personal mode**:

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

CREATE INDEX IF NOT EXISTS media_items_url_idx      ON media_items (url);
CREATE INDEX IF NOT EXISTS media_items_platform_idx ON media_items (platform);
CREATE INDEX IF NOT EXISTS media_items_category_idx ON media_items (category);
```

Soft-deleted rows remain in `media_items` with `deleted_at` set, but they are filtered out of the dashboard UI.

The application also auto-creates a `personal_access_keys` table on demand for `/omoinjm` access control.

See [`docs/database-schema.md`](./docs/database-schema.md) for full schema documentation.

### Install & Run

```bash
pnpm install
pnpm run dev         # http://localhost:3000 — uses INFISICAL_ENVIRONMENT=dev
pnpm run dev:local   # http://localhost:3000 — uses .env.local directly (no Infisical)
pnpm run build       # production build
pnpm run build:dev   # production build with INFISICAL_ENVIRONMENT=dev
pnpm run build:prod  # production build with INFISICAL_ENVIRONMENT=prod
pnpm run start       # serve production build with INFISICAL_ENVIRONMENT=prod
pnpm run start:local # serve production build — uses .env.local directly
```

---

## Blob Storage Convention

Personal mode looks up transcripts and notes by the following path pattern in Vercel Blob:

```
njmtech-blob-api/yt-transcribe/{platform}/{videoId}/
├── {videoId}.txt   →  transcript
└── {videoId}.md    →  notes
```

Public mode writes newly generated transcript and notes files to:

```
public-media/{platform}/{videoId}/
├── {videoId}.txt   →  transcript
└── {videoId}.md    →  notes
```

If a `.txt` file is present, AI categorization is triggered automatically after a new item is saved or after a transcript is generated.

---

## Project Structure

```
src/
├── app/
│   ├── actions.ts          # Server actions (add item, categorize, fetch by ID)
│   ├── icon.tsx            # Generated favicon (primary color background)
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── AddUrlBar.tsx       # URL input form
│   ├── MediaCard.tsx       # Card with inline player, tags, and action buttons
│   ├── MediaDashboard.tsx  # Grid, category tabs, polling for background categorization
│   └── PlatformIcon.tsx    # Platform badge (YouTube / TikTok / Instagram / X)
├── instrumentation.ts      # Runs loadSecrets() once at server startup
└── lib/
    ├── blob-utils.ts       # Vercel Blob file lookup
    ├── categorize.ts       # GPT-4o-mini categorization
    ├── db.ts               # Neon SQL queries (lazy sql client)
    ├── metadata.ts         # oEmbed fetch + URL platform extraction
    ├── mock-data.ts        # MediaItem type + Platform type
    └── secrets.ts          # Infisical client — fetches and injects secrets
```
