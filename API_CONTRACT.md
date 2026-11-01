# NetShield API Contract

Status: **target contract** agreed in Phase 0, amended in Phase 1 (section 7) and Phase 2 (sections 3, 5,
8 and 9 refined to the Phase 2 brief). Implemented: `GET /api/health` (section 6, partially:
`engineVersion` and `limits` pending), `POST /api/analyze` (section 7), `POST /api/simulate` (section 8)
and `POST /api/reliability-sweep` (section 9).

The FastAPI service (NetworkX, Pydantic v2) is the single source of computed results. Frontend types
are generated from the backend OpenAPI schema (`npm run gen:api`), and `npm run check:api-types`
fails when they drift.

## 1. Conventions

| Topic | Rule |
| :-- | :-- |
| Base path | Every endpoint lives under `/api`. In development the Vite dev server proxies `/api` to FastAPI. |
| Encoding | JSON, UTF-8, `Content-Type: application/json`. |
| Field names | camelCase in requests and responses. |
| Unknown fields | Rejected with 422 (`VALIDATION_ERROR`). This catches client and server drift early. |
| Numbers | Returned unrounded (full double precision). Rounding is a presentation concern. |
| Ordering | Every list and every map in a response has a documented, deterministic order. Ids compare by Unicode code point (`"A" < "B" < "a"`, `"n10" < "n2"`). Maps keyed by node id are emitted in that order. |
| Determinism | The same request body always produces a byte-identical response body. Timing is reported in the `Server-Timing` response header (`compute;dur=<ms>`). One exception, requested in Phase 2: simulation responses carry `elapsedMs`; every other field is identical for the same request and seed. |
| Graph model | Simple undirected graph: no self loops, no parallel edges (in either direction), no duplicate ids. |

## 2. Common types

### 2.1 `Node`

| Field | Type | Required | Rules |
| :-- | :-- | :-- | :-- |
| `id` | string | yes | 1 to 64 characters, unique among nodes. |
| `label` | string | yes | 0 to 100 characters. Display only, never used for identity. |
| `type` | `"router" \| "server" \| "client" \| "firewall"` | yes | Display only, no effect on computation. |
| `failed` | boolean | no, default `false` | Stored failure status. |

### 2.2 `Edge`

| Field | Type | Required | Rules |
| :-- | :-- | :-- | :-- |
| `id` | string | yes | 1 to 64 characters, unique among edges. |
| `source` | string | yes | Must be the id of a node in the same request. |
| `target` | string | yes | Must be the id of a node in the same request; `target != source`. |
| `failed` | boolean | no, default `false` | Stored failure status of the link itself. |
| `failureProbability` | number | no | In `[0, 1]`. Overrides the request level `edgeFailureProbability` for this edge in simulations. Ignored by `/api/analyze`. |
| `weight` | number | no, default `1` | Finite and `> 0`. Used only when `pathMetric` is `"weight"`. |

Edges are undirected: `{source: "A", target: "B"}` and `{source: "B", target: "A"}` are the same
pair and may not both appear.

### 2.3 Graph payload

Every POST body contains:

```json
{ "nodes": [Node, ...], "edges": [Edge, ...] }
```

plus the endpoint specific fields below.

### 2.4 `Wilson95`

```json
{ "low": number, "high": number }
```

Wilson score interval at 95 percent (section 3, rule 8).

### 2.5 `Meta` (present in every successful POST response)

| Field | Type | Meaning |
| :-- | :-- | :-- |
| `engine` | `"networkx" \| "demo"` | Computation engine. The backend always sends `"networkx"`; `"demo"` marks results from the frontend demo adapter (explicit demo mode only). |
| `engineVersion` | string | NetworkX version, for example `"3.7"`. |
| `apiVersion` | string | Version of this contract implementation, for example `"2.0.0"`. |

Compute time is not part of the body (see Determinism in section 1); it is sent as
`Server-Timing: compute;dur=<milliseconds>`.

The backend never sets any demo flag. The frontend demo adapter (see section 9) is the only
producer of demo results.

## 3. Semantics (law)

These definitions apply to every endpoint and every test.

1. **Failed node.** A node with `failed: true` is not operational. Every edge incident to it is
   unavailable for analysis. The stored `failed` flag of those edges is not changed, so restoring the
   node (sending `failed: false`) restores every incident edge that was not independently failed.
2. **Operational graph.** Operational nodes are the nodes with `failed: false`. Operational edges are
   the edges with `failed: false` whose two endpoints are both operational. The operational graph is
   (operational nodes, operational edges).
3. **Connected.** The operational graph is connected when it has at least one node and exactly one
   connected component. An empty operational graph is **not** connected. A single operational node
   **is** connected.
4. **Bridge.** An operational edge whose removal increases the number of connected components of the
   operational graph.
5. **Articulation point.** An operational node whose removal (with its incident edges) increases the
   number of connected components of the operational graph.
6. **Reliability model.** Failures are independent. Starting from the operational graph:
   * each operational edge fails with its own `failureProbability` if set, otherwise with the request's
     `edgeFailureProbability`;
   * each operational node fails with `nodeFailureProbability` (default `0`);
   * an edge whose endpoint failed in the trial is unavailable in that trial (rule 1 applies per trial).

   Elements already failed in the request stay failed in every trial. Randomness only ever removes
   more elements.
   * **All terminal reliability** (`mode: "all-terminal"`, default): the probability that the surviving
     graph of a trial is connected in the sense of rule 3. If every node fails in a trial, that trial
     is a failure.
   * **Two terminal reliability** (`mode: "two-terminal"`): the probability that `source` and `target`
     both survive and lie in the same component of the surviving graph.
7. **Estimate.** With `k` successes in `N` trials: `reliability = k / N`,
   `standardError = sqrt(p (1 - p) / N)` with `p = k / N`.
8. **Wilson interval (95%).** With `z = 1.959963984540054`:

   ```
   center    = (p + z^2 / (2N)) / (1 + z^2 / N)
   halfWidth = (z / (1 + z^2 / N)) * sqrt(p (1 - p) / N + z^2 / (4 N^2))
   low       = max(0, center - halfWidth)   (exactly 0 when k = 0)
   high      = min(1, center + halfWidth)   (exactly 1 when k = N)
   ```

9. **Seeding and reproducibility.** Simulations use Python's `random.Random(seed)` (Mersenne Twister).
   If the request omits `seed`, the server chooses one and returns it. The same request with the same
   seed, against the same API version, returns identical results. Draw order inside one trial is fixed:
   one `random()` call for every operational node in request order, then one `random()` call for every
   operational edge in request order. An element fails when its draw is `< probability`. Node draws are
   made even when `nodeFailureProbability` is `0`, and edge draws are made even when an endpoint failed
   in the same trial, so the stream position never depends on earlier outcomes.

## 4. Limits

| Limit | Max | Error |
| :-- | --: | :-- |
| Nodes per request | 200 | 422 `LIMIT_EXCEEDED`, `details.limit = "maxNodes"` |
| Edges per request | 1000 | 422 `LIMIT_EXCEEDED`, `details.limit = "maxEdges"` |
| Trials per `/api/simulate` call | 20000 | 422 `LIMIT_EXCEEDED`, `details.limit = "maxTrials"` |
| Trials per sweep point | 20000 | 422 `LIMIT_EXCEEDED`, `details.limit = "maxTrials"` |
| Sweep points | 25 | 422 `LIMIT_EXCEEDED`, `details.limit = "maxSweepPoints"` |

`details` for `LIMIT_EXCEEDED` is `{ "limit": string, "max": number, "actual": number }`. The message
names the limit, for example `"Too many nodes: 240 given, maximum is 200 (maxNodes)."`.

## 5. Errors

Every non 2xx response, including 404, 405 and 500, has exactly this shape:

```json
{ "error": { "code": string, "message": string, "details": object | array (optional) } }
```

| HTTP | `code` | When | `details` |
| :-- | :-- | :-- | :-- |
| 422 | `VALIDATION_ERROR` | Body is not valid JSON, a field has the wrong type or range, an unknown field is present, `two-terminal` without `source` and `target`, `pMin > pMax` | array of `{ "path": string, "message": string }`, for example `{"path": "edges[3].failureProbability", "message": "must be <= 1"}` |
| 422 | `DUPLICATE_NODE_ID` | Two nodes share an id | `{ "id": string }` |
| 422 | `DUPLICATE_EDGE_ID` | Two edges share an id | `{ "id": string }` |
| 422 | `UNKNOWN_NODE` | An edge endpoint, `source` or `target` is not a node id in the request | `{ "id": string, "field": string }` |
| 422 | `SELF_LOOP` | `source == target` on an edge | `{ "edgeId": string }` |
| 422 | `PARALLEL_EDGE` | Two edges connect the same unordered pair | `{ "edgeIds": [string, string], "nodes": [string, string] }` |
| 422 | `LIMIT_EXCEEDED` | See section 4 | `{ "limit": string, "max": number, "actual": number }` |
| 504 | `TIMEOUT` | A simulation or sweep exceeded the server side time budget (`NETSHIELD_SIMULATION_BUDGET_MS`, default 10000 ms) | `{ "budgetMs": number, "completedTrials": number, "requestedTrials": number }` |
| 404 | `NOT_FOUND` | Unknown path | none |
| 405 | `METHOD_NOT_ALLOWED` | Wrong method on a known path | none |
| 500 | `INTERNAL_ERROR` | Unexpected server failure. Never includes a stack trace. | none |

Validation order: schema, then limits, then graph structure (duplicates, unknown endpoints, self
loops, parallel edges). The first failing check is reported.

## 6. `GET /api/health`

Response 200:

| Field | Type | Value |
| :-- | :-- | :-- |
| `status` | `"ok"` | Always `"ok"` when the service answers. |
| `service` | string | `"NetShield Backend"` |
| `engine` | string | `"NetworkX"` |
| `engineVersion` | string | NetworkX version. |
| `version` | string | API version. |
| `limits` | object | `{ "maxNodes": 200, "maxEdges": 1000, "maxTrials": 20000, "maxSweepPoints": 25 }` |

## 7. `POST /api/analyze`

Deterministic structural analysis of the operational graph (section 3), optionally with a traversal,
a shortest path, and a before and after comparison against the same graph with every failure cleared.

### Request

| Field | Type | Required | Rules |
| :-- | :-- | :-- | :-- |
| `nodes`, `edges` | see section 2 | yes | |
| `startNodeId` | string | no | Node id. Enables `traversal`. Unknown id: 422 `UNKNOWN_NODE` (`details.field = "startNodeId"`). |
| `pathSource` | string | no | Node id. Must be given together with `pathTarget` (otherwise 422 `VALIDATION_ERROR`). Unknown id: 422 `UNKNOWN_NODE`. |
| `pathTarget` | string | no | Node id, may equal `pathSource`. |
| `useWeights` | boolean | no, default `false` | `true`: weighted shortest path (Dijkstra) when **every** edge in the request has a `weight`; otherwise the hop count path is returned with `weightsIgnoredReason: "MISSING_WEIGHTS"`. |
| `compareHealthy` | boolean | no, default `false` | `true`: also analyse the same graph with every `failed` flag cleared (nodes and edges) and return it as `healthy`. |

### Response 200

```
{ "current": Analysis, "healthy": Analysis | null, "meta": Meta }
```

`healthy` is `null` unless `compareHealthy` is `true`. It is computed by the same rules, including
`traversal` and `path` when requested.

`Analysis`:

| Field | Type |
| :-- | :-- |
| `summary` | `Summary` |
| `connectivity` | `Connectivity` |
| `components` | `Components` |
| `degrees` | `Degrees` |
| `bridges` | `Bridges` |
| `articulationPoints` | `ArticulationPoints` |
| `traversal` | `Traversal \| null` (null unless `startNodeId` is given) |
| `path` | `Path \| null` (null unless `pathSource` and `pathTarget` are given) |

Every section carries an `explanationKey`: a stable identifier the frontend maps to explanatory text.
Keys are part of the contract; renaming one is a contract change.

`Summary` (`explanationKey: "density_definition"`):

| Field | Type | Meaning |
| :-- | :-- | :-- |
| `nodeCount`, `edgeCount` | integer | All nodes and edges in the request. |
| `operationalNodeCount`, `operationalEdgeCount` | integer | Section 3, rule 2. |
| `failedNodeCount` | integer | Nodes with `failed: true`. |
| `failedEdgeCount` | integer | Edges with `failed: true` (their own flag only). |
| `unavailableEdgeCount` | integer | Edges that are not operational for any reason (`edgeCount - operationalEdgeCount`). |
| `density` | number | NetworkX density of the operational graph, `2E / (V (V - 1))`; defined as `0` when `V < 2`. |

`Connectivity` (`explanationKey: "connectivity_definition"`):

| Field | Type | Meaning |
| :-- | :-- | :-- |
| `connected` | boolean | Section 3, rule 3. |
| `componentCount` | integer | Components of the operational graph (`0` when empty). |
| `reasonKey` | `"empty_network" \| "single_component" \| "multiple_components"` | |
| `reason` | string | `"Empty network"`, `"Single component"`, or `"<N> components"` (for example `"6 components"`). |

`Components` (`explanationKey: "component_definition"`):

| Field | Type | Meaning |
| :-- | :-- | :-- |
| `items` | `string[][]` | Node ids of each component, ascending; components ordered largest first, ties by smallest node id. |
| `componentOf` | `Record<string, integer \| null>` | For every node id, its index into `items`; `null` for failed nodes. |

`Degrees` (`explanationKey: "degree_definition"`):

| Field | Type | Meaning |
| :-- | :-- | :-- |
| `byNode` | `Record<string, { operational: integer, stored: integer }>` | For every node id. `operational`: degree in the operational graph (`0` for a failed node). `stored`: degree counting every edge in the request, failed or not. |

`Bridges` (`explanationKey: "bridge_definition"`): `edgeIds: string[]`, ascending. Section 3, rule 4,
computed per component so disconnected graphs are handled.

`ArticulationPoints` (`explanationKey: "articulation_point_definition"`): `nodeIds: string[]`,
ascending. Section 3, rule 5, computed per component.

`Traversal` (`bfsExplanationKey: "bfs_definition"`, `dfsExplanationKey: "dfs_definition"`):

| Field | Type | Meaning |
| :-- | :-- | :-- |
| `startNodeId` | string | Echo. |
| `error` | `{ code: "START_NODE_FAILED", message: string } \| null` | Set when the start node is failed; `bfs` and `dfs` are then empty. The rest of the analysis is still returned. |
| `bfs` | `{ nodeId: string, layer: integer }[]` | Breadth first visit order with hop distance from the start (start has layer 0). Neighbours visited in ascending id order. Covers the start node's component only. |
| `dfs` | `string[]` | Depth first preorder, neighbours in ascending id order, start node's component only. |

`Path` (`explanationKey: "shortest_path_hops"` or `"shortest_path_weighted"`):

| Field | Type | Meaning |
| :-- | :-- | :-- |
| `source`, `target` | string | Echo of `pathSource`, `pathTarget`. |
| `metric` | `"hops" \| "weight"` | Metric actually used. |
| `weightsIgnoredReason` | `"MISSING_WEIGHTS" \| null` | Set when `useWeights` was `true` but some edge has no `weight`. |
| `found` | boolean | A path exists in the operational graph. |
| `reason` | `"SOURCE_FAILED" \| "TARGET_FAILED" \| "DISCONNECTED" \| null` | Why `found` is false (`SOURCE_FAILED` wins when both endpoints failed); `null` when found. |
| `reasonKey` | `"path_source_failed" \| "path_target_failed" \| "path_disconnected" \| null` | |
| `nodeIds` | `string[] \| null` | Source first. Among all shortest paths, the one whose node id sequence is smallest (compared element by element). |
| `edgeIds` | `string[] \| null` | Edge ids along the path. |
| `hops` | integer \| null | `nodeIds.length - 1` (`0` when source equals target). |
| `length` | number \| null | Sum of edge weights for `metric: "weight"`, otherwise equal to `hops`. |

## 8. `POST /api/simulate`

Monte Carlo reliability estimate under section 3, rules 6 to 9. The trial loop runs in a worker
thread (it never blocks other requests) and stops with `TIMEOUT` when the time budget is exceeded.
Each trial is evaluated with union find; NetworkX is used for analysis and as the test oracle.

### Request

| Field | Type | Required | Rules |
| :-- | :-- | :-- | :-- |
| `nodes`, `edges` | see section 2 | yes | Manual `failed` flags are applied first (section 3, rule 2). |
| `edgeFailureProbability` | number | yes | `[0, 1]`. Edges with their own `failureProbability` use that instead. |
| `nodeFailureProbability` | number | no, default `0` | `[0, 1]`. |
| `trials` | integer | no, default `1000` | `>= 1`; more than 20000 is `LIMIT_EXCEEDED` (`maxTrials`). |
| `seed` | integer | no | `0` to `2^32 - 1`. When omitted the server picks one and returns it. |
| `mode` | `"all-terminal" \| "two-terminal"` | no, default `"all-terminal"` | |
| `source`, `target` | string | `two-terminal` only | Required and different in `two-terminal`; not allowed in `all-terminal` (422 `VALIDATION_ERROR`). Unknown ids: `UNKNOWN_NODE`. A manually failed terminal makes every trial fail. |

### Response 200

| Field | Type | Meaning |
| :-- | :-- | :-- |
| `mode`, `source`, `target` | | Echo (`source`, `target` are `null` in `all-terminal`). |
| `trials` | integer | `N`. |
| `connectedTrials` | integer | `k`, the number of successful trials. |
| `estimate` | number | `k / N`. |
| `standardError` | number | `sqrt(p (1 - p) / N)` with `p = k / N`. |
| `wilson95` | `{ low: number, high: number }` | Wilson score interval at 95 percent (section 3, rule 8); exactly `0` or `1` at the ends when `k = 0` or `k = N`. |
| `seed` | integer | Seed actually used. |
| `edgeFailureProbability`, `nodeFailureProbability` | number | Echo. |
| `averageComponents` | number | Mean number of connected components of the surviving graph over all trials (`0` counts a trial where every node failed). |
| `componentHistogram` | `{ components: integer, trials: integer }[]` | Trials per component count, ascending; `trials` sum to `N`. |
| `criticalEdge` | `{ edgeId, pivotalTrials, share, explanationKey: "critical_edge_definition" } \| null` | The edge that was pivotal in the most trials: a trial is a failure, the edge failed in it, and restoring that edge alone would make the trial succeed. `share = pivotalTrials / N`. Ties: smallest edge id. `null` when no edge was ever pivotal. |
| `assumptions` | `string[]` | Plain language statement of the model used for this result. |
| `elapsedMs` | number | Server compute time. The only field that varies between identical requests. |
| `explanationKey` | `"monte_carlo_estimate"` | |
| `meta` | `Meta` | Section 2.5. |

## 9. `POST /api/reliability-sweep`

Reliability as the edge failure probability varies, with **common random numbers**: each trial draws
its uniforms once (same draw order as section 3, rule 9) and the same draws are evaluated at every
`p`. A link that fails at `p` also fails at every larger `p`, so every trial's outcome, and therefore
every estimate, is non increasing in `p` by construction. A point at `p` is identical to
`/api/simulate` with that `p`, the same seed and `trials = trialsPerPoint`.

### Request

| Field | Type | Required | Rules |
| :-- | :-- | :-- | :-- |
| `nodes`, `edges` | see section 2 | yes | |
| `pMin`, `pMax` | number | yes | `[0, 1]`, `pMin <= pMax`. |
| `points` | integer | no, default `11` | `>= 1`; more than 25 is `LIMIT_EXCEEDED` (`maxSweepPoints`). Values are `pMin + i (pMax - pMin) / (points - 1)` rounded to 12 decimals; `points = 1` gives `[pMin]`. |
| `trialsPerPoint` | integer | no, default `1000` | `>= 1`; more than 20000 is `LIMIT_EXCEEDED` (`maxTrials`). |
| `nodeFailureProbability` | number | no, default `0` | Fixed for every point. |
| `seed`, `mode`, `source`, `target` | as in section 8 | | |

Edges with their own `failureProbability` keep it at every point.

### Response 200

| Field | Type | Meaning |
| :-- | :-- | :-- |
| `mode`, `source`, `target`, `trialsPerPoint`, `seed`, `nodeFailureProbability` | | Echo (`seed` is the one used). |
| `points` | `{ p, estimate, connectedTrials, standardError, wilson95 }[]` | One per probability, ascending `p`. |
| `assumptions` | `string[]` | As in section 8, plus the common random numbers statement. |
| `elapsedMs` | number | Server compute time for the whole sweep. |
| `explanationKey` | `"reliability_sweep"` | |
| `meta` | `Meta` | Section 2.5. |

## 10. Client behaviour (frontend obligations)

Implemented in Phase 3 (`frontend/src/services/api/`: `client.ts`, `schemas.ts`, `demoAdapter.ts`,
`registry.ts`; stores in `frontend/src/store/`).

* The studio and dashboard display only values returned by these endpoints. They never recompute
  analysis or reliability in the browser. An ESLint rule forbids importing the landing page graph
  helpers (`lib/graphAlgorithms`, `lib/seededGraphGenerator`, `landing/**`) from pages, features,
  services, stores, hooks, components and types.
* Every response is validated with Zod at the boundary. The schemas are strict (unknown keys
  rejected), are proven equal to the generated OpenAPI types at compile time, and also check ranges
  the OpenAPI types cannot express (probabilities in [0, 1], counts are non negative integers).
* Every failure is one `ApiError` with `kind` (`network`, `timeout`, `cancelled`, `validation` for
  HTTP 4xx, `server` for HTTP 5xx including `TIMEOUT` 504, `invalid_response`), `code` (the server's
  error code, or `NETWORK_ERROR`, `CLIENT_TIMEOUT`, `CANCELLED`, `SUPERSEDED`, `INVALID_RESPONSE`,
  `HTTP_<status>`), `message` and `status`.
* Client timeouts: health 3 s, analyze 10 s, simulate and sweep 15 s (above the server budget).
  Only `GET /api/health` is retried (3 attempts, on network, timeout and 5xx). A new request of the
  same kind cancels the previous one; callers can cancel with an `AbortSignal`. The analysis store
  also ignores any response whose request id is not the latest.
* Analysis re-runs automatically 300 ms after the graph, its failures, or the traversal and path
  settings stop changing (not for moves, renames or type changes), and only for a non empty graph.
  A result whose inputs changed afterwards is flagged `stale` and shown as "Results out of date".
  A failed request clears the earlier result; it is never shown next to an error.
* When the backend is unreachable or returns an error, the UI shows the error message and a Retry
  action. It does not switch to the demo adapter by itself.
* The demo adapter is used only when `VITE_USE_DEMO_ADAPTER=true` or after the explicit "Switch to
  demo mode" action; a banner is shown on every page while it is active. It returns the same response
  shapes, stamps `isDemo: true` and `meta.engine: "demo"` on every response, and every output is
  labelled **Demo result** in the UI. Its calculation code (`services/api/demo/`) is separate from the
  landing page helpers and from the backend. Its analysis is tested for exact equality with captured
  backend responses; its simulation uses its own generator and is tested statistically. Switching
  between modes clears every result.
* The client adds `isDemo: false` to backend responses. `isDemo` is a client side field, not part of
  the HTTP response.

## 11. Examples

Analyze (`A - B - C` with `B` failed):

```json
POST /api/analyze
{
  "nodes": [
    { "id": "A", "label": "Router A", "type": "router" },
    { "id": "B", "label": "Server B", "type": "server", "failed": true },
    { "id": "C", "label": "Client C", "type": "client" }
  ],
  "edges": [
    { "id": "e1", "source": "A", "target": "B" },
    { "id": "e2", "source": "B", "target": "C" }
  ]
}
```

returns in `current`: `connectivity.connected: false`, `connectivity.reason: "2 components"`,
`components.items: [["A"], ["C"]]`, `components.componentOf: {"A": 0, "B": null, "C": 1}`,
`summary.unavailableEdgeCount: 2`, `summary.failedEdgeCount: 0`,
`degrees.byNode.B: {"operational": 0, "stored": 2}`.

Simulate:

```json
POST /api/simulate
{ "nodes": [...], "edges": [...], "edgeFailureProbability": 0.1, "trials": 5000, "seed": 42 }
```

Sweep:

```json
POST /api/reliability-sweep
{ "nodes": [...], "edges": [...], "pMin": 0, "pMax": 0.5, "points": 6, "trialsPerPoint": 2000, "seed": 42 }
```

Error:

```json
HTTP 422
{ "error": { "code": "PARALLEL_EDGE",
             "message": "Edges e1 and e7 both connect A and B. The graph must be simple.",
             "details": { "edgeIds": ["e1", "e7"], "nodes": ["A", "B"] } } }
```
