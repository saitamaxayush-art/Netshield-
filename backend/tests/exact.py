"""Exact reliability by enumeration, for tests only (independent of backend/app/simulation.py).

Enumerates every up or down state of the random elements of the operational graph and sums the
probabilities of the successful states. Connectivity is decided by NetworkX (the oracle), not by the
union find under test. Limited to 14 random elements (16384 states).
"""

from itertools import product

import networkx as nx

from backend.tests.graphs import Body

MAX_ELEMENTS = 14


def exact_reliability(
    graph: Body,
    edge_probability: float,
    node_probability: float = 0.0,
    terminals: tuple[str, str] | None = None,
) -> float:
    """P(success) under contract section 3, rule 6, for the given request body."""
    nodes = [n["id"] for n in graph["nodes"] if not n.get("failed", False)]
    alive = set(nodes)
    edges = [
        (e["source"], e["target"], e.get("failureProbability", edge_probability))
        for e in graph["edges"]
        if not e.get("failed", False) and e["source"] in alive and e["target"] in alive
    ]
    random_nodes = nodes if node_probability > 0 else []
    elements = len(random_nodes) + len(edges)
    if elements > MAX_ELEMENTS:
        raise ValueError(f"{elements} random elements; exact enumeration supports at most {MAX_ELEMENTS}")

    total = 0.0
    for state in product((True, False), repeat=elements):
        node_up = dict(zip(random_nodes, state[: len(random_nodes)], strict=True))
        edge_up = state[len(random_nodes) :]
        probability = 1.0
        for up in state[: len(random_nodes)]:
            probability *= (1 - node_probability) if up else node_probability
        for (_, _, p), up in zip(edges, edge_up, strict=True):
            probability *= (1 - p) if up else p
        if probability == 0.0:
            continue
        surviving = [v for v in nodes if node_up.get(v, True)]
        g: nx.Graph[str] = nx.Graph()
        g.add_nodes_from(surviving)
        g.add_edges_from((a, b) for (a, b, _), up in zip(edges, edge_up, strict=True) if up and a in g and b in g)
        if terminals is None:
            success = g.number_of_nodes() > 0 and nx.is_connected(g)
        else:
            s, t = terminals
            success = s in g and t in g and nx.has_path(g, s, t)
        if success:
            total += probability
    return total
