"""NetShield FastAPI application: CORS, error handling and routers."""

import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.routing import Match

from backend.app.error_handlers import install_error_handlers
from backend.app.middleware import BodyLimitAndLogging, configure_logging
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
    configure_logging()
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
        expose_headers=["X-Request-Id", "Server-Timing"],
    )
    # Outermost: the size limit applies before anything reads the body, and every request is logged.
    app.add_middleware(BodyLimitAndLogging)
    install_error_handlers(app)
    app.include_router(health.router)
    app.include_router(analyze.router)
    app.include_router(simulate.router)
    static_dir = os.environ.get("NETSHIELD_STATIC_DIR")
    if static_dir:
        serve_frontend(app, Path(static_dir))
    return app


def serve_frontend(app: FastAPI, root: Path) -> None:
    """Production: serve the built frontend (frontend/dist) from the same origin as the API.

    Existing files are served as they are; any other non API path gets index.html, so client side routes
    such as /studio work on reload. /api paths that do not exist keep the JSON 404 error shape.
    """
    root = root.resolve()
    index = root / "index.html"
    if not index.is_file():
        raise RuntimeError(f"NETSHIELD_STATIC_DIR has no index.html: {root}")

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str, request: Request) -> Response:
        if path == "api" or path.startswith("api/"):
            # A known API path with the wrong method stays 405, as without static serving.
            known = any(
                route.matches({**request.scope, "method": method})[0] == Match.FULL
                for route in app.routes
                if getattr(route, "path", None) != "/{path:path}"
                for method in ("GET", "POST")
            )
            if known:
                raise StarletteHTTPException(status_code=405, detail="Method Not Allowed")
            raise StarletteHTTPException(status_code=404, detail="Not Found")
        candidate = (root / path).resolve()
        # Never serve anything outside the build folder (no path traversal).
        if path and candidate.is_relative_to(root) and candidate.is_file():
            cache = "public, max-age=31536000, immutable" if path.startswith("assets/") else "no-cache"
            return FileResponse(candidate, headers={"Cache-Control": cache})
        return FileResponse(index, headers={"Cache-Control": "no-cache"})


app = create_app()
