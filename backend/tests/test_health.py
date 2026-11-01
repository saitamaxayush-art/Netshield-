"""Health endpoints and CORS configuration (moved from the old backend/test_main.py)."""

from fastapi.testclient import TestClient

from backend.app.main import DEV_ORIGINS, cors_origins_from_env
from backend.main import app

client = TestClient(app)


def test_legacy_health_path() -> None:
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_api_health_through_api_prefix() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["engine"] == "NetworkX"


def test_cors_origins_from_env() -> None:
    assert cors_origins_from_env(None) == DEV_ORIGINS.split(",")
    assert cors_origins_from_env("  ") == DEV_ORIGINS.split(",")
    assert cors_origins_from_env("https://a.example/, https://b.example") == ["https://a.example", "https://b.example"]


def test_cors_allows_configured_origin_only() -> None:
    allowed = client.options(
        "/api/health", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"}
    )
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:5173"
    blocked = client.options(
        "/api/health", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"}
    )
    assert "access-control-allow-origin" not in blocked.headers
