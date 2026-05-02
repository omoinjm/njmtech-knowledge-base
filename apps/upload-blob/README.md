# NJMTech Upload Blob API

## Tech Stack

This project is built using the following technologies:

*   🐍 **Python**: The core programming language.
*   ☁️ **Cloudflare Workers (Python Workers)**: Primary runtime and deployment platform.
*   🧰 **Wrangler / PyWrangler**: Local development and deployment tooling for Cloudflare Workers.
*   ☁️ **Cloudflare S3 / R2**: The S3-compatible object storage backend for uploads, listing, and deletes.

This is a Cloudflare Worker API for uploading and managing files in Cloudflare's S3-compatible object storage.

## Setup

1.  **Install workspace dependencies (from repository root):**

    ```bash
    npm install
    ```

    This app lives in a Node/Nx workspace. Cloudflare tooling (Wrangler) is managed through `package.json`.
    Python code is the application runtime, but workspace orchestration is Node-first.

2.  **Set up environment variables:**

    Create a `.env` file in the root of the project and add the API token plus the Cloudflare storage credentials:

    ```bash
    UPLOAD_BLOB_API_TOKEN="YOUR_UPLOAD_BLOB_API_TOKEN"
    CLOUDFLARE_S3_API_URL="https://<account-id>.r2.cloudflarestorage.com"
    CLOUDFLARE_S3_ACCESS_KEY_ID="YOUR_ACCESS_KEY_ID"
    CLOUDFLARE_S3_SECRET_ACCESS_KEY="YOUR_SECRET_ACCESS_KEY"
    CLOUDFLARE_S3_BUCKET="YOUR_BUCKET_NAME"
    CLOUDFLARE_S3_REGION="auto"
    CLOUDFLARE_S3_PUBLIC_BASE_URL="https://pub-xxxxxxxxxxxxxxxx.r2.dev"
    ```

    `CLOUDFLARE_S3_PUBLIC_BASE_URL` is optional but recommended when your public download host differs from the authenticated S3 API endpoint.

3.  **Run the application:**

    ```bash
    npm run dev
    ```

    The Worker will run locally via Wrangler.

4.  **Deploy to Cloudflare Workers:**

    ```bash
    npm run deploy
    ```

## API Endpoints

### Upload File

*   **URL:** `/api/v1/upload` or `/api/v1/blob/upload`
*   **Method:** `POST`
*   **Headers:**
    *   `Authorization: Bearer YOUR_API_TOKEN`
*   **Form Data:** `file` (the file to upload)
*   **Query Params:**
    *   `blob_path` (optional): target folder path under the configured prefix
    *   `allow_overwrite` (optional): `true|false` (defaults to `false`)
*   **Notes:**
    *   Trailing slash variants are supported (for example `/api/v1/upload/`).
    *   Non-markdown filenames are stored as `.txt` by the API path builder.

**Example using `curl`:**

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -F "file=@/path/to/your/file.txt" \
  "http://127.0.0.1:8787/api/v1/blob/upload?blob_path=yt-transcribe/youtube/dQw4w9WgXcQ&allow_overwrite=true"
```

### List Files

*   **URL:** `/api/v1/files` or `/api/v1/blob/files`
*   **Method:** `GET`
*   **Headers:**
    *   `Authorization: Bearer YOUR_API_TOKEN`
*   **Query Params:**
    *   `no_cache` (optional): `1|true|yes|on` to bypass Redis and fetch directly from object storage
*   **Notes:**
    *   Trailing slash variants are supported (for example `/api/v1/blob/files/`).
    *   Default behavior (`no_cache` omitted/false): read from Redis cache first, then fallback to object storage and refresh cache.
    *   `no_cache=1`: bypass Redis for this request, fetch from object storage, and refresh Redis cache.
    *   Response includes:
        *   `cache_source: "redis" | "blob"`
        *   paths with only `.txt` files are included (`md_url` can be `null`)
    *   When `no_cache` is enabled, response also includes:
        *   `cache_bypass: true` in JSON
        *   `Cache-Control: no-store, max-age=0`
        *   `Pragma: no-cache`

**Example using `curl`:**

```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
  "http://127.0.0.1:8787/api/v1/blob/files?no_cache=1"
```
