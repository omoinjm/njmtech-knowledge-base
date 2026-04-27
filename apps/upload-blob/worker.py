import json
from pathlib import Path
from urllib.parse import urlencode, urlparse
from workers import Response, WorkerEntrypoint, fetch

from api.config import Settings
from api.secrets import async_load_secrets


def _json_response(payload, status=200):
    return Response(
        json.dumps(payload),
        status=status,
        headers={"content-type": "application/json"},
    )


def _extract_bearer_token(request):
    auth = request.headers.get("Authorization")
    if not auth:
        return None
    prefix = "Bearer "
    if not auth.startswith(prefix):
        return None
    return auth[len(prefix) :]


async def _list_blobs(settings):
    query = urlencode({"limit": "1000", "prefix": settings.BLOB_PREFIX})
    resp = await fetch(
        f"https://blob.vercel-storage.com?{query}",
        method="GET",
        headers={"authorization": f"Bearer {settings.BLOB_READ_WRITE_TOKEN}"},
    )
    if resp.status != 200:
        try:
            details = await resp.json()
        except Exception:
            details = await resp.text()
        raise RuntimeError(f"Blob API request failed (status {resp.status}): {details}")

    result = await resp.json()
    blobs_list = result.get("blobs", [])

    groups = {}
    for blob in blobs_list:
        pathname = blob.get("pathname", "")
        url = blob.get("url")
        uploaded_at = blob.get("uploadedAt")

        p = Path(pathname)
        parent_dir = str(p.parent)
        filename = p.name

        if parent_dir not in groups:
            groups[parent_dir] = {
                "path": parent_dir,
                "timestamp": uploaded_at,
                "txt_url": None,
                "md_url": None,
            }

        if uploaded_at and (
            not groups[parent_dir]["timestamp"]
            or uploaded_at > groups[parent_dir]["timestamp"]
        ):
            groups[parent_dir]["timestamp"] = uploaded_at

        if filename.endswith(".md"):
            groups[parent_dir]["md_url"] = url
        elif filename.endswith(".txt"):
            groups[parent_dir]["txt_url"] = url

    return [groups[k] for k in sorted(groups.keys())]


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        path = urlparse(request.url).path
        method = request.method.value

        if method == "GET" and path == "/":
            return _json_response({"message": "Welcome to the Vercel Blob API"})

        if method == "GET" and path in ("/api/v1/files", "/api/v1/blob/files"):
            await async_load_secrets(self.env)
            settings = Settings.load(env_source=self.env)

            token = _extract_bearer_token(request)
            if token != settings.VERCEL_BLOB_API_TOKEN:
                return _json_response(
                    {
                        "error": {
                            "detail": "Invalid token",
                            "title": "Unauthorized",
                            "instance": request.url,
                            "type": "https://example.com/errors/unauthorized",
                            "additional_info": None,
                        }
                    },
                    status=401,
                )

            try:
                data = await _list_blobs(settings)
                return _json_response({"data": data}, status=200)
            except Exception as exc:
                return _json_response(
                    {
                        "error": {
                            "detail": "An unexpected error occurred.",
                            "title": "Internal Server Error",
                            "instance": request.url,
                            "type": "https://example.com/errors/internal-server-error",
                            "additional_info": {"original_error": str(exc)},
                        }
                    },
                    status=500,
                )

        return _json_response(
            {
                "error": {
                    "detail": "Not Found",
                    "title": "Not Found",
                    "instance": request.url,
                    "type": "https://example.com/errors/not-found",
                    "additional_info": None,
                }
            },
            status=404,
        )
