import json

import js
from pyodide.ffi import to_js

BLOB_FILES_CACHE_KEY = "upload-blob:files:v1"

# Cloudflare KV requires expirationTtl to be at least 60 seconds.
_MIN_KV_TTL_SECONDS = 60


def _get_kv(env):
    return getattr(env, "UPLOAD_BLOB_CACHE", None)


async def cache_get_json(env, key: str):
    kv = _get_kv(env)
    if kv is None:
        return None

    try:
        raw = await kv.get(key)
    except Exception as exc:
        # KV is a read-through cache, not a source of truth: any failure
        # here should fall back to object storage rather than fail the
        # whole request.
        print(f"[cache] get_json failed, falling back to blob storage: {exc}")
        return None

    if not raw:
        return None

    try:
        return json.loads(raw)
    except Exception:
        return None


async def cache_set_json(env, key: str, value, ttl_seconds: int):
    kv = _get_kv(env)
    if kv is None:
        return False

    safe_ttl = max(
        _MIN_KV_TTL_SECONDS,
        int(ttl_seconds) if ttl_seconds and int(ttl_seconds) > 0 else 86400,
    )
    serialized = json.dumps(value, separators=(",", ":"))
    options = to_js(
        {"expirationTtl": safe_ttl}, dict_converter=js.Object.fromEntries
    )

    try:
        await kv.put(key, serialized, options)
        return True
    except Exception as exc:
        # Cache refresh is best-effort: the caller already has the real data
        # from object storage, so a broken/unreachable KV must not fail the
        # request.
        print(f"[cache] set_json failed, continuing without cache: {exc}")
        return False
