# Project Context: njmtech-media

You are an expert full-stack developer working on **njmtech-media**, a modern media dashboard for managing and exploring social media content. This document provides a comprehensive overview of the project setup, architecture, and conventions.

## 1. Project Overview
- **Purpose**: A fast, interactive dashboard to organize YouTube, TikTok, Instagram, Twitter/X, and Vimeo links.
- **Core Value**: Automated metadata extraction, AI-powered categorization, and a cosmic force-directed graph for exploration.
- **Key Modes**:
  - **Public Mode (`/`)**: Privacy-first. Media records are stored in encrypted browser storage (IndexedDB/LocalStorage). AI transcripts/notes are stored in public Vercel Blob paths.
  - **Personal Mode (`/omoinjm`)**: Persistence-first. Uses a Neon (Postgres) database for storage. Protected by a hashed access key.
  - **Setup Mode (`/setup`)**: Utility route to restore public mode configurations via shareable links/QR codes.

## 2. Tech Stack
- **Framework**: Next.js 15 (App Router) with React 19.
- **Language**: TypeScript (Strict mode, SOLID principles).
- **Styling**: Tailwind CSS, shadcn/ui components, Framer Motion for animations.
- **Database**: Neon (Serverless Postgres) via `@neondatabase/serverless`.
- **Secret Management**: Infisical (integrated via `src/instrumentation.ts` in dev).
- **Storage**: Vercel Blob for transcripts (`.txt`) and AI notes (`.md`).
- **AI Stack**: 
  - **Models**: GPT-4o-mini (primarily via GitHub Models).
  - **Tasks**: Categorization, tagging, transcript analysis, and Q&A.
- **Visualization**: `react-force-graph-2d` (D3-powered).
- **Testing**: Playwright for E2E testing.

## 3. Core Architecture

### Directory Structure (`src/`)
- `app/`: Next.js 15 routes and layouts.
  - `actions/`: Server actions split by domain (media, ai, categorize, auth).
  - `omoinjm/`: Protected personal dashboard.
  - `setup/`: Configuration restoration.
- `components/`:
  - `GraphView/`: Heavy logic for D3/Canvas graph rendering.
  - `shared/`: High-level dashboard components (AIPanel, MediaCard, AddUrlBar).
  - `ui/`: Base shadcn/ui primitives.
- `hooks/`: Domain-specific React hooks (`useTranscript`, `useNotes`, `useViewMode`).
- `lib/`: 
  - `db.ts`: Neon database client and cached queries.
  - `env.ts`: Type-safe environment variable access.
  - `metadata.ts`: Platform-specific scraping/oEmbed logic.
  - `secrets.ts`: Infisical bootstrap logic.
  - `graph/`: Canvas drawing helpers.
- `types/`: Centralized TypeScript interfaces (matches DB schema and UI state).

### Data Flow (Submission)
1. **Extraction**: `extractPlatformAndId` parses the URL into `platform` and `videoId`.
2. **Metadata**: `fetchVideoMeta` uses `noembed.com` or platform-specific APIs for titles and thumbnails.
3. **Blob Check**: `checkBlobFiles` looks for existing transcript/notes in Vercel Blob.
4. **Persistence**:
   - *Personal*: `dbUpsertMediaItem` writes to Neon.
   - *Public*: Saved to local storage via client-side hooks.
5. **AI Enrichment**: If a transcript exists, `categorizeTranscript` triggers GPT-4o-mini to assign a category and tags.

## 4. Database Schema (Neon)
- **`media_items`**: Main table for Personal mode. Key fields: `url` (unique), `platform`, `video_id`, `transcript_url`, `notes_url`, `category`, `tags` (TEXT[]).
- **`personal_access_keys`**: Stores hashed keys (`slot`, `salt`, `key_hash`) for route protection.

## 5. Environment & Secrets
- **Required**: `POSTGRES_URL` (Neon), `GITHUB_TOKEN` (AI Models).
- **Infisical (Dev)**: Provide `INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`, and `INFISICAL_PROJECT_ID` to sync secrets automatically at startup.
- **Fallback**: Uses standard `.env.local` if Infisical vars are missing.

## 6. Development Conventions
- **Server Actions**: Preferred over API routes for data mutations.
- **Caching**: Uses `unstable_cache` with tags (`media`) for DB reads; `revalidateTag` for mutations.
- **UI/UX**: Dark mode by default (`next-themes`). High-performance graph rendering (D3 + Canvas).
- **Error Handling**: Graceful fallbacks for metadata extraction (e.g., "Untitled" video if oEmbed fails).

## 7. Commands
- `pnpm dev`: Start development server with Turbopack and Infisical.
- `pnpm build`: Production build.
- `pnpm lint`: Run ESLint.
- `pnpm test`: Run Playwright E2E tests.
