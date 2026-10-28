"""
NetShield: Graph-Theoretic Network Reliability and Failure Simulation Backend
FastAPI service powered by NetworkX and Pydantic.
"""

from typing import List, Optional, Dict, Tuple, Literal
import math
import random
import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import networkx as nx

app = FastAPI(
    title="NetShield Reliability API",
    description="Authoritative graph-theoretic network reliability and failure simulation service.",
    version="1.0.0",
)

# Configure CORS for local development and integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Pydantic Data Models ---

class NodeModel(BaseModel):
    id: str
    label: str
    type: Optional[str] = "router"


class EdgeModel(BaseModel):
    id: str
    source: str
    target: str


class AnalyzeRequest(BaseModel):
    nodes: List[NodeModel]
    edges: List[EdgeModel]
    failed_nodes: List[str] = Field(default_factory=list)
    failed_edges: List[str] = Field(default_factory=list)
    start_node: Optional[str] = None
    target_node: Optional[str] = None


class AnalyzeResponse(BaseModel):
    node_degrees: Dict[str, int]
    connected_components: List[List[str]]
    num_components: int
    is_connected: bool
    bridges: List[Tuple[str, str]]
    articulation_points: List[str]
    density: float
    diameter: Optional[int] = None
    average_clustering: Optional[float] = None
    bfs_order: Optional[List[str]] = None
    dfs_order: Optional[List[str]] = None
    path: Optional[List[str]] = None
    active_nodes_count: int
    active_edges_count: int
    is_demo: bool = False


class SimulateRequest(BaseModel):
    nodes: List[NodeModel]
    edges: List[EdgeModel]
    failed_nodes: List[str] = Field(default_factory=list)
    failed_edges: List[str] = Field(default_factory=list)
    failure_prob: float = Field(default=0.1, ge=0.0, le=1.0)
    trials: int = Field(default=500, ge=1, le=5000)
    fail_target: Literal["nodes", "edges", "both"] = "edges"


class SimulateResponse(BaseModel):
    trials: int
    connected_trials: int
    estimated_reliability: float
    standard_error: float
    confidence_interval_95: Tuple[float, float]
    failure_probability: float
    fail_target: Literal["nodes", "edges", "both"]
    active_components_distribution: Optional[Dict[str, int]] = None
    execution_time_ms: float
    is_demo: bool = False


class ReliabilitySweepRequest(BaseModel):
    nodes: List[NodeModel]
    edges: List[EdgeModel]
    failed_nodes: List[str] = Field(default_factory=list)
    failed_edges: List[str] = Field(default_factory=list)
    probs: List[float]
    trials_per_prob: int = Field(default=100, ge=10, le=1000)
    fail_target: Literal["nodes", "edges", "both"] = "edges"


class ReliabilitySweepPoint(BaseModel):
    prob: float
    reliability: float
    standard_error: float
    connected_trials: int
    total_trials: int


class ReliabilitySweepResponse(BaseModel):
    points: List[ReliabilitySweepPoint]
    trials_per_prob: int
    fail_target: Literal["nodes", "edges", "both"]
    is_demo: bool = False


# --- Helper to Build Active NetworkX Graph ---

def build_active_networkx_graph(
    nodes: List[NodeModel],
    edges: List[EdgeModel],
    failed_node_ids: set,
    failed_edge_ids: set,
) -> nx.Graph:
    """
    Builds an undirected NetworkX graph respecting failure semantics:
    - Failed nodes are excluded.
    - Failed edges are excluded.
    - Edges incident to failed nodes are excluded.
    """
    g = nx.Graph()

    for node in nodes:
        if node.id not in failed_node_ids:
            g.add_node(node.id, label=node.label, type=node.type)

    for edge in edges:
        if edge.id in failed_edge_ids:
            continue
        if edge.source in g and edge.target in g:
            g.add_edge(edge.source, edge.target, id=edge.id)

    return g


# --- Endpoints ---

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "NetShield Backend", "engine": "NetworkX"}


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze_network(req: AnalyzeRequest):
    failed_nodes = set(req.failed_nodes)
    failed_edges = set(req.failed_edges)

    g = build_active_networkx_graph(req.nodes, req.edges, failed_nodes, failed_edges)
    num_nodes = g.number_of_nodes()
    num_edges = g.number_of_edges()

    node_degrees = {n: d for n, d in g.degree()}

    # Connected Components
    if num_nodes == 0:
        connected_components = []
        is_connected = False
        bridges = []
        articulation_points = []
        density = 0.0
    else:
        connected_components = [sorted(list(c)) for c in nx.connected_components(g)]
        is_connected = nx.is_connected(g)
        # Bridges: sorted pairs for deterministic output
        raw_bridges = list(nx.bridges(g))
        bridges = sorted([tuple(sorted([u, v])) for u, v in raw_bridges])
        articulation_points = sorted(list(nx.articulation_points(g)))
        density = round(float(nx.density(g)), 4)

    # Optional diameter & average clustering
    diameter = None
    if is_connected and num_nodes > 1:
        diameter = nx.diameter(g)

    avg_clustering = None
    if num_nodes > 2:
        avg_clustering = round(float(nx.average_clustering(g)), 4)

    # Traversals
    bfs_order = None
    dfs_order = None
    if req.start_node and req.start_node in g:
        bfs_order = list(nx.bfs_tree(g, req.start_node).nodes())
        dfs_order = list(nx.dfs_tree(g, req.start_node).nodes())

    # Shortest Path
    path = None
    if req.start_node and req.target_node:
        if req.start_node in g and req.target_node in g:
            try:
                path = nx.shortest_path(g, req.start_node, req.target_node)
            except nx.NetworkXNoPath:
                path = None

    return AnalyzeResponse(
        node_degrees=node_degrees,
        connected_components=connected_components,
        num_components=len(connected_components),
        is_connected=is_connected,
        bridges=bridges,
        articulation_points=articulation_points,
        density=density,
        diameter=diameter,
        average_clustering=avg_clustering,
        bfs_order=bfs_order,
        dfs_order=dfs_order,
        path=path,
        active_nodes_count=num_nodes,
        active_edges_count=num_edges,
        is_demo=False,
    )


@app.post("/api/simulate", response_model=SimulateResponse)
def simulate_failures(req: SimulateRequest):
    start_time = time.perf_counter()
    baseline_failed_nodes = set(req.failed_nodes)
    baseline_failed_edges = set(req.failed_edges)

    trials = req.trials
    p = req.failure_prob
    fail_target = req.fail_target

    connected_trials = 0
    active_components_dist: Dict[str, int] = {}

    for _ in range(trials):
        current_failed_nodes = set(baseline_failed_nodes)
        current_failed_edges = set(baseline_failed_edges)

        if fail_target in ("nodes", "both"):
            for n in req.nodes:
                if n.id not in current_failed_nodes and random.random() < p:
                    current_failed_nodes.add(n.id)

        if fail_target in ("edges", "both"):
            for e in req.edges:
                if e.id not in current_failed_edges and random.random() < p:
                    current_failed_edges.add(e.id)

        g = build_active_networkx_graph(
            req.nodes, req.edges, current_failed_nodes, current_failed_edges
        )

        comp_count = nx.number_connected_components(g)
        key = str(comp_count)
        active_components_dist[key] = active_components_dist.get(key, 0) + 1

        if g.number_of_nodes() > 0 and comp_count == 1:
            connected_trials += 1

    rel = connected_trials / trials if trials > 0 else 0.0
    se = math.sqrt((rel * (1.0 - rel)) / trials) if trials > 0 else 0.0
    ci_low = max(0.0, round(rel - 1.96 * se, 4))
    ci_high = min(1.0, round(rel + 1.96 * se, 4))
    exec_time = round((time.perf_counter() - start_time) * 1000, 2)

    return SimulateResponse(
        trials=trials,
        connected_trials=connected_trials,
        estimated_reliability=round(rel, 4),
        standard_error=round(se, 4),
        confidence_interval_95=(ci_low, ci_high),
        failure_probability=p,
        fail_target=fail_target,
        active_components_distribution=active_components_dist,
        execution_time_ms=exec_time,
        is_demo=False,
    )


@app.post("/api/reliability-sweep", response_model=ReliabilitySweepResponse)
def reliability_sweep(req: ReliabilitySweepRequest):
    points = []
    for prob in req.probs:
        sim_req = SimulateRequest(
            nodes=req.nodes,
            edges=req.edges,
            failed_nodes=req.failed_nodes,
            failed_edges=req.failed_edges,
            failure_prob=prob,
            trials=req.trials_per_prob,
            fail_target=req.fail_target,
        )
        res = simulate_failures(sim_req)
        points.append(
            ReliabilitySweepPoint(
                prob=prob,
                reliability=res.estimated_reliability,
                standard_error=res.standard_error,
                connected_trials=res.connected_trials,
                total_trials=res.trials,
            )
        )

    return ReliabilitySweepResponse(
        points=points,
        trials_per_prob=req.trials_per_prob,
        fail_target=req.fail_target,
        is_demo=False,
    )
