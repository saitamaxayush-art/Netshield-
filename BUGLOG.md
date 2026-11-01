# NetShield Bug Log

## BUG-001: Studio silently replaced backend results with browser computed demo results

| | |
| :-- | :-- |
| Found | 2026-11-01, after Phase 1 (question raised during review) |
| Fixed | 2026-11-01, Phase 1B |
| Severity | High: the app could show results that did not come from the backend, with nothing more than a badge to tell them apart, and the test suite could not notice |
| Area | `frontend/src/services/api/client.ts`, `frontend/src/store/graphStore.ts`, studio panels |

### Symptom

In `/studio`, Graph Analysis showed plausible results after "Compute Graph Metrics" even when the
backend rejected the request. The only sign was the header badge reading "Demo Adapter" instead of
"FastAPI NetworkX". No error and no Retry action ever appeared. Simulation and sweep had the same
code path, latent until a backend change or outage.

### Root cause

Three defects combined:

1. **Silent fallback.** Every client method wrapped the request in `try { ... } catch { return demoAdapter.x(req) }`.
   Any failure (backend down, HTTP 4xx or 5xx, invalid JSON, a response that failed validation) became
   a successful looking demo result. The store's error states and the analysis panel's Retry button
   were therefore dead code.
2. **Hand written types that nothing compared with the backend.** `frontend/src/types/api.ts` held
   hand written Zod schemas. When Phase 1 replaced `/api/analyze` with the `API_CONTRACT.md` shape,
   the client kept sending the old body (`failed_nodes`, `start_node`, ...), the backend answered 422,
   and defect 1 hid it. The generated OpenAPI types existed (Phase 0) but nothing imported them.
3. **A validation mismatch that predates Phase 1.** Even with the old backend, a run without a start
   vertex (the default) returned `bfs_order: null`, the hand written schema accepted only an array or
   undefined, and defect 1 switched to demo results. Verified by running the pre-Phase-1 backend from
   git and parsing its real responses with the client's schema: 2 of 3 cases parsed, the default case
   was rejected. So the default studio flow was already showing demo results before Phase 1.

Additional findings while fixing:

* The demo adapter's analysis returned fabricated values (diameter always 3, clustering always 0.35).
* Sweep errors were stored but never rendered; simulation errors had no Retry action.
* Path, BFS and DFS sequences rendered the literal text `&rarr;` (an HTML entity inside a JavaScript
  string) instead of an arrow.

### Why the tests did not catch it

* **Playwright** started only the frontend (`vite preview`), never the backend, and its studio test
  only checked that `/studio` loads without console errors. No test clicked an analysis or
  simulation action.
* **Frontend unit tests** validated the hand written schemas against hand written fixtures, not real
  backend output (this is also how defect 3 stayed hidden), and never exercised the client's network
  path.
* **Backend tests** cover the new contract only, not what the frontend sends.
* **`check:api-types`** proved the generated types matched the backend, but the app did not use the
  generated types.
* Even a click through test would have passed: defect 1 turned every failure into a normal looking
  result, so only an assertion on provenance (or on an error state) could fail.

### Fix

* `frontend/src/services/api/contract.ts`: Zod schemas for every consumed response, each proven
  **exactly equal** to the generated OpenAPI type by compile time assertions (`Equals<z.infer<...>,
  generated>`). Regenerating types after a backend change makes `tsc` fail until the runtime schema
  matches. Schemas are strict (unknown fields rejected). `types/api.ts` deleted.
* `client.ts`: no catch and substitute. Network failure, HTTP error (with the backend's
  `{error: {code, message}}` surfaced), non JSON and wrong shape all throw a typed `ApiError`. Each
  result is wrapped as `{ data, source }`; `source` is set by the code path, never read from the
  payload. Demo mode exists only when `VITE_USE_DEMO_ADAPTER=true` (exact string), is shown as a
  banner in the studio, labels results "Demo result", and offers no analysis (the fabricated demo
  analysis was removed).
* `graphStore.ts`: analysis uses the contract request (per element `failed` flags, `startNodeId`,
  `pathSource`/`pathTarget`), built from the generated request type. Every run clears the previous
  result and canvas highlights first, and a failure clears them again, so an error can never sit next
  to an older result.
* Panels: visible error with Retry for analysis, simulation and sweep; arrows render correctly.

### Tests that now catch it

* `frontend/e2e/studio-backend.spec.ts` (12 tests), with the real FastAPI backend started by
  `playwright.config.ts` on its own port (8799, never reused from outside the run):
  * analysis, simulation and sweep success: the test captures the backend's actual HTTP response and
    asserts every displayed value equals it (plus hand verified values: Star example bridges
    `e_hub_cli3`, `e_hub_fw`, `e_hub_srv` and articulation point `hub_1`; 6 leaf star: 6 bridges and
    the hub; hub failed: "6 components"), and that the source badge says backend;
  * analysis, simulation and sweep failure (HTTP 500 with error body, HTTP 200 with the wrong shape,
    connection refused): a visible error with Retry, no result, no source badge; Retry then succeeds
    against the real backend.
* Mutation check (each regression planted, spec run, source restored): a silent analysis fallback
  labelled backend, skipped response validation, a simulate fallback to the demo adapter, and keeping
  the previous result after a failure were all caught.
* Unit tests: `client.test.ts` (every failure kind throws, demo mode is explicit and never calls the
  network), `contract.test.ts` (strict schemas reject the legacy shape, unknown, missing and mistyped
  fields), `store.test.ts` (a failed analysis clears the result and highlights).

### Still open (related, out of scope for this fix)

* The dashboard computes components, bridges and articulation points in the browser
  (`DashboardPage.tsx`) instead of using the backend (rule 2). It is not a fallback (it never calls
  the backend), but its numbers are not backend results.
* Simulate and sweep still use the legacy endpoint shapes until Phase 2; their schemas are bound to
  the generated legacy types, so Phase 2 cannot change them without `tsc` and the real backend tests
  failing first.
* Pre-existing `as unknown as` casts in studio components (`NetShieldCustomEdge.tsx`,
  `NetShieldCustomNode.tsx`, `PropertiesPanel.tsx`) for React Flow node data.
* Saved workspace persistence: a corrupt `localStorage` entry silently loads the default Star
  example. This is local persistence, not an API result, but it is silent.
