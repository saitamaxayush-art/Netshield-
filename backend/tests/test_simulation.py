"""Statistical correctness and API tests for /api/simulate and /api/reliability-sweep.

Oracles: closed forms, exact enumeration (backend/tests/exact.py, NetworkX based), and NetworkX for
single trial outcomes. Monte Carlo checks use fixed seeds, so they are deterministic; tolerances are
4 standard errors of the exact value, sqrt(R (1 - R) / N).
"""

import asyncio
import math
import random
import time
from collections.abc import Iterator

import httpx
import networkx as nx
import pytest
from fastapi.testclient import TestClient
from hypothesis import given
from hypothesis import strategies as st

from backend.app import settings, simulation
from backend.app.models import SimulateRequest
from backend.main import app
from backend.tests.exact import exact_reliability
from backend.tests.graphs import (
    Body,
    EdgeBody,
    NodeBody,
    body,
    complete_graph,
    cycle_graph,
    edge,
    node,
    path_graph,
    star_graph,
    two_triangles_joined,
    with_failures,
)

client = TestClient(app)


def simulate(graph: Body, **options: object) -> dict[str, object]:
    response = client.post("/api/simulate", json={**graph, **options})
    assert response.status_code == 200, response.text
    data: dict[str, object] = response.json()
    return data


def sweep(graph: Body, **options: object) -> dict[str, object]:
    response = client.post("/api/reliability-sweep", json={**graph, **options})
    assert response.status_code == 200, response.text
    data: dict[str, object] = response.json()
    return data


def estimate_of(data: dict[str, object]) -> float:
    value = data["estimate"]
    assert isinstance(value, float | int)
    return float(value)


def within_4_se(estimate: float, exact: float, trials: int) -> bool:
    return abs(estimate - exact) <= 4 * math.sqrt(exact * (1 - exact) / trials) + 1e-12


def single_edge() -> Body:
    return body([node("A"), node("B")], [edge("e1", "A", "B")])


# --- Exact enumerator against closed forms ---------------------------------------------------------


@pytest.mark.parametrize("p", [0.0, 0.05, 0.2, 0.5, 0.9, 1.0])
def test_exact_matches_closed_forms(p: float) -> None:
    assert exact_reliability(single_edge(), p) == pytest.approx(1 - p)
    for n in (3, 5, 7):
        assert exact_reliability(path_graph(n), p) == pytest.approx((1 - p) ** (n - 1))
    for n in (3, 4, 6):
        assert exact_reliability(cycle_graph(n), p) == pytest.approx((1 - p) ** n + n * p * (1 - p) ** (n - 1))


def test_exact_with_node_failures_and_two_terminal() -> None:
    # Single edge, node failures q: all-terminal succeeds if both nodes and the edge survive, or
    # exactly one node survives (a single node is connected).
    p, q = 0.2, 0.1
    expected = (1 - q) ** 2 * (1 - p) + 2 * q * (1 - q)
    assert exact_reliability(single_edge(), p, q) == pytest.approx(expected)
    assert exact_reliability(single_edge(), p, q, ("A", "B")) == pytest.approx((1 - q) ** 2 * (1 - p))


# --- Monte Carlo against exact ----------------------------------------------------------------------

SHAPES = {
    "star": star_graph(5),
    "path": path_graph(5),
    "cycle": cycle_graph(6),
    "K4": complete_graph(4),
    "two triangles": two_triangles_joined(),
}


@pytest.mark.parametrize("name", list(SHAPES))
@pytest.mark.parametrize("p", [0.05, 0.2, 0.5])
def test_monte_carlo_within_4_standard_errors_of_exact(name: str, p: float) -> None:
    graph = SHAPES[name]
    trials = 4000
    data = simulate(graph, edgeFailureProbability=p, trials=trials, seed=1000 + int(p * 100))
    exact = exact_reliability(graph, p)
    assert within_4_se(estimate_of(data), exact, trials), (name, p, data["estimate"], exact)


@pytest.mark.parametrize(
    ("name", "terminals"),
    [("K4", ("A", "D")), ("cycle", ("A", "D")), ("two triangles", ("A", "F")), ("two triangles", ("A", "B"))],
)
def test_two_terminal_matches_exact(name: str, terminals: tuple[str, str]) -> None:
    graph = SHAPES[name]
    trials = 4000
    for p in (0.1, 0.4):
        data = simulate(
            graph,
            edgeFailureProbability=p,
            trials=trials,
            seed=7,
            mode="two-terminal",
            source=terminals[0],
            target=terminals[1],
        )
        exact = exact_reliability(graph, p, terminals=terminals)
        assert within_4_se(estimate_of(data), exact, trials), (name, terminals, p, data["estimate"], exact)


def test_node_failures_and_per_edge_probabilities_match_exact() -> None:
    graph = two_triangles_joined()
    graph["edges"] = [{**e, "failureProbability": 0.5} if e["id"] == "eCD" else e for e in graph["edges"]]
    trials = 6000
    data = simulate(graph, edgeFailureProbability=0.1, nodeFailureProbability=0.05, trials=trials, seed=99)
    exact = exact_reliability(graph, 0.1, 0.05)
    assert within_4_se(estimate_of(data), exact, trials), (data["estimate"], exact)


# --- Boundary values ---------------------------------------------------------------------------------


@pytest.mark.parametrize("name", list(SHAPES))
def test_p_zero_gives_one_and_p_one_gives_zero(name: str) -> None:
    graph = SHAPES[name]
    assert estimate_of(simulate(graph, edgeFailureProbability=0.0, trials=200, seed=1)) == 1.0
    assert estimate_of(simulate(graph, edgeFailureProbability=1.0, trials=200, seed=1)) == 0.0
    assert estimate_of(simulate(single_edge(), edgeFailureProbability=1.0, trials=50, seed=1)) == 0.0


def test_single_node_is_always_connected() -> None:
    data = simulate(body([node("A")], []), edgeFailureProbability=1.0, trials=50, seed=1)
    assert data["estimate"] == 1.0


def test_manual_failures_are_respected() -> None:
    cut = with_failures(two_triangles_joined(), edges=("eCD",))
    for p in (0.0, 0.3):
        assert estimate_of(simulate(cut, edgeFailureProbability=p, trials=300, seed=5)) == 0.0
    # Two-terminal inside one triangle is unaffected by the cut bridge.
    inside = simulate(cut, edgeFailureProbability=0.0, trials=50, seed=5, mode="two-terminal", source="A", target="B")
    assert inside["estimate"] == 1.0
    # A failed node takes its links: failing C splits A, B from D, E, F.
    assert (
        estimate_of(
            simulate(with_failures(two_triangles_joined(), nodes=("C",)), edgeFailureProbability=0.0, trials=20, seed=1)
        )
        == 0.0
    )
    # A failed terminal can never be reached.
    failed_terminal = with_failures(two_triangles_joined(), nodes=("A",))
    data = simulate(
        failed_terminal, edgeFailureProbability=0.0, trials=20, seed=1, mode="two-terminal", source="A", target="B"
    )
    assert data["estimate"] == 0.0


def test_all_nodes_failed_gives_zero() -> None:
    data = simulate(with_failures(path_graph(3), nodes=("A", "B", "C")), edgeFailureProbability=0.0, trials=10, seed=1)
    assert data["estimate"] == 0.0
    assert data["componentHistogram"] == [{"components": 0, "trials": 10}]


# --- Determinism ---------------------------------------------------------------------------------------


def without_timing(data: dict[str, object]) -> dict[str, object]:
    return {k: v for k, v in data.items() if k != "elapsedMs"}


def test_same_seed_gives_identical_output_and_different_seeds_differ() -> None:
    graph = two_triangles_joined()
    a = simulate(graph, edgeFailureProbability=0.3, trials=2000, seed=42)
    b = simulate(graph, edgeFailureProbability=0.3, trials=2000, seed=42)
    c = simulate(graph, edgeFailureProbability=0.3, trials=2000, seed=43)
    assert without_timing(a) == without_timing(b)
    assert a["estimate"] != c["estimate"] or a["componentHistogram"] != c["componentHistogram"]
    s1 = sweep(graph, pMin=0.0, pMax=0.5, points=6, trialsPerPoint=500, seed=42)
    s2 = sweep(graph, pMin=0.0, pMax=0.5, points=6, trialsPerPoint=500, seed=42)
    assert without_timing(s1) == without_timing(s2)


def test_omitted_seed_is_generated_returned_and_reproducible() -> None:
    graph = two_triangles_joined()
    first = simulate(graph, edgeFailureProbability=0.3, trials=500)
    seed = first["seed"]
    assert isinstance(seed, int) and 0 <= seed < 2**32
    again = simulate(graph, edgeFailureProbability=0.3, trials=500, seed=seed)
    assert without_timing(first) == without_timing(again)


def test_sweep_point_equals_simulate_at_the_same_p_and_seed() -> None:
    graph = two_triangles_joined()
    points = sweep(graph, pMin=0.0, pMax=0.4, points=5, trialsPerPoint=1500, seed=11)["points"]
    assert isinstance(points, list)
    for point in points:
        single = simulate(graph, edgeFailureProbability=point["p"], trials=1500, seed=11)
        assert single["estimate"] == point["estimate"]
        assert single["wilson95"] == point["wilson95"]


# --- Common random numbers ---------------------------------------------------------------------------


@st.composite
def random_bodies(draw: st.DrawFn) -> Body:
    n = draw(st.integers(min_value=1, max_value=8))
    ids = [f"n{i}" for i in range(n)]
    pairs = [(ids[i], ids[j]) for i in range(n) for j in range(i + 1, n)]
    chosen = [pair for pair in pairs if draw(st.booleans())]
    nodes: list[NodeBody] = [node(i, failed=draw(st.integers(0, 9)) == 0) for i in ids]
    edges: list[EdgeBody] = [edge(f"e{a}_{b}", a, b, failed=draw(st.integers(0, 9)) == 0) for a, b in chosen]
    return body(nodes, edges)


@given(random_bodies(), st.integers(0, 2**32 - 1))
def test_sweep_estimates_are_non_increasing_in_p(graph: Body, seed: int) -> None:
    points = sweep(graph, pMin=0.0, pMax=1.0, points=25, trialsPerPoint=40, seed=seed)["points"]
    assert isinstance(points, list)
    estimates = [p["estimate"] for p in points]
    assert all(later <= earlier for earlier, later in zip(estimates, estimates[1:], strict=False)), estimates


def test_sweep_probability_grid() -> None:
    data = sweep(single_edge(), pMin=0.1, pMax=0.3, points=3, trialsPerPoint=10, seed=1)
    assert isinstance(data["points"], list)
    assert [p["p"] for p in data["points"]] == [0.1, 0.2, 0.3]
    one = sweep(single_edge(), pMin=0.25, pMax=0.75, points=1, trialsPerPoint=10, seed=1)
    assert isinstance(one["points"], list)
    assert [p["p"] for p in one["points"]] == [0.25]


# --- Wilson interval coverage -------------------------------------------------------------------------


def test_wilson_interval_covers_the_exact_value_in_most_seeded_repeats(capsys: pytest.CaptureFixture[str]) -> None:
    """Nominal coverage is 95 percent. With 200 repeats the observed rate has a standard deviation of
    about 1.5 points, so the assertion uses 90 percent: a correct interval fails it with probability far
    below one in a million, while a grossly wrong one (for example a missing z factor, about 68 percent
    coverage) fails it. Formula level errors are caught by test_wilson_formula_reference_values. Seeds
    are fixed, so the result is deterministic."""
    graph = two_triangles_joined()
    p, trials = 0.15, 300
    exact = exact_reliability(graph, p)
    request = SimulateRequest.model_validate({**graph, "edgeFailureProbability": p, "trials": trials})
    plan = simulation.make_plan(simulation.compile_graph(request), p, 0.0, None)
    covered = 0
    for seed in range(200):
        (tally,) = simulation.run([plan], trials, seed, budget_seconds=60)
        low, high = simulation.wilson_95(tally.successes, tally.trials)
        covered += low <= exact <= high
    with capsys.disabled():
        print(
            f"\nWilson 95% coverage over 200 seeded repeats (exact R = {exact:.4f}, N = {trials}): {covered / 2:.1f}%"
        )
    assert covered >= 180


def test_wilson_formula_reference_values() -> None:
    # Reference values computed by hand from the contract formula.
    low, high = simulation.wilson_95(81, 100)
    assert low == pytest.approx(0.7222, abs=1e-4)
    assert high == pytest.approx(0.8749, abs=1e-4)
    assert simulation.wilson_95(0, 10)[0] == 0.0
    assert simulation.wilson_95(10, 10)[1] == 1.0


# --- Union find against NetworkX ------------------------------------------------------------------------


@given(random_bodies(), st.data())
def test_trial_evaluation_matches_networkx(graph: Body, data: st.DataObject) -> None:
    request = SimulateRequest.model_validate({**graph, "edgeFailureProbability": 0.5})
    compiled = simulation.compile_graph(request)
    node_alive = [data.draw(st.booleans()) for _ in compiled.node_ids]
    edge_alive = [data.draw(st.booleans()) for _ in compiled.edge_ids]
    terminals = None
    if len(compiled.node_ids) >= 2 and data.draw(st.booleans()):
        s, t = data.draw(st.permutations(range(len(compiled.node_ids))))[:2]
        terminals = (s, t)

    def nx_success(alive_edges: list[bool]) -> tuple[bool, int]:
        g: nx.Graph[int] = nx.Graph()
        g.add_nodes_from(i for i, up in enumerate(node_alive) if up)
        for i, up in enumerate(alive_edges):
            a, b = compiled.edge_a[i], compiled.edge_b[i]
            if up and a in g and b in g:
                g.add_edge(a, b)
        count = nx.number_connected_components(g)
        if terminals is None:
            return count == 1, count
        s, t = terminals
        return s in g and t in g and nx.has_path(g, s, t), count

    outcome = simulation.evaluate_trial(compiled, node_alive, edge_alive, terminals)
    expected_success, expected_components = nx_success(edge_alive)
    assert outcome.success == expected_success
    assert outcome.components == expected_components
    expected_pivotal = [
        i
        for i, up in enumerate(edge_alive)
        if not up and not expected_success and nx_success([True if j == i else e for j, e in enumerate(edge_alive)])[0]
    ]
    assert outcome.pivotal_edges == expected_pivotal


# --- Response content -----------------------------------------------------------------------------------


def test_histogram_average_and_critical_edge() -> None:
    data = simulate(two_triangles_joined(), edgeFailureProbability=0.2, trials=3000, seed=3)
    histogram = data["componentHistogram"]
    assert isinstance(histogram, list)
    assert sum(b["trials"] for b in histogram) == 3000
    average = sum(b["components"] * b["trials"] for b in histogram) / 3000
    assert data["averageComponents"] == pytest.approx(average)
    assert [b["components"] for b in histogram] == sorted(b["components"] for b in histogram)
    critical = data["criticalEdge"]
    assert isinstance(critical, dict)
    assert critical["edgeId"] == "eCD"  # the only bridge
    assert critical["share"] == pytest.approx(critical["pivotalTrials"] / 3000)
    assert data["connectedTrials"] == round(estimate_of(data) * 3000)
    wilson = data["wilson95"]
    assert isinstance(wilson, dict) and wilson["low"] <= estimate_of(data) <= wilson["high"]
    assumptions = data["assumptions"]
    assert isinstance(assumptions, list) and any("Wilson" in a for a in assumptions)
    assert all("—" not in a for a in assumptions)


def test_no_critical_edge_when_every_trial_succeeds() -> None:
    assert simulate(cycle_graph(5), edgeFailureProbability=0.0, trials=50, seed=1)["criticalEdge"] is None


# --- Validation and limits --------------------------------------------------------------------------------


def error_of(path: str, payload: object) -> dict[str, object]:
    response = client.post(path, json=payload)
    assert response.status_code == 422, response.text
    error = response.json()["error"]
    assert isinstance(error, dict)
    return error


def simulate_cases() -> Iterator[tuple[str, dict[str, object], str]]:
    g = two_triangles_joined()
    yield "missing edgeFailureProbability", {**g}, "VALIDATION_ERROR"
    yield "probability above 1", {**g, "edgeFailureProbability": 1.5}, "VALIDATION_ERROR"
    yield (
        "node probability below 0",
        {**g, "edgeFailureProbability": 0.1, "nodeFailureProbability": -0.1},
        "VALIDATION_ERROR",
    )
    yield "zero trials", {**g, "edgeFailureProbability": 0.1, "trials": 0}, "VALIDATION_ERROR"
    yield "trials as string", {**g, "edgeFailureProbability": 0.1, "trials": "100"}, "VALIDATION_ERROR"
    yield "negative seed", {**g, "edgeFailureProbability": 0.1, "seed": -1}, "VALIDATION_ERROR"
    yield "seed too large", {**g, "edgeFailureProbability": 0.1, "seed": 2**32}, "VALIDATION_ERROR"
    yield "unknown mode", {**g, "edgeFailureProbability": 0.1, "mode": "k-terminal"}, "VALIDATION_ERROR"
    yield (
        "two-terminal without target",
        {**g, "edgeFailureProbability": 0.1, "mode": "two-terminal", "source": "A"},
        "VALIDATION_ERROR",
    )
    yield (
        "two-terminal same node",
        {**g, "edgeFailureProbability": 0.1, "mode": "two-terminal", "source": "A", "target": "A"},
        "VALIDATION_ERROR",
    )
    yield "source in all-terminal", {**g, "edgeFailureProbability": 0.1, "source": "A"}, "VALIDATION_ERROR"
    yield (
        "unknown source",
        {**g, "edgeFailureProbability": 0.1, "mode": "two-terminal", "source": "Z", "target": "A"},
        "UNKNOWN_NODE",
    )
    yield "unknown field", {**g, "edgeFailureProbability": 0.1, "failure_prob": 0.1}, "VALIDATION_ERROR"
    yield "trials over limit", {**g, "edgeFailureProbability": 0.1, "trials": 20001}, "LIMIT_EXCEEDED"
    yield (
        "parallel edge",
        {**g, "edges": [*g["edges"], edge("dup", "B", "A")], "edgeFailureProbability": 0.1},
        "PARALLEL_EDGE",
    )


@pytest.mark.parametrize(("name", "payload", "code"), list(simulate_cases()), ids=[c[0] for c in simulate_cases()])
def test_simulate_validation(name: str, payload: dict[str, object], code: str) -> None:
    assert error_of("/api/simulate", payload)["code"] == code, name


def sweep_cases() -> Iterator[tuple[str, dict[str, object], str]]:
    g = two_triangles_joined()
    yield "missing pMax", {**g, "pMin": 0.0}, "VALIDATION_ERROR"
    yield "pMin above pMax", {**g, "pMin": 0.6, "pMax": 0.4}, "VALIDATION_ERROR"
    yield "zero points", {**g, "pMin": 0.0, "pMax": 0.5, "points": 0}, "VALIDATION_ERROR"
    yield "points over limit", {**g, "pMin": 0.0, "pMax": 0.5, "points": 26}, "LIMIT_EXCEEDED"
    yield "trials per point over limit", {**g, "pMin": 0.0, "pMax": 0.5, "trialsPerPoint": 20001}, "LIMIT_EXCEEDED"
    yield "pMax above 1", {**g, "pMin": 0.0, "pMax": 1.2}, "VALIDATION_ERROR"


@pytest.mark.parametrize(("name", "payload", "code"), list(sweep_cases()), ids=[c[0] for c in sweep_cases()])
def test_sweep_validation(name: str, payload: dict[str, object], code: str) -> None:
    assert error_of("/api/reliability-sweep", payload)["code"] == code, name


def test_limit_details_name_the_limit() -> None:
    g = two_triangles_joined()
    assert error_of("/api/simulate", {**g, "edgeFailureProbability": 0.1, "trials": 20001})["details"] == {
        "limit": "maxTrials",
        "max": 20000,
        "actual": 20001,
    }
    assert error_of("/api/reliability-sweep", {**g, "pMin": 0, "pMax": 1, "points": 26})["details"] == {
        "limit": "maxSweepPoints",
        "max": 25,
        "actual": 26,
    }
    assert simulate(g, edgeFailureProbability=0.1, trials=20000, seed=1)["trials"] == 20000
    points = sweep(g, pMin=0.0, pMax=1.0, points=25, trialsPerPoint=10, seed=1)["points"]
    assert isinstance(points, list) and len(points) == 25


# --- Time budget and event loop -----------------------------------------------------------------------------


def connected_graph(n: int, m: int, seed: int) -> Body:
    """A random connected simple graph: a random spanning tree plus random extra edges."""
    rng = random.Random(seed)
    ids = [f"n{i:03d}" for i in range(n)]
    pairs = {(rng.randrange(i), i) for i in range(1, n)}
    while len(pairs) < m:
        a, b = sorted(rng.sample(range(n), 2))
        pairs.add((a, b))
    return body([node(i) for i in ids], [edge(f"e{k:04d}", ids[a], ids[b]) for k, (a, b) in enumerate(sorted(pairs))])


def test_time_budget_returns_a_timeout_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "SIMULATION_TIME_BUDGET_MS", 1.0)
    graph = connected_graph(200, 600, 1)
    response = client.post("/api/simulate", json={**graph, "edgeFailureProbability": 0.05, "trials": 20000, "seed": 1})
    assert response.status_code == 504
    error = response.json()["error"]
    assert error["code"] == "TIMEOUT"
    assert "time budget of 1 ms" in error["message"]
    assert error["details"]["budgetMs"] == 1 and error["details"]["requestedTrials"] == 20000
    assert 0 < error["details"]["completedTrials"] < 20000
    sweep_response = client.post(
        "/api/reliability-sweep",
        json={**graph, "pMin": 0, "pMax": 0.5, "points": 25, "trialsPerPoint": 20000, "seed": 1},
    )
    assert sweep_response.status_code == 504
    assert sweep_response.json()["error"]["code"] == "TIMEOUT"


def test_simulation_does_not_block_the_event_loop() -> None:
    graph = connected_graph(200, 600, 2)

    async def scenario() -> tuple[float, float, float]:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
            started = time.perf_counter()

            async def long_run() -> float:
                r = await ac.post(
                    "/api/simulate", json={**graph, "edgeFailureProbability": 0.05, "trials": 8000, "seed": 1}
                )
                assert r.status_code == 200
                return time.perf_counter() - started

            async def health() -> float:
                await asyncio.sleep(0.1)
                sent = time.perf_counter()
                r = await ac.get("/api/health")
                assert r.status_code == 200
                return time.perf_counter() - sent

            sim_done, health_latency = await asyncio.gather(long_run(), health())
            return sim_done, health_latency, time.perf_counter() - started

    sim_done, health_latency, _ = asyncio.run(scenario())
    assert health_latency < 0.25, health_latency
    assert sim_done > 0.1 + health_latency  # health was answered while the simulation was still running


@pytest.mark.parametrize("mode", ["all-terminal", "two-terminal"])
def test_performance_200_nodes_600_edges_5000_trials(mode: str, capsys: pytest.CaptureFixture[str]) -> None:
    graph = connected_graph(200, 600, 3)
    extra = {"mode": "two-terminal", "source": "n000", "target": "n199"} if mode == "two-terminal" else {}
    # p chosen per mode so the estimate is strictly between 0 and 1 (the run does real work).
    p = 0.3 if mode == "two-terminal" else 0.02
    started = time.perf_counter()
    data = simulate(graph, edgeFailureProbability=p, trials=5000, seed=1, **extra)
    wall = (time.perf_counter() - started) * 1000
    budget = settings.SIMULATION_TIME_BUDGET_MS
    with capsys.disabled():
        print(
            f"\nperformance {mode}: 200 nodes, 600 edges, 5000 trials: elapsedMs {data['elapsedMs']}, "
            f"request {wall:.0f} ms, budget {budget:.0f} ms, estimate {data['estimate']}"
        )
    assert isinstance(data["elapsedMs"], float) and data["elapsedMs"] < budget
    assert 0 < estimate_of(data) < 1
