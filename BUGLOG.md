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

Phase 3 resolution of the items above:

* Dashboard: now shows only the backend analysis (auto analysis through `analysisStore`), with the
  same error, Retry and "Results out of date" states as the studio. An ESLint rule blocks the landing
  helpers from app code.
* Simulate and sweep: moved to the Phase 2 shapes (see BUG-002).
* Casts: removed. Nodes and edges are typed `EditorNode` and `EditorEdge` (`src/types/graph.ts`) and
  the components take `NodeProps<EditorNode>` and `EdgeProps<EditorEdge>`.
* Persistence: saved data is parsed with Zod and checked against the editing rules. When it is
  discarded, the studio shows a notice with the reason (`persistence-notice`), and a failed save
  (quota, blocked storage) is reported the same way. Tests: `src/test/persistence.test.ts`.

## BUG-002: Studio simulation and sweep failed with HTTP 422 after Phase 2

### Symptom

After Phase 2 replaced `/api/simulate` and `/api/reliability-sweep` with the contract shapes, the
studio's Simulator tab showed "Request rejected" errors (HTTP 422) for both buttons. Because of the
Phase 1B fix the failure was visible (error and Retry, no result), not hidden.

### Root cause

Phase 2 was backend only by instruction ("No frontend changes"). The studio still sent the legacy
request bodies (`failure_prob`, `fail_target`, `probs`) and parsed the legacy responses.

### Fix (Phase 3)

The data layer builds requests from the settings store (`src/store/requests.ts`), the generated types
define both request and response shapes, and the Simulator panel and sweep chart read the new fields
(`estimate`, `wilson95`, `criticalEdge`, `points[].p`, `points[].estimate`).

### Tests that now catch it

* `npm run check:api-types` and `tsc -b`: a backend shape change breaks the build before any UI runs.
* `src/test/schemas.test.ts`: the schemas parse real responses captured from the backend.
* `e2e/studio-backend.spec.ts`: the simulation and sweep tests assert that every displayed value
  equals the real backend response.

## BUG-003: The Star example was not a star

### Symptom

Failing the hub of the Star example gave 4 components, not one per leaf, and the example had a triangle.

### Root cause

The preset, carried over from the original studio, had 5 leaves and an extra `c1-c2` link.

### Fix (Phase 5)

`src/store/presets.ts`: Star is now a true star, a hub with 6 leaves and no other links, so every link
is a bridge and failing the hub gives 6 components. Saved graphs are not changed.

### Tests that now catch it

`e2e/studio-failure.spec.ts` asserts 6 components from the real backend after failing the hub, and
`e2e/studio-backend.spec.ts` asserts all 6 links are bridges.

## Phase 7 bug hunt

Each bug below was found in this phase, in code that existed before it, and has a regression test.

### BUG-004: The backend read request bodies of any size

* Symptom: a 2.6 MB body was read and parsed in full before the node limit rejected it.
* Root cause: no body size limit anywhere in the stack.
* Fix: `backend/app/middleware.py` rejects bodies over `NETSHIELD_MAX_REQUEST_BYTES` (1 MiB) with 413
  `PAYLOAD_TOO_LARGE` before the app reads them, including chunked bodies without a length. Contract
  section 5 amended.
* Tests: `backend/tests/test_hardening.py` (`test_body_over_the_limit_is_413_before_parsing`,
  `test_chunked_body_without_length_is_limited_too`, `test_a_graph_at_the_limits_fits_under_the_size_limit`),
  `e2e/robustness.spec.ts` (limits test).

### BUG-005: Malformed JSON was reported as an error "at [11]"

* Symptom: `{"nodes": [` gave "Invalid request at [11]: JSON decode error." with `details[0].path` `"[11]"`.
* Root cause: Pydantic puts the character offset in the error location; the handler formatted it as a
  field path.
* Fix: `backend/app/error_handlers.py` reports "Request body is not valid JSON (near character N)." with
  `details` `[{"path": "", "message": "Malformed JSON"}]`.
* Tests: `test_malformed_json_is_a_clear_validation_error` (4 bodies), `e2e/robustness.spec.ts`
  (malformed JSON test against the real backend).

### BUG-006: Blank and untrimmed labels were accepted

* Symptom: a label of spaces was stored, rendering an empty node; leading and trailing spaces were kept.
* Root cause: `checkLabel` checked only the length.
* Fix: labels are trimmed in the store and on import; blank labels are refused; the input has
  `maxLength=100`.
* Tests: `src/test/robustness.test.tsx` "labels are trimmed, and blank or over long labels are refused",
  import "trims imported labels and refuses blank ones", `e2e/robustness.spec.ts` (long labels).

### BUG-007: Nodes with the same label could not be told apart in pickers

* Symptom: two nodes labelled "Same" appeared as two identical options in the path, traversal, terminal
  and link pickers, and in analysis lists.
* Fix: `features/studio/nodeNames.ts` adds the id when a label is not unique ("Same (a)"); used by every
  picker and analysis list.
* Tests: "duplicate labels are told apart by id in every picker", `e2e/robustness.spec.ts` (duplicate labels).

### BUG-008: Requests were not checked before sending

* Symptom: settings or a graph that break a rule (for example from older saved data or a direct state
  change) were sent, and only the backend's 422 caught them.
* Fix: `analysisStore` checks every payload with the editing and settings rules first; a failure is a
  `CLIENT_VALIDATION` error ("Not sent: ...") and nothing is sent.
* Tests: "a payload that breaks a rule is never sent".

### BUG-009: The last changes before a reload were lost

* Symptom: choosing 20000 trials and reloading within 0.4 s brought back 1000.
* Root cause: saves are debounced by 400 ms and nothing flushed them when the page went away.
* Fix: `store/persistence.ts` writes pending changes on `pagehide`, `beforeunload` and when the tab is hidden.
* Tests: `src/test/persistence.test.ts` "a pending debounced save is written on pagehide and when the tab is
  hidden", `e2e/robustness.spec.ts` (reload in the middle of a simulation).

### BUG-010: Far away nodes could not be brought into view

* Symptom: a node at (999000, -999000) stayed off screen after Fit view, because the canvas could not zoom
  out far enough (minimum zoom 0.1).
* Fix: the store clamps every position (add, drag, nudge, move) to within 100000 of the origin; imported
  files beyond that are refused with a message; the canvas and Fit view can zoom out to 0.005. Saved data
  with far positions still loads (it is not discarded).
* Tests: "the store clamps added, moved and nudged positions", import "refuses huge coordinates",
  `e2e/robustness.spec.ts` (huge coordinates).

### BUG-011: Muted and failure text failed WCAG AA contrast

* Symptom: axe reported `color-contrast` on /studio, /dashboard and /privacy: muted text `#64748B` at
  3.8:1 on the page background, failure text `#F43F5E` at 4.2:1 on its dim background.
* Fix: token values (names unchanged) `--color-text-muted` `#8693A7` (at least 4.55:1 on every app
  surface) and `--color-state-failure` `#F65A74` (at least 4.84:1), in `index.css` and `lib/tokens.ts`.
* Tests: `e2e/accessibility.spec.ts` (axe, WCAG 2.1 AA, at 1440 and 390, in result, dialog and offline states).

### BUG-012: Linking nodes needed a pointer, and the handles had invalid ARIA

* Symptom: axe `aria-prohibited-attr` on all 28 handles (`aria-label` on a `div` without a role); there
  was no way to create a link from the keyboard.
* Fix: handles are `aria-hidden` (pointer only); the node properties panel has "Link to another node"
  (select plus Add link), which uses the same store validation and messages.
* Tests: axe spec, `e2e/accessibility.spec.ts` "add a node, link it, fail it and restore it, with the
  keyboard alone".

### BUG-013: The exact value inputs of the probability sliders had no label

* Symptom: axe `label` (critical) on `#edge-p-value` and `#node-p-value`.
* Fix: a visually hidden label ("Link failure probability (p), exact value").
* Tests: axe spec.

### BUG-014: The privacy page described a data flow the app does not have

* Symptom: it named the old storage key `netshield_graph_state_v1` and said that when the backend is
  offline "all computations execute locally in the browser", which is the silent fallback removed in
  Phase 1B. It did not mention that labels are sent, what the server logs, or the uvicorn access log.
* Fix: `/privacy` rewritten from the code: what is stored, what is sent and when, what the server logs
  (and what it never logs), demo mode, Google Fonts; hosting retention and contact marked "Developer
  review required".
* Tests: `e2e/robustness.spec.ts` "the privacy page states the real data flow and keeps Clear saved data".
