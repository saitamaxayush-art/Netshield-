"""Cross check POST /api/analyze against an independent NetworkX computation.

For 20 seeded random graphs (with failed nodes, failed links and isolated nodes), send the graph to a
running backend over HTTP and compare components, bridges, articulation points and density with
NetworkX called directly on the operational graph.

    .venv/bin/python scripts/crosscheck_networkx.py http://127.0.0.1:8765
"""

import random
import sys

import httpx
import networkx as nx

GRAPHS = 20


def random_graph(seed: int) -> dict[str, object]:
    rng = random.Random(seed)
    n = rng.randint(2, 40)
    ids = [f"n{i}" for i in range(n)]
    rng.shuffle(ids)
    p = rng.uniform(0.03, 0.35)
    nodes = [{"id": i, "label": i, "type": "router", "failed": rng.random() < 0.15} for i in ids]
    edges = []
    for a in range(n):
        for b in range(a + 1, n):
            if rng.random() < p:
                edges.append({"id": f"e{len(edges)}", "source": ids[a], "target": ids[b], "failed": rng.random() < 0.1})
    return {"nodes": nodes, "edges": edges}


def expected(graph: dict[str, object]) -> dict[str, object]:
    nodes = graph["nodes"]
    edges = graph["edges"]
    assert isinstance(nodes, list) and isinstance(edges, list)
    failed = {node["id"] for node in nodes if node["failed"]}
    g = nx.Graph()
    g.add_nodes_from(node["id"] for node in nodes if not node["failed"])
    edge_id: dict[frozenset[str], str] = {}
    for e in edges:
        if not e["failed"] and e["source"] not in failed and e["target"] not in failed:
            g.add_edge(e["source"], e["target"])
            edge_id[frozenset((e["source"], e["target"]))] = e["id"]
    return {
        "components": sorted(sorted(c) for c in nx.connected_components(g)),
        "bridges": sorted(edge_id[frozenset(b)] for b in nx.bridges(g)),
        "articulation": sorted(nx.articulation_points(g)),
        "density": nx.density(g) if g.number_of_nodes() >= 2 else 0.0,
    }


def main(base: str) -> int:
    failures = 0
    with httpx.Client(base_url=base, timeout=30) as client:
        for seed in range(1, GRAPHS + 1):
            graph = random_graph(seed)
            response = client.post("/api/analyze", json=graph)
            response.raise_for_status()
            current = response.json()["current"]
            got = {
                "components": sorted(sorted(c) for c in current["components"]["items"]),
                "bridges": sorted(current["bridges"]["edgeIds"]),
                "articulation": sorted(current["articulationPoints"]["nodeIds"]),
                "density": current["summary"]["density"],
            }
            want = expected(graph)
            same = (
                got["components"] == want["components"]
                and got["bridges"] == want["bridges"]
                and got["articulation"] == want["articulation"]
                and got["density"] == want["density"]
            )
            failures += 0 if same else 1
            nodes, edges = graph["nodes"], graph["edges"]
            assert isinstance(nodes, list) and isinstance(edges, list)
            down = sum(1 for node in nodes if node["failed"]) + sum(1 for e in edges if e["failed"])
            print(
                f"seed {seed:2d}: {len(nodes):2d} nodes {len(edges):3d} links {down:2d} failed | "
                f"components {len(want['components']):2d} bridges {len(want['bridges']):2d} "
                f"articulation {len(want['articulation']):2d} density {want['density']:.6f} | "
                f"{'MATCH' if same else 'MISMATCH'}"
            )
            if not same:
                print(f"  backend: {got}\n  networkx: {want}")
    print(f"\n{GRAPHS - failures} of {GRAPHS} graphs match; {failures} mismatches.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"))
