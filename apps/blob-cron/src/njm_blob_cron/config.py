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

# AI Model Configuration (Cloudflare Workers AI)
CLOUDFLARE_AI_MODEL = os.getenv("CLOUDFLARE_AI_MODEL", "@cf/meta/llama-3.3-70b-instruct-fp8-fast")
CLOUDFLARE_AI_API_TOKEN = os.getenv("CLOUDFLARE_AI_API_TOKEN")

# Scanner Configuration
ROOT_SCAN_FOLDER = os.getenv("ROOT_SCAN_FOLDER", "njmtech-blob-api")

# Database Configuration (Cloudflare D1)
CLOUDFLARE_ACCOUNT_ID = os.getenv("CLOUDFLARE_ACCOUNT_ID")
CLOUDFLARE_D1_DATABASE_ID = os.getenv("CLOUDFLARE_D1_DATABASE_ID")
CLOUDFLARE_D1_API_TOKEN = os.getenv("CLOUDFLARE_D1_API_TOKEN")


def validate_config():
    """Validates that all required environment variables are set."""
    required_vars = {
        "UPLOAD_BLOB_API_TOKEN": get_upload_blob_api_token(),
        "UPLOAD_BLOB_API_URL": get_upload_blob_api_url(),
        "CLOUDFLARE_ACCOUNT_ID": os.getenv("CLOUDFLARE_ACCOUNT_ID"),
        "CLOUDFLARE_D1_DATABASE_ID": os.getenv("CLOUDFLARE_D1_DATABASE_ID"),
        "CLOUDFLARE_D1_API_TOKEN": os.getenv("CLOUDFLARE_D1_API_TOKEN"),
        "CLOUDFLARE_AI_API_TOKEN": os.getenv("CLOUDFLARE_AI_API_TOKEN"),
    }
    missing_vars = [var for var, value in required_vars.items() if not value]
    if missing_vars:
        raise ValueError(
            f"Missing required environment variables: {', '.join(missing_vars)}"
        )
