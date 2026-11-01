"""Renders every failure as {"error": {"code", "message", "details"?}} (API_CONTRACT.md section 5)."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.app.errors import ApiError

logger = logging.getLogger("netshield")

_HTTP_CODES = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}


def _path(loc: tuple[int | str, ...]) -> str:
    """('body', 'edges', 3, 'weight') -> 'edges[3].weight'; the request root is ''."""
    out = ""
    for part in loc[1:] if loc and loc[0] == "body" else loc:
        out += f"[{part}]" if isinstance(part, int) else (f".{part}" if out else str(part))
    return out


def _message(raw: str) -> str:
    return raw.removeprefix("Value error, ")


def error_response(status_code: int, code: str, message: str, details: object | None = None) -> JSONResponse:
    error: dict[str, object] = {"code": code, "message": message}
    if details is not None:
        error["details"] = details
    return JSONResponse(status_code=status_code, content={"error": error})


async def _api_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, ApiError)
    return JSONResponse(status_code=exc.status_code, content=exc.body())


async def _validation_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    details = [
        {"path": _path(tuple(e.get("loc", ()))), "message": _message(str(e.get("msg", "")))} for e in exc.errors()
    ]
    first = details[0] if details else {"path": "", "message": "Invalid request"}
    where = f" at {first['path']}" if first["path"] else ""
    return error_response(422, "VALIDATION_ERROR", f"Invalid request{where}: {first['message']}.", details)


async def _http_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    code = _HTTP_CODES.get(exc.status_code, f"HTTP_{exc.status_code}")
    return error_response(exc.status_code, code, str(exc.detail))


async def _unexpected(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error", exc_info=exc)
    return error_response(500, "INTERNAL_ERROR", "Unexpected server error.")


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, _api_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_exception_handler(Exception, _unexpected)
