"""Pure, side effect free graph analysis on the operational graph (API_CONTRACT.md sections 3 and 7).

No FastAPI imports. Every function takes validated models and returns new values. Determinism: nodes
and edges are inserted into NetworkX in ascending id order, traversals sort neighbours by id, and
every output list or map is sorted by id, so the result does not depend on request ordering.
"""

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Literal

import networkx as nx

from backend.app.models import (
    Analysis,
    AnalyzeRequest,
    ArticulationPoints,
    BfsStep,
    Bridges,
    Components,
    Connectivity,
    DegreeEntry,
    Degrees,
    Edge,
    GraphRequest,
    Node,
    PathResult,
    Summary,
    Traversal,
    TraversalError,
)


@dataclass(frozen=True)
class OperationalGraph:
    """The operational graph plus the lookups needed to map results back to request ids."""

    graph: nx.Graph[str]
    edge_id_by_pair: dict[frozenset[str], str]
    weight_by_pair: dict[frozenset[str], float]
    failed_node_ids: frozenset[str]


def build_operational_graph(request: GraphRequest) -> OperationalGraph:
    """Operational nodes (not failed) and operational edges (not failed, both endpoints operational)."""
    failed = frozenset(node.id for node in request.nodes if node.failed)
    graph: nx.Graph[str] = nx.Graph()
    graph.add_nodes_from(sorted(node.id for node in request.nodes if not node.failed))
    edge_id_by_pair: dict[frozenset[str], str] = {}
    weight_by_pair: dict[frozenset[str], float] = {}
    for edge in sorted(request.edges, key=lambda e: e.id):
        if edge.failed or edge.source in failed or edge.target in failed:
            continue
        pair = frozenset((edge.source, edge.target))
        weight = edge.weight if edge.weight is not None else 1.0
        graph.add_edge(edge.source, edge.target, weight=weight)
        edge_id_by_pair[pair] = edge.id
        weight_by_pair[pair] = weight
    return OperationalGraph(graph, edge_id_by_pair, weight_by_pair, failed)


def clear_failures(request: AnalyzeRequest) -> AnalyzeRequest:
    """The same request with every failed flag cleared (the healthy baseline for comparisons)."""
    nodes = [node.model_copy(update={"failed": False}) for node in request.nodes]
    edges = [edge.model_copy(update={"failed": False}) for edge in request.edges]
    return request.model_copy(update={"nodes": nodes, "edges": edges})


def sorted_components(op: OperationalGraph) -> list[list[str]]:
    """Components with ascending node ids, ordered largest first, ties by smallest node id."""
    items = [sorted(component) for component in nx.connected_components(op.graph)]
    return sorted(items, key=lambda c: (-len(c), c[0]))


def summarize(nodes: list[Node], edges: list[Edge], op: OperationalGraph) -> Summary:
    operational_nodes = op.graph.number_of_nodes()
    operational_edges = op.graph.number_of_edges()
    density = float(nx.density(op.graph)) if operational_nodes >= 2 else 0.0
    return Summary(
        nodeCount=len(nodes),
        edgeCount=len(edges),
        operationalNodeCount=operational_nodes,
        operationalEdgeCount=operational_edges,
        failedNodeCount=sum(1 for node in nodes if node.failed),
        failedEdgeCount=sum(1 for edge in edges if edge.failed),
        unavailableEdgeCount=len(edges) - operational_edges,
        density=density,
    )


def connectivity(component_count: int) -> Connectivity:
    if component_count == 0:
        return Connectivity(connected=False, componentCount=0, reasonKey="empty_network", reason="Empty network")
    if component_count == 1:
        return Connectivity(connected=True, componentCount=1, reasonKey="single_component", reason="Single component")
    return Connectivity(
        connected=False,
        componentCount=component_count,
        reasonKey="multiple_components",
        reason=f"{component_count} components",
    )


def components(nodes: list[Node], items: list[list[str]]) -> Components:
    index_of = {node_id: i for i, component in enumerate(items) for node_id in component}
    component_of: dict[str, int | None] = {node_id: index_of.get(node_id) for node_id in sorted(n.id for n in nodes)}
    return Components(items=items, componentOf=component_of)


def degrees(nodes: list[Node], edges: list[Edge], op: OperationalGraph) -> Degrees:
    stored = {node.id: 0 for node in nodes}
    for edge in edges:
        stored[edge.source] += 1
        stored[edge.target] += 1
    by_node = {
        node_id: DegreeEntry(
            operational=op.graph.degree(node_id) if node_id in op.graph else 0,
            stored=stored[node_id],
        )
        for node_id in sorted(stored)
    }
    return Degrees(byNode=by_node)


def _bridge_pairs(component: nx.Graph[str]) -> list[tuple[str, str]]:
    # types-networkx 3.6.1 declares nx.bridges as yielding nodes; it yields (u, v) edge tuples.
    pairs: list[tuple[str, str]] = list(nx.bridges(component))  # type: ignore[arg-type]
    return pairs


def bridges(op: OperationalGraph, items: list[list[str]]) -> Bridges:
    """Bridges per component (a component needs at least two nodes to have an edge)."""
    edge_ids: list[str] = []
    for component in items:
        if len(component) < 2:
            continue
        for u, v in _bridge_pairs(op.graph.subgraph(component)):
            edge_ids.append(op.edge_id_by_pair[frozenset((u, v))])
    return Bridges(edgeIds=sorted(edge_ids))


def articulation_points(op: OperationalGraph, items: list[list[str]]) -> ArticulationPoints:
    """Articulation points per component (a component needs at least three nodes to have one)."""
    node_ids: list[str] = []
    for component in items:
        if len(component) < 3:
            continue
        node_ids.extend(nx.articulation_points(op.graph.subgraph(component)))
    return ArticulationPoints(nodeIds=sorted(node_ids))


def traversal(op: OperationalGraph, start: str) -> Traversal:
    """BFS with layers and DFS preorder from start, neighbours in ascending id order."""
    if start in op.failed_node_ids:
        return Traversal(
            startNodeId=start,
            error=TraversalError(
                code="START_NODE_FAILED", message=f"Start node '{start}' is failed, so no traversal is possible."
            ),
            bfs=[],
            dfs=[],
        )
    layer = {start: 0}
    bfs = [BfsStep(nodeId=start, layer=0)]
    for parent, child in nx.bfs_edges(op.graph, start, sort_neighbors=sorted):
        layer[child] = layer[parent] + 1
        bfs.append(BfsStep(nodeId=child, layer=layer[child]))
    dfs = list(nx.dfs_preorder_nodes(op.graph, start, sort_neighbors=sorted))
    return Traversal(startNodeId=start, error=None, bfs=bfs, dfs=dfs)


def _distances_to(op: OperationalGraph, target: str, weighted: bool) -> dict[str, float]:
    if weighted:
        return dict(nx.single_source_dijkstra_path_length(op.graph, target, weight="weight"))
    return {node: float(hops) for node, hops in nx.single_source_shortest_path_length(op.graph, target).items()}


def _step_cost(op: OperationalGraph, u: str, v: str, weighted: bool) -> float:
    return op.weight_by_pair[frozenset((u, v))] if weighted else 1.0


PathReason = Literal["SOURCE_FAILED", "TARGET_FAILED", "DISCONNECTED"]
PathReasonKey = Literal["path_source_failed", "path_target_failed", "path_disconnected"]


def shortest_path(
    op: OperationalGraph, edges: Iterable[Edge], source: str, target: str, use_weights: bool
) -> PathResult:
    """One shortest path: among all shortest paths, the lexicographically smallest node sequence.

    Distances to the target are computed once; the path is then walked greedily from the source,
    always taking the smallest neighbour id that stays on a shortest path. For weighted paths the
    test `dist[v] + w == dist[u]` uses the same addition Dijkstra performed, so the Dijkstra
    predecessor always qualifies and the walk cannot get stuck.
    """
    all_weighted = all(edge.weight is not None for edge in edges)
    weighted = use_weights and all_weighted

    def result(
        found: bool,
        reason: PathReason | None = None,
        reason_key: PathReasonKey | None = None,
        node_ids: list[str] | None = None,
        length: float | None = None,
    ) -> PathResult:
        return PathResult(
            source=source,
            target=target,
            metric="weight" if weighted else "hops",
            weightsIgnoredReason="MISSING_WEIGHTS" if use_weights and not all_weighted else None,
            found=found,
            reason=reason,
            reasonKey=reason_key,
            nodeIds=node_ids,
            edgeIds=None
            if node_ids is None
            else [op.edge_id_by_pair[frozenset((a, b))] for a, b in zip(node_ids, node_ids[1:], strict=False)],
            hops=None if node_ids is None else len(node_ids) - 1,
            length=length,
            explanationKey="shortest_path_weighted" if weighted else "shortest_path_hops",
        )

    if source in op.failed_node_ids:
        return result(False, "SOURCE_FAILED", "path_source_failed")
    if target in op.failed_node_ids:
        return result(False, "TARGET_FAILED", "path_target_failed")

    dist = _distances_to(op, target, weighted)
    if source not in dist:
        return result(False, "DISCONNECTED", "path_disconnected")

    path = [source]
    current = source
    while current != target:
        current = next(
            v
            for v in sorted(op.graph.neighbors(current))
            if v in dist and dist[v] + _step_cost(op, current, v, weighted) == dist[current]
        )
        path.append(current)
    return result(True, node_ids=path, length=dist[source] if weighted else float(len(path) - 1))


def analyze(request: AnalyzeRequest) -> Analysis:
    """Full analysis of one request (failures as given)."""
    op = build_operational_graph(request)
    items = sorted_components(op)
    path = None
    if request.pathSource is not None and request.pathTarget is not None:
        path = shortest_path(op, request.edges, request.pathSource, request.pathTarget, request.useWeights)
    return Analysis(
        summary=summarize(request.nodes, request.edges, op),
        connectivity=connectivity(len(items)),
        components=components(request.nodes, items),
        degrees=degrees(request.nodes, request.edges, op),
        bridges=bridges(op, items),
        articulationPoints=articulation_points(op, items),
        traversal=traversal(op, request.startNodeId) if request.startNodeId is not None else None,
        path=path,
    )


def analyze_with_comparison(request: AnalyzeRequest) -> tuple[Analysis, Analysis | None]:
    """The analysis as requested, plus the healthy baseline when compareHealthy is set."""
    current = analyze(request)
    healthy = analyze(clear_failures(request)) if request.compareHealthy else None
    return current, healthy
