# Repository Guidelines

## Project Structure & Module Organization
- `main.go`: application entry point; switches between CLI worker and HTTP server modes.
- `src/`: core service interfaces and orchestration (`TranscriptionService`).
- `pkg/`: infrastructure adapters:
  - `pkg/downloader` (`yt-dlp` wrapper)
  - `pkg/transcriber` (`whisper-cli` wrapper)
  - `pkg/uploader` (blob API client)
  - `pkg/repository` (Postgres + retry-state persistence)
  - `pkg/bootstrap` (env/secret config wiring)
- `worker.mjs`: Cloudflare Worker routing, cron trigger, admin endpoints.
- `docs/openapi.json`: API contract used by `/docs`.
- Tests are colocated as `*_test.go` files.

## Build, Test, and Development Commands
- `go build -o yt-transcribe .`: build the Go binary.
- `go test ./...`: run all Go tests.
- `PORT=3000 go run .`: run local API server.
- `go run . -db`: run one DB-driven batch worker cycle.
- `npm run worker:deploy`: deploy Worker + container config (if package scripts are available).

## Coding Style & Naming Conventions
- Follow idiomatic Go style (`gofmt` formatting, short clear function names, explicit error wrapping).
- Keep packages focused by concern (`repository`, `transcriber`, etc.).
- Use `camelCase` for JS in `worker.mjs`; use descriptive constants for route names and container instance names.
- Prefer small, composable functions and explicit log messages for operational visibility.

## Testing Guidelines
- Use Go’s standard `testing` package.
- Name tests `TestXxx` and place beside implementation (`*_test.go`).
- Cover failure paths heavily (network errors, command failures, retry behavior).
- Before PR: run `go test ./...` and validate key admin routes (`/admin/job-result`, `/admin/state`) in a deployed environment when relevant.

## Commit & Pull Request Guidelines
- Use concise, imperative commit subjects (e.g., `Add Discord alerts for job errors`).
- Keep commits scoped to a single concern when possible.
- PRs should include:
  - What changed and why
  - Config/env var changes (e.g., `WHISPER_THREADS`, `DISCORD_WEBHOOK_URL`)
  - Verification steps and sample outputs
  - Linked issue/ticket when applicable

## Security & Configuration Tips
- Never commit secrets. Use Wrangler secrets/env vars for tokens, DB URLs, and cookie material.
- Treat `YT_DLP` cookies as sensitive credentials; rotate when auth failures reappear.
- Prefer long retry backoff for auth/captcha failures to avoid service hammering.
