import os
from dotenv import load_dotenv
from .secrets import load_secrets

# Load environment variables from a .env file
load_dotenv()
load_secrets()

# Vercel Blob Storage Configuration
BLOB_API_URL = os.getenv("BLOB_API_URL")
VERCEL_BLOB_TOKEN = os.getenv("VERCEL_BLOB_TOKEN")

# AI Model Configuration (Ollama)
OLLAMA_MODEL_ID = os.getenv("OLLAMA_MODEL_ID", "llama3.2")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")

# Scanner Configuration
ROOT_SCAN_FOLDER = os.getenv("ROOT_SCAN_FOLDER", "njmtech-blob-api")

# Database Configuration
POSTGRES_URL = os.getenv("POSTGRES_URL")


def validate_config():
    """Validates that all required environment variables are set."""
    required_vars = [
        "VERCEL_BLOB_TOKEN",
        "BLOB_API_URL",
        "POSTGRES_URL",
    ]
    missing_vars = [var for var in required_vars if not globals()[var]]
    if missing_vars:
        raise ValueError(
            f"Missing required environment variables: {', '.join(missing_vars)}"
        )
