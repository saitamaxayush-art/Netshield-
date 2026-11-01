"""NetShield FastAPI application: CORS, error handling and routers."""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.error_handlers import install_error_handlers
from backend.app.routers import analyze, health, simulate
from backend.app.version import API_VERSION

# CORS. In development the Vite dev server proxies /api, so the browser never makes a cross origin
# call. In production set NETSHIELD_CORS_ORIGINS to a comma separated list of allowed origins.
DEV_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"


def cors_origins_from_env(raw: str | None) -> list[str]:
    """Parse NETSHIELD_CORS_ORIGINS; fall back to the local dev origins when unset."""
    value = raw if raw and raw.strip() else DEV_ORIGINS
    return [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]


def create_app() -> FastAPI:
    app = FastAPI(
        title="NetShield Reliability API",
        description="Authoritative graph theoretic network reliability and failure simulation service.",
        version=API_VERSION,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins_from_env(os.environ.get("NETSHIELD_CORS_ORIGINS")),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type"],
    )
    install_error_handlers(app)
    app.include_router(health.router)
    app.include_router(analyze.router)
    app.include_router(simulate.router)
    return app


app = create_app()
