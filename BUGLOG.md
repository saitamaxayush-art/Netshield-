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

## Phase 8 final verification

### BUG-015: End to end specs were never type checked

* Symptom: `frontend/e2e/` was in no tsconfig, so `tsc -b` and verify skipped it. A strict check found
  11 type errors in three landing specs and 7 `window as unknown as` casts in four test files; one more
  such cast was in `src/landing/workers/reliability.worker.ts`.
* Fix: `frontend/tsconfig.e2e.json` (strict) is part of `tsc -b`; test globals are declared once in
  `e2e/globals.d.ts`; `scripts/contrast.d.mts` types the contrast helper; all 8 casts removed (the worker
  declares `self` as its worker scope).
* Test: a deliberate type error in a spec now fails `tsc -b` (checked), and verify runs it.

### BUG-016: A saved canvas view was restored at a different screen size

* Symptom: after using the studio at 360 px, opening it at 1920 px showed the graph small in the top
  left corner (also after a window resize and reload).
* Fix: the view is saved with the canvas size; on load a different size fits the graph instead. The same
  size still restores the exact view.
* Tests: `layout.spec.ts` (graph fills the canvas at every width, proven to fail without the fix),
  `studio-editing.spec.ts` (same size reload restores the view exactly).

### BUG-017: The dashboard shifted when results arrived

* Symptom: Lighthouse mobile measured cumulative layout shift 0.327 on `/dashboard` (above the 0.1 good threshold).
* Fix: the loading placeholder is the same grid of eight cards with the same minimum height as the results.
* Test: Lighthouse after the fix: 0.003 (FINAL_REPORT.md); `layout.spec.ts` checks equal card heights.

### BUG-018: The studio had no main landmark

* Symptom: Lighthouse accessibility 98 on `/studio` (`landmark-one-main`).
* Fix: the studio workspace is a `<main>` element.
* Test: Lighthouse accessibility 100 on `/studio`; axe in `accessibility.spec.ts`.

### BUG-019: /robots.txt returned the app page

* Symptom: Lighthouse SEO 91: `robots.txt` had 44 syntax errors, because the server answered with the HTML page.
* Fix: `frontend/public/robots.txt`.
* Test: Lighthouse SEO 100; `backend/tests/test_static.py` serves it in production mode.

### BUG-020: The Google Fonts stylesheet blocked rendering on every page

* Symptom: Lighthouse "render blocking requests", about 950 ms on mobile.
* Fix: the stylesheet is loaded without blocking (`media="print"` swapped to `all` on load, with a
  `<noscript>` fallback); fonts already use `display=swap`.
* Test: Lighthouse mobile first contentful paint 2.5 s to 2.0 s on `/dashboard`, layout shift unchanged
  (0.003); the landing CLS and font tests in `audit.spec.ts` still pass.

### BUG-021: Navigation and small buttons were below the 40 px touch target

* Symptom: at 390 px the brand links (28 to 32 px), menu button (34 px), every footer link (16 px), "Back to
  top" (32 px) and every small button (36 px) were too small to tap reliably.
* Fix: `min-h-10` on those links and the menu button, and small buttons are 40 px on touch screens
  (`pointer-coarse:h-10`).
* Test: `accessibility.spec.ts` now measures every button and link in main, header, nav, footer and the
  studio on every app page.

Phase 8 also closed the open test items from PROJECT_AUDIT.md section 9 (9.1 to 9.5); see there.

## Post release sweep

### BUG-022: Two specs could read the page's own first analysis instead of the one they caused

* Symptom: under load (3 repeats with 8 workers) the import test failed once: "Expected: 2, Received: 1"
  components. The app was correct; the test was not.
* Root cause: the test waited for "the next `/api/analyze` response" after clicking Replace graph. The
  star example's automatic first analysis (1 component) could still be in flight and was taken instead.
  `studio-failure.spec.ts` had the same pattern after `page.goto('/studio')` in 7 tests.
* Fix: the import test matches the response whose request contains the 3 imported nodes;
  `studio-failure.spec.ts` opens the studio with `openStudio`, which waits for the first analysis as
  part of navigating.
* Tests: import test 15 of 15 and `studio-failure.spec.ts` 35 of 35 under 8 workers.

### BUG-023: The tour mascot's arms and eye swung around the wrong point

* Symptom: in the guided tour (new in this release) the pointing or waving arm floated away from the
  robot's body, and the eye could drift off the face during a blink. Found while reviewing tour screenshots.
* Root cause: Motion sets `transform-box: fill-box` on SVG elements, so a transform origin is measured
  from each shape's own box. The origins were written as drawing coordinates (`'18px'`, `'62px'`), which
  put the pivot far outside the arm.
* Fix: origins are fractions of each shape's own box (arms: top centre; eye and mouth: centre).
* Test: the full tour spec checks on every step that every part of the mascot stays within its bounds. On
  the old build it failed with "part at 982,603 outside mascot 792,447 88x97"; it passes now in Chrome
  and WebKit.

### BUG-024: The layout spec assumed simple pages render within 400 ms

* Symptom: the full suite failed `privacy`, `terms` and `404` layout at 414px: "heading inset, Received: -1".
  The page snapshot showed the route loader ("Loading NetShield Environment...") still on screen.
* Root cause: for those routes the test only slept 400 ms after `goto`. On a reload in the same tab the
  lazy route takes about 800 ms to replace the loader, even though every asset comes from cache within
  15 ms; the committed build measured the same (about 820 ms). The test had been passing on timing.
  The delay is most likely React's Suspense reveal throttling; this was not changed.
* Fix: the test waits for the page heading before measuring.
* Test: `layout.spec.ts` 30 of 30 with `--repeat-each=3` in Chrome and WebKit.

## Pre-demo sweep

A presenter's click-through of every studio and dashboard control against the real backend, both the
production build and `npm run dev:all` (34 steps, scripted in a real browser, with console and network
captured at each step).

### BUG-025: Update on an out of date result could run on an empty network

* Symptom: after Reset canvas, the Simulator still showed the earlier result as out of date (correct), but
  its Update button was enabled although Run Monte Carlo Simulation was disabled. Clicking it sent
  `POST /api/simulate` for a network with no nodes (HTTP 200) and showed a fresh "0.0%" estimate.
* Root cause: the run buttons were disabled for an empty network, but nothing else was: the out of date
  notice's Update (and an error box's Retry) called the store's `run` directly.
* Fix: the store's `run` sends nothing for an empty network; the Update button is disabled then, with
  "Add nodes to run it again."
* Tests: unit test in `analysisStore.test.ts` (5 requests sent instead of 2 without the fix); e2e test in
  `simulation.spec.ts` (Chrome and WebKit).

### BUG-026: Compute Graph Metrics looked like it did nothing

* Symptom: reported before the demo as "Compute Metrics isn't working properly". Measured: clicking it
  sends `POST /api/analyze` (HTTP 200 in 49 ms), but the button is busy for one animation frame and,
  because automatic analysis had already produced the same numbers, the panel text is identical before and
  after. Nothing on screen changes, so it reads as a dead button.
* Root cause: no visible sign that a run completed when its results are unchanged.
* Fix: the panel shows "Computed by the backend at HH:MM:SS (N ms)" (or "in the browser (demo)"), updated
  on every completed run (`finishedAt` on each result slot).
* Test: e2e test in `robustness.spec.ts`: two clicks, each one moves the shown time forward while the
  results stay the same.

### BUG-027: With the backend stopped behind a proxy, no offline banner and no way into demo mode

* Symptom: the backend process was stopped while the studio was open (`npm run dev:all` setup). Every
  request then got HTTP 502 with an empty body from the Vite proxy. The app showed "Backend error: The
  backend returned HTTP 502 without an error body." in the panels, but no "Cannot reach the analysis
  server" banner and no "Use demo mode" or "Switch to demo mode" button anywhere: a presenter had no way
  out.
* Root cause: the API client treated every 5xx response as a server error. Only a failed `fetch` counted
  as unreachable, and behind a proxy (Vite in development, any reverse proxy in production) the browser
  never sees one. The Phase 7 offline test aborted the connection, so it never covered this.
* Fix: 502, 503 and 504 without the backend's own JSON error body are network errors
  (`BACKEND_UNREACHABLE`). The backend's own 504 TIMEOUT keeps its JSON body and stays a server error.
* Tests: `client.test.ts` (four proxy answers; they fail on the old client); e2e test in
  `robustness.spec.ts` (fails on the old client with "offline banner not found"). Repeated by hand by
  stopping a real backend while the app was open.

### BUG-028: the tour "never appears" once it has been seen, with no visible way back in the studio

* Symptom: opening the studio or dashboard showed no Netbot and no tour.
* Investigation (real browsers, not code reading): the tour is built, merged (fe2d0b2), rendered by
  `TourHost` in `App.tsx` on every app page, and in the production build. In a clean profile it starts by
  itself on `/studio` and on `/dashboard` (Chromium and WebKit, desktop and 390 px phone, with and without
  reduced motion, and entering from the landing page). The mascot is opaque, at z-index 80, inside the
  viewport, and nothing covers it. No page errors. Removing `netshield_tour_seen` and reloading brings it
  back every time; with the key set to `1` it stays away, as designed.
* Root cause: the first visit check is per browser and per origin (`localStorage.netshield_tour_seen`),
  and any earlier Skip, Escape or Finish on that origin sets it. After that, the studio's only way back
  was a "Start guided tour" button inside the Keyboard shortcuts dialog, which nobody looks for. The
  dashboard's Guided tour button was the only visible replay.
* Fix: a visible "Guided tour" button (compass icon) in the studio toolbar and in the phone Tools sheet.
  The tour's "Help is here" step now points at it.
* Tests: `tour.spec.ts` gains "first visit with empty storage, straight to /studio" and "... /dashboard"
  (the mascot must be visible, opaque, on screen and on top), and "returning visitor" for desktop and
  phone (the key is set: no automatic tour, and the toolbar button brings Netbot back). The returning
  visitor tests fail without the button ("waiting for ... 'Guided tour'").

### BUG-029: the landing estimator e2e test failed intermittently ("p = 0.10")

* Symptom: `interactions.spec.ts` "estimator: 5000 trials match a seeded run" failed 2 of 3 times in
  isolation: after ten ArrowRight presses the slider still read p = 0.10.
* Root cause (test, not app): the test waited for the on-view run's final estimate, then pressed keys.
  The live estimate reaches its final value with the last progress batch, a moment before the run reports
  done and re-enables the slider (it is disabled while a run is going, by design). A focus listener showed
  the slider disabled with "Running" still shown at the moment it lost focus, so every key press was lost.
* Fix: the test waits for the slider to be enabled before pressing keys. 8 of 8 repeated runs pass.

### BUG-030: replace the automatic tour with an explicit Tutorial switch (supersedes BUG-028's button)

* Symptom: the first visit tour kept being reported as "not showing". BUG-028 traced it to the
  `netshield_tour_seen` key in `localStorage`, an "already seen" state the visitor cannot see.
* Fix: the automatic start and the storage are removed. A `role="switch"` control labelled Tutorial, in
  the top bar of the studio and dashboard (phone too), turns Netbot and the walkthrough on and off. The
  state lives only in the Zustand store, so every page load starts with it off. While the tour is on,
  the top bar sits above the tour's overlay, so the switch can always turn it off. Skip, Escape and
  Finish turn the switch off. The studio toolbar's Guided tour button, the dashboard's Guided tour
  button and the shortcuts dialog's Start guided tour button are gone: there is one control.
* Tests: `tour.spec.ts` (off on load; on puts the overlay and mascot in the page, off removes them, on
  /studio, /dashboard and a phone; keyboard Space and Enter with a visible focus ring; nothing kept
  after Skip and reload; the full walkthrough; axe). The first visit and returning visitor tests, and
  the seeded `storageState` in `playwright.config.ts`, are deleted with the trigger they tested.

## Landing scroll, UI sweep, tour voice and size

### BUG-031: landing section 02 (Sandbox) "gets stuck" while scrolling

* Reproduced (Playwright, real wheel events, Lenis on): over the Sandbox graph every wheel step moved the
  page exactly 100px with no smoothing (native scroll), and at the edge of the graph a step was lost
  (1447 -> 1440, 7px instead of about 100). Trackpad style input (40 x 12px) scrolling up over the graph
  covered 317 of 480px (66%), against 96% over empty space.
* Ruled out with evidence: `.ns-graph { touch-action: none }` was overridden by the inline `pan-y` on the
  SVG (computed value pan-y), and vertical swipes on the empty canvas scrolled on Pixel 7 and iPhone 14
  (Chromium emulation); the touchmove blocker only acts while a node is really dragged and is cleared on
  pointerup and pointercancel; arrow keys are only taken while a graph item has focus (PageDown scrolls);
  no ScrollTrigger position changes on a forced refresh after load (27 triggers), the How it works pin
  spacing matches its section; the menu overlay releases its lock on every close path.
* Root cause: the graph box carried `data-lenis-prevent`. Lenis then ignored wheel events over the graph,
  so the browser scrolled natively while Lenis kept easing towards its own target and wrote that back,
  undoing the native step. The Hero's WebGL layer carried the same attribute.
* Fix: `data-lenis-prevent` removed from the graph box and the Hero layer (neither uses the wheel); the
  stylesheet's `touch-action` for `.ns-graph` set to `pan-y` to match. Node dragging (touch and mouse)
  and keyboard movement are unchanged.
* Tests: `e2e/sandbox-scroll.spec.ts`. Against the old code: "wheel events over the graph handled by
  Lenis, expected 4, received 0" and "trackpad up moved 318, expected > 408". Both pass after the fix.

### BUG-032: the dashboard moved while its first results arrived

* Found by the sweep: layout shift on load at every width (CLS 0.022 to 0.039; graph map moved 23px at
  375px). The loading placeholder was not the same height as the metric cells, and the source badge row
  grew when the first result arrived. Introduced by the dashboard simplification (BUG-030 round).
* Fix: the placeholder renders the real cell markup with transparent text (same heights at every width,
  including the arrow icon that makes a label wrap at 375px), and the badge row reserves its height.
  CLS now 0 to 0.003.
* Tests: `e2e/ui-sweep.spec.ts` (CLS below 0.01 at 375, 768, 1280, 1920; old code 0.044 to 0.080).

### BUG-033: dashboard metric links only looked like links on hover

* Found by the sweep: after the simplification the cells had no border and their arrow appeared only on
  hover or focus, so on a touch screen nothing showed they open the studio.
* Fix: the arrow is always shown (muted), brighter on hover.
* Test: `e2e/ui-sweep.spec.ts` (arrow visible at full opacity on a touch viewport; old code opacity 0).

### BUG-034: on a phone the tour box covered half of the simulator it was explaining

* Found by the new every step geometry test: at 375px the simulation step's box covered 39 to 49% of the
  highlighted controls, which sit mid screen in the details sheet, so neither the top nor the bottom sheet
  position could clear them.
* Fix: while the tour is on, the details sheet opens to just below the top bar, and when an element sits
  where neither sheet position clears it, the tour scrolls it to the top of its panel once.
* Test: `tour.spec.ts` "on every step the tour box stays on screen and clear of the highlighted element"
  (375 and 1280px, Chrome and WebKit).

## Voice, accordions, readability

### BUG-035: Netbot's first line used the wrong voice; after mute and unmute it was right

* Reproduced in Google Chrome (fresh browser, Tutorial clicked as soon as it showed):
  `399ms speak("I will show you around..."): getVoices().length=0, utterance.voice=null (browser default)`
  then after mute and unmute `2299ms speak(...): getVoices().length=180, utterance.voice=Samantha`.
* Root cause: Chrome loads voices lazily. The voice was picked when the voice object was created, at the
  first click, while getVoices() was still empty, so the first utterance carried no voice and Chrome used
  its default. The voiceschanged listener fixed the choice only for later lines.
* Ruled out: the voice was set before speak() on every path (start, Next, Back, unmute); Chrome dropping
  an utterance spoken right after cancel(): every such utterance fired start in the log, so no next tick
  delay was added.
* Fix: the voice is resolved once: at once if the list is loaded, else on voiceschanged, else after 1.5s
  (browser default), and cached for the session. A line asked for while the list loads is held (the
  bubble text shows at once) and spoken with the resolved voice, unless Next, Back, mute, Skip or the
  switch came first. One utterance at a time as before.
* Tests: `voice.test.ts` (late list, never loading list, held line dropped by a newer one) and
  `tour-voice.spec.ts` "voices that load late" (first speak uses Samantha, the same as after unmute; a list
  that never loads still speaks after the wait with the default). The old code spoke at once with no voice.

### BUG-036: section arrows in the Analysis panel did not behave like toggles

* Diagnosed in Chromium for all seven sections and the folding rows: clicking an open section's arrow,
  text or row, or Enter or Space on it, never closed it (`true -> true`); the arrow rotated right to down
  correctly and no element covered it; no double toggle (one click event per action). The folding rows
  ("What this means", "More options") were 15 to 20px tall text links only as wide as their text, and
  Space did nothing on them: React Flow treats Space as its pan key on the whole document and cancels it
  outside text fields, which stops a summary from toggling.
* Fix: the open section closes when its row is pressed again; every header and folding row is one full
  width button at least 52px tall with a 24px arrow in a 44px box, hover and focus styles, pointing down
  when closed and up when open (rotation follows aria-expanded or open, instant with reduced motion). The
  side panel and the phone sheet carry React Flow's `nokey` class so panel controls keep their keys.
* Test: `accordion.spec.ts` (arrow opens, row closes, Enter and Space, and aria-expanded, content and arrow
  agree, for every section and folding row). Against the old code: "Overview start closed: expected false,
  received true" and "row height: expected >= 52, received 20".

### BUG-037: the larger type scale pushed controls off screen and under the side panel

* Found by the sweep after raising the type scale: at 375px the top bar's menu button ended at 383px; at
  1280 and 1920px the Simulator panel tab ran past the panel; at 1280px the toolbar (1071px wide in a
  900px column) ran under the side panel. A phone rule from an earlier round capped studio controls at
  40px (`min-height: 40px` below 1280px), overriding the 44px sizes.
* Also found: canvas cards grew from 84 to about 102px tall, so on the Ring example cards met and the
  Router A to Server 1 link was 3px long under them (the Ring e2e test could not click it); names such as
  "Internet Gateway" were cut off; the 14px "CUT VERTEX" badge reached the card's top connection handle.
* Fix: toolbar labels use the 14px label size and the "Example:" heading shows from 1536px, so the
  desktop toolbar fits one 60px row from 1280px, level with the panel tabs; panel tabs use the 14px label
  size; on phones the brand shows only its mark below 420px; the phone rule is 44px; 8px between
  neighbouring targets on phones; example layouts are spread 1.3 times; names on cards wrap to two lines
  instead of being cut (cards keep their 176px width, so saved layouts do not start to overlap); the cut vertex badge uses a 13px step (the smallest in the scale).
* Test: `ui-sweep.spec.ts` sizes (text at least 13px, panel text at least 14px, controls at least 44px,
  8px between targets on a phone) plus the existing overflow tests at 375, 768, 1280 and 1920px.
