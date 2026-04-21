# NJMTech Blob Cron

This application is a cron-driven Python script that scans a Vercel Blob Storage container, identifies specific text files, and uses an AI model to transform them into structured Markdown documents.

## Project Structure

- `src/njm_blob_cron`: Main application source code.
  - `blob_storage`: Handles interaction with Vercel Blob Storage.
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

    - `BLOB_API_URL`: Your Vercel Blob API URL.
    - `VERCEL_BLOB_TOKEN`: Your Vercel API token.
    - `BLOB_STORE_ID`: Your Blob Store ID.
    - `OLLAMA_MODEL_ID`: The Ollama model to use (e.g., `llama3.2`).
    - `OLLAMA_BASE_URL`: URL of your local Ollama instance.
    - `ROOT_SCAN_FOLDER`: The root directory to scan in your blob storage.

3.  **Run the application:**

    ```bash
    poetry run python main.py
    ```

## Cron Job

The `scripts/run_cron.sh` script is provided to be used with a cron scheduler. It ensures the application runs within the correct environment.

Example cron task to run every minute:

```cron
* * * * * /path/to/your/project/scripts/run_cron.sh
```
