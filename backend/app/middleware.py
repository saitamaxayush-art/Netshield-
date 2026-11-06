"""ASGI middleware: request body size limit and structured request logging.

Logging never includes request or response bodies (graph contents). One JSON line per request with:
request id, method, path, status, duration in ms and request body size in bytes.
"""

import json
import logging
import time
import uuid
from collections.abc import Awaitable, Callable, MutableMapping
from typing import Any, TextIO

from backend.app.settings import MAX_REQUEST_BYTES

Scope = MutableMapping[str, Any]
Message = MutableMapping[str, Any]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]
ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]

logger = logging.getLogger("netshield.requests")


class JsonFormatter(logging.Formatter):
    """Formats a record as one JSON object: time, level, event and the record's `fields`."""

    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, object] = {
            "time": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname.lower(),
            "event": record.getMessage(),
        }
        fields = getattr(record, "fields", None)
        if isinstance(fields, dict):
            entry.update(fields)
        return json.dumps(entry, separators=(",", ":"))


class _NetShieldHandler(logging.StreamHandler[TextIO]):
    """Marker type, so the handler is added once however often the app is created."""


def configure_logging() -> None:
    """Attach the JSON formatter to the netshield loggers once (stderr)."""
    root = logging.getLogger("netshield")
    if any(isinstance(h, _NetShieldHandler) for h in root.handlers):
        return
    handler = _NetShieldHandler()
    handler.setFormatter(JsonFormatter())
    root.addHandler(handler)
    root.setLevel(logging.INFO)
    root.propagate = False


async def _send_json(send: Send, status: int, body: dict[str, object]) -> None:
    payload = json.dumps(body).encode()
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(payload)).encode())],
        }
    )
    await send({"type": "http.response.body", "body": payload})


def _too_large(limit: int) -> dict[str, object]:
    return {
        "error": {
            "code": "PAYLOAD_TOO_LARGE",
            "message": f"Request body is larger than {limit} bytes.",
            "details": {"limit": "maxRequestBytes", "max": limit},
        }
    }


class BodyLimitAndLogging:
    """Rejects bodies above MAX_REQUEST_BYTES with 413 before the app reads them, and logs each request."""

    def __init__(self, app: ASGIApp, max_bytes: int = MAX_REQUEST_BYTES) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        started = time.perf_counter()
        request_id = uuid.uuid4().hex[:12]
        status = 500
        size = 0

        async def send_logged(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = int(message["status"])
                message.setdefault("headers", []).append((b"x-request-id", request_id.encode()))
            await send(message)

        try:
            declared = dict(scope.get("headers", [])).get(b"content-length")
            if declared is not None and declared.isdigit() and int(declared) > self.max_bytes:
                size = int(declared)
                await _send_json(send_logged, 413, _too_large(self.max_bytes))
                return
            # Read the body here, counting bytes, so a chunked upload without a length is limited too.
            chunks: list[bytes] = []
            more = True
            while more:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                chunk = message.get("body", b"")
                size += len(chunk)
                if size > self.max_bytes:
                    await _send_json(send_logged, 413, _too_large(self.max_bytes))
                    return
                chunks.append(chunk)
                more = bool(message.get("more_body", False))
            body = b"".join(chunks)
            replayed = False

            async def replay() -> Message:
                nonlocal replayed
                if not replayed:
                    replayed = True
                    return {"type": "http.request", "body": body, "more_body": False}
                return await receive()

            await self.app(scope, replay, send_logged)
        finally:
            logger.info(
                "request",
                extra={
                    "fields": {
                        "requestId": request_id,
                        "method": scope.get("method"),
                        "path": scope.get("path"),
                        "status": status,
                        "durationMs": round((time.perf_counter() - started) * 1000, 2),
                        "requestBytes": size,
                    }
                },
            )
