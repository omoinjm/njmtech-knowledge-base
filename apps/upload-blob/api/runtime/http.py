import json

from workers import Response


class RuntimeHTTPError(Exception):
    def __init__(
        self,
        status: int,
        detail: str,
        title: str,
        type_url: str,
        additional_info=None,
    ):
        self.status = status
        self.detail = detail
        self.title = title
        self.type_url = type_url
        self.additional_info = additional_info
        super().__init__(detail)


def json_response(payload, status=200):
    return Response(
        json.dumps(payload),
        status=status,
        headers={"content-type": "application/json"},
    )


def html_response(html: str, status=200):
    return Response(
        html,
        status=status,
        headers={"content-type": "text/html; charset=utf-8"},
    )


def error_response(request_url: str, detail: str, title: str, type_url: str, status: int, additional_info=None):
    return json_response(
        {
            "error": {
                "detail": detail,
                "title": title,
                "instance": request_url,
                "type": type_url,
                "additional_info": additional_info,
            }
        },
        status=status,
    )


def error_response_from_exception(request_url: str, exc: RuntimeHTTPError):
    return error_response(
        request_url=request_url,
        detail=exc.detail,
        title=exc.title,
        type_url=exc.type_url,
        status=exc.status,
        additional_info=exc.additional_info,
    )
