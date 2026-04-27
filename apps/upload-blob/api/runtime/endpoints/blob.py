from workers import File

from api.runtime.auth import authorize
from api.runtime.blob_client import build_blob_pathname, delete_blob, list_blobs, upload_blob
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
    if method == "GET" and path in ("/api/v1", "/api/v1/"):
        return json_response({"message": "Welcome to the Vercel Blob API"})

    if method == "GET" and path == "/api/v1/files":
        settings = await _require_authorized_settings(request, env)
        data = await list_blobs(settings)
        return json_response({"data": data})

    if method == "POST" and path == "/api/v1/upload":
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

    if method == "DELETE" and path == "/api/v1/delete":
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
