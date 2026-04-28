# NJMTech Upload Blob API

## Tech Stack

This project is built using the following technologies:

*   🐍 **Python**: The core programming language.
*   ☁️ **Cloudflare Workers (Python Workers)**: Primary runtime and deployment platform.
*   🧰 **Wrangler / PyWrangler**: Local development and deployment tooling for Cloudflare Workers.
*   ☁️ **Vercel Blob**: A serverless, scalable, and cost-efficient object storage solution for the web.

This is a Cloudflare Worker API for uploading and managing files in Vercel Blob storage.

## Setup

1.  **Install workspace dependencies (from repository root):**

    ```bash
    npm install
    ```

    This app lives in a Node/Nx workspace. Cloudflare tooling (Wrangler) is managed through `package.json`.
    Python code is the application runtime, but workspace orchestration is Node-first.

2.  **Set up environment variables:**

    Create a `.env` file in the root of the project and add your Vercel Blob read-write token:

    ```
    BLOB_READ_WRITE_TOKEN="YOUR_BLOB_READ_WRITE_TOKEN"
    ```

    Replace `"YOUR_BLOB_READ_WRITE_TOKEN"` with your actual token.

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
    *   `no_cache` (optional): `1|true|yes|on` to bypass Redis and fetch directly from Blob
*   **Notes:**
    *   Trailing slash variants are supported (for example `/api/v1/blob/files/`).
    *   Default behavior (`no_cache` omitted/false): read from Redis cache first, then fallback to Blob and refresh cache.
    *   `no_cache=1`: bypass Redis for this request, fetch from Blob, and refresh Redis cache.
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
