import os
from dataclasses import dataclass
from .secrets import load_secrets


@dataclass
class Settings:
    """
    Application settings and environment variables.
    Centralized configuration management to follow SOLID principles (SRP).
    """

    UPLOAD_BLOB_API_TOKEN: str
    CLOUDFLARE_S3_API_URL: str
    CLOUDFLARE_S3_ACCESS_KEY_ID: str
    CLOUDFLARE_S3_SECRET_ACCESS_KEY: str
    CLOUDFLARE_S3_BUCKET: str
    REDIS_URL: str | None = None
    CRON_SECRET: str | None = None
    CACHE_TTL: int = 86400  # 24 hours
    BLOB_PREFIX: str = "njmtech-blob-api/"
    CLOUDFLARE_S3_REGION: str = "auto"
    CLOUDFLARE_S3_PUBLIC_BASE_URL: str | None = None

    @classmethod
    def load(cls, env_source=None) -> "Settings":
        """
        Load settings. Infisical is the source of truth.
        """
        # Fetch variables from Infisical (injects into os.environ or env_source)
        load_secrets(env_source)

        def get_env(key, default=None):
            # Check env_source (Cloudflare Worker env) first
            if env_source and hasattr(env_source, key):
                return getattr(env_source, key)
            if env_source and isinstance(env_source, dict) and key in env_source:
                return env_source[key]
            # Fallback to os.environ (where Infisical injected them)
            return os.getenv(key, default)

        api_token = get_env("UPLOAD_BLOB_API_TOKEN")

        return cls(
            UPLOAD_BLOB_API_TOKEN=api_token,
            CLOUDFLARE_S3_API_URL=get_env("CLOUDFLARE_S3_API_URL"),
            CLOUDFLARE_S3_ACCESS_KEY_ID=get_env("CLOUDFLARE_S3_ACCESS_KEY_ID"),
            CLOUDFLARE_S3_SECRET_ACCESS_KEY=get_env("CLOUDFLARE_S3_SECRET_ACCESS_KEY"),
            CLOUDFLARE_S3_BUCKET=get_env("CLOUDFLARE_S3_BUCKET"),
            REDIS_URL=get_env("REDIS_URL"),
            CRON_SECRET=get_env("CRON_SECRET"),
            CACHE_TTL=int(get_env("CACHE_TTL", "86400")),
            BLOB_PREFIX=get_env("BLOB_PREFIX", "njmtech-blob-api/"),
            CLOUDFLARE_S3_REGION=get_env("CLOUDFLARE_S3_REGION", "auto"),
            CLOUDFLARE_S3_PUBLIC_BASE_URL=get_env("CLOUDFLARE_S3_PUBLIC_BASE_URL"),
        )


# Global fallback for non-request contexts (tests, scripts)
try:
    settings = Settings.load()
except Exception:
    settings = Settings(
        UPLOAD_BLOB_API_TOKEN="",
        CLOUDFLARE_S3_API_URL="",
        CLOUDFLARE_S3_ACCESS_KEY_ID="",
        CLOUDFLARE_S3_SECRET_ACCESS_KEY="",
        CLOUDFLARE_S3_BUCKET="",
    )

API_TOKEN = settings.UPLOAD_BLOB_API_TOKEN
