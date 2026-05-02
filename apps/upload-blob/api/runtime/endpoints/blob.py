from workers import File

from api.runtime.auth import authorize
from api.runtime.blob_client import (
    build_blob_pathname,
    delete_blob,
    list_blobs,
    upload_blob,
)
from api.runtime.cache import BLOB_FILES_CACHE_KEY, cache_get_json, cache_set_json
from api.runtime.http import RuntimeHTTPError, json_response


async def _require_authorized_settings(request, env):
    settings = await authorize(request, env)
    if settings is None:
        raise RuntimeHTTPError(
            status=401,
            detail="Invalid token",
            title="Unauthorized",
            type_url="https://example.com/errors/unauthorized",
        )
    return settings


async def handle_blob_routes(request, env, method, path, query):
    normalized_path = path.rstrip("/") or "/"

    if method == "GET" and normalized_path == "/api/v1":
        return json_response({"message": "Welcome to the upload blob API"})

    if method == "GET" and normalized_path in ("/api/v1/files", "/api/v1/blob/files"):
        settings = await _require_authorized_settings(request, env)
        no_cache = query.get("no_cache", ["false"])[0].lower() in {"1", "true", "yes", "on"}
        cache_source = "blob"
        data = None

        if not no_cache:
            cached = await cache_get_json(settings, BLOB_FILES_CACHE_KEY)
            if isinstance(cached, list):
                data = cached
                cache_source = "redis"

        if data is None:
            data = await list_blobs(settings)
            await cache_set_json(settings, BLOB_FILES_CACHE_KEY, data, settings.CACHE_TTL)

        response_headers = (
            {
                "cache-control": "no-store, max-age=0",
                "pragma": "no-cache",
            }
            if no_cache
            else None
        )
        return json_response(
            {
                "cache_bypass": no_cache,
                "cache_source": cache_source,
                "count": len(data),
                "data": data,
            },
            headers=response_headers,
        )

    if method == "POST" and normalized_path in ("/api/v1/upload", "/api/v1/blob/upload"):
        settings = await _require_authorized_settings(request, env)
        form_data = await request.form_data()
        file = form_data.get("file")
        if file is None or not isinstance(file, File):
            raise RuntimeHTTPError(
                status=400,
                detail="File is required",
                title="Bad Request",
                type_url="https://example.com/errors/bad-request",
            )

        blob_path = query.get("blob_path", ["uploads"])[0]
        allow_overwrite = query.get("allow_overwrite", ["false"])[0].lower() in {
            "1",
            "true",
            "yes",
            "on",
        }

        contents = await file.bytes()
        pathname = build_blob_pathname(settings, blob_path, file.name or "file")
        result = await upload_blob(
            settings,
            pathname,
            contents,
            file.content_type,
            allow_overwrite=allow_overwrite,
        )
        return json_response(
            {
                "url": result.get("url"),
                "pathname": result.get("pathname", pathname),
                "content_type": result.get("contentType", file.content_type),
                "size": len(contents),
            }
        )

    if method == "DELETE" and normalized_path in ("/api/v1/delete", "/api/v1/blob/delete"):
        settings = await _require_authorized_settings(request, env)
        url = query.get("url", [None])[0]
        if not url:
            raise RuntimeHTTPError(
                status=400,
                detail="url query parameter is required",
                title="Bad Request",
                type_url="https://example.com/errors/bad-request",
            )

        await delete_blob(settings, [url])
        return json_response({"message": "Blob deleted successfully"})

    return None
