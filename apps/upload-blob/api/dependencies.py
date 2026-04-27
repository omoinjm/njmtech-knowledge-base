from fastapi import Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .config import Settings
from .secrets import async_load_secrets
from .exceptions import CustomException

security = HTTPBearer()

from .services.blob_storage import BlobStorageService

async def get_settings(request: Request) -> Settings:
    """
    Provides access to application settings.
    If running in Cloudflare, it loads settings from the request scope's env.
    """
    env = request.scope.get("env")
    # In Workers (Pyodide), sync SDK loading is skipped; fetch from Infisical via REST.
    if env:
        await async_load_secrets(env)
    return Settings.load(env_source=env)

async def get_blob_service(config: Settings = Depends(get_settings)) -> BlobStorageService:
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
