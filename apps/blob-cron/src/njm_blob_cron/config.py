import os
from dotenv import load_dotenv
from .secrets import load_secrets

# Load environment variables from a .env file
load_dotenv()
load_secrets()

def get_upload_blob_api_url():
    url = os.getenv("UPLOAD_BLOB_API_URL", "https://api.blob.njmtech.co.za")
    return url


def get_upload_blob_api_token():
    return os.getenv("UPLOAD_BLOB_API_TOKEN")

# AI Model Configuration (Ollama)
OLLAMA_MODEL_ID = os.getenv("OLLAMA_MODEL_ID", "llama3.2")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")

# Scanner Configuration
ROOT_SCAN_FOLDER = os.getenv("ROOT_SCAN_FOLDER", "njmtech-blob-api")

# Database Configuration
POSTGRES_URL = os.getenv("POSTGRES_URL")


def validate_config():
    """Validates that all required environment variables are set."""
    required_vars = {
        "UPLOAD_BLOB_API_TOKEN": get_upload_blob_api_token(),
        "UPLOAD_BLOB_API_URL": get_upload_blob_api_url(),
        "POSTGRES_URL": os.getenv("POSTGRES_URL"),
    }
    missing_vars = [var for var, value in required_vars.items() if not value]
    if missing_vars:
        raise ValueError(
            f"Missing required environment variables: {', '.join(missing_vars)}"
        )
