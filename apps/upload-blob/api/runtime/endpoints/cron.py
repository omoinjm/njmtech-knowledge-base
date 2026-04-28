from api.runtime.auth import load_settings
from api.runtime.blob_client import list_blobs
from api.runtime.cache import BLOB_FILES_CACHE_KEY, cache_set_json


async def run_scheduled_refresh(env):
    """
    Worker-native equivalent of FastAPI cron cache refresh.
    In the worker runtime this currently pre-fetches blob listings.
    """
    settings = await load_settings(env)
    data = await list_blobs(settings)
    await cache_set_json(settings, BLOB_FILES_CACHE_KEY, data, settings.CACHE_TTL)
    return {"status": "success", "message": "Blob refresh completed", "items": len(data)}
