"""HTTP tests for POST /api/analyze: success shape, determinism, every 422 case, limits, error shape."""

import json
import random
import time
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from backend.app import graph_ops
from backend.main import app
from backend.tests.graphs import Body, EdgeBody, NodeBody, edge, node, star_graph, with_failures, with_options

client = TestClient(app)


def post(payload: object) -> tuple[int, dict[str, object]]:
    response = client.post("/api/analyze", json=payload)
    data: dict[str, object] = response.json()
    return response.status_code, data


def error_of(payload: object) -> dict[str, object]:
    status, data = post(payload)
    assert status == 422, data
    assert set(data) == {"error"}
    error = data["error"]
    assert isinstance(error, dict)
    assert set(error) <= {"code", "message", "details"}
    assert isinstance(error["message"], str) and error["message"]
    return error


# --- Success ------------------------------------------------------------------------------------


def test_success_shape_for_a_star() -> None:
    payload = with_options(star_graph(3), startNodeId="hub", pathSource="L1", pathTarget="L3", compareHealthy=True)
    response = client.post("/api/analyze", json=payload)
    assert response.status_code == 200
    assert response.headers["server-timing"].startswith("compute;dur=")
    data = response.json()
    assert set(data) == {"current", "healthy", "meta"}
    assert data["meta"]["engine"] == "networkx"
    assert data["meta"]["apiVersion"] == "2.0.0"
    current = data["current"]
    assert set(current) == {
        "summary",
        "connectivity",
        "components",
        "degrees",
        "bridges",
        "articulationPoints",
        "traversal",
        "path",
    }
    assert current["summary"] == {
        "nodeCount": 4,
        "edgeCount": 3,
        "operationalNodeCount": 4,
        "operationalEdgeCount": 3,
        "failedNodeCount": 0,
        "failedEdgeCount": 0,
        "unavailableEdgeCount": 0,
        "density": 0.5,
        "explanationKey": "density_definition",
    }
    assert current["bridges"] == {"edgeIds": ["eL1", "eL2", "eL3"], "explanationKey": "bridge_definition"}
    assert current["articulationPoints"] == {"nodeIds": ["hub"], "explanationKey": "articulation_point_definition"}
    assert current["degrees"]["byNode"]["hub"] == {"operational": 3, "stored": 3}
    assert current["traversal"]["bfs"] == [
        {"nodeId": "hub", "layer": 0},
        {"nodeId": "L1", "layer": 1},
        {"nodeId": "L2", "layer": 1},
        {"nodeId": "L3", "layer": 1},
    ]
    assert current["traversal"]["bfsExplanationKey"] == "bfs_definition"
    assert current["path"]["nodeIds"] == ["L1", "hub", "L3"]
    assert current["path"]["edgeIds"] == ["eL1", "eL3"]
    assert data["healthy"] == current  # nothing failed, so before and after are the same


def test_optional_sections_are_null_when_not_requested() -> None:
    status, data = post(star_graph(2))
    assert status == 200
    current = data["current"]
    assert isinstance(current, dict)
    assert current["traversal"] is None and current["path"] is None
    assert data["healthy"] is None


def test_compare_healthy_returns_before_and_after() -> None:
    payload = with_options(with_failures(star_graph(3), nodes=("hub",)), compareHealthy=True)
    status, data = post(payload)
    assert status == 200
    current, healthy = data["current"], data["healthy"]
    assert isinstance(current, dict) and isinstance(healthy, dict)
    assert current["connectivity"]["componentCount"] == 3
    assert healthy["connectivity"]["componentCount"] == 1
    assert healthy["summary"]["failedNodeCount"] == 0


def test_identical_requests_give_byte_identical_bodies() -> None:
    payload = with_options(
        with_failures(star_graph(5), edges=("eL2",)),
        startNodeId="L1",
        pathSource="L1",
        pathTarget="L5",
        compareHealthy=True,
    )
    first = client.post("/api/analyze", json=payload)
    second = client.post("/api/analyze", json=payload)
    assert first.content == second.content


# --- 422: schema (VALIDATION_ERROR) -------------------------------------------------------------

GOOD_NODE: NodeBody = node("A")


def schema_cases() -> Iterator[tuple[str, object, str]]:
    """(name, payload, expected details path)."""
    base_edge: EdgeBody = edge("e1", "A", "B")
    two = [node("A"), node("B")]
    yield "missing nodes", {"edges": []}, "nodes"
    yield "missing edges", {"nodes": []}, "edges"
    yield "nodes not a list", {"nodes": {}, "edges": []}, "nodes"
    yield "unknown top level field", {"nodes": [], "edges": [], "extra": 1}, "extra"
    yield "unknown node field", {"nodes": [{**GOOD_NODE, "color": "red"}], "edges": []}, "nodes[0].color"
    yield "empty node id", {"nodes": [{**GOOD_NODE, "id": ""}], "edges": []}, "nodes[0].id"
    yield "node id over 64", {"nodes": [{**GOOD_NODE, "id": "x" * 65}], "edges": []}, "nodes[0].id"
    yield "label over 100", {"nodes": [{**GOOD_NODE, "label": "x" * 101}], "edges": []}, "nodes[0].label"
    yield "missing label", {"nodes": [{"id": "A", "type": "router"}], "edges": []}, "nodes[0].label"
    yield "bad node type", {"nodes": [{**GOOD_NODE, "type": "switch"}], "edges": []}, "nodes[0].type"
    yield "failed not boolean", {"nodes": [{**GOOD_NODE, "failed": "yes"}], "edges": []}, "nodes[0].failed"
    yield "failed as integer", {"nodes": [{**GOOD_NODE, "failed": 1}], "edges": []}, "nodes[0].failed"
    yield "id as number", {"nodes": [{**GOOD_NODE, "id": 7}], "edges": []}, "nodes[0].id"
    yield "edge missing target", {"nodes": two, "edges": [{"id": "e1", "source": "A"}]}, "edges[0].target"
    yield (
        "probability above 1",
        {"nodes": two, "edges": [{**base_edge, "failureProbability": 1.5}]},
        ("edges[0].failureProbability"),
    )
    yield (
        "probability below 0",
        {"nodes": two, "edges": [{**base_edge, "failureProbability": -0.1}]},
        ("edges[0].failureProbability"),
    )
    yield "weight zero", {"nodes": two, "edges": [{**base_edge, "weight": 0}]}, "edges[0].weight"
    yield "weight negative", {"nodes": two, "edges": [{**base_edge, "weight": -2}]}, "edges[0].weight"
    yield "weight as string", {"nodes": two, "edges": [{**base_edge, "weight": "3"}]}, "edges[0].weight"
    yield "useWeights not boolean", {"nodes": two, "edges": [], "useWeights": "true"}, "useWeights"
    yield "compareHealthy not boolean", {"nodes": two, "edges": [], "compareHealthy": 1}, "compareHealthy"
    yield "empty startNodeId", {"nodes": two, "edges": [], "startNodeId": ""}, "startNodeId"
    yield "pathSource without pathTarget", {"nodes": two, "edges": [], "pathSource": "A"}, ""
    yield "pathTarget without pathSource", {"nodes": two, "edges": [], "pathTarget": "A"}, ""


@pytest.mark.parametrize(("name", "payload", "path"), list(schema_cases()), ids=[c[0] for c in schema_cases()])
def test_schema_errors_are_validation_errors(name: str, payload: object, path: str) -> None:
    error = error_of(payload)
    assert error["code"] == "VALIDATION_ERROR", name
    details = error["details"]
    assert isinstance(details, list) and details
    assert details[0]["path"] == path
    assert isinstance(details[0]["message"], str)


@pytest.mark.parametrize(
    "raw",
    [
        "{",  # not JSON
        "[]",  # JSON but not an object
        '{"nodes": [{"id": "A", "label": "", "type": "router"}, {"id": "B", "label": "", "type": "router"}],'
        ' "edges": [{"id": "e1", "source": "A", "target": "B", "weight": NaN}]}',  # NaN is not a valid weight
    ],
    ids=["invalid json", "array body", "NaN weight"],
)
def test_malformed_bodies_are_validation_errors(raw: str) -> None:
    response = client.post("/api/analyze", content=raw, headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


# --- 422: graph structure -------------------------------------------------------------------------


def test_duplicate_node_id() -> None:
    error = error_of({"nodes": [node("A"), node("A")], "edges": []})
    assert error["code"] == "DUPLICATE_NODE_ID"
    assert error["details"] == {"id": "A"}


def test_duplicate_edge_id() -> None:
    error = error_of(
        {"nodes": [node("A"), node("B"), node("C")], "edges": [edge("e1", "A", "B"), edge("e1", "B", "C")]}
    )
    assert error["code"] == "DUPLICATE_EDGE_ID"
    assert error["details"] == {"id": "e1"}


@pytest.mark.parametrize(
    ("payload", "details"),
    [
        ({"nodes": [node("A")], "edges": [edge("e1", "A", "Z")]}, {"id": "Z", "field": "edges[0].target"}),
        ({"nodes": [node("A")], "edges": [edge("e1", "Z", "A")]}, {"id": "Z", "field": "edges[0].source"}),
        ({"nodes": [node("A")], "edges": [], "startNodeId": "Z"}, {"id": "Z", "field": "startNodeId"}),
        (
            {"nodes": [node("A")], "edges": [], "pathSource": "Z", "pathTarget": "A"},
            {"id": "Z", "field": "pathSource"},
        ),
        (
            {"nodes": [node("A")], "edges": [], "pathSource": "A", "pathTarget": "Z"},
            {"id": "Z", "field": "pathTarget"},
        ),
    ],
    ids=["edge target", "edge source", "startNodeId", "pathSource", "pathTarget"],
)
def test_unknown_node(payload: Body, details: dict[str, str]) -> None:
    error = error_of(payload)
    assert error["code"] == "UNKNOWN_NODE"
    assert error["details"] == details


def test_self_loop() -> None:
    error = error_of({"nodes": [node("A")], "edges": [edge("e1", "A", "A")]})
    assert error["code"] == "SELF_LOOP"
    assert error["details"] == {"edgeId": "e1"}


@pytest.mark.parametrize("reverse", [False, True], ids=["same direction", "reverse direction"])
def test_parallel_edge(reverse: bool) -> None:
    second = edge("e2", "B", "A") if reverse else edge("e2", "A", "B")
    error = error_of({"nodes": [node("A"), node("B")], "edges": [edge("e1", "A", "B"), second]})
    assert error["code"] == "PARALLEL_EDGE"
    assert error["details"] == {"edgeIds": ["e1", "e2"], "nodes": ["A", "B"]}


# --- 422: limits ----------------------------------------------------------------------------------


def many_nodes(n: int) -> list[NodeBody]:
    return [node(f"n{i}") for i in range(n)]


def many_edges(nodes: int, count: int) -> list[EdgeBody]:
    pairs = [(i, j) for i in range(nodes) for j in range(i + 1, nodes)][:count]
    return [edge(f"e{k}", f"n{i}", f"n{j}") for k, (i, j) in enumerate(pairs)]


def test_node_limit() -> None:
    assert post({"nodes": many_nodes(200), "edges": []})[0] == 200
    error = error_of({"nodes": many_nodes(201), "edges": []})
    assert error["code"] == "LIMIT_EXCEEDED"
    assert error["details"] == {"limit": "maxNodes", "max": 200, "actual": 201}
    assert "maxNodes" in str(error["message"])


def test_edge_limit() -> None:
    assert post({"nodes": many_nodes(50), "edges": many_edges(50, 1000)})[0] == 200
    error = error_of({"nodes": many_nodes(50), "edges": many_edges(50, 1001)})
    assert error["code"] == "LIMIT_EXCEEDED"
    assert error["details"] == {"limit": "maxEdges", "max": 1000, "actual": 1001}


def test_limits_are_checked_before_structure() -> None:
    nodes = many_nodes(200) + [node("n0")]  # 201 nodes, one duplicate id
    assert error_of({"nodes": nodes, "edges": []})["code"] == "LIMIT_EXCEEDED"


def test_structure_is_checked_before_request_references() -> None:
    error = error_of({"nodes": [node("A"), node("A")], "edges": [], "startNodeId": "Z"})
    assert error["code"] == "DUPLICATE_NODE_ID"


# --- Other statuses use the same error shape ------------------------------------------------------


def test_not_found_and_method_not_allowed() -> None:
    missing = client.get("/api/does-not-exist")
    assert missing.status_code == 404
    assert missing.json() == {"error": {"code": "NOT_FOUND", "message": "Not Found"}}
    wrong = client.get("/api/analyze")
    assert wrong.status_code == 405
    assert wrong.json()["error"]["code"] == "METHOD_NOT_ALLOWED"


def test_unexpected_errors_are_500_without_internals(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(_: object) -> None:
        raise RuntimeError("secret internal detail")

    monkeypatch.setattr(graph_ops, "analyze_with_comparison", boom)
    response = TestClient(app, raise_server_exceptions=False).post("/api/analyze", json=star_graph(2))
    assert response.status_code == 500
    assert response.json() == {"error": {"code": "INTERNAL_ERROR", "message": "Unexpected server error."}}
    assert "secret" not in response.text


# --- Performance ----------------------------------------------------------------------------------


def test_200_nodes_and_1000_edges_respond_in_under_500ms() -> None:
    rng = random.Random(2026)
    pairs = [(i, j) for i in range(200) for j in range(i + 1, 200)]
    chosen = rng.sample(pairs, 1000)
    nodes = [node(f"n{i:03d}", failed=rng.random() < 0.05) for i in range(200)]
    edges = [edge(f"e{k:04d}", f"n{i:03d}", f"n{j:03d}", weight=rng.uniform(1, 10)) for k, (i, j) in enumerate(chosen)]
    payload = {
        "nodes": nodes,
        "edges": edges,
        "startNodeId": "n001",
        "pathSource": "n001",
        "pathTarget": "n199",
        "useWeights": True,
        "compareHealthy": True,
    }
    raw = json.dumps(payload)
    timings = []
    for _ in range(5):
        started = time.perf_counter()
        response = client.post("/api/analyze", content=raw, headers={"Content-Type": "application/json"})
        timings.append(time.perf_counter() - started)
        assert response.status_code == 200
    assert max(timings) < 0.5, timings
