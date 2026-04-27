from urllib.parse import parse_qs, urlparse

from api.runtime.http import RuntimeHTTPError

from .blob import handle_blob_routes
from .pages import handle_public_routes
from .cron import run_scheduled_refresh


async def dispatch_request(request, env):
    parsed = urlparse(request.url)
    path = parsed.path
    method = request.method.value
    query = parse_qs(parsed.query)

    public_response = await handle_public_routes(method, path)
    if public_response is not None:
        return public_response

    blob_response = await handle_blob_routes(request, env, method, path, query)
    if blob_response is not None:
        return blob_response

    raise RuntimeHTTPError(
        status=404,
        detail="Not Found",
        title="Not Found",
        type_url="https://example.com/errors/not-found",
    )


__all__ = ["dispatch_request", "run_scheduled_refresh"]
