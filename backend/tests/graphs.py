"""Builders for request bodies used across the tests. Bodies are plain JSON dicts."""

from typing import Required, TypedDict, Unpack

from backend.app.graph_ops import analyze
from backend.app.models import Analysis, AnalyzeRequest


class NodeBody(TypedDict, total=False):
    id: str
    label: str
    type: str
    failed: bool


class EdgeBody(TypedDict, total=False):
    id: str
    source: str
    target: str
    failed: bool
    weight: float
    failureProbability: float


class Options(TypedDict, total=False):
    startNodeId: str
    pathSource: str
    pathTarget: str
    useWeights: bool
    compareHealthy: bool


class Body(Options, total=False):
    nodes: Required[list[NodeBody]]
    edges: Required[list[EdgeBody]]


def node(node_id: str, failed: bool = False) -> NodeBody:
    return {"id": node_id, "label": f"Node {node_id}", "type": "router", "failed": failed}


def edge(edge_id: str, source: str, target: str, failed: bool = False, weight: float | None = None) -> EdgeBody:
    body: EdgeBody = {"id": edge_id, "source": source, "target": target, "failed": failed}
    if weight is not None:
        body["weight"] = weight
    return body


def body(nodes: list[NodeBody], edges: list[EdgeBody], **options: Unpack[Options]) -> Body:
    return {"nodes": nodes, "edges": edges, **options}


def with_options(base: Body, **options: Unpack[Options]) -> Body:
    return {**base, **options}


def with_failures(base: Body, nodes: tuple[str, ...] = (), edges: tuple[str, ...] = ()) -> Body:
    """A copy of a body with exactly the given node and edge ids marked failed."""
    return {
        **base,
        "nodes": [{**n, "failed": n["id"] in nodes} for n in base["nodes"]],
        "edges": [{**e, "failed": e["id"] in edges} for e in base["edges"]],
    }


def letters(n: int) -> list[str]:
    return [chr(ord("A") + i) for i in range(n)]


def path_graph(n: int) -> Body:
    ids = letters(n)
    return body([node(i) for i in ids], [edge(f"e{a}{b}", a, b) for a, b in zip(ids, ids[1:], strict=False)])


def cycle_graph(n: int) -> Body:
    ids = letters(n)
    return body(
        [node(i) for i in ids], [edge(f"e{ids[i]}{ids[(i + 1) % n]}", ids[i], ids[(i + 1) % n]) for i in range(n)]
    )


def star_graph(leaves: int) -> Body:
    leaf_ids = [f"L{i}" for i in range(1, leaves + 1)]
    return body([node("hub"), *(node(i) for i in leaf_ids)], [edge(f"e{i}", "hub", i) for i in leaf_ids])


def complete_graph(n: int) -> Body:
    ids = letters(n)
    edges = [edge(f"e{a}{b}", a, b) for i, a in enumerate(ids) for b in ids[i + 1 :]]
    return body([node(i) for i in ids], edges)


def two_triangles_joined() -> Body:
    """Triangle A-B-C and triangle D-E-F joined by the single edge C-D."""
    pairs = [("A", "B"), ("B", "C"), ("A", "C"), ("C", "D"), ("D", "E"), ("E", "F"), ("D", "F")]
    return body([node(i) for i in letters(6)], [edge(f"e{a}{b}", a, b) for a, b in pairs])


def run(request_body: Body) -> Analysis:
    """Validate a body exactly as the API does and analyse it."""
    return analyze(AnalyzeRequest.model_validate(request_body))
