# NJMTech Knowledge Base Monorepo

Welcome to the **NJMTech Knowledge Base** monorepo. This project is a polyglot system designed to automate media transcription and transformation into structured Markdown documents using AI.

## Project Architecture

The monorepo is organized using **Nx** and **pnpm workspaces**, consolidating four distinct applications into a single, unified environment:

### Applications (`apps/`)
- **`media` (Next.js 15 / TS / Turbopack)**: The central dashboard and entry point. Saves video metadata to the database.
- **`upload-blob` (Python / Cloudflare Workers)**: A specialized API for interacting with Cloudflare's S3-compatible object storage (upload, delete, list).
- **`yt-transcribe` (Go)**: A high-performance background service that downloads audio from video platforms, transcribes it using `whisper.cpp`, and uploads the result. It is orchestrated via Cloudflare Workers + Containers for API and batch modes.
- **`blob-cron` (Python / Poetry)**: A scheduled job that identifies new transcripts in object storage and uses AI (via Ollama) to transform them into Markdown. It is orchestrated via Cloudflare Workers + Containers.

### Infrastructure
- **Nx**: Orchestrates builds, tests, and development across all languages.
- **Infisical**: Centralized secret management for all four applications.
- **Cloudflare S3 / R2**: The primary storage for raw transcripts and processed documents.
- **Cloudflare Containers**: Runtime for `yt-transcribe` and `blob-cron`, scheduled and proxied by Workers.
- **Neon (Postgres)**: The database for media metadata.

---

## Prerequisites

- **Docker & Docker Compose**
- **pnpm** (for local development)
- **Ollama** (running locally for the AI transformation)
- **Infisical Account** (for secret management)

---

## Quick Start (Docker Compose)

The easiest way to run the entire stack simultaneously in an isolated network:

1. **Configure Environments**: Populate the files in the `environments/` directory (created based on `.env.example` files in each app).
2. **Launch Services**:
   ```bash
   docker compose up --build
   ```
3. **Access the Apps**:
   - **Media Dashboard**: [http://localhost:3000](http://localhost:3000)
   - **Blob API**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## Local Development (Nx)

Each app can be run individually using Nx. This is recommended during active development for faster feedback loops.

### Root Commands
- **Install all dependencies**: `pnpm install`
- **Build all projects**: `pnpm build:all`
- **Test all projects**: `pnpm test:all`
- **Lint all projects**: `pnpm lint:all`

### Individual App Commands
| App | Run/Serve | Test |
| :--- | :--- | :--- |
| **media** | `pnpm start:media` | `nx test media` |
| **upload-blob** | `pnpm start:upload` | `nx test upload-blob` |
| **yt-transcribe** | `pnpm start:yt` | `nx test yt-transcribe` |
| **blob-cron** | `nx run blob-cron:run` | `nx test blob-cron` |

---

## Configuration & Secrets

Secrets are managed centrally in the `environments/` directory and injected via **Infisical**:

- **`environments/media.env`**: Bootstrap for Next.js secrets.
- **`environments/upload-blob.env`**: API tokens and storage credentials.
- **`environments/yt-transcribe.env`**: Postgres and Whisper model paths.
- **`environments/blob-cron.env`**: AI model and storage config.

*Note: The `environments/` directory is gitignored to protect your secrets.*

---

## Contributing

1. Ensure you are in the root of the monorepo.
2. Run `pnpm install` to set up the workspace.
3. Create a feature branch and commit your changes atomically across apps.
4. Verify your changes with `nx affected:test`.
