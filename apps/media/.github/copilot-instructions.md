# Copilot Instructions

## Build, lint, and test commands

- Install dependencies with `pnpm install`.
- Start local development with `pnpm run dev` (sets `INFISICAL_ENVIRONMENT=dev`) or `pnpm run dev:local` (uses local env only).
- Build with `pnpm run build`, `pnpm run build:dev`, or `pnpm run build:prod`.
- Serve a production build with `pnpm run start` or `pnpm run start:local`.
- Lint with `pnpm run lint`.
- Playwright is configured in `playwright.config.ts` with `testDir: "./src/test"` and a Chromium project. Run all tests with `pnpm exec playwright test`.
- Run a single Playwright spec with `pnpm exec playwright test src/test/<spec>.ts --project=chromium`.
- Run a single Playwright test by name with `pnpm exec playwright test -g "<test name>" --project=chromium`.
- There are currently no committed test files under `src/test`.

## MCP servers

- Playwright MCP is relevant for this repository. Use it against `http://localhost:3000`, which matches the configured `baseURL` in `playwright.config.ts`.
- It is especially useful for validating the dashboard submission flow, category-tab filtering, platform badges/icons, and inline player behavior in `MediaCard`.
- If a UI bug appears only after server actions complete, start the app first with `pnpm run dev` or `pnpm run dev:local`, then reproduce it through Playwright instead of relying only on static code inspection.

## High-level architecture

- This is a Next.js 15 App Router app. `/` is the Public route and renders `MediaDashboard` in public mode. `/omoinjm` is the Personal route and only renders personal dashboard data after access is verified.
- `src/app/layout.tsx` wraps the app in `Providers`, `Toaster`, and `Sonner`. `src/components/Providers.tsx` currently sets up the shared React Query client and Radix tooltip provider for the whole app.
- `MediaDashboard` receives a fixed `mode` prop from the route. Do not reintroduce a client-side mode switch unless the route model changes again.
- `/omoinjm` is protected by a DB-backed hashed key. The first visit uses `PersonalAccessGate` to create the initial key, and later visits use the same gate to verify it. Server actions set an auth cookie scoped to `/omoinjm` after successful setup/login.
- The main submission flow spans client and server:
  1. `AddUrlBar` collects a URL and `MediaDashboard` calls `addMediaItem()`.
  2. `addMediaItem()` resolves metadata with `fetchVideoMeta()` in `src/lib/metadata.ts`.
  3. It checks Vercel Blob for transcript and notes files with `checkBlobFiles()` in `src/lib/blob-utils.ts`.
  4. It persists the record in Neon with `dbUpsertMediaItem()` in `src/lib/db.ts`.
  5. If a transcript exists, it kicks off background categorization with `categorizeTranscript()` in `src/lib/categorize.ts` and then writes category/tags back with `dbUpdateCategory()`.
- Public mode reuses the same metadata/blob/categorization helpers through `preparePublicMediaItem()` and `categorizeTranscriptAction()`, persists the resulting `MediaItem` objects in encrypted browser storage via `src/lib/public-media-storage.ts`, and stores Blob/API credentials in encrypted browser storage via `src/lib/guest-config.ts`.
- Rendering is split between server-fetched initial state and client-side updates. The page fetches the first item list on the server, then `MediaDashboard` owns local item state, tab derivation, error state, and the polling loop for background categorization results.
- The client is intentionally optimistic only for manual categorization. Automatic categorization after add is async, so `MediaDashboard` polls `getMediaItemById()` every 4 seconds for up to 15 attempts until `category` is populated.
- `MediaCard` is where platform-specific playback behavior lives. YouTube, TikTok, and Vimeo use inline embeds; other platforms fall back to opening the original URL in a new tab. Platform badge labels/icons come from `src/components/PlatformIcon.tsx`.
- Secrets are loaded at Node startup through `src/instrumentation.ts`, which calls `loadSecrets()` from `src/lib/secrets.ts`. The app uses the Infisical SDK directly; the package scripts do not shell out to an Infisical CLI.
- `src/lib/db.ts` lazy-initializes the Neon SQL client so `POSTGRES_URL` can be injected by instrumentation before first DB access. In development it overrides Neon fetch behavior to force IPv4 resolution.
- `src/lib/db.ts` also owns the personal-access schema and verification helpers. The personal route key is stored as a hash plus salt in the database, not in environment variables or local storage.
- Personal-mode blob lookups follow `njmtech-blob-api/yt-transcribe/{platform}/{videoId}/`. Public-mode generated transcript and notes uploads go to `public-media/{platform}/{videoId}/`.
- Thumbnail rendering depends on `next/image` plus the remote host allowlist in `next.config.ts`, so metadata, blob URLs, and image config have to stay aligned when new platforms or thumbnail sources are added.
- `src/lib/secure-local-storage.ts` is the shared encryption helper for browser-stored data. `guest-config.ts` and `public-media-storage.ts` both build on it rather than implementing separate crypto logic.

## Key conventions

- `media_items.url` is the dedupe key. Re-submitting the same URL should refresh `platform`, `video_id`, title, thumbnail, author, transcript URL, and notes URL through the upsert path instead of creating a second row.
- Public mode also dedupes by URL. Re-submitting the same URL should restore a previously hidden local item instead of creating a second encrypted local record.
- Personal route access depends on the `personal_access_keys` table and the `/omoinjm` auth cookie. If you change the route name or auth flow, update both together.
- Existing rows with `platform === "unknown"` are intentionally reprocessed in `addMediaItem()` so better URL detection can self-heal old data.
- `Platform` and `MediaItem` are centralized in `src/lib/mock-data.ts`. Keep that union in sync with URL extraction in `src/lib/metadata.ts`, icon rendering in `src/components/PlatformIcon.tsx`, blob path usage, and embed handling in `src/components/MediaCard.tsx`.
- Server-side list reads use `unstable_cache(..., { tags: ["media"] })`. Mutations that should refresh the dashboard call `revalidateTag("media")`. `categorizeItem()` intentionally skips revalidation because the caller updates local state directly.
- Interactive components must stay client components. Existing patterns use `"use client"` for hook-based UI like `MediaDashboard`, `MediaCard`, `Providers`, and shadcn wrappers that depend on client-only behavior.
- If you add a new thumbnail host or remote image source, update `images.remotePatterns` in `next.config.ts` or `next/image` will fail at runtime.
- `rowToItem()` in both DB modules is the canonical DB-to-UI mapping. `created_at` is exposed to the UI as a `YYYY-MM-DD` string, and nullable Postgres `tags` become `[]`.
