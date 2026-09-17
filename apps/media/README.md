# njmtech-media

A modern, fast dashboard for managing and exploring social media content. Supports YouTube, TikTok, Instagram, Twitter/X, and Vimeo.

## Key Features

- **Multi-platform support** — Add links from any supported platform and get instant metadata (thumbnails, titles, authors)
- **AI Categorization** — Automatically assigns categories and tags to items using GPT-4o-mini
- **Interactive Graph** — Explore your media collection in a cosmic, force-directed graph view
- **Personal & Public Modes** — Keep your data in a private Cloudflare D1 database, or use browser-only mode with encrypted local storage
- **AI-Powered Exploration** — Generate transcripts and structured notes, then ask questions about specific videos using AI question pills

## Tech Stack

- **Next.js 15 (App Router)**
- **React 19**
- **TypeScript** (fully refactored with SOLID principles)
- **Tailwind CSS** + **shadcn/ui**
- **Cloudflare D1** (SQLite) via the D1 REST API (`src/lib/d1.ts`)
- **Infisical** (Secret management)
- **OpenAI / Anthropic / Groq / Gemini** (AI integrations)
- **Framer Motion** (Animations)
- **react-force-graph-2d** (D3-powered graph)

## Getting Started

### Prerequisites

- Node.js 18+
- A [Cloudflare D1](https://developers.cloudflare.com/d1/) database, and a Cloudflare API token scoped to D1 edit
- A [GitHub Models](https://github.com/marketplace/models) token (for AI categorization)

### Environment Variables

The app supports two modes for secrets:

**Option A — Infisical (recommended for staging/prod)**

Store `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_D1_API_TOKEN`, and `GITHUB_TOKEN` as secrets inside Infisical, then provide only the bootstrap credentials locally:

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
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_D1_DATABASE_ID=your_d1_database_id
CLOUDFLARE_D1_API_TOKEN=your_d1_scoped_api_token
GITHUB_TOKEN=your_github_models_token
```

**Option C — local SQLite replica (fully offline dev)**

If none of the `CLOUDFLARE_D1_*` vars are set (e.g. `pnpm dev:local` once the `dev` Infisical environment no longer carries them), `src/lib/d1.ts` falls back to a local SQLite file at `.data/local-d1.sqlite` instead of calling the D1 REST API — same schema, same query helper, no cloud calls. It's created on first use and is gitignored. Uses Node's built-in `node:sqlite` (Node 22+ required for this path; the Docker/prod image is unaffected since it always has real D1 creds).

### App Modes

- **Public mode** lives at `/` and is the default experience. It still uses the server for metadata/blob/categorization helpers, but the media records themselves are stored in encrypted browser storage and never written to the app database.
- **Personal mode** lives at `/omoinjm`. It uses the normal server-backed flow: metadata is resolved on the server, items are persisted to Cloudflare D1 (via the D1 REST API — see `docs/database-schema.md`), and AI categorization writes back to the shared database row.
- **Setup mode** lives at `/setup`. It allows restoring Public mode settings from a shared link or QR code.

## Project Structure (src/)

```
src/
├── app/
│   ├── actions/           # Split server actions (media, ai, categorize, auth)
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Public mode dashboard
│   ├── omoinjm/           # Personal mode routes
│   └── setup/             # Public settings restore route
├── components/
│   ├── GraphView/         # Logic-heavy graph components
│   ├── shared/            # Shared components (AIPanel, etc.)
│   ├── ui/                # Minimal shadcn/ui components
│   ├── AddUrlBar.tsx      # URL entry component
│   └── MediaDashboard.tsx # Orchestrator component
├── hooks/                 # Custom hooks (useTranscript, useNotes, etc.)
├── lib/
│   ├── graph/             # D3/Canvas graph drawing logic
│   ├── db.ts              # Database client and queries
│   ├── env.ts             # Type-safe environment access
│   ├── metadata.ts        # Metadata extraction
│   └── secrets.ts         # Infisical integration
└── types/                 # Centralized TypeScript definitions
```
