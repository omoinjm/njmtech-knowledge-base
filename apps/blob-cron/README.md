# NJMTech Blob Cron

This application is a Python batch job that scans transcript files through the `upload-blob` API, identifies specific text files, and uses an AI model to transform them into structured Markdown documents.

## Project Structure

- `src/njm_blob_cron`: Main application source code.
  - `blob_storage`: Handles interaction with the `upload-blob` API backed by Cloudflare S3 / R2.
  - `processing`: Contains file processing logic, including the AI-powered text-to-markdown transformation.
  - `scanner`: Implements the directory scanning and rule evaluation logic.
  - `config.py`: Manages application configuration from environment variables.
- `scripts`: Contains shell scripts, like the one to execute the cron job.
- `main.py`: The entry point of the application.
- `pyproject.toml`: Project metadata and dependencies.
- `docs`: Project documentation.

## Setup

1.  **Install Dependencies:**
    This project uses Poetry for dependency management.

    ```bash
    poetry install
    ```

2.  **Environment Variables:**
    Copy the `.env.example` file to `.env` and fill in the required values.

    ```bash
    cp .env.example .env
    ```

    - `UPLOAD_BLOB_API_URL`: Your upload-blob API URL.
    - `UPLOAD_BLOB_API_TOKEN`: Your upload-blob API token.
    - `POSTGRES_URL`: Postgres connection string for media record updates.
    - `OLLAMA_MODEL_ID`: The Ollama model to use (e.g., `llama3.2`).
    - `OLLAMA_BASE_URL`: URL of your local Ollama instance.
    - `ROOT_SCAN_FOLDER`: The root directory to scan in object storage.

3.  **Run the application:**

    ```bash
    poetry run python main.py
    ```

## Cloudflare Containers deployment

This app is now designed to run as a **Cloudflare Container batch job** launched by a Worker, not as an in-container cron daemon.

- `worker.mjs` owns the schedule and starts the container every minute.
- `wrangler.jsonc` declares the cron trigger, container image, and Durable Object binding.
- `Dockerfile` now runs `python3 main.py` once and exits.
- `POST /admin/run` triggers a manual run.
- `GET /admin/state` returns the current container state.

Manual admin routes require:

- `BLOB_CRON_ADMIN_TOKEN`

Example manual trigger:

```bash
curl -X POST https://<your-worker-url>/admin/run \
  -H "Authorization: Bearer $BLOB_CRON_ADMIN_TOKEN"
```

## Local cron / non-Cloudflare environments

The `scripts/run_cron.sh` script is still available for traditional cron-based environments.
