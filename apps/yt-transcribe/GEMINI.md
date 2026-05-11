# GEMINI Instructions: yt-transcribe

This project is a Go-based transcription service that downloads audio from various platforms (YouTube, Instagram, etc.), transcribes it using `whisper.cpp`, and uploads the result to a blob storage. It is designed to run in multiple modes: as a CLI tool, a database-driven worker, or an HTTP API. It is optimized for deployment on Cloudflare via Workers and Containers.

## Project Overview

- **Core Logic:** Go (1.25+), structured using a service/provider pattern.
- **Transcriber:** `whisper.cpp` (C++ based CLI integrated via shell execution).
- **Downloader:** `yt-dlp` and `ffmpeg`.
- **Storage:** Cloudflare R2 / S3-compatible storage via the `upload-blob` API.
- **Database:** PostgreSQL (for job tracking and state management).
- **Orchestration:** Cloudflare Workers (as a proxy and cron trigger) and Cloudflare Containers (for the heavy-lifting Go worker/API).
- **Secrets:** Infisical integration for secret management, with fallback to environment variables.

## Building and Running

The project uses `nx` for task orchestration, but can also be managed via standard Go commands or provided scripts.

### Build
```bash
# Using Nx
npm run build
# OR
nx build yt-transcribe

# Using Go directly
go build -o yt-transcribe .

# Including Infisical support
go build -tags=infisical -o yt-transcribe .
```

### Test
```bash
# Using Nx
npm run test
# OR
nx test yt-transcribe

# Using Go directly
go test ./...

# Using helper script
bash scripts/build_and_test.sh
```

### Run
The application behavior is determined by flags and environment variables.

#### CLI Modes
- **Single URL:** `./yt-transcribe -url "https://..."`
- **DB Worker:** `./yt-transcribe -db` (fetches next job from Postgres)
- **Reprocess:** `./yt-transcribe -reprocess-all` (re-transcribes all DB records)

#### Server Mode
When the `PORT` environment variable is set, the application starts as an HTTP API server.
```bash
PORT=3000 ./yt-transcribe
# OR
npm run serve
```

### Deployment
- **Cloudflare Worker:** `npm run worker:deploy`
- **Docker:** Build via `Dockerfile`. Multi-stage build bundles all dependencies (`ffmpeg`, `yt-dlp`, `whisper.cpp`).
- **VPS:** Use `bash scripts/setup-vps.sh` for automated Docker-based setup on a fresh server.

## Architecture and Conventions

### Directory Structure
- `/main.go`: Entry point, handles flag parsing and mode selection.
- `/src/`: Core business logic and interface definitions (`TranscriptionService`).
- `/pkg/`: Provider implementations and infrastructure code.
    - `api/`: HTTP handlers for the API mode.
    - `bootstrap/`: Service initialization and configuration loading.
    - `downloader/`: `yt-dlp` wrapper.
    - `repository/`: Database interactions (Postgres).
    - `secrets/`: Secret retrieval logic (Env/Infisical).
    - `transcriber/`: `whisper.cpp` wrapper.
    - `uploader/`: Blob storage API client.
- `/scripts/`: Operational scripts for building, testing, and deployment.
- `/docs/`: Database schema and OpenAPI specifications.

### Key Conventions
- **Error Handling:** Use `handleFatalError` in `main.go` for CLI-level errors. For job-level errors in `-db` mode, the system distinguishes between transient and permanent errors:
- **Error Handling:** Use `handleFatalError` in `main.go` for CLI-level errors. For job-level errors in `-db` mode, the system distinguishes between transient, auth-cookie, and permanent errors:
    - **Transient Errors:** (e.g., timeouts, 429s) trigger exponential backoff.
    - **Auth-cookie Errors:** (e.g., `Sign in to confirm you're not a bot`) are treated as long-backoff (24h) and should be remediated by refreshing `YT_DLP` cookies.
    - **Permanent Errors:** (e.g., restricted, private, or removed videos) are blocked indefinitely (10-year delay) and reported as `idle` to the job callback to avoid false positive alerts.
    - Classification/backoff logic is handled in `pkg/repository/retry_policy.go`.
- **Configuration:** Always load configuration via `bootstrap.LoadConfigFromEnv`. It handles both environment variables and Infisical fetching.
- **State Management:** DB jobs persist retry state in Postgres table `media_item_retry_state` to survive container restarts/placement changes.
- **Shell Commands:** The project heavily relies on executing external binaries (`yt-dlp`, `ffmpeg`, `whisper-cli`). Ensure these are available in the PATH (handled by Docker and VPS setup script).

## Environment Variables
Key variables required in `.env`:
- `WHISPER_MODEL_PATH`: Path to the GGML model file.
- `WHISPER_THREADS`: Thread count for `whisper-cli` (`-t`), defaults to `1`.
- `WHISPER_EXTRA_ARGS`: Optional extra flags appended to `whisper-cli`.
- `UPLOAD_BLOB_API_URL`: Destination for SRT uploads.
- `UPLOAD_BLOB_API_TOKEN`: Auth for the blob API.
- `POSTGRES_URL`: Connection string for job management.
- `YT_TRANSCRIBE_ADMIN_TOKEN`: Auth for admin API routes.
- `DISCORD_WEBHOOK_URL`: Optional Discord webhook for automatic job error notifications.

## Development Workflow
1. **Modify Logic:** Focus changes in `pkg/` for infrastructure or `src/` for orchestration.
2. **Update Tests:** Add tests in the corresponding `*_test.go` files.
3. **Verify:** Run `go test ./...` and `go build`.
4. **Containerize:** If dependencies change, update the `Dockerfile`.
5. **Worker:** If proxy logic changes, update `worker.mjs`.
