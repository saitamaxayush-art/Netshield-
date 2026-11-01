"""ASGI entry point kept at backend.main:app for existing scripts (uvicorn, OpenAPI export)."""

from backend.app.main import DEV_ORIGINS, app, cors_origins_from_env

__all__ = ["DEV_ORIGINS", "app", "cors_origins_from_env"]
