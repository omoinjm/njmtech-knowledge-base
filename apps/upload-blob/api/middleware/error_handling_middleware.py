import logging
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi import HTTPException
from ..exceptions import CustomException

logger = logging.getLogger(__name__)

class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            response = await call_next(request)
            return response
        except CustomException as exc:
            return JSONResponse(
                status_code=exc.status_code,
                content={
                    "error": {
                        "detail": exc.detail,
                        "title": exc.title,
                        "instance": str(request.url),
                        "type": exc.type,
                        "additional_info": exc.additional_info,
                    }
                },
            )
        except HTTPException as exc:
            return JSONResponse(
                status_code=exc.status_code,
                content={
                    "error": {
                        "detail": exc.detail,
                        "title": "HTTP Exception",
                        "instance": str(request.url),
                        "type": "https://example.com/errors/http-exception",
                        "additional_info": None,
                    }
                },
            )
        except Exception as exc:
            logger.error(f"An unexpected error occurred: {exc}", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={
                    "error": {
                        "detail": "An unexpected error occurred.",
                        "title": "Internal Server Error",
                        "instance": str(request.url),
                        "type": "https://example.com/errors/internal-server-error",
                        "additional_info": {"original_error": str(exc)},
                    }
                },
            )
