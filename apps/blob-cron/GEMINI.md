# Project: NJMTech Blob Cron

## Project Overview

This project is a Python-based cron job designed to automate the process of scanning a Vercel Blob Storage container, identifying specific text files, and using an AI model to transform them into structured Markdown documents. The application is built with a modular architecture, separating concerns for blob storage interaction, file processing, and directory scanning.

The core technologies used are:
- **Python 3.9+**: The primary programming language.
- **Poetry**: For dependency management and packaging.
- **Vercel Blob Storage**: The target storage system for file scanning and writing.
- **Ollama**: To run the AI model locally for text-to-markdown transformation.
- **asyncio**: For concurrent processing of files.

## Building and Running

### 1. Installation

This project uses Poetry for dependency management. To install the required packages, run:

```bash
poetry install
```

### 2. Configuration

The application is configured through environment variables. Copy the `.env.example` file to `.env` and populate it with the necessary values:

```bash
cp .env.example .env
```

The required environment variables are:
- `BLOB_API_URL`: Your Vercel Blob API URL.
- `VERCEL_BLOB_TOKEN`: Your Vercel API token.
- `BLOB_STORE_ID`: Your Blob Store ID.
- `OLLAMA_MODEL_ID`: The Ollama model to use (e.g., `llama3.2`).
- `OLLAMA_BASE_URL`: URL of your local Ollama instance.
- `ROOT_SCAN_FOLDER`: The root directory to scan in your blob storage.

### 3. Running the Application

To run the application manually, use the following command:

```bash
poetry run python main.py
```

### 4. Running as a Cron Job

The `scripts/run_cron.sh` script is provided to execute the application as a cron job. This script ensures that the application runs within the correct environment.

Example cron task to run every minute:

```cron
* * * * * /path/to/your/project/scripts/run_cron.sh
```

## Development Conventions

- **Modular Design**: The codebase is organized into distinct modules for different functionalities (blob storage, processing, scanning). This separation of concerns makes the code easier to maintain and test.
- **Interface-Based Design**: The `DirectoryScanner` and `MarkdownTransformer` classes use interfaces (`BlobStorage` and `FileProcessor`) to allow for easy extension and testing with mock objects.
- **Asynchronous Operations**: The application uses Python's `asyncio` library to perform I/O-bound operations (like downloading and uploading files) concurrently, which improves performance.
- **Prompt Engineering**: The `MarkdownTransformer` class contains a well-defined prompt that instructs the AI model on how to format the output, ensuring consistent and high-quality results.
- **Configuration Management**: The application uses a dedicated `config.py` module to manage configuration, making it easy to change settings without modifying the core application logic.
