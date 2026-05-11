# yt-transcribe

A Go transcription worker and HTTP API that downloads audio from YouTube, Instagram, and other platforms supported by `yt-dlp`, transcribes it using `whisper.cpp`, and uploads the transcript (SRT format with timestamps) through the `upload-blob` API backed by Cloudflare's S3-compatible storage. It can run as a CLI worker, pull the next job from Postgres, reprocess existing records, or expose an HTTP API.

## Features

- Downloads audio via `yt-dlp` and converts to WAV with `ffmpeg`
- Transcribes using `whisper.cpp` — outputs SRT files with timestamps
- Uploads transcripts through the upload-blob API to Cloudflare S3 / R2
- Three run modes: single URL, DB-driven, and reprocess-all
- HTTP API mode for Cloudflare Containers and local server use
- Idle-safe DB connection (uses `pgxpool` — survives Neon's connection timeouts during long jobs)

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `WHISPER_MODEL_PATH` | ✅ | Path to the `ggml-*.bin` model file |
| `WHISPER_THREADS` | Optional (default: `1`) | Thread count passed to `whisper-cli` (`-t`) |
| `WHISPER_EXTRA_ARGS` | Optional | Extra args appended to `whisper-cli` (space-delimited) |
| `UPLOAD_BLOB_API_URL` | ✅ | Upload endpoint for the upload-blob API |
| `UPLOAD_BLOB_API_TOKEN` | ✅ | Auth token for the upload-blob API |
| `PORT` | Cloudflare container / local API only | Port for HTTP server mode |
| `POSTGRES_URL` | `-db` / `-reprocess-all` only | Neon / Postgres connection string |
| `DISCORD_WEBHOOK_URL` | Optional | Discord webhook URL for job failure alerts (`status=error`) |
| `DOCKERHUB_USERNAME` | Docker Compose only | Your Docker Hub username (resolves the image name) |

---

## Infisical integration

This project optionally supports fetching secrets from Infisical. By default the application reads required values from environment variables (or `.env`). To enable Infisical:

1. Set INFISICAL_ENABLED=true and provide INFISICAL_PROJECT_ID and INFISICAL_ENVIRONMENT.
2. Provide authentication environment variables (one supported option is Universal Auth):
   - INFISICAL_UNIVERSAL_AUTH_CLIENT_ID
   - INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET
3. (Optional) Override the site URL with INFISICAL_SITE_URL (defaults to https://app.infisical.com).

Build and runtime notes:

- Local / Docker (build-time): compile the binary with the `infisical` build tag so the Infisical SDK is included:

  docker build --build-arg INFISICAL_ENABLED=true -t yt-transcribe .

  or with docker-compose (reads from your `.env`):

  INFISICAL_ENABLED=true docker compose build

  When INFISICAL_ENABLED is true the Dockerfile will build the app with `-tags=infisical`.

- CI: the GitHub Actions workflow is configured to build with `-tags=infisical` when the repository secret `INFISICAL_ENABLED` is set to `true`.

- Runtime behavior: the code prefers explicit environment variables first (for local dev and platform-injected secrets). If a required variable is not present and INFISICAL_ENABLED=true, the binary will attempt to fetch the secret from Infisical at startup.

Security

- Never commit secrets to the repository. Use environment variables, CI secrets, or Infisical to inject runtime secrets.
- Keep `.env` files out of source control; use `.env.example` as a template (already included).

---

## Usage

### Flags

```
-url <URL>        Transcribe a single video URL
-output <dir>     Directory for temporary audio files (default: /tmp)
-db               Fetch and process the next unprocessed URL from the database
-reprocess-all    Reprocess every record in the database (overwrites existing transcripts)
```

### Examples

**Single URL:**
```bash
./yt-transcribe -url "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

**Next unprocessed item from DB:**
```bash
./yt-transcribe -db
```

**Reprocess all records:**
```bash
./yt-transcribe -reprocess-all
```

### API server mode

When `PORT` is set, the binary starts an HTTP server instead of running the CLI flow.

**Run locally:**
```bash
PORT=3000 go run .
```

**Health check:**
```bash
curl http://localhost:3000/
```

**Transcribe a URL:**
```bash
curl -X POST http://localhost:3000/api/transcribe \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

**Response:**
```json
{"blobUrl":"https://..."}
```

### Cloudflare Containers deployment

This app is now wired for **Cloudflare Workers + Containers**:

- `worker.mjs` proxies normal HTTP traffic to an API container instance.
- The Worker cron trigger starts a separate batch-job container every 15 minutes with `-db`.
- `POST /admin/jobs/db` starts a manual `-db` batch run.
- `POST /admin/jobs/reprocess-all` starts a manual `-reprocess-all` batch run.
- `GET /admin/state` returns the current state of the API and batch container instances.
- `GET /admin/job-result` returns the last status callback reported by the job container.
- `GET /admin/retry-state?id=<media_item_id>` returns retry metadata (`failures`, `next_attempt`, `last_error`) for a specific item.
- `GET /admin/logs/job` returns the job container's stdout/stderr buffer from its last start.

Admin routes require:

- `YT_TRANSCRIBE_ADMIN_TOKEN`

Cloudflare's **Events** view mostly shows Worker lifecycle logs. Detailed batch execution logs come from the container runtime, so use `/admin/job-result` for the latest success/error/idle summary and `/admin/logs/job` for the full container output when a cron run looks quiet.

`-db` retry/backoff state is persisted in Postgres table `media_item_retry_state` (auto-created on startup), so retries are no longer reset by container restarts or placement changes.

YouTube auth/cookie failures (for example, `Sign in to confirm you're not a bot`) are automatically classified as long-backoff errors (24h) and surfaced with a clear remediation message in `/admin/job-result`.

If `DISCORD_WEBHOOK_URL` is set, every job callback with `status=error` sends the full error message to Discord.

Example manual reprocess:

```bash
curl -X POST https://<your-worker-url>/admin/jobs/reprocess-all \
  -H "Authorization: Bearer $YT_TRANSCRIBE_ADMIN_TOKEN"
```

---

## Running with Docker

The pre-built image is published to Docker Hub on every merge to `main`. All dependencies (`yt-dlp`, `ffmpeg`, `whisper.cpp`, model) are bundled inside the image.

### `docker run`

```bash
docker run --rm --env-file .env \
  your-dockerhub-username/njmtech-yt-transcribe:latest -db
```

Replace `-db` with any valid flag combination (e.g. `-url "https://..."`, `-reprocess-all`).

### `docker compose`

Ensure `DOCKERHUB_USERNAME` is set in your `.env` file, then:

```bash
# Process next unprocessed DB item (default command in docker-compose.yml)
docker compose run --rm yt-transcribe

# Override command
docker compose run --rm yt-transcribe -url "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
docker compose run --rm yt-transcribe -reprocess-all
```

---

## VPS Deployment (recommended for long videos)

For videos longer than a few minutes, run the worker on a dedicated VPS instead of CI. A helper script handles the full setup:

```bash
# On your VPS — clone the repo and run once
git clone https://github.com/omoinjm/njmtech-yt-transcribe.git
cd njmtech-yt-transcribe
bash scripts/setup-vps.sh
```

The script will:
1. Install Docker (if not already present)
2. Copy `docker-compose.yml` to `/opt/yt-transcribe/`
3. Create `/opt/yt-transcribe/.env` from `.env.example` (edit this file with your secrets)
4. Pull the latest image from Docker Hub
5. Register a cron job that runs `./yt-transcribe -db` every 30 minutes

Logs are written to `/var/log/yt-transcribe.log`.

---

## Building from Source

**Prerequisites:** Go 1.22+, `yt-dlp`, `ffmpeg`, `whisper-cli` (from [whisper.cpp](https://github.com/ggml-org/whisper.cpp))

```bash
git clone https://github.com/omoinjm/njmtech-yt-transcribe.git
cd njmtech-yt-transcribe
go build -o yt-transcribe .
```

**Run tests:**
```bash
go test ./...
```

---

## License

See [LICENSE](LICENSE).
