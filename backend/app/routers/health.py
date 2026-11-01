"""Health check."""

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from backend.app.version import API_VERSION

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    engine: str
    version: str


@router.get("/api/health", response_model=HealthResponse)
def api_health() -> HealthResponse:
    return HealthResponse(status="ok", service="NetShield Backend", engine="NetworkX", version=API_VERSION)


@router.get("/health", response_model=HealthResponse, include_in_schema=False)
def health_check() -> HealthResponse:
    """Legacy path kept for existing callers; /api/health is canonical."""
    return api_health()
