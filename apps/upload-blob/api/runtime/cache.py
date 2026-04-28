import json
from urllib.parse import quote, urlparse

from workers import fetch


BLOB_FILES_CACHE_KEY = "upload-blob:files:v1"


def _redis_rest_target(redis_url: str | None):
    if not redis_url:
        return None, None

    parsed = urlparse(redis_url)
    scheme = (parsed.scheme or "").lower()

    # Upstash REST URL form, optionally with basic-auth token in the URL.
    if scheme in {"http", "https"}:
        base_url = f"{scheme}://{parsed.hostname}"
        if parsed.port:
            base_url = f"{base_url}:{parsed.port}"
        token = parsed.password or None
        return base_url, token

    # Redis TCP URL form (redis:// or rediss://), adapted to Upstash REST host + token.
    if scheme in {"redis", "rediss"}:
        if not parsed.hostname:
            return None, None
        base_url = f"https://{parsed.hostname}"
        token = parsed.password or None
        return base_url, token

    return None, None


def _redis_headers(token: str | None):
    headers = {"content-type": "application/json"}
    if token:
        headers["authorization"] = f"Bearer {token}"
    return headers


async def cache_get_json(settings, key: str):
    base_url, token = _redis_rest_target(settings.REDIS_URL)
    if not base_url:
        return None

    url = f"{base_url}/get/{quote(key, safe='')}"
    resp = await fetch(url, method="GET", headers=_redis_headers(token))
    if resp.status != 200:
        return None

    payload = await resp.json()
    raw = payload.get("result")
    if not raw:
        return None

    try:
        return json.loads(raw)
    except Exception:
        return None


async def cache_set_json(settings, key: str, value, ttl_seconds: int):
    base_url, token = _redis_rest_target(settings.REDIS_URL)
    if not base_url:
        return False

    safe_ttl = int(ttl_seconds) if ttl_seconds and int(ttl_seconds) > 0 else 86400
    serialized = json.dumps(value, separators=(",", ":"))
    url = f"{base_url}/setex/{quote(key, safe='')}/{safe_ttl}/{quote(serialized, safe='')}"
    resp = await fetch(url, method="GET", headers=_redis_headers(token))
    return resp.status == 200
