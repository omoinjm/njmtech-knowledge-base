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
    def load(cls, env_source=None) -> "Settings":
        """
        Load settings. Infisical is the source of truth.
        """
        # 1. Load local .env for bootstrapping Infisical credentials if needed
        if env_source is None:
            load_dotenv()
        
        # 2. Fetch all other variables from Infisical (injects into os.environ or env_source)
        load_secrets(env_source)
            
        def get_env(key, default=None):
            # Check env_source (Cloudflare Worker env) first
            if env_source and hasattr(env_source, key):
                return getattr(env_source, key)
            if env_source and isinstance(env_source, dict) and key in env_source:
                return env_source[key]
            # Fallback to os.environ (where Infisical injected them)
            return os.getenv(key, default)
        
        # Standardize on VERCEL_BLOB_API_TOKEN as the primary key
        token = get_env("VERCEL_BLOB_API_TOKEN")
        # or \
        #        get_env("BLOB_READ_WRITE_TOKEN") or \
        #        get_env("VERCEL_BLOB_READ_WRITE_TOKEN") or \
        #        get_env("API_TOKEN")
            
        if not token and not env_source:
             print("WARNING: VERCEL_BLOB_API_TOKEN not found in Infisical or environment.")
            
        return cls(
            VERCEL_BLOB_API_TOKEN=token,
            REDIS_URL=get_env("REDIS_URL"),
            CRON_SECRET=get_env("CRON_SECRET"),
            CACHE_TTL=int(get_env("CACHE_TTL", "86400")),
            BLOB_PREFIX=get_env("BLOB_PREFIX", "njmtech-blob-api/")
        )

# Global settings instance for non-request contexts
try:
    settings = Settings.load()
except Exception:
    settings = Settings(VERCEL_BLOB_API_TOKEN="")

API_TOKEN = settings.VERCEL_BLOB_API_TOKEN
