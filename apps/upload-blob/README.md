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

## API Endpoint

### Upload File

*   **URL:** `/api/v1/upload`
*   **Method:** `POST`
*   **Headers:**
    *   `Authorization: Bearer YOUR_API_TOKEN`
*   **Form Data:** `file` (the file to upload)

**Example using `curl`:**

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -F "file=@/path/to/your/file.txt" \
  http://127.0.0.1:8787/api/v1/upload
```
