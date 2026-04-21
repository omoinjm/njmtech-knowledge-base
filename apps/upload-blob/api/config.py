import os
from dataclasses import dataclass
from dotenv import load_dotenv
from .secrets import load_secrets

@dataclass
class Settings:
    """
    Application settings and environment variables.
    Centralized configuration management to follow SOLID principles (SRP).
    """
    VERCEL_BLOB_API_TOKEN: str
    REDIS_URL: str | None = None
    CRON_SECRET: str | None = None
    CACHE_TTL: int = 86400  # 24 hours
    BLOB_PREFIX: str = "njmtech-blob-api/"

    @classmethod
    def load(cls) -> "Settings":
        """Load settings from environment variables."""
        load_dotenv()
        load_secrets()
        
        token = os.getenv("VERCEL_BLOB_API_TOKEN")
        if not token:
            # Fallback to API_TOKEN for backward compatibility if needed, 
            # but prefer VERCEL_BLOB_API_TOKEN
            token = os.getenv("API_TOKEN")
        
        if not token:
            # Check for API_TOKEN in case it was renamed earlier but still used
            token = os.getenv("VERCEL_BLOB_READ_WRITE_TOKEN")
            
        if not token:
            # Vercel's default environment variable name
            token = os.getenv("BLOB_READ_WRITE_TOKEN")
            
        if not token:
             print("WARNING: VERCEL_BLOB_API_TOKEN environment variable is not set. Blob operations will fail.")
            
        return cls(
            VERCEL_BLOB_API_TOKEN=token or "",
            REDIS_URL=os.getenv("REDIS_URL"),
            CRON_SECRET=os.getenv("CRON_SECRET"),
            CACHE_TTL=int(os.getenv("CACHE_TTL", "86400")),
            BLOB_PREFIX=os.getenv("BLOB_PREFIX", "njmtech-blob-api/")
        )

# Global settings instance (acting as a singleton)
settings = Settings.load()
API_TOKEN = settings.VERCEL_BLOB_API_TOKEN
