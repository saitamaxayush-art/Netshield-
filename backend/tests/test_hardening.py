"""Request size limit, malformed JSON, error shape on every path, and logs without graph contents."""

import json
import logging
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from backend.app import graph_ops
from backend.app.main import app, cors_origins_from_env
from backend.app.settings import MAX_REQUEST_BYTES
from backend.tests.graphs import NodeBody, body, edge, node

client = TestClient(app, raise_server_exceptions=False)


def assert_error_shape(response_json: object) -> None:
    assert isinstance(response_json, dict)
    assert set(response_json) == {"error"}
    error = response_json["error"]
    assert isinstance(error, dict)
    assert {"code", "message"} <= set(error) <= {"code", "message", "details"}


def test_body_over_the_limit_is_413_before_parsing() -> None:
    big = b'{"nodes":[' + b" " * (MAX_REQUEST_BYTES + 10) + b'],"edges":[]}'
    response = client.post("/api/analyze", content=big, headers={"Content-Type": "application/json"})
    assert response.status_code == 413
    assert_error_shape(response.json())
    assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


def test_chunked_body_without_length_is_limited_too() -> None:
    def chunks() -> Iterator[bytes]:
        yield b'{"nodes":['
        for _ in range(MAX_REQUEST_BYTES // 1000 + 2):
            yield b" " * 1000
        yield b'],"edges":[]}'

    response = client.post("/api/analyze", content=chunks(), headers={"Content-Type": "application/json"})
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


def test_a_graph_at_the_limits_fits_under_the_size_limit() -> None:
    nodes: list[NodeBody] = []
    for i in range(200):
        n = node(f"n{'x' * 60}{i:03d}")
        n["label"] = "L" * 100
        nodes.append(n)
    ids = [n["id"] for n in nodes]
    edges = [edge(f"e{'y' * 58}{i:04d}", ids[i % 200], ids[(i * 7 + 1 + i // 200) % 200]) for i in range(1000)]
    payload = json.dumps(body(nodes, edges)).encode()
    assert len(payload) < MAX_REQUEST_BYTES
    response = client.post("/api/analyze", content=payload, headers={"Content-Type": "application/json"})
    assert response.status_code in (200, 422)
    assert response.json().get("error", {}).get("code") != "PAYLOAD_TOO_LARGE"


@pytest.mark.parametrize("raw", [b'{"nodes": [', b"{nodes: []}", b"\xff\xfe", b"[1, 2"])
def test_malformed_json_is_a_clear_validation_error(raw: bytes) -> None:
    response = client.post("/api/analyze", content=raw, headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    assert_error_shape(response.json())
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert error["message"].startswith("Request body is not valid JSON")
    assert error["details"] == [{"path": "", "message": "Malformed JSON"}]


@pytest.mark.parametrize(
    ("method", "path", "status", "code"),
    [
        ("get", "/api/nope", 404, "NOT_FOUND"),
        ("delete", "/api/health", 405, "METHOD_NOT_ALLOWED"),
        ("get", "/api/analyze", 405, "METHOD_NOT_ALLOWED"),
    ],
)
def test_every_http_error_has_the_contract_shape(method: str, path: str, status: int, code: str) -> None:
    response = getattr(client, method)(path)
    assert response.status_code == status
    assert_error_shape(response.json())
    assert response.json()["error"]["code"] == code


def test_wrong_body_types_are_validation_errors_with_the_shape() -> None:
    for raw, ctype in [
        (b"[1,2]", "application/json"),
        (b"hello", "text/plain"),
        (b"", "application/json"),
        (b"null", "application/json"),
    ]:
        response = client.post("/api/simulate", content=raw, headers={"Content-Type": ctype})
        assert response.status_code == 422, raw
        assert_error_shape(response.json())


def test_health_reports_the_api_version() -> None:
    response = client.get("/api/health")
    assert response.json()["version"] == "2.0.0"
    assert response.headers["x-request-id"]


def test_cors_comes_from_the_environment() -> None:
    assert cors_origins_from_env("https://a.example, https://b.example/") == ["https://a.example", "https://b.example"]
    assert "http://localhost:5173" in cors_origins_from_env(None)
    allowed = client.options(
        "/api/analyze", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"}
    )
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:5173"
    blocked = client.options(
        "/api/analyze", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"}
    )
    assert "access-control-allow-origin" not in blocked.headers


def test_request_logs_carry_no_graph_contents(caplog: pytest.LogCaptureFixture) -> None:
    logging.getLogger("netshield").propagate = True
    try:
        with caplog.at_level(logging.INFO, logger="netshield"):
            secret = "SECRET-LABEL-7f3a"
            labelled = [node("A"), node("B")]
            for n in labelled:
                n["label"] = secret
            response = client.post("/api/analyze", json=body(labelled, [edge("e1", "A", "B")]))
            assert response.status_code == 200
        records = [r for r in caplog.records if r.name == "netshield.requests"]
        assert records, "a request log line is written"
        fields = getattr(records[-1], "fields", {})
        assert set(fields) == {"requestId", "method", "path", "status", "durationMs", "requestBytes"}
        assert fields["path"] == "/api/analyze" and fields["status"] == 200
        assert all(
            secret not in r.getMessage() and secret not in json.dumps(getattr(r, "fields", {})) for r in caplog.records
        )
    finally:
        logging.getLogger("netshield").propagate = False


def test_unhandled_errors_log_type_and_frames_but_not_the_message(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    def boom(*_: object, **__: object) -> object:
        raise RuntimeError("contains node label SECRET-9b1c")

    monkeypatch.setattr(graph_ops, "analyze_with_comparison", boom)
    logging.getLogger("netshield").propagate = True
    try:
        with caplog.at_level(logging.INFO, logger="netshield"):
            response = client.post("/api/analyze", json=body([node("A")], []))
        assert response.status_code == 500
        assert response.json() == {"error": {"code": "INTERNAL_ERROR", "message": "Unexpected server error."}}
        logged = [r for r in caplog.records if r.getMessage() == "unhandled_error"]
        assert logged and getattr(logged[0], "fields", {})["exception"] == "RuntimeError"
        assert all("SECRET-9b1c" not in (r.getMessage() + json.dumps(getattr(r, "fields", {}))) for r in caplog.records)
    finally:
        logging.getLogger("netshield").propagate = False
