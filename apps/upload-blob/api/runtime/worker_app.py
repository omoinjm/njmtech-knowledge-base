import logging

from api.runtime.endpoints import dispatch_request, run_scheduled_refresh
from api.runtime.http import RuntimeHTTPError, error_response, error_response_from_exception

logger = logging.getLogger(__name__)


async def handle_request(request, env):
    try:
        return await dispatch_request(request, env)
    except RuntimeHTTPError as exc:
        return error_response_from_exception(request.url, exc)
    except Exception as exc:
        logger.error("Unhandled worker exception", exc_info=True)
        return error_response(
            request.url,
            detail="An unexpected error occurred.",
            title="Internal Server Error",
            type_url="https://example.com/errors/internal-server-error",
            status=500,
            additional_info={"original_error": str(exc)},
        )


__all__ = ["handle_request", "run_scheduled_refresh"]
