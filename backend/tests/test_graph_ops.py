"""Hand verified expectations for the pure analysis functions (backend/app/graph_ops.py)."""

import random

import pytest
from hypothesis import given
from hypothesis import strategies as st

from backend.app.graph_ops import analyze, clear_failures
from backend.app.models import AnalyzeRequest
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
    run,
    star_graph,
    two_triangles_joined,
    with_failures,
    with_options,
)

# --- The shapes named in the Phase 1 brief -------------------------------------------------------


def test_path_of_5_has_4_bridges_and_3_articulation_points() -> None:
    a = run(path_graph(5))  # A-B-C-D-E
    assert a.bridges.edgeIds == ["eAB", "eBC", "eCD", "eDE"]
    assert a.articulationPoints.nodeIds == ["B", "C", "D"]
    assert a.connectivity.connected is True
    assert a.summary.density == pytest.approx(4 / 10)


def test_cycle_of_6_has_no_bridges_and_density_6_over_15() -> None:
    a = run(cycle_graph(6))
    assert a.bridges.edgeIds == []
    assert a.articulationPoints.nodeIds == []
    assert a.summary.density == pytest.approx(6 / 15)
    assert a.connectivity.reason == "Single component"


def test_star_with_6_leaves_has_6_bridges_and_the_hub_as_only_articulation_point() -> None:
    a = run(star_graph(6))
    assert a.bridges.edgeIds == ["eL1", "eL2", "eL3", "eL4", "eL5", "eL6"]
    assert a.articulationPoints.nodeIds == ["hub"]
    assert a.degrees.byNode["hub"].operational == 6


def test_complete_graph_k5_has_density_1_and_no_cut_elements() -> None:
    a = run(complete_graph(5))
    assert a.summary.density == 1.0
    assert a.bridges.edgeIds == []
    assert a.articulationPoints.nodeIds == []
    assert {d.operational for d in a.degrees.byNode.values()} == {4}


def test_two_triangles_joined_by_one_edge() -> None:
    a = run(two_triangles_joined())
    assert a.bridges.edgeIds == ["eCD"]
    assert a.articulationPoints.nodeIds == ["C", "D"]


def test_failing_the_star_hub_leaves_6_isolated_components() -> None:
    a = run(with_failures(star_graph(6), nodes=("hub",)))
    assert a.connectivity.connected is False
    assert a.connectivity.componentCount == 6
    assert a.connectivity.reason == "6 components"
    assert a.connectivity.reasonKey == "multiple_components"
    assert a.components.items == [["L1"], ["L2"], ["L3"], ["L4"], ["L5"], ["L6"]]
    assert a.components.componentOf["hub"] is None
    assert a.bridges.edgeIds == []
    assert a.summary.unavailableEdgeCount == 6
    assert a.summary.failedEdgeCount == 0  # the edges' own flags are untouched
    assert a.degrees.byNode["hub"].operational == 0
    assert a.degrees.byNode["hub"].stored == 6


def test_failing_and_restoring_a_node_restores_its_edges() -> None:
    base = two_triangles_joined()
    healthy = run(base)
    failed = run(with_failures(base, nodes=("C",)))
    assert failed.summary.operationalEdgeCount == 4  # C's three edges are unavailable
    assert failed.connectivity.componentCount == 2
    restored = run(with_failures(base, nodes=()))
    assert restored == healthy


def test_failing_a_node_does_not_restore_an_independently_failed_edge() -> None:
    base = two_triangles_joined()
    # eAB failed on its own; C failed and then restored. eAB must stay unavailable.
    restored = run(with_failures(base, edges=("eAB",)))
    assert restored.summary.operationalEdgeCount == 6
    assert restored.summary.failedEdgeCount == 1


def test_one_failed_cycle_edge_keeps_it_connected_two_disconnect_it() -> None:
    one = run(with_failures(cycle_graph(6), edges=("eAB",)))
    assert one.connectivity.connected is True
    assert len(one.bridges.edgeIds) == 5  # the remaining path of 6 nodes
    two = run(with_failures(cycle_graph(6), edges=("eAB", "eDE")))
    assert two.connectivity.connected is False
    assert two.components.items == [["A", "E", "F"], ["B", "C", "D"]]  # equal sizes: smallest first id wins


# --- Edge cases -----------------------------------------------------------------------------------


def test_empty_graph() -> None:
    a = run(body([], []))
    assert a.connectivity.connected is False
    assert a.connectivity.reasonKey == "empty_network"
    assert a.connectivity.reason == "Empty network"
    assert a.connectivity.componentCount == 0
    assert a.summary.density == 0.0
    assert a.components.items == []


def test_single_node_is_connected() -> None:
    a = run(body([node("A")], []))
    assert a.connectivity.connected is True
    assert a.summary.density == 0.0
    assert a.components.componentOf == {"A": 0}


def test_two_nodes() -> None:
    joined = run(body([node("A"), node("B")], [edge("e1", "A", "B")]))
    assert joined.bridges.edgeIds == ["e1"]
    assert joined.articulationPoints.nodeIds == []  # removing either end leaves one node
    assert joined.summary.density == 1.0
    apart = run(body([node("A"), node("B")], []))
    assert apart.connectivity.componentCount == 2
    assert apart.summary.density == 0.0


def test_tree_every_edge_is_a_bridge_and_inner_nodes_are_cut_vertices() -> None:
    # A-B, A-C, B-D, B-E, C-F: leaves D, E, F; inner nodes A, B, C.
    pairs = [("A", "B"), ("A", "C"), ("B", "D"), ("B", "E"), ("C", "F")]
    a = run(body([node(i) for i in "ABCDEF"], [edge(f"e{x}{y}", x, y) for x, y in pairs]))
    assert len(a.bridges.edgeIds) == 5
    assert a.articulationPoints.nodeIds == ["A", "B", "C"]


def test_disconnected_graph_bridges_and_articulation_points_per_component() -> None:
    # Triangle A-B-C plus path X-Y-Z: only the path contributes cut elements.
    edges = [
        edge("eAB", "A", "B"),
        edge("eBC", "B", "C"),
        edge("eAC", "A", "C"),
        edge("eXY", "X", "Y"),
        edge("eYZ", "Y", "Z"),
    ]
    a = run(body([node(i) for i in "ABCXYZ"], edges))
    assert a.connectivity.componentCount == 2
    assert a.bridges.edgeIds == ["eXY", "eYZ"]
    assert a.articulationPoints.nodeIds == ["Y"]


def test_all_nodes_failed() -> None:
    base = complete_graph(4)
    a = run(with_failures(base, nodes=("A", "B", "C", "D")))
    assert a.connectivity.reasonKey == "empty_network"
    assert a.summary.operationalNodeCount == 0
    assert a.summary.unavailableEdgeCount == 6
    assert set(a.components.componentOf.values()) == {None}
    assert {d.stored for d in a.degrees.byNode.values()} == {3}
    assert {d.operational for d in a.degrees.byNode.values()} == {0}


def test_all_edges_failed() -> None:
    base = complete_graph(4)
    a = run(with_failures(base, edges=tuple(e["id"] for e in base["edges"])))
    assert a.connectivity.componentCount == 4
    assert a.summary.failedEdgeCount == 6
    assert a.summary.unavailableEdgeCount == 6
    assert a.bridges.edgeIds == []


def test_component_ordering_largest_first_then_smallest_id() -> None:
    # Components {Q, R}, {A, B}, {M}: sizes 2, 2, 1; ties broken by first id.
    a = run(body([node(i) for i in "QRABM"], [edge("e1", "Q", "R"), edge("e2", "A", "B")]))
    assert a.components.items == [["A", "B"], ["Q", "R"], ["M"]]
    assert list(a.components.componentOf) == ["A", "B", "M", "Q", "R"]


# --- Traversal ------------------------------------------------------------------------------------


def test_bfs_layers_and_dfs_order_use_ascending_neighbour_ids() -> None:
    # A connects to D, C, B (given in that order); C-E, D-E.
    edges = [
        edge("e1", "A", "D"),
        edge("e2", "A", "C"),
        edge("e3", "A", "B"),
        edge("e4", "C", "E"),
        edge("e5", "D", "E"),
    ]
    t = run(body([node(i) for i in "EDCBA"], edges, startNodeId="A")).traversal
    assert t is not None and t.error is None
    assert [(s.nodeId, s.layer) for s in t.bfs] == [("A", 0), ("B", 1), ("C", 1), ("D", 1), ("E", 2)]
    assert t.dfs == ["A", "B", "C", "E", "D"]


def test_traversal_covers_only_the_start_component() -> None:
    t = run(body([node(i) for i in "ABC"], [edge("e1", "A", "B")], startNodeId="C")).traversal
    assert t is not None
    assert [s.nodeId for s in t.bfs] == ["C"]
    assert t.dfs == ["C"]


def test_traversal_from_a_failed_start_reports_an_error_but_analysis_continues() -> None:
    a = run(with_options(with_failures(path_graph(3), nodes=("A",)), startNodeId="A"))
    assert a.traversal is not None and a.traversal.error is not None
    assert a.traversal.error.code == "START_NODE_FAILED"
    assert a.traversal.bfs == [] and a.traversal.dfs == []
    assert a.connectivity.componentCount == 1


# --- Shortest path --------------------------------------------------------------------------------


def square() -> Body:
    """A-B-D and A-C-D are both shortest paths from A to D."""
    edges = [
        edge("eAB", "A", "B", weight=1),
        edge("eBD", "B", "D", weight=5),
        edge("eAC", "A", "C", weight=1),
        edge("eCD", "C", "D", weight=1),
    ]
    return body([node(i) for i in "DCBA"], edges)


def test_hop_path_is_the_lexicographically_smallest_shortest_path() -> None:
    p = run(with_options(square(), pathSource="A", pathTarget="D")).path
    assert p is not None and p.found
    assert p.nodeIds == ["A", "B", "D"]
    assert p.edgeIds == ["eAB", "eBD"]
    assert (p.hops, p.length, p.metric) == (2, 2.0, "hops")
    assert p.explanationKey == "shortest_path_hops"


def test_weighted_path_uses_dijkstra_when_every_edge_has_a_weight() -> None:
    p = run(with_options(square(), pathSource="A", pathTarget="D", useWeights=True)).path
    assert p is not None
    assert p.nodeIds == ["A", "C", "D"]
    assert (p.hops, p.length, p.metric, p.weightsIgnoredReason) == (2, 2.0, "weight", None)
    assert p.explanationKey == "shortest_path_weighted"


def test_weighted_path_prefers_more_hops_when_cheaper() -> None:
    edges = [
        edge("eAD", "A", "D", weight=10),
        edge("eAB", "A", "B", weight=1),
        edge("eBC", "B", "C", weight=1),
        edge("eCD", "C", "D", weight=1.5),
    ]
    p = run(body([node(i) for i in "ABCD"], edges, pathSource="A", pathTarget="D", useWeights=True)).path
    assert p is not None
    assert p.nodeIds == ["A", "B", "C", "D"]
    assert p.length == pytest.approx(3.5)


def test_use_weights_with_a_missing_weight_falls_back_to_hops() -> None:
    edges = [edge("eAB", "A", "B", weight=1), edge("eBC", "B", "C")]
    p = run(body([node(i) for i in "ABC"], edges, pathSource="A", pathTarget="C", useWeights=True)).path
    assert p is not None
    assert (p.metric, p.weightsIgnoredReason, p.hops) == ("hops", "MISSING_WEIGHTS", 2)


def test_path_reasons() -> None:
    base = path_graph(4)  # A-B-C-D
    src = run(with_options(with_failures(base, nodes=("A", "D")), pathSource="A", pathTarget="D")).path
    assert src is not None and (src.found, src.reason, src.reasonKey) == (False, "SOURCE_FAILED", "path_source_failed")
    tgt = run(with_options(with_failures(base, nodes=("D",)), pathSource="A", pathTarget="D")).path
    assert tgt is not None and (tgt.reason, tgt.reasonKey) == ("TARGET_FAILED", "path_target_failed")
    cut = run(with_options(with_failures(base, edges=("eBC",)), pathSource="A", pathTarget="D")).path
    assert cut is not None and (cut.reason, cut.nodeIds, cut.hops) == ("DISCONNECTED", None, None)


def test_path_to_itself() -> None:
    p = run(with_options(path_graph(2), pathSource="A", pathTarget="A")).path
    assert p is not None and (p.found, p.nodeIds, p.edgeIds, p.hops, p.length) == (True, ["A"], [], 0, 0.0)


def test_path_through_a_failed_node_takes_the_detour() -> None:
    p = run(with_options(with_failures(square(), nodes=("B",)), pathSource="A", pathTarget="D")).path
    assert p is not None and p.nodeIds == ["A", "C", "D"]


# --- Comparison and determinism -------------------------------------------------------------------


def test_clear_failures_produces_the_healthy_baseline() -> None:
    failed = AnalyzeRequest.model_validate(with_failures(star_graph(3), nodes=("hub",), edges=("eL1",)))
    healthy = clear_failures(failed)
    assert not any(n.failed for n in healthy.nodes) and not any(e.failed for e in healthy.edges)
    assert analyze(healthy) == run(star_graph(3))
    assert any(n.failed for n in failed.nodes)  # the input is not mutated


def test_result_does_not_depend_on_request_order() -> None:
    base = with_options(two_triangles_joined(), startNodeId="A", pathSource="A", pathTarget="F")
    expected = run(base)
    rng = random.Random(3)
    for _ in range(10):
        nodes = list(base["nodes"])
        edges = list(base["edges"])
        rng.shuffle(nodes)
        rng.shuffle(edges)
        assert run({**base, "nodes": nodes, "edges": edges}) == expected


# --- Property based tests (hypothesis) against an independent brute force --------------------------


@st.composite
def random_graphs(draw: st.DrawFn) -> Body:
    """Random simple graphs of up to 9 nodes with random node and edge failures."""
    n = draw(st.integers(min_value=0, max_value=9))
    ids = [f"n{i}" for i in range(n)]
    pairs = [(ids[i], ids[j]) for i in range(n) for j in range(i + 1, n)]
    chosen = [p for p in pairs if draw(st.booleans())]
    nodes: list[NodeBody] = [node(i, failed=draw(st.integers(0, 6)) == 0) for i in ids]
    edges: list[EdgeBody] = [edge(f"e{a}_{b}", a, b, failed=draw(st.integers(0, 6)) == 0) for a, b in chosen]
    return body(nodes, edges)


def brute_components(node_ids: set[str], pairs: list[tuple[str, str]]) -> int:
    """Number of connected components by union find, without NetworkX."""
    parent = {v: v for v in node_ids}

    def find(v: str) -> str:
        while parent[v] != v:
            parent[v] = parent[parent[v]]
            v = parent[v]
        return v

    for a, b in pairs:
        parent[find(a)] = find(b)
    return len({find(v) for v in node_ids})


def operational(graph: Body) -> tuple[set[str], dict[str, tuple[str, str]]]:
    alive = {n["id"] for n in graph["nodes"] if not n["failed"]}
    edges = {
        e["id"]: (e["source"], e["target"])
        for e in graph["edges"]
        if not e["failed"] and e["source"] in alive and e["target"] in alive
    }
    return alive, edges


@given(random_graphs())
def test_bridges_match_brute_force(graph: Body) -> None:
    alive, edges = operational(graph)
    base = brute_components(alive, list(edges.values()))
    expected = sorted(
        edge_id
        for edge_id in edges
        if brute_components(alive, [p for other, p in edges.items() if other != edge_id]) > base
    )
    assert run(graph).bridges.edgeIds == expected


@given(random_graphs())
def test_articulation_points_match_brute_force(graph: Body) -> None:
    alive, edges = operational(graph)
    base = brute_components(alive, list(edges.values()))
    expected = sorted(
        v for v in alive if brute_components(alive - {v}, [p for p in edges.values() if v not in p]) > base
    )
    assert run(graph).articulationPoints.nodeIds == expected


@given(random_graphs())
def test_components_degrees_and_connectivity_match_brute_force(graph: Body) -> None:
    alive, edges = operational(graph)
    a = run(graph)
    count = brute_components(alive, list(edges.values()))
    assert a.connectivity.componentCount == count
    assert a.connectivity.connected == (len(alive) > 0 and count == 1)
    assert sorted(v for c in a.components.items for v in c) == sorted(alive)
    assert sum(d.operational for d in a.degrees.byNode.values()) == 2 * len(edges)
    assert sum(d.stored for d in a.degrees.byNode.values()) == 2 * len(graph["edges"])


@given(random_graphs(), st.data())
def test_bfs_layers_and_path_hops_match_brute_force_distances(graph: Body, data: st.DataObject) -> None:
    alive, edges = operational(graph)
    if not alive:
        return
    start, goal = sorted(alive)[0], data.draw(st.sampled_from(sorted(alive)))
    adjacency: dict[str, set[str]] = {v: set() for v in alive}
    for a, b in edges.values():
        adjacency[a].add(b)
        adjacency[b].add(a)
    dist = {start: 0}
    frontier = [start]
    while frontier:
        nxt = []
        for u in frontier:
            for v in adjacency[u]:
                if v not in dist:
                    dist[v] = dist[u] + 1
                    nxt.append(v)
        frontier = nxt
    result = run(with_options(graph, startNodeId=start, pathSource=start, pathTarget=goal))
    assert result.traversal is not None
    assert {s.nodeId: s.layer for s in result.traversal.bfs} == dist
    assert sorted(result.traversal.dfs) == sorted(dist)
    path = result.path
    assert path is not None
    if goal in dist:
        assert path.found and path.hops == dist[goal] and path.nodeIds is not None
        assert all(b in adjacency[a] for a, b in zip(path.nodeIds, path.nodeIds[1:], strict=False))
    else:
        assert not path.found and path.reason == "DISCONNECTED"
