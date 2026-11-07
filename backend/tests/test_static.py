"""Production static serving (NETSHIELD_STATIC_DIR): files, client side routes, API 404s, no traversal."""

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<!doctype html><title>NetShield</title>")
    (tmp_path / "assets" / "app-123.js").write_text("console.log(1)")
    (tmp_path / "robots.txt").write_text("User-agent: *")
    (tmp_path.parent / "secret.txt").write_text("outside the build folder")
    monkeypatch.setenv("NETSHIELD_STATIC_DIR", str(tmp_path))
    return TestClient(create_app(), raise_server_exceptions=False)


def test_serves_files_and_client_routes(client: TestClient) -> None:
    asset = client.get("/assets/app-123.js")
    assert asset.status_code == 200 and asset.text == "console.log(1)"
    assert "immutable" in asset.headers["cache-control"]
    assert client.get("/robots.txt").text == "User-agent: *"
    for route in ["/", "/studio", "/dashboard?x=1", "/no/such/page"]:
        page = client.get(route)
        assert page.status_code == 200, route
        assert "<title>NetShield</title>" in page.text
        assert page.headers["cache-control"] == "no-cache"


def test_api_keeps_working_and_unknown_api_paths_keep_the_json_404(client: TestClient) -> None:
    assert client.get("/api/health").json()["status"] == "ok"
    missing = client.get("/api/nope")
    assert missing.status_code == 404
    assert missing.json() == {"error": {"code": "NOT_FOUND", "message": "Not Found"}}
    assert client.post("/api/analyze", json={"nodes": [], "edges": []}).status_code == 200
    wrong_method = client.get("/api/analyze")
    assert wrong_method.status_code == 405
    assert wrong_method.json()["error"]["code"] == "METHOD_NOT_ALLOWED"


def test_no_path_traversal(client: TestClient) -> None:
    for path in ["/../secret.txt", "/%2e%2e/secret.txt", "/assets/../../secret.txt"]:
        response = client.get(path)
        assert "outside the build folder" not in response.text, path


def test_missing_index_is_a_clear_startup_error(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("NETSHIELD_STATIC_DIR", str(tmp_path))
    with pytest.raises(RuntimeError, match="no index.html"):
        create_app()
