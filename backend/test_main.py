"""
Backend algorithmic unit tests using Pytest and FastAPI TestClient.
Tests bridges, articulation points, components, disconnected graphs, trivial graphs, and incident edge failure semantics.
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_trivial_graph_empty():
    """Trivial graph with 0 nodes"""
    res = client.post("/api/analyze", json={
        "nodes": [],
        "edges": [],
        "failed_nodes": [],
        "failed_edges": [],
    })
    assert res.status_code == 200
    data = res.json()
    assert data["active_nodes_count"] == 0
    assert data["active_edges_count"] == 0
    assert data["num_components"] == 0
    assert data["is_connected"] is False
    assert data["bridges"] == []
    assert data["articulation_points"] == []


def test_trivial_graph_single_node():
    """Trivial graph with 1 node"""
    res = client.post("/api/analyze", json={
        "nodes": [{"id": "n1", "label": "Single Node"}],
        "edges": [],
        "failed_nodes": [],
        "failed_edges": [],
    })
    assert res.status_code == 200
    data = res.json()
    assert data["active_nodes_count"] == 1
    assert data["active_edges_count"] == 0
    assert data["num_components"] == 1
    assert data["is_connected"] is True
    assert data["bridges"] == []
    assert data["articulation_points"] == []


def test_bridges_and_articulation_points():
    """
    Graph: Two triangles joined by a single bridge edge:
    (n1 - n2 - n3 - n1) -- (n3 - n4) -- (n4 - n5 - n6 - n4)
    Bridge: (n3, n4)
    Articulation points: n3, n4
    """
    nodes = [{"id": f"n{i}", "label": f"Node {i}"} for i in range(1, 7)]
    edges = [
        {"id": "e1", "source": "n1", "target": "n2"},
        {"id": "e2", "source": "n2", "target": "n3"},
        {"id": "e3", "source": "n1", "target": "n3"},
        {"id": "e_bridge", "source": "n3", "target": "n4"},
        {"id": "e4", "source": "n4", "target": "n5"},
        {"id": "e5", "source": "n5", "target": "n6"},
        {"id": "e6", "source": "n4", "target": "n6"},
    ]

    res = client.post("/api/analyze", json={
        "nodes": nodes,
        "edges": edges,
        "failed_nodes": [],
        "failed_edges": [],
    })
    assert res.status_code == 200
    data = res.json()
    assert data["is_connected"] is True
    assert data["num_components"] == 1
    assert len(data["bridges"]) == 1
    assert sorted(data["bridges"][0]) == ["n3", "n4"]
    assert set(data["articulation_points"]) == {"n3", "n4"}


def test_disconnected_graph():
    """Two disconnected components"""
    nodes = [{"id": "a1", "label": "A1"}, {"id": "a2", "label": "A2"}, {"id": "b1", "label": "B1"}]
    edges = [{"id": "e1", "source": "a1", "target": "a2"}]

    res = client.post("/api/analyze", json={
        "nodes": nodes,
        "edges": edges,
        "failed_nodes": [],
        "failed_edges": [],
    })
    assert res.status_code == 200
    data = res.json()
    assert data["is_connected"] is False
    assert data["num_components"] == 2


def test_incident_edge_failure_semantics():
    """
    When node n2 fails, incident edges (n1, n2) and (n2, n3) must be filtered out.
    """
    nodes = [{"id": "n1", "label": "N1"}, {"id": "n2", "label": "N2"}, {"id": "n3", "label": "N3"}]
    edges = [
        {"id": "e1", "source": "n1", "target": "n2"},
        {"id": "e2", "source": "n2", "target": "n3"},
    ]

    res = client.post("/api/analyze", json={
        "nodes": nodes,
        "edges": edges,
        "failed_nodes": ["n2"],
        "failed_edges": [],
    })
    assert res.status_code == 200
    data = res.json()
    assert data["active_nodes_count"] == 2
    assert data["active_edges_count"] == 0
    assert data["num_components"] == 2


def test_simulate_monte_carlo():
    nodes = [{"id": "n1", "label": "N1"}, {"id": "n2", "label": "N2"}]
    edges = [{"id": "e1", "source": "n1", "target": "n2"}]

    res = client.post("/api/simulate", json={
        "nodes": nodes,
        "edges": edges,
        "failed_nodes": [],
        "failed_edges": [],
        "failure_prob": 0.2,
        "trials": 200,
        "fail_target": "edges",
    })
    assert res.status_code == 200
    data = res.json()
    assert data["trials"] == 200
    assert 0.0 <= data["estimated_reliability"] <= 1.0
    assert data["is_demo"] is False
