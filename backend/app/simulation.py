"""Monte Carlo reliability estimation (API_CONTRACT.md sections 3, 8 and 9). No FastAPI imports.

Model: starting from the operational graph (manual failures already applied), every operational node
fails with nodeFailureProbability and every operational edge with its own failureProbability or the
request's edge probability, all independently. An edge is unavailable in a trial when it failed or
either endpoint failed. Connectivity per trial is checked with union find (no NetworkX per trial).

Randomness: random.Random(seed). Each trial draws one uniform per operational node (request order),
then one per operational edge (request order); an element fails when its draw is < its probability.
Draws never depend on earlier outcomes, so the stream position is fixed and a seed reproduces a run.

Sweeps use common random numbers: each trial's uniforms are drawn once and reused for every p. A
failure at p is then also a failure at every larger p, so each trial's outcome, and therefore the
estimate, is non-increasing in p by construction. A sweep point at p equals /api/simulate at p with
the same seed.
"""

import math
import random
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Literal

from backend.app.models import GraphRequest

Mode = Literal["all-terminal", "two-terminal"]
Z_95 = 1.959963984540054
DEADLINE_CHECK_EVERY = 64


class SimulationTimeout(Exception):
    """The run exceeded the server side time budget."""

    def __init__(self, completed_trials: int, budget_ms: float) -> None:
        super().__init__(f"Stopped after {completed_trials} trials: time budget of {budget_ms:.0f} ms exceeded.")
        self.completed_trials = completed_trials
        self.budget_ms = budget_ms


@dataclass(frozen=True)
class CompiledGraph:
    """Operational graph as index arrays, in request order (the draw order)."""

    node_ids: list[str]
    edge_ids: list[str]
    edge_a: list[int]
    edge_b: list[int]
    edge_own_probability: list[float | None]
    index_of: dict[str, int]


def compile_graph(request: GraphRequest) -> CompiledGraph:
    alive = [n.id for n in request.nodes if not n.failed]
    index_of = {node_id: i for i, node_id in enumerate(alive)}
    edges = [e for e in request.edges if not e.failed and e.source in index_of and e.target in index_of]
    return CompiledGraph(
        node_ids=alive,
        edge_ids=[e.id for e in edges],
        edge_a=[index_of[e.source] for e in edges],
        edge_b=[index_of[e.target] for e in edges],
        edge_own_probability=[e.failureProbability for e in edges],
        index_of=index_of,
    )


@dataclass(frozen=True)
class TrialOutcome:
    success: bool
    components: int
    pivotal_edges: list[int]


def evaluate_trial(
    graph: CompiledGraph,
    node_alive: list[bool],
    edge_alive: list[bool],
    two_terminal: tuple[int, int] | None,
) -> TrialOutcome:
    """Union find on one sampled state.

    `pivotal_edges` (only for failed trials): failed edges whose restoration alone would make the
    trial succeed. All terminal: the surviving graph has exactly two components and the edge joins
    them. Two terminal: the edge joins the source's component to the target's.
    """
    n = len(graph.node_ids)
    parent = list(range(n))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    components = sum(node_alive)
    edge_a, edge_b = graph.edge_a, graph.edge_b
    for i in range(len(edge_a)):
        a, b = edge_a[i], edge_b[i]
        if edge_alive[i] and node_alive[a] and node_alive[b]:
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[ra] = rb
                components -= 1

    if two_terminal is None:
        success = components == 1
        joinable = components == 2
        target_roots: frozenset[int] = frozenset()
    else:
        s, t = two_terminal
        both_alive = node_alive[s] and node_alive[t]
        success = both_alive and find(s) == find(t)
        joinable = both_alive and not success
        target_roots = frozenset((find(s), find(t))) if joinable else frozenset()

    pivotal: list[int] = []
    if joinable:
        for i in range(len(edge_a)):
            a, b = edge_a[i], edge_b[i]
            if edge_alive[i] or not (node_alive[a] and node_alive[b]):
                continue
            ra, rb = find(a), find(b)
            if ra != rb and (two_terminal is None or frozenset((ra, rb)) == target_roots):
                pivotal.append(i)
    return TrialOutcome(success, components, pivotal)


def wilson_95(successes: int, trials: int) -> tuple[float, float]:
    """Wilson score interval at 95 percent (contract section 3, rule 8)."""
    if trials == 0:
        return 0.0, 1.0
    p = successes / trials
    z2 = Z_95 * Z_95
    denominator = 1 + z2 / trials
    center = (p + z2 / (2 * trials)) / denominator
    half = (Z_95 / denominator) * math.sqrt(p * (1 - p) / trials + z2 / (4 * trials * trials))
    # At 0 or N successes the exact endpoint is 0 or 1; floating point would give 1e-16 off.
    low = 0.0 if successes == 0 else max(0.0, center - half)
    high = 1.0 if successes == trials else min(1.0, center + half)
    return low, high


def standard_error(successes: int, trials: int) -> float:
    p = successes / trials
    return math.sqrt(p * (1 - p) / trials)


@dataclass
class Tally:
    """Running counts for one probability value."""

    trials: int = 0
    successes: int = 0
    component_sum: int = 0
    histogram: dict[int, int] = field(default_factory=dict)
    pivotal_counts: list[int] = field(default_factory=list)


@dataclass(frozen=True)
class Plan:
    graph: CompiledGraph
    edge_probabilities: list[float]
    node_probability: float
    two_terminal: tuple[int, int] | None


def make_plan(
    graph: CompiledGraph, edge_probability: float, node_probability: float, terminals: tuple[str, str] | None
) -> Plan:
    probabilities = [own if own is not None else edge_probability for own in graph.edge_own_probability]
    pair = None
    if terminals is not None:
        # A manually failed terminal is not in the operational graph: use -1 and the trial always fails.
        pair = (graph.index_of.get(terminals[0], -1), graph.index_of.get(terminals[1], -1))
    return Plan(graph, probabilities, node_probability, pair)


def _record(tally: Tally, outcome: TrialOutcome) -> None:
    tally.trials += 1
    tally.successes += outcome.success
    tally.component_sum += outcome.components
    tally.histogram[outcome.components] = tally.histogram.get(outcome.components, 0) + 1
    for i in outcome.pivotal_edges:
        tally.pivotal_counts[i] += 1


def run(
    plans: list[Plan],
    trials: int,
    seed: int,
    budget_seconds: float,
    clock: Callable[[], float] = time.monotonic,
) -> list[Tally]:
    """Run `trials` trials, evaluating every plan on the same uniforms (common random numbers).

    All plans share the graph and node probability; they differ only in edge probabilities.
    """
    graph = plans[0].graph
    n_nodes, n_edges = len(graph.node_ids), len(graph.edge_ids)
    node_probability = plans[0].node_probability
    rng = random.Random(seed)
    draw = rng.random
    tallies = [Tally(pivotal_counts=[0] * n_edges) for _ in plans]
    deadline = clock() + budget_seconds

    for trial in range(trials):
        if trial % DEADLINE_CHECK_EVERY == 0 and trial and clock() > deadline:
            raise SimulationTimeout(trial, budget_seconds * 1000)
        node_u = [draw() for _ in range(n_nodes)]
        edge_u = [draw() for _ in range(n_edges)]
        node_alive = [u >= node_probability for u in node_u]
        for plan, tally in zip(plans, tallies, strict=True):
            edge_alive = [edge_u[i] >= plan.edge_probabilities[i] for i in range(n_edges)]
            two_terminal = plan.two_terminal
            if two_terminal is not None and min(two_terminal) < 0:
                counted = evaluate_trial(graph, node_alive, edge_alive, None)
                outcome = TrialOutcome(False, counted.components, [])
            else:
                outcome = evaluate_trial(graph, node_alive, edge_alive, two_terminal)
            _record(tally, outcome)
    return tallies
