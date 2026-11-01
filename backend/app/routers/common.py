"""Shared OpenAPI declarations for routers."""

from typing import Any

from backend.app.errors import ErrorResponse

# FastAPI types `responses` as dict[int | str, dict[str, Any]]; the value shape is FastAPI's, not ours.
ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    422: {"model": ErrorResponse, "description": "Validation error or limit exceeded (API_CONTRACT.md section 5)."},
    500: {"model": ErrorResponse, "description": "Unexpected server error."},
}
