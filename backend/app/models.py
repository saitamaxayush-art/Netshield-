"""Request and response models (Pydantic v2) for the NetShield API.

Field names are camelCase on purpose: they are the JSON contract (API_CONTRACT.md) verbatim, so the
OpenAPI schema and the generated frontend types match the document without an alias layer.

Validation order (contract section 5): schema (field types, ranges, unknown fields), then limits,
then graph structure, then references from request options to node ids. The first failing check is
reported. Schema problems surface as Pydantic validation errors (code VALIDATION_ERROR); the other
checks raise GraphValidationError with their specific code.
"""

from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

from backend.app.errors import GraphValidationError
from backend.app.settings import MAX_SWEEP_POINTS, MAX_TRIALS

MAX_NODES = 200
MAX_EDGES = 1000

NodeType = Literal["router", "server", "client", "firewall"]
ElementId = Annotated[str, Field(min_length=1, max_length=64)]
Probability = Annotated[float, Field(ge=0.0, le=1.0, allow_inf_nan=False)]
Weight = Annotated[float, Field(gt=0.0, allow_inf_nan=False)]


class RequestModel(BaseModel):
    """Requests are strict: no type coercion, no unknown fields, immutable once validated."""

    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)


class ResponseModel(BaseModel):
    """Every field is always present in a response, so the schema marks defaulted fields required too."""

    model_config = ConfigDict(extra="forbid", json_schema_serialization_defaults_required=True)


# --- Request -----------------------------------------------------------------------------------


class Node(RequestModel):
    id: ElementId
    label: Annotated[str, Field(max_length=100)]
    type: NodeType
    failed: bool = False


class Edge(RequestModel):
    id: ElementId
    source: ElementId
    target: ElementId
    failed: bool = False
    failureProbability: Probability | None = None
    weight: Weight | None = None


def check_limits(nodes: list[Node], edges: list[Edge]) -> None:
    for limit, maximum, actual, noun in (
        ("maxNodes", MAX_NODES, len(nodes), "nodes"),
        ("maxEdges", MAX_EDGES, len(edges), "edges"),
    ):
        if actual > maximum:
            raise GraphValidationError(
                "LIMIT_EXCEEDED",
                f"Too many {noun}: {actual} given, maximum is {maximum} ({limit}).",
                {"limit": limit, "max": maximum, "actual": actual},
            )


def check_structure(nodes: list[Node], edges: list[Edge]) -> None:
    """Simple undirected graph: unique ids, known endpoints, no self loops, no parallel edges."""
    node_ids: set[str] = set()
    for node in nodes:
        if node.id in node_ids:
            raise GraphValidationError(
                "DUPLICATE_NODE_ID", f"Duplicate node id '{node.id}'. Every node needs a unique id.", {"id": node.id}
            )
        node_ids.add(node.id)

    edge_ids: set[str] = set()
    pairs: dict[frozenset[str], str] = {}
    for index, edge in enumerate(edges):
        if edge.id in edge_ids:
            raise GraphValidationError(
                "DUPLICATE_EDGE_ID", f"Duplicate edge id '{edge.id}'. Every edge needs a unique id.", {"id": edge.id}
            )
        edge_ids.add(edge.id)
        for end in ("source", "target"):
            node_id = edge.source if end == "source" else edge.target
            if node_id not in node_ids:
                field = f"edges[{index}].{end}"
                raise GraphValidationError(
                    "UNKNOWN_NODE",
                    f"Edge '{edge.id}' refers to unknown node '{node_id}' ({field}).",
                    {"id": node_id, "field": field},
                )
        if edge.source == edge.target:
            raise GraphValidationError(
                "SELF_LOOP",
                f"Edge '{edge.id}' connects node '{edge.source}' to itself. Self loops are not allowed.",
                {"edgeId": edge.id},
            )
        pair = frozenset((edge.source, edge.target))
        if pair in pairs:
            first = pairs[pair]
            ends = sorted(pair)
            raise GraphValidationError(
                "PARALLEL_EDGE",
                f"Edges '{first}' and '{edge.id}' both connect '{ends[0]}' and '{ends[1]}'. The graph must be simple.",
                {"edgeIds": [first, edge.id], "nodes": ends},
            )
        pairs[pair] = edge.id


class GraphRequest(RequestModel):
    """The common graph payload. Subclasses add endpoint options."""

    nodes: list[Node]
    edges: list[Edge]

    @model_validator(mode="after")
    def _validate_graph(self) -> Self:
        check_limits(self.nodes, self.edges)
        self._extra_limits()
        check_structure(self.nodes, self.edges)
        return self

    def _extra_limits(self) -> None:
        """Endpoint specific limits, checked after the graph size limits and before graph structure."""


class AnalyzeRequest(GraphRequest):
    startNodeId: ElementId | None = None
    pathSource: ElementId | None = None
    pathTarget: ElementId | None = None
    useWeights: bool = False
    compareHealthy: bool = False

    @model_validator(mode="after")
    def _validate_references(self) -> Self:
        # Runs after GraphRequest._validate_graph (Pydantic runs inherited validators first).
        if (self.pathSource is None) != (self.pathTarget is None):
            raise ValueError("pathSource and pathTarget must be given together")
        node_ids = {node.id for node in self.nodes}
        for field in ("startNodeId", "pathSource", "pathTarget"):
            value: str | None = getattr(self, field)
            if value is not None and value not in node_ids:
                raise GraphValidationError(
                    "UNKNOWN_NODE", f"{field} refers to unknown node '{value}'.", {"id": value, "field": field}
                )
        return self


SimulationMode = Literal["all-terminal", "two-terminal"]
Seed = Annotated[int, Field(ge=0, le=2**32 - 1)]
TrialCount = Annotated[int, Field(ge=1)]


def check_limit(limit: str, maximum: int, actual: int, what: str) -> None:
    if actual > maximum:
        raise GraphValidationError(
            "LIMIT_EXCEEDED",
            f"Too many {what}: {actual} given, maximum is {maximum} ({limit}).",
            {"limit": limit, "max": maximum, "actual": actual},
        )


class SimulationOptions(GraphRequest):
    """Options shared by /api/simulate and /api/reliability-sweep."""

    nodeFailureProbability: Probability = 0.0
    seed: Seed | None = None
    mode: SimulationMode = "all-terminal"
    source: ElementId | None = None
    target: ElementId | None = None

    @model_validator(mode="after")
    def _validate_terminals(self) -> Self:
        if self.mode == "two-terminal":
            if self.source is None or self.target is None:
                raise ValueError("two-terminal mode needs both source and target")
            if self.source == self.target:
                raise ValueError("source and target must be different nodes")
        elif self.source is not None or self.target is not None:
            raise ValueError("source and target are only allowed in two-terminal mode")
        node_ids = {node.id for node in self.nodes}
        for field in ("source", "target"):
            value: str | None = getattr(self, field)
            if value is not None and value not in node_ids:
                raise GraphValidationError(
                    "UNKNOWN_NODE", f"{field} refers to unknown node '{value}'.", {"id": value, "field": field}
                )
        return self

    def terminals(self) -> tuple[str, str] | None:
        if self.mode == "two-terminal" and self.source is not None and self.target is not None:
            return self.source, self.target
        return None


class SimulateRequest(SimulationOptions):
    edgeFailureProbability: Probability
    trials: TrialCount = 1000

    def _extra_limits(self) -> None:
        check_limit("maxTrials", MAX_TRIALS, self.trials, "trials")


class SweepRequest(SimulationOptions):
    pMin: Probability
    pMax: Probability
    points: Annotated[int, Field(ge=1)] = 11
    trialsPerPoint: TrialCount = 1000

    def _extra_limits(self) -> None:
        check_limit("maxSweepPoints", MAX_SWEEP_POINTS, self.points, "sweep points")
        check_limit("maxTrials", MAX_TRIALS, self.trialsPerPoint, "trials per point")

    @model_validator(mode="after")
    def _validate_range(self) -> Self:
        if self.pMin > self.pMax:
            raise ValueError("pMin must be less than or equal to pMax")
        return self

    def probabilities(self) -> list[float]:
        """`points` evenly spaced values from pMin to pMax inclusive (rounded to 12 decimals)."""
        if self.points == 1:
            return [self.pMin]
        step = (self.pMax - self.pMin) / (self.points - 1)
        return [round(self.pMin + i * step, 12) for i in range(self.points)]


# --- Response ----------------------------------------------------------------------------------


class Summary(ResponseModel):
    nodeCount: int
    edgeCount: int
    operationalNodeCount: int
    operationalEdgeCount: int
    failedNodeCount: int
    failedEdgeCount: int
    unavailableEdgeCount: int
    density: float
    explanationKey: Literal["density_definition"] = "density_definition"


class Connectivity(ResponseModel):
    connected: bool
    componentCount: int
    reasonKey: Literal["empty_network", "single_component", "multiple_components"]
    reason: str
    explanationKey: Literal["connectivity_definition"] = "connectivity_definition"


class Components(ResponseModel):
    items: list[list[str]]
    componentOf: dict[str, int | None]
    explanationKey: Literal["component_definition"] = "component_definition"


class DegreeEntry(ResponseModel):
    operational: int
    stored: int


class Degrees(ResponseModel):
    byNode: dict[str, DegreeEntry]
    explanationKey: Literal["degree_definition"] = "degree_definition"


class Bridges(ResponseModel):
    edgeIds: list[str]
    explanationKey: Literal["bridge_definition"] = "bridge_definition"


class ArticulationPoints(ResponseModel):
    nodeIds: list[str]
    explanationKey: Literal["articulation_point_definition"] = "articulation_point_definition"


class BfsStep(ResponseModel):
    nodeId: str
    layer: int


class TraversalError(ResponseModel):
    code: Literal["START_NODE_FAILED"]
    message: str


class Traversal(ResponseModel):
    startNodeId: str
    error: TraversalError | None
    bfs: list[BfsStep]
    dfs: list[str]
    bfsExplanationKey: Literal["bfs_definition"] = "bfs_definition"
    dfsExplanationKey: Literal["dfs_definition"] = "dfs_definition"


class PathResult(ResponseModel):
    source: str
    target: str
    metric: Literal["hops", "weight"]
    weightsIgnoredReason: Literal["MISSING_WEIGHTS"] | None
    found: bool
    reason: Literal["SOURCE_FAILED", "TARGET_FAILED", "DISCONNECTED"] | None
    reasonKey: Literal["path_source_failed", "path_target_failed", "path_disconnected"] | None
    nodeIds: list[str] | None
    edgeIds: list[str] | None
    hops: int | None
    length: float | None
    explanationKey: Literal["shortest_path_hops", "shortest_path_weighted"]


class Analysis(ResponseModel):
    summary: Summary
    connectivity: Connectivity
    components: Components
    degrees: Degrees
    bridges: Bridges
    articulationPoints: ArticulationPoints
    traversal: Traversal | None
    path: PathResult | None


class Meta(ResponseModel):
    engine: Literal["networkx"] = "networkx"
    engineVersion: str
    apiVersion: str


class AnalyzeResponse(ResponseModel):
    current: Analysis
    healthy: Analysis | None
    meta: Meta


class Wilson95(ResponseModel):
    low: float
    high: float


class HistogramBin(ResponseModel):
    components: int
    trials: int


class CriticalEdge(ResponseModel):
    edgeId: str
    pivotalTrials: int
    share: float
    explanationKey: Literal["critical_edge_definition"] = "critical_edge_definition"


class SimulateResponse(ResponseModel):
    mode: SimulationMode
    source: str | None
    target: str | None
    trials: int
    connectedTrials: int
    estimate: float
    standardError: float
    wilson95: Wilson95
    seed: int
    edgeFailureProbability: float
    nodeFailureProbability: float
    averageComponents: float
    componentHistogram: list[HistogramBin]
    criticalEdge: CriticalEdge | None
    assumptions: list[str]
    elapsedMs: float
    explanationKey: Literal["monte_carlo_estimate"] = "monte_carlo_estimate"
    meta: Meta


class SweepPoint(ResponseModel):
    p: float
    estimate: float
    connectedTrials: int
    standardError: float
    wilson95: Wilson95


class SweepResponse(ResponseModel):
    mode: SimulationMode
    source: str | None
    target: str | None
    trialsPerPoint: int
    seed: int
    nodeFailureProbability: float
    points: list[SweepPoint]
    assumptions: list[str]
    elapsedMs: float
    explanationKey: Literal["reliability_sweep"] = "reliability_sweep"
    meta: Meta
