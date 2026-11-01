"""POST /api/simulate and POST /api/reliability-sweep (API_CONTRACT.md sections 8 and 9).

The trial loop is CPU bound, so it runs in a worker thread (run_in_threadpool) and the event loop
stays free for other requests. The loop checks the server side time budget and stops with a TIMEOUT
error (HTTP 504) when it is exceeded.
"""

import secrets
import time
from typing import Any

from fastapi import APIRouter
from starlette.concurrency import run_in_threadpool

from backend.app import settings, simulation
from backend.app.errors import ApiError, ErrorResponse
from backend.app.models import (
    CriticalEdge,
    HistogramBin,
    Meta,
    SimulateRequest,
    SimulateResponse,
    SimulationOptions,
    SweepPoint,
    SweepRequest,
    SweepResponse,
    Wilson95,
)
from backend.app.routers.common import ERROR_RESPONSES
from backend.app.version import API_VERSION, ENGINE_VERSION

router = APIRouter(tags=["simulation"])

# FastAPI types `responses` as dict[int | str, dict[str, Any]]; the value shape is FastAPI's, not ours.
SIMULATION_RESPONSES: dict[int | str, dict[str, Any]] = {
    **ERROR_RESPONSES,
    504: {"model": ErrorResponse, "description": "The run exceeded the server side time budget (code TIMEOUT)."},
}


def _pct(value: float) -> str:
    return f"{value:g}"


def _assumptions(
    request: SimulationOptions, graph: simulation.CompiledGraph, edge_text: str, trials_text: str, seed: int
) -> list[str]:
    own = sum(1 for p in graph.edge_own_probability if p is not None)
    failed_nodes = sum(1 for n in request.nodes if n.failed)
    failed_edges = sum(1 for e in request.edges if e.failed)
    terminals = request.terminals()
    success = (
        f"A trial succeeds when nodes {terminals[0]} and {terminals[1]} both survive and are connected (two-terminal)."
        if terminals
        else "A trial succeeds when the surviving network has at least one node and exactly one connected component "
        "(all-terminal)."
    )
    return [
        f"Each operational link fails independently with probability {edge_text}"
        + (f", except {own} link(s) with their own failureProbability." if own else "."),
        f"Each operational node fails independently with probability {_pct(request.nodeFailureProbability)}.",
        f"Nodes and links marked failed in the request stay failed in every trial ({failed_nodes} node(s), "
        f"{failed_edges} link(s)); a link whose endpoint failed is unavailable in that trial.",
        success,
        f"{trials_text} with seed {seed}; the interval is the Wilson score interval at 95 percent.",
    ]


def _meta() -> Meta:
    return Meta(engineVersion=ENGINE_VERSION, apiVersion=API_VERSION)


async def _run(plans: list[simulation.Plan], trials: int, seed: int) -> tuple[list[simulation.Tally], float]:
    budget_ms = settings.SIMULATION_TIME_BUDGET_MS
    started = time.perf_counter()
    try:
        tallies = await run_in_threadpool(simulation.run, plans, trials, seed, budget_ms / 1000)
    except simulation.SimulationTimeout as timeout:
        raise ApiError(
            "TIMEOUT",
            f"The simulation did not finish within the server time budget of {budget_ms:.0f} ms "
            f"(stopped after {timeout.completed_trials} of {trials} trials). Use fewer trials or a smaller graph.",
            {"budgetMs": round(budget_ms), "completedTrials": timeout.completed_trials, "requestedTrials": trials},
            status_code=504,
        ) from timeout
    return tallies, round((time.perf_counter() - started) * 1000, 2)


def _critical_edge(graph: simulation.CompiledGraph, tally: simulation.Tally) -> CriticalEdge | None:
    """The edge that was pivotal in the most trials; ties go to the smallest edge id."""
    top = max(tally.pivotal_counts, default=0)
    if top == 0:
        return None
    edge_id = min(graph.edge_ids[i] for i, count in enumerate(tally.pivotal_counts) if count == top)
    return CriticalEdge(edgeId=edge_id, pivotalTrials=top, share=top / tally.trials)


@router.post("/api/simulate", response_model=SimulateResponse, responses=SIMULATION_RESPONSES)
async def simulate(request: SimulateRequest) -> SimulateResponse:
    seed = request.seed if request.seed is not None else secrets.randbits(32)
    graph = simulation.compile_graph(request)
    plan = simulation.make_plan(
        graph, request.edgeFailureProbability, request.nodeFailureProbability, request.terminals()
    )
    (tally,), elapsed = await _run([plan], request.trials, seed)
    low, high = simulation.wilson_95(tally.successes, tally.trials)
    return SimulateResponse(
        mode=request.mode,
        source=request.source,
        target=request.target,
        trials=tally.trials,
        connectedTrials=tally.successes,
        estimate=tally.successes / tally.trials,
        standardError=simulation.standard_error(tally.successes, tally.trials),
        wilson95=Wilson95(low=low, high=high),
        seed=seed,
        edgeFailureProbability=request.edgeFailureProbability,
        nodeFailureProbability=request.nodeFailureProbability,
        averageComponents=tally.component_sum / tally.trials,
        componentHistogram=[HistogramBin(components=k, trials=v) for k, v in sorted(tally.histogram.items())],
        criticalEdge=_critical_edge(graph, tally),
        assumptions=_assumptions(request, graph, _pct(request.edgeFailureProbability), f"{tally.trials} trials", seed),
        elapsedMs=elapsed,
        meta=_meta(),
    )


@router.post("/api/reliability-sweep", response_model=SweepResponse, responses=SIMULATION_RESPONSES)
async def reliability_sweep(request: SweepRequest) -> SweepResponse:
    seed = request.seed if request.seed is not None else secrets.randbits(32)
    graph = simulation.compile_graph(request)
    ps = request.probabilities()
    plans = [simulation.make_plan(graph, p, request.nodeFailureProbability, request.terminals()) for p in ps]
    tallies, elapsed = await _run(plans, request.trialsPerPoint, seed)
    points = []
    for p, tally in zip(ps, tallies, strict=True):
        low, high = simulation.wilson_95(tally.successes, tally.trials)
        points.append(
            SweepPoint(
                p=p,
                estimate=tally.successes / tally.trials,
                connectedTrials=tally.successes,
                standardError=simulation.standard_error(tally.successes, tally.trials),
                wilson95=Wilson95(low=low, high=high),
            )
        )
    edge_text = f"p from {_pct(request.pMin)} to {_pct(request.pMax)} in {request.points} step(s)"
    assumptions = _assumptions(request, graph, edge_text, f"{request.trialsPerPoint} trials per point", seed)
    assumptions.append(
        "Every point reuses the same random draws (common random numbers), so the estimate never increases with p."
    )
    return SweepResponse(
        mode=request.mode,
        source=request.source,
        target=request.target,
        trialsPerPoint=request.trialsPerPoint,
        seed=seed,
        nodeFailureProbability=request.nodeFailureProbability,
        points=points,
        assumptions=assumptions,
        elapsedMs=elapsed,
        meta=_meta(),
    )
