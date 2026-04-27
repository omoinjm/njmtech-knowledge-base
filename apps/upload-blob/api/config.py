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
    BLOB_READ_WRITE_TOKEN: str
    REDIS_URL: str | None = None
    CRON_SECRET: str | None = None
    CACHE_TTL: int = 86400  # 24 hours
    BLOB_PREFIX: str = "njmtech-blob-api/"

    @classmethod
    def load(cls, env_source=None) -> "Settings":
        """
        Load settings. Infisical is the source of truth.
        """
        # Load local .env for bootstrapping Infisical credentials if needed.
        # This is harmless when values are already injected by `infisical run`.
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

        api_token = get_env("VERCEL_BLOB_API_TOKEN") or get_env("API_TOKEN")
        blob_read_write_token = (
            get_env("BLOB_READ_WRITE_TOKEN")
            or get_env("VERCEL_BLOB_READ_WRITE_TOKEN")
        )

        # Standardize aliases where available.
        if api_token and not get_env("VERCEL_BLOB_API_TOKEN"):
            os.environ["VERCEL_BLOB_API_TOKEN"] = api_token
            if env_source is not None:
                if isinstance(env_source, dict):
                    env_source["VERCEL_BLOB_API_TOKEN"] = api_token
                elif hasattr(env_source, "__setattr__"):
                    try:
                        setattr(env_source, "VERCEL_BLOB_API_TOKEN", api_token)
                    except Exception:
                        pass

        if blob_read_write_token and not get_env("BLOB_READ_WRITE_TOKEN"):
            os.environ["BLOB_READ_WRITE_TOKEN"] = blob_read_write_token
            if env_source is not None:
                if isinstance(env_source, dict):
                    env_source["BLOB_READ_WRITE_TOKEN"] = blob_read_write_token
                elif hasattr(env_source, "__setattr__"):
                    try:
                        setattr(env_source, "BLOB_READ_WRITE_TOKEN", blob_read_write_token)
                    except Exception:
                        pass

        return cls(
            VERCEL_BLOB_API_TOKEN=api_token,
            BLOB_READ_WRITE_TOKEN=blob_read_write_token,
            REDIS_URL=get_env("REDIS_URL"),
            CRON_SECRET=get_env("CRON_SECRET"),
            CACHE_TTL=int(get_env("CACHE_TTL", "86400")),
            BLOB_PREFIX=get_env("BLOB_PREFIX", "njmtech-blob-api/"),
        )


# Global fallback for non-request contexts (tests, scripts)
try:
    settings = Settings.load()
except Exception:
    settings = Settings(VERCEL_BLOB_API_TOKEN="", BLOB_READ_WRITE_TOKEN="")

API_TOKEN = settings.VERCEL_BLOB_API_TOKEN
