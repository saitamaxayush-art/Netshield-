# NetShield Project Audit (Phase 0)

Date: 2026-11-01. Repository state: commit `ef33842` plus uncommitted landing page edits that were
already in the working tree before Phase 0 (13 files under `frontend/src/landing/`; not touched by
Phase 0). Every command output below was produced by running the command on the development Mac
(macOS, Node 26.7.0, Python 3.14.3 in `.venv`).

Target API: `API_CONTRACT.md`. Section 5 below lists how the current code differs from it.

## 1. Layout

```
.
├── backend/                 FastAPI + NetworkX service (single module)
│   ├── main.py              models, graph builder, /api/analyze, /api/simulate, /api/reliability-sweep, health
│   ├── test_main.py         pytest (10 tests after Phase 0)
│   ├── export_openapi.py    NEW: prints the OpenAPI schema (type generation)
│   ├── requirements.txt     runtime deps (unpinned lower bounds)
│   ├── requirements-dev.txt NEW: pinned pytest, httpx, ruff, mypy, types-networkx
│   └── README.md            NEW: beginner setup guide
├── frontend/                React 19, TypeScript 7.0.2, Vite 8, Tailwind 4
│   ├── src/pages/           Landing (/), Dashboard, Studio, Privacy, Terms, NotFound (lazy routes)
│   ├── src/landing/         landing page (sections, motion engine, hero, worker)
│   ├── src/features/studio/ studio panels (toolbar, analysis, simulation, properties, custom node and edge)
│   ├── src/features/analytics/ReliabilitySweepChart.tsx (Recharts)
│   ├── src/store/graphStore.ts  zustand store: graph, failures, persistence, API calls
│   ├── src/services/api/    client.ts (fetch + zod), demoAdapter.ts
│   ├── src/types/           api.ts (hand written zod), graph.ts, api.generated.ts (NEW, generated)
│   ├── src/lib/             graphAlgorithms.ts, seededGraphGenerator.ts, motion.ts, tokens.ts, useReducedMotion.ts
│   ├── src/components/      ui/ (Button, Badge, Dialog), layout/ (Navbar, Footer, Container), editorial/EditorialMenuOverlay
│   ├── src/test/            Vitest (6 files, 43 tests)
│   ├── e2e/                 Playwright (6 specs, 44 tests, landing page focused)
│   └── tools/               NEW: isolated ESLint + openapi-typescript package (see section 7)
├── scripts/                 NEW: verify.sh, verify.mjs, dev-backend.mjs, python.mjs, run-python.mjs; old audit-layout.js
├── package.json             root workspace scripts (dev:all, verify, ...)
├── pyproject.toml           NEW: ruff, mypy, pytest configuration
└── API_CONTRACT.md, PROJECT_AUDIT.md, DESIGN.md, ALIGNMENT_AUDIT.md, README.md
```

Routes (`frontend/src/App.tsx`): `/` landing, `/dashboard`, `/studio`, `/privacy`, `/terms`, `*` not found.

Env files: none committed before Phase 0. `.gitignore` ignores `.env`, `.env.local`, `.env.*.local`.
Phase 0 adds `frontend/.env.example`. The client reads `VITE_API_BASE_URL` and `VITE_USE_DEMO_ADAPTER`.

## 2. What exists and works

| Area | Evidence |
| :-- | :-- |
| Backend endpoints `/api/analyze`, `/api/simulate`, `/api/reliability-sweep` respond and use NetworkX | pytest 7/7 before Phase 0 |
| Failure semantics for failed nodes (incident edges excluded, stored edge state untouched) | `build_active_networkx_graph`, test `test_incident_edge_failure_semantics` |
| Studio canvas (React Flow) with add, connect, delete, fail and restore, examples (star, ring, mesh) | store tests 5/5; e2e `routes.spec.ts` loads `/studio` without console errors |
| Store prevents self loops and duplicate connections between the same pair | `store.test.ts` |
| Persistence of the workspace in `localStorage` (`netshield_graph_state_v1`) with safe parse fallback | `graphStore.ts` lines 214 to 280 |
| Zod validation of API responses in the client | `apiValidation.test.ts` 4/4 |
| Analysis, simulation and sweep panels in the studio, with a Recharts sweep chart | renders; badges show the result source |
| Landing page with its own tested demo widgets | `npm run test:e2e` 44/44 (section 4.2) |
| Type check, lint (oxlint), unit tests, build | section 4, all exit 0 |

## 3. What is stubbed or fake

Phase 1B status (see `BUGLOG.md`, BUG-001): the silent demo fallback, the dead error paths and the
fabricated demo analysis values below are fixed and covered by real backend tests
(`frontend/e2e/studio-backend.spec.ts`). Demo results are labelled "Demo result". The unseeded
simulation remains until Phase 2.

| Item | Location | Problem | Rule |
| :-- | :-- | :-- | :-- |
| Hard coded diameter | `frontend/src/services/api/demoAdapter.ts` (`diameter: isConnected && n > 1 ? 3 : null`) | Always reports 3 regardless of the graph. Fabricated value. | 3 (never fake results) |
| Hard coded clustering | same file (`average_clustering: n > 2 ? 0.35 : null`) | Always 0.35. Fabricated value. | 3 |
| Silent demo fallback | `frontend/src/services/api/client.ts`, every method's `catch` | Any failure (backend down, 4xx validation error, 5xx, response shape mismatch) silently returns a demo adapter result. The user gets numbers instead of an error. | 3 |
| Dead error paths | `graphStore.ts` `analysisError`, `simulationError`, `sweepError` | Never set in practice because the client never throws (see previous row). No retry action exists. | 3 |
| Demo labelling wording | `AnalysisPanel.tsx`, `SimulationPanel.tsx`, `ReliabilitySweepChart.tsx` | Badges read "Demo Adapter", not "Demo result"; the dashboard shows no source at all. | 3 |
| Unseeded simulation | `backend/main.py` uses the global `random.random()` | Results are not reproducible; no seed in request or response. | contract 3.9 |

## 4. Command results (real output)

### 4.1 Baseline, before any Phase 0 change

| Command | Exit | Output (relevant lines) |
| :-- | :-: | :-- |
| `npx tsc -b` (frontend) | 0 | no output |
| `npm run lint` (frontend, oxlint) | 0 | `> oxlint` with no findings |
| `npm test` (frontend, Vitest) | 0 | `Test Files  6 passed (6)` / `Tests  43 passed (43)` |
| `npm run build` (frontend) | 0 | `✓ built in 321ms`; warning `Some chunks are larger than 500 kB` (`StudioPage` 557.92 kB, `HeroScene` 535.54 kB) |
| `.venv/bin/pytest backend/test_main.py` | 0 | `7 passed, 1 warning in 0.28s` |
| `ruff`, `mypy` | n/a | Not installed (`No module named 'ruff'`, no `.venv/bin/mypy`) |

The pytest warning (still present): `StarletteDeprecationWarning: Using httpx with starlette.testclient
is deprecated; install httpx2 instead.` The tooling list for this project names httpx, so it stays;
switching to httpx2 is a candidate for a later phase.

### 4.2 Master check after Phase 0 (`scripts/verify.sh`, identical summary from `npm run verify`)

```
=== verify summary ===
FAIL  backend: ruff
FAIL  backend: mypy
PASS  backend: pytest
PASS  frontend: typecheck
FAIL  frontend: lint
PASS  frontend: unit tests
PASS  frontend: api types in sync
PASS  frontend: build

3 step(s) failed.
```

pytest: `10 passed, 1 warning`. Vitest: 43/43. `npm run test:e2e`: `44 passed (1.6m)`.

### 4.3 Pre-existing failures surfaced by the new tools (RESOLVED in Phase 0B, see 4.4)

None of these come from Phase 0 code. New Phase 0 files (`export_openapi.py`, the CORS and health
additions in `main.py`, new tests, scripts) produce no ruff, mypy or ESLint findings.

**ruff: 48 findings, all in pre-existing code** (`backend/main.py` 45, `backend/test_main.py` 3).

```
28  UP006   non-pep585-annotation        (List[...] instead of list[...])
 9  UP045   non-pep604-annotation-optional (Optional[X] instead of X | None)
 3  UP035   deprecated-import            (typing.List, Dict, Tuple)
 3  ANN201  missing-return-type          (analyze_network, simulate_failures, reliability_sweep)
 2  I001    unsorted-imports
 2  F401    unused-import                (HTTPException, pytest)
 1  E501    line-too-long
```

**mypy (strict): 14 errors in pre-existing code**

```
backend/main.py:137: error: Missing type arguments for generic type "set"  [type-arg]
backend/main.py:138: error: Missing type arguments for generic type "set"  [type-arg]
backend/main.py:139: error: Missing type arguments for generic type "Graph"  [type-arg]
backend/main.py:146: error: Need type annotation for "g"  [var-annotated]
backend/main.py:182: error: Function is missing a return type annotation  [no-untyped-def]
backend/main.py:253: error: Function is missing a return type annotation  [no-untyped-def]
backend/main.py:311: error: Function is missing a return type annotation  [no-untyped-def]
backend/test_main.py:13, 19, 37, 55, 88, 105, 128: error: Function is missing a return type annotation  [no-untyped-def]
Found 14 errors in 2 files (checked 4 source files)
```

Status: resolved in Phase 0B (section 4.4).

**ESLint: 6 errors, all in landing page code** (the landing page is out of scope for Phase 0):

| File | Rule | Finding |
| :-- | :-- | :-- |
| `src/landing/sections/Estimator.tsx:266` | `react-hooks/refs` | Reads `runParams.current` during render. Correction (Phase 0B): this was originally described here as a visible bug; it is not. `run()` writes the ref before the state updates that trigger the render, so the rendered value was already correct. It is still an impure render (a React rule violation). |
| `src/landing/components/BigWordList.tsx:62` | `no-useless-assignment` | `let next = selected` overwritten on every branch. |
| `src/landing/sections/FinalCta.tsx:35` | `no-useless-assignment` | Initial `y = 0` overwritten in the loop. |
| `src/lib/seededGraphGenerator.ts:368` (3 findings) | `no-useless-assignment` | `let x = 0, y = 0, z = 0` before a `do` loop that always assigns them. Landing only helper. |

The lint rules were not weakened. Status: resolved in Phase 0B (section 4.4).

### 4.4 Phase 0B: lint and type debt cleared

Before and after counts, each from a real run of the same command on the whole repository:

| Check | Command | Before | After |
| :-- | :-- | --: | --: |
| ruff | `.venv/bin/ruff check .` | 48 findings (`backend/main.py` 45, `backend/test_main.py` 3) | 0 (`All checks passed!`) |
| mypy, strict | `.venv/bin/mypy` (config: `strict = true`, files `backend`, which holds every Python file in the repo) | 14 errors in 2 files | 0 (`Success: no issues found in 4 source files`) |
| ESLint | `npm --prefix frontend run lint` | 6 errors in 4 files | 0 |

How each was fixed (no logic changes):

| Item | Fix |
| :-- | :-- |
| 45 ruff findings | `ruff check . --fix`: `List`, `Dict`, `Tuple`, `Optional` rewritten as `list`, `dict`, `tuple`, `X \| None`; imports sorted; unused imports `HTTPException` (main.py) and `pytest` (test_main.py) removed. |
| 3 ruff ANN201 and 3 mypy no-untyped-def in main.py | Return types `AnalyzeResponse`, `SimulateResponse`, `ReliabilitySweepResponse` (the models already declared as `response_model`). |
| ruff E501 | Module docstring line in `test_main.py` wrapped. |
| mypy type-arg, var-annotated | `failed_node_ids: set[str]`, `failed_edge_ids: set[str]`, graph typed `nx.Graph[str]` (node ids are strings). |
| mypy no-untyped-def (7, test_main.py) | `-> None` on the seven test functions. |
| Newly visible after annotating | Annotating `analyze_network` made mypy check its body for the first time and exposed a wrong third party stub: types-networkx 3.6.1.20261031 declares `nx.bridges` as yielding nodes, while NetworkX 3.7 yields `(u, v)` edge tuples (verified: `list(nx.bridges(...))` returns `[('C', 'D')]`). The line declares the true type `list[tuple[str, str]]` and carries `# type: ignore[arg-type]` with a one line comment. This is the only ignore in the backend; strict mode's `warn_unused_ignores` confirms it is needed. No `Any` was added. |
| ESLint `no-useless-assignment` (5) | `BigWordList.tsx`: `let next: number` without a dead initial value. `FinalCta.tsx`: `const y` scoped inside the loop. `seededGraphGenerator.ts`: `let x: number, y: number, z: number` before the `do` loop (same random call order, so seeded output is unchanged). |
| ESLint `react-hooks/refs` (1) | `Estimator.tsx`: the probability of the run in progress is kept in state (`runP`, set in `run()` next to the existing state updates) and read in render instead of the ref. Rendered output identical. |

Behaviour check for the backend: the pre fix `main.py` (saved copy) and the fixed one were loaded side
by side and given the same 40 random graphs on all three POST endpoints (simulations under the same
global random seed): 0 differences. pytest 10/10, Vitest 43/43 and Playwright 44/44 pass after the
changes.

Not done (outside the gate): `ruff format --check backend` reports 2 files that would be reformatted.
Formatting is not part of `verify`; reformatting would add churn to files Phase 1 rewrites.

## 5. Broken or non conforming (against `API_CONTRACT.md`)

Phase 2 status: `POST /api/simulate` and `POST /api/reliability-sweep` now conform (seeded, Wilson
interval, per edge probabilities, two-terminal mode, common random numbers, time budget, worker thread);
items 3, 5 and 6 are resolved for them. The legacy endpoints were removed, so the studio's simulation
and sweep now receive 422 and show a visible error until the frontend moves to the new shapes
(`check:api-types` fails and 5 real backend e2e tests fail until then, by design of Phase 1B).

Phase 1 status: `POST /api/analyze` now conforms (backend/app/, 88 backend tests). For the analyze
endpoint, items 1, 2, 3 (node and edge limits), 4, 7 and 8 below are resolved; they remain open for
`/api/simulate` and `/api/reliability-sweep` (Phase 2). Item 4 (error shape) is resolved for every
endpoint, including the legacy ones.

Backend:

1. Request shape: failures are sent as `failed_nodes` / `failed_edges` id lists, not per element
   `failed` flags; fields are snake_case; `type` is a free string (contract: enum).
2. No graph validation. Duplicate node ids, unknown edge endpoints (silently dropped), self loops and
   parallel edges (silently merged by `nx.Graph`) are all accepted.
3. No limits except `trials <= 5000` and `trials_per_prob <= 1000`; no node, edge or sweep point limits.
4. Error shape is FastAPI's default `{"detail": ...}`, not `{error: {code, message, details}}`.
5. Simulation is unseeded; confidence interval is the Wald interval (`p +- 1.96 SE`, clamped) instead
   of Wilson; results rounded to 4 decimals on the server.
6. No per edge `failureProbability`; one `failure_prob` applied to nodes, edges or both. No
   two terminal mode. No node failure probability separate from edge probability.
7. `bfs_order` and `dfs_order` depend on insertion order (NetworkX adjacency order), not ascending ids.
8. Bridges returned as sorted id pairs rather than edge ids.
9. Health was only at `/health` (fixed in Phase 0: `/api/health` added, `/health` kept). The response
   lacks `engineVersion` and `limits` from the contract.
10. CORS allowed `*` with credentials (fixed in Phase 0, see section 7).

Frontend:

11. Default API base was `http://localhost:8000`, a cross origin call in development (fixed in Phase 0:
    relative `/api` through the Vite proxy).
12. Hand written zod schemas in `src/types/api.ts` can drift from the backend. Generated types now
    exist (`api.generated.ts`) but nothing imports them yet.
13. Dashboard computes analysis in the browser (section 6).

## 6. Duplicated logic

Phase 1B status: hand written API types (`src/types/api.ts`) removed; runtime schemas in
`src/services/api/contract.ts` are proven equal to the generated types at compile time. The demo
adapter no longer has an analysis path. The dashboard still computes analysis in the browser (open).

Phase 3 status: resolved. The dashboard and the studio properties panel show backend results only
(the local degree count and the dashboard's `lib/graphAlgorithms` calls are gone), and an ESLint
`no-restricted-imports` rule keeps the landing helpers out of app code. `contract.ts` became
`schemas.ts`. The demo adapter has its own independent implementation in `services/api/demo/`
(analysis checked for exact equality against captured backend responses). The studio example
topologies now live in `src/store/presets.ts`.

| Logic | Copies | Rule |
| :-- | :-- | :-- |
| Components, bridges, articulation points | Backend (NetworkX); `frontend/src/lib/graphAlgorithms.ts` used by the **dashboard** (`DashboardPage.tsx` lines 20 and 33 to 50 compute them locally on every render), by the **demo adapter**, and by the **landing page** widgets. | 2 (studio and dashboard must not recompute; landing helpers must not be imported by studio or dashboard), 3 (demo and real paths must not share calculation code) |
| Monte Carlo simulation | Backend `simulate_failures`; `graphAlgorithms.simulateReliability` (demo adapter); `createReliabilityRun` (landing worker) | 2, 3 |
| Example topologies (star, ring, mesh) | `graphStore.ts` (studio examples) and `seededGraphGenerator.generatePreset` (landing) | Different purpose and layout; acceptable, listed for awareness |
| API types | `src/types/api.ts` (zod, hand written) and `src/types/api.generated.ts` (generated) | To be resolved when the client moves to the contract |
| Theme tokens | `src/index.css` (`@theme`), `src/lib/tokens.ts`, landing `landing.css` | Landing tokens are intentionally separate; `tokens.ts` duplicates `index.css` values |

Plan implied by the rules: split `lib/graphAlgorithms.ts` into a landing only module (imported only
under `src/landing/`) and a separate demo adapter implementation; the dashboard reads results from
the backend through the store.

## 7. Phase 0 changes (tooling only)

| Change | Files |
| :-- | :-- |
| Backend dev tooling, pinned: pytest 9.2.0, httpx 0.28.1, ruff 0.17.3, mypy 2.4.1 (strict, pydantic plugin), types-networkx | `backend/requirements-dev.txt`, `pyproject.toml` |
| `GET /api/health` (typed `HealthResponse`), legacy `/health` kept out of the schema | `backend/main.py`, 3 new tests in `backend/test_main.py` |
| CORS from `NETSHIELD_CORS_ORIGINS` (comma separated), defaulting to local dev origins; no credentials; only GET, POST, OPTIONS | `backend/main.py` |
| OpenAPI export for codegen | `backend/export_openapi.py` |
| Frontend scripts `typecheck`, `lint` (ESLint), `lint:oxlint` (previous linter, kept), `test`, `test:e2e`, `build`, `gen:api`, `check:api-types`, `postinstall` | `frontend/package.json` |
| ESLint 10 + typescript-eslint + react-hooks + react-refresh; `no-explicit-any` and `ban-ts-comment` (ts-ignore, ts-nocheck) as errors | `frontend/tools/eslint.config.js` |
| Isolated tools package with TypeScript 5.9.3 for ESLint and openapi-typescript (see below), `minimatch` 11.0.3 override to clear a moderate advisory | `frontend/tools/package.json`, lockfile |
| Type generation and drift check | `frontend/tools/gen-api.mjs`, `frontend/src/types/api.generated.ts` |
| Vite dev and preview proxy `/api` to FastAPI; port follows `NETSHIELD_API_PORT` | `frontend/vite.config.ts` |
| Relative API base by default | `frontend/src/services/api/client.ts` (one line) |
| Env documentation and typing | `frontend/.env.example`, `frontend/src/vite-env.d.ts` |
| `npm run dev:all` (concurrently), cross platform backend launcher | `package.json`, `scripts/dev-backend.mjs`, `scripts/python.mjs` |
| Master check | `scripts/verify.sh`, `scripts/verify.mjs` (`npm run verify`), `scripts/run-python.mjs` |
| Lint disable comment renamed from the oxlint rule name to the ESLint rule name | `frontend/src/landing/components/Toast.tsx` (comment only) |
| Docs | `README.md`, `backend/README.md`, `API_CONTRACT.md`, this file |

**Why `frontend/tools/` exists.** The app uses TypeScript 7.0.2, the native compiler, which ships no
JavaScript API (`require('typescript').createSourceFile` is undefined). typescript-eslint requires
`typescript >= 4.8.4 < 6.1.0` and openapi-typescript requires `typescript ^5`, both as peer
dependencies, so npm refuses to install them next to TypeScript 7 (`ERESOLVE`), and npm `overrides`
cannot split a peer dependency (tried, same error). The tools therefore live in their own package with
TypeScript 5.9.3, used only to parse source for linting and to print generated types. Type checking of
the app stays on TypeScript 7 (`tsc -b`). `npm install` in `frontend/` installs the tools package via
`postinstall` (verified from an empty `tools/node_modules`).

## 8. Known limitations after Phase 0 and 0B

* `verify` passes every step since Phase 0B (section 4.4). The backend still does not conform to
  `API_CONTRACT.md` (section 5); that is Phase 1.
* ESLint runs without type aware rules (no `parserOptions.project`), because the type information
  would come from TypeScript 5.9 rather than the TypeScript 7 compiler the app uses. Strictness is
  enforced by `tsc -b` with `strict: true`.
* `api.generated.ts` reflects the current (non conforming) backend; it changes when Phase 1 lands.
* On this machine port 8000 was already used by another uvicorn process (started 2026-10-31 with the
  system Python 3.13), so the dev:all gate was run with `NETSHIELD_API_PORT=8765`; with port 8000 free
  the defaults apply. In Phase 0 Vite chose 5174 because 5173 was busy; in Phase 0B 5173 was free.
* Playwright e2e covers the landing page and route smoke tests; studio and dashboard flows have no e2e
  tests yet.

## 9. Open items for the Phase 8 QA sweep

Tracked here so they are not left only in phase reports. Each line says where it lives and what to decide.

| # | Item | Where | Risk | What Phase 8 should do |
| :-- | :-- | :-- | :-- | :-- |
| 9.1 | The cancel test assumes Cancel is clicked before the first of 4 batches returns. It passes today (the first 5000 trial batch takes long enough), but a much faster backend could finish batch 1 first, so the run would still be cancelled but the assertion on the "No result." text could race. | `frontend/e2e/simulation.spec.ts`, test "cancel stops a running batched simulation and says so" | Flaky test, not a product bug | Make the timing deterministic, for example hold the first `/api/simulate` response with `page.route` until Cancel has been clicked, then release it, and assert no result and no later batches. |
| 9.2 | When one batch of a batched simulation fails, the whole run reports the error and the batches that already finished are discarded; no partial result is shown. This is deliberate (a partial run is not the run the user asked for), but it throws away valid backend results. | `frontend/src/store/simulationRuns.ts` (`runBatches`), `frontend/src/store/analysisStore.ts` (`runSlot`) | Lost work on long runs; no wrong numbers | Decide: keep as is, or offer the completed batches as a clearly labelled partial result ("3 of 4 batches, 15000 trials") with Retry for the rest. Add a test either way. |
| 9.3 | `frontend/e2e/` is not in any tsconfig (`tsconfig.app.json` includes only `src`, `tsconfig.node.json` only `vite.config.ts`), so `tsc -b` and verify never type check the Playwright specs; Playwright only strips types. Still true after Phase 7. A strict standalone check (`tsc --noEmit --strict ... e2e/*.ts`, run 2026-11-06) finds no errors in the 8 studio, simulation, robustness and accessibility specs, but 11 errors in three pre-existing landing specs (`fallbacks.spec.ts`, `scroll.spec.ts`: undeclared `window.__nsEngine`, `__NS_FORCE_MOTION_FAILURE`, `__nsHeroFrames`; `static.spec.ts`: untyped import of `scripts/contrast.mjs`). Four landing spec files also still use `window as unknown as` (`audit.spec.ts`, `helpers.ts`, `interactions.spec.ts`, `routes.spec.ts`, 7 casts). | `frontend/e2e/`, `frontend/tsconfig*.json` | Type errors in tests go unnoticed; unchecked casts against rule 4 | Add a `tsconfig.e2e.json` (strict, `include: ["e2e", "playwright.config.ts"]`) to the `tsc -b` references, declare the landing test globals with a `declare global { interface Window { ... } }` as done in `studio-editing.spec.ts`, add a declaration for `contrast.mjs`, and remove the 7 casts. |
| 9.4 | Error boundaries (app and panel) are covered by unit tests only (`src/test/robustness.test.tsx`); no Playwright test forces a real render crash in the built app. | `frontend/src/components/layout/ErrorBoundary.tsx`, `StudioPage.tsx` | A boundary that fails to catch in the production build would go unnoticed | Add a test only crash trigger (for example a query flag read only in test builds, or injecting a malformed store state with `page.evaluate`) and assert the panel fallback, Try again, and that the rest of the page keeps working; same for the app fallback. |
| 9.5 | The 40px touch target test (`e2e/accessibility.spec.ts`) checks `main` and `.studio-root` controls only; the shared Navbar and Footer links and buttons are not measured. | `frontend/e2e/accessibility.spec.ts`, `src/components/layout/Navbar.tsx`, `Footer.tsx` | Small touch targets in the navigation on phones | Extend the test to `header` and `footer` at 390 px and fix any control under 40px. |

## 10. Phase 7 changes and decisions

* Removed unused dependencies `@react-three/drei`, `@react-three/fiber`, `clsx`, `tailwind-merge` and the
  unused `src/lib/useReducedMotion.ts` and `graphSignature`. Kept `puppeteer-core` (used by
  `scripts/audit-layout.js`) and `@types/three` (types for `three`). Added `@axe-core/playwright` 4.14.0 as a
  test only dependency.
* No `TODO` or `FIXME` in the code; no em dash in any user facing string; no `dangerouslySetInnerHTML`,
  `innerHTML` or `eval` anywhere in `src`.
* Two theme token values changed for WCAG AA contrast (BUG-011); token names and every other value are
  unchanged.
* Rate limiting is not implemented (optional in the brief). The request size limit and the node, edge and
  trial limits bound the cost of one request.
* Numeric inputs clamp into their range with a note ("Set to 1, the largest allowed value."); input that is
  not a number is refused with the reason.
