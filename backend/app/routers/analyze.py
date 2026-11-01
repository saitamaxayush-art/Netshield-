"""POST /api/analyze: thin HTTP layer over backend.app.graph_ops."""

import time

from fastapi import APIRouter, Response

from backend.app import graph_ops
from backend.app.models import AnalyzeRequest, AnalyzeResponse, Meta
from backend.app.routers.common import ERROR_RESPONSES
from backend.app.version import API_VERSION, ENGINE_VERSION

router = APIRouter(tags=["analysis"])


@router.post("/api/analyze", response_model=AnalyzeResponse, responses=ERROR_RESPONSES)
def analyze(request: AnalyzeRequest, response: Response) -> AnalyzeResponse:
    started = time.perf_counter()
    current, healthy = graph_ops.analyze_with_comparison(request)
    # Timing goes in a header so the body stays byte identical for identical requests.
    response.headers["Server-Timing"] = f"compute;dur={(time.perf_counter() - started) * 1000:.2f}"
    return AnalyzeResponse(
        current=current, healthy=healthy, meta=Meta(engineVersion=ENGINE_VERSION, apiVersion=API_VERSION)
    )
