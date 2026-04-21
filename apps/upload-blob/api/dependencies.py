from fastapi import Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .config import settings, Settings
from .exceptions import CustomException

security = HTTPBearer()

from .services.blob_storage import BlobStorageService

def get_settings() -> Settings:
    """Provides access to application settings."""
    return settings

def get_blob_service(config: Settings = Depends(get_settings)) -> BlobStorageService:
    """Provides access to the blob storage service."""
    return BlobStorageService(config)

async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    config: Settings = Depends(get_settings)
):
    """Verifies the bearer token against the configured API token."""
    token = credentials.credentials
    if token != config.VERCEL_BLOB_API_TOKEN:
        raise CustomException(
            status_code=401,
            detail="Invalid token",
            title="Unauthorized",
            type="https://example.com/errors/unauthorized",
        )
