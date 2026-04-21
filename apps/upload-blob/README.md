# NJMTech Upload Blob API

## Tech Stack

This project is built using the following technologies:

*   🐍 **Python**: The core programming language.
*   ⚡ **FastAPI**: A modern, fast (high-performance) web framework for building APIs with Python 3.7+ based on standard Python type hints.
*   ☁️ **Vercel Blob**: A serverless, scalable, and cost-efficient object storage solution for the web.
*   🦄 **Uvicorn**: A lightning-fast ASGI server, used to run the FastAPI application.
*   .env **python-dotenv**: Manages environment variables, loading them from a `.env` file.
*   🛠️ **Werkzeug**: A comprehensive WSGI web application library, used here for secure filename handling.
*   🧪 **Pytest**: A mature full-featured Python testing framework.



This is a simple FastAPI application to upload files to Vercel Blob storage.

## Setup

1.  **Install dependencies:**

    ```bash
    pip install -r requirements.txt
    ```

2.  **Set up environment variables:**

    Create a `.env.local` file in the root of the project and add your Vercel Blob read-write token:

    ```
    BLOB_READ_WRITE_TOKEN="YOUR_BLOB_READ_WRITE_TOKEN"
    ```

    Replace `"YOUR_BLOB_READ_WRITE_TOKEN"` with your actual token.

3.  **Run the application:**

    ```bash
    uvicorn api.main:app --reload
    ```

    The application will be running at `http://127.0.0.1:8000`.

## Testing

To run the tests for this project, follow these steps:

1.  **Install test dependencies:**

    ```bash
    pip install -r tests/requirements.txt
    ```

2.  **Run the tests:**

    ```bash
    pytest tests/
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
  http://127.0.0.1:8000/api/v1/upload
```
