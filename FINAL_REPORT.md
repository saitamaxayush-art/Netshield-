# NetShield: Final Report

Final verification, 2026-11-07. Every number below was measured in this session on macOS (Darwin 25.6,
Apple Silicon), Node.js 26.7.0, Python 3.14.3, Google Chrome (Playwright channel `chrome`) and Playwright's
WebKit (build 2370). Nothing here is estimated.

## 1. What is implemented

| Area | Implemented | Verified by |
| :-- | :-- | :-- |
| Backend analysis (`POST /api/analyze`) | NetworkX on the operational graph: summary and density, connectivity with a reason, components, degrees, bridges, articulation points, BFS with layers, DFS, shortest path (hops, or weights when every link has one), healthy versus current comparison. Deterministic output. | 175 pytest tests (including Hypothesis property tests), the NetworkX cross check (section 3), end to end tests against the real backend |
| Backend simulation (`/api/simulate`, `/api/reliability-sweep`) | Seeded Monte Carlo, all terminal and two terminal, standard error, Wilson 95 percent interval, component histogram, most critical link, sweeps with common random numbers, time budget (504) | pytest, closed form checks on a 6 node cycle in Playwright (section 2) |
| Backend hardening | 1 MiB request limit (413), clear malformed JSON error, one error shape on every path (404, 405, 422, 500), CORS from the environment, JSON request logs without graph contents, `X-Request-Id`, versioned health, optional static serving of the built frontend for production | `test_hardening.py`, `test_static.py`, `robustness.spec.ts` |
| Typed data layer | Types generated from OpenAPI, Zod validation of every response, one `ApiError` type, timeouts, cancellation, supersession, health retries; demo adapter as a separate, labelled implementation | unit tests, `check:api-types`, integration test against a live backend (6 of 6) |
| Stores | Graph editing with validation and 100 step undo, settings, analysis results with request ids and a stale flag, versioned `localStorage` persistence with migration (format 5), health status | unit tests (281 passing) |
| Network Studio (`/studio`) | React Flow canvas bound to the store, four node types, link states (normal, selected, failed, unavailable, bridge, highlighted), toolbar, examples, keyboard use and shortcut help, touch connect, sheets on small screens, import and export (JSON, SVG, PNG) | `studio-editing.spec.ts`, `robustness.spec.ts`, `accessibility.spec.ts` |
| Failure simulation and analysis UI | Fail and restore, clear, seeded "Fail random" (undoable), seven analysis sections with explanations, canvas highlights, traversal play and step, aria-live announcements | `studio-failure.spec.ts`, `journey.spec.ts` |
| Reliability simulation UI | Controls with clamping, batching above 5000 trials with derived seeds and a real progress bar, cancel, results, four charts with data tables, CSV and JSON export | `simulation.spec.ts`, `journey.spec.ts` |
| Dashboard (`/dashboard`) | Metrics from the real analysis only, latest simulation, mini map, links to studio panels, empty state | `studio-failure.spec.ts`, `layout.spec.ts` |
| Resilience | Offline banner with Retry, explicit "Use demo mode", app and panel error boundaries, payload checks before sending, limits | `robustness.spec.ts`, `accessibility.spec.ts` |
| Accessibility | WCAG 2.1 AA (axe) on all app pages and states, keyboard only use, reduced motion, 40 px touch targets including navigation | `accessibility.spec.ts`, Lighthouse accessibility 100 |
| Privacy page | States the real data flow and server logging; unverified legal details marked "Developer review required" | `robustness.spec.ts` |
| Production | `npm run start:prod`: one uvicorn process without reload serving API and frontend; `.env.example`; Dockerfile and docker-compose.yml (not built, see section 7) | `test:e2e:prod` (8 of 8) |

## 2. Commands run and results

### Master check on a clean install

The working tree (tracked and new files, without `node_modules`, `.venv` or build output; 2.2 MB) was
copied to an empty folder, then installed exactly as the README says:

```
python3 -m venv .venv && .venv/bin/python -m pip install -r backend/requirements-dev.txt
npm --prefix frontend install     # found 0 vulnerabilities; frontend/tools installed by postinstall
npm install                       # found 0 vulnerabilities
scripts/verify.sh
```

```
=== verify summary ===
PASS  backend: ruff
PASS  backend: mypy
PASS  backend: pytest              175 passed
PASS  frontend: typecheck          app, Vite config, end to end specs (tsconfig.e2e.json)
PASS  frontend: lint
PASS  frontend: unit tests         Test Files 13 passed | 1 skipped (14); Tests 281 passed | 6 skipped (287)
PASS  frontend: api types in sync
PASS  frontend: build
All steps passed.
```

The 6 skipped unit tests are the integration tests that need a running backend; run separately with
`NETSHIELD_API_URL=http://127.0.0.1:8765 npm run test:integration`: Tests 6 passed (6).

### Full Playwright suite on the clean install (`npm run test:e2e`)

Production build served by `vite preview`, real FastAPI backend started by the test config on port 8799.

```
145 passed (2.7m)        Chrome: 123   WebKit: 22   failed: 0
200/600 drag: frames=121 p95=16.8ms max=41.4ms
```

It covers, among others:

* **Journey** (`journey.spec.ts`), at 1440 and 390 px in Chrome and WebKit:
  * landing to "Open Simulator" with no theme flash;
  * load Mesh, run analysis, fail two nodes and a link, with counts compared after every step against
    an independent naive reference implementation (`e2e/reference.ts`) and a hand check;
  * a seeded simulation and a sweep, all four charts and their data tables;
  * CSV export containing the seed and the assumptions;
  * reload with persistence, then clear saved data;
  * Privacy and Terms from the footer and directly, and the 404 page.
* **Simulation** (`simulation.spec.ts`): on the 6 node cycle at p = 0.2 the backend estimate is within 4
  standard errors of the closed form R = 0.65536, both as one request and as 4 batches of 5000, and a
  rerun with the same seed reproduces identical numbers.
* **Robustness, accessibility, layout, code splitting** (sections 4 and 5).

### Production smoke (`npm --prefix frontend run test:e2e:prod`)

Build, then `node scripts/start-prod.mjs` (uvicorn, no reload, `NETSHIELD_STATIC_DIR=frontend/dist`,
port 8811), then the journey and code splitting specs against it: **8 passed**, on the working tree
and again on the clean install.

### Security and dependencies

```
npm audit (frontend, frontend/tools, root)                          found 0 vulnerabilities (each)
pip-audit -r backend/requirements.txt -r backend/requirements-dev.txt   No known vulnerabilities found
```

* **Secret scan:** a pattern search of every tracked file for keys, tokens, passwords and private keys
  found one hit, a test literal ("SECRET-LABEL-7f3a" in `test_hardening.py`), not a credential.
* **Environment files:** no `.env` files are tracked. `.env.example` (backend and scripts) and
  `frontend/.env.example` list every variable the code reads.
* **Pinning:** backend runtime requirements are now pinned (`backend/requirements.txt`).

## 3. NetworkX cross check

`scripts/crosscheck_networkx.py` builds 20 seeded random graphs (2 to 40 nodes, random failed nodes and
links, isolated nodes), sends each to a running backend over HTTP, and compares components, bridges,
articulation points and density (exact equality) with NetworkX called directly on the operational graph.

```
$ .venv/bin/python scripts/crosscheck_networkx.py http://127.0.0.1:8765
seed  1: 10 nodes  11 links  5 failed | components  5 bridges  2 articulation  0 density 0.095238 | MATCH
seed  2:  5 nodes   2 links  1 failed | components  4 bridges  1 articulation  0 density 0.100000 | MATCH
seed  3: 17 nodes  23 links  3 failed | components  2 bridges  6 articulation  6 density 0.152381 | MATCH
seed  4: 17 nodes  19 links  6 failed | components  6 bridges  7 articulation  4 density 0.095238 | MATCH
seed  5: 18 nodes  31 links  7 failed | components  2 bridges  2 articulation  2 density 0.186813 | MATCH
seed  6: 38 nodes 187 links 19 failed | components  1 bridges  0 articulation  0 density 0.236975 | MATCH
seed  7: 22 nodes  69 links  9 failed | components  1 bridges  0 articulation  0 density 0.286765 | MATCH
seed  8: 16 nodes  23 links  7 failed | components  2 bridges  7 articulation  6 density 0.166667 | MATCH
seed  9: 31 nodes 136 links 19 failed | components  1 bridges  0 articulation  0 density 0.249231 | MATCH
seed 10: 38 nodes 154 links 27 failed | components  1 bridges  0 articulation  0 density 0.218391 | MATCH
seed 11: 30 nodes 140 links 25 failed | components  2 bridges  0 articulation  0 density 0.242105 | MATCH
seed 12: 32 nodes 148 links 13 failed | components  1 bridges  0 articulation  0 density 0.275862 | MATCH
seed 13: 18 nodes  51 links  7 failed | components  1 bridges  0 articulation  0 density 0.308333 | MATCH
seed 14:  8 nodes  13 links  2 failed | components  1 bridges  2 articulation  2 density 0.428571 | MATCH
seed 15: 15 nodes  13 links  4 failed | components  5 bridges  6 articulation  4 density 0.109890 | MATCH
seed 16: 25 nodes  92 links 16 failed | components  1 bridges  1 articulation  1 density 0.246753 | MATCH
seed 17: 35 nodes  39 links  8 failed | components  6 bridges 13 articulation 13 density 0.060215 | MATCH
seed 18: 13 nodes  14 links  1 failed | components  1 bridges  8 articulation  7 density 0.166667 | MATCH
seed 19:  4 nodes   1 links  1 failed | components  3 bridges  0 articulation  0 density 0.000000 | MATCH
seed 20: 11 nodes  13 links  5 failed | components  4 bridges  2 articulation  2 density 0.177778 | MATCH

20 of 20 graphs match; 0 mismatches.
```

## 4. Layout

`layout.spec.ts` checks `/dashboard`, `/studio`, `/privacy`, `/terms` and the 404 page at 360, 390,
414, 768, 820, 1024, 1280, 1440, 1680 and 1920 px in Chrome and WebKit:

* no horizontal scroll;
* no clipped text and no text past the right edge;
* aligned studio panel edges and equal toolbar and tab row height;
* dashboard cards aligned to the heading, with equal sizes per row;
* the graph framed in the canvas.

All 10 tests pass (5 pages in each of the 2 browsers). The checks were shown to fail on an injected
overflow and with the BUG-016 fix disabled. The defects found in the screenshot review and their fixes
are in `ALIGNMENT_AUDIT.md` (Phase 8 section).

## 5. Performance

### Lighthouse

Lighthouse 13.5.0 against the production build of the working tree (`vite preview`) with the real backend,
headless Chrome,
default throttling (mobile: simulated slow 4G and CPU slowdown). Final run:

| Page | Form | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS |
| :-- | :-- | --: | --: | --: | --: | --: | --: | --: | --: |
| /dashboard | desktop | 100 | 100 | 100 | 100 | 0.5 s | 0.8 s | 0 ms | 0 |
| /dashboard | mobile | 88 | 100 | 100 | 100 | 2.0 s | 3.6 s | 0 ms | 0.003 |
| /studio | desktop | 99 | 100 | 100 | 100 | 0.5 s | 0.9 s | 0 ms | 0 |
| /studio | mobile | 89 | 100 | 100 | 100 | 2.3 s | 3.3 s | 0 ms | 0 |
| /privacy | desktop | 99 | 100 | 100 | 100 | 0.4 s | 0.8 s | 0 ms | 0 |
| /privacy | mobile | 91 | 100 | 100 | 100 | 2.0 s | 3.3 s | 0 ms | 0 |

Before this phase's fixes, the first run measured:

| Page | Form | Performance | Accessibility | SEO | CLS |
| :-- | :-- | --: | --: | --: | --: |
| /dashboard | mobile | 70 | 100 | 91 | 0.327 |
| /studio | desktop | 99 | 98 | 91 | 0 |

The fixes were BUG-017 to BUG-020 in `BUGLOG.md`.

### Bundle and responsiveness

* **Bundle (production build):** 24 JS and CSS files, 2072.1 kB raw, 601.5 kB gzip in total. Largest
  chunks (raw / gzip):

  | Chunk | Raw | Gzip |
  | :-- | --: | --: |
  | StudioPage | 491.36 kB | 138.30 kB |
  | analysisStore (shared app code) | 308.37 kB | 96.35 kB |
  | index (entry) | 264.87 kB | 84.50 kB |
  | LandingPage (landing only) | 303.67 kB | 100.22 kB |
  | HeroScene (3D, landing only) | 535.54 kB | 134.03 kB |

* **Code splitting:** `bundle.spec.ts` records every script requested. `/dashboard`, `/studio` and
  `/privacy` load no LandingPage, HeroScene or three.js chunk and no landing stylesheet; a control test
  shows `/` does load them. This passes against `vite preview` and against the production server.
* **200 nodes and 600 links:** a 30 step drag in the studio measured p95 frame time 16.8 ms and a maximum
  of 41.4 ms (clean install run), with nothing saved during the drag and one save after it.

## 6. Fixed in this phase

* **Bugs BUG-015 to BUG-021** (`BUGLOG.md`):
  * untyped end to end specs: 11 type errors and 8 unchecked casts;
  * a canvas view restored at the wrong size;
  * the dashboard layout shift;
  * the missing `<main>` landmark;
  * the missing robots.txt;
  * render blocking fonts;
  * navigation touch targets.
* **The open test items 9.1 to 9.5** in `PROJECT_AUDIT.md`:
  * the deterministic cancel test;
  * a clear message when a batch fails;
  * the e2e type check;
  * error boundaries tested with a real render crash;
  * navigation touch targets.
* **A test race:** a test waited for the first analysis only after navigating; it now waits from
  before, and passed 20 of 20 repeats under load.

## 7. Known limitations

* **WebKit fonts:** on the landing page WebKit does not use the four font preloads and downloads each
  font twice (measured: 9 requests against Chrome's 5), with a console warning for each.
  PROJECT_AUDIT.md 9.6.
* **Docker:** `Dockerfile` and `docker-compose.yml` were written but not built or run: Docker is not
  installed in this environment. The same single process production setup is tested without Docker
  (`test:e2e:prod`).
* **Browsers:** Chrome and WebKit were tested; Firefox was not.
* **Runtime versions:** only Node.js 26.7.0 and Python 3.14.3 were used. During `npm install`, npm
  skipped the install script of the optional macOS file watcher `fsevents`; nothing depends on it.
* **Mobile Lighthouse:** largest contentful paint is 3.3 to 3.6 s under simulated slow 4G (performance
  88 to 91). The remaining time is JavaScript download and parse.
* **Rate limiting:** none. Request size, node, link and trial limits bound the cost of one request.
* **Batched simulations:** above 5000 trials, the combined Wilson interval and standard error are
  computed in the browser from the summed backend counts (labelled on screen). The most critical link is
  shown per batch, not combined.
* **Demo mode:** demo simulation numbers differ from the backend's for the same seed (different random
  generator); they are labelled "Demo result".
* **Test hook in the build:** `CrashProbe` throws only when a test sets `window.__nsCrash`; it renders
  nothing otherwise.
* **JSON casts in tests:** Playwright specs read response bodies with `as` type assertions on
  `response.json()` (an `any`). They are not validated with Zod in the tests, though the app itself
  validates every response.
* **Clear saved data in the studio:** the default star layout is saved again once the canvas view
  settles. Your graph is removed; the storage key comes back.
* **Privacy page:** log retention, hosting, Google Fonts and contact details are marked "Developer review
  required".
* **Earlier decisions:** the `text-muted` and `state-failure` token values were changed in Phase 7 for
  WCAG AA (names unchanged).

## 8. Manual test checklist (about ten minutes)

Start everything with `npm run dev:all` and open the printed Vite address (normally
`http://localhost:5173`).

1. **Landing (1 min):** the page loads in charcoal. Click "Open Simulator": the studio opens with no
   flash of another colour, showing "Example: star network" with 7 nodes.
2. **Analysis (1 min):** open the Analysis tab, Overview: "Connected", "Single component", 7 nodes, 6
   links. Critical: 6 bridges and 1 articulation point (Core Router). Click a bridge: it is highlighted
   on the canvas.
3. **Failures (2 min):**
   * Click Core Router, then in Properties "Fail selected node". Its links turn dashed and faded, a note
     explains why, and Analysis says "Not connected", 6 components.
   * Undo with Ctrl or Cmd Z: connected again.
   * Press "Fail random" twice and read which element was picked, then "Clear all failures".
4. **Editing (1 min):**
   * Tools or the toolbar: add a Router and drag from its handle to another node to link them.
   * Try linking a node to itself: a message explains why it is refused.
   * Press `?` for the shortcuts.
5. **Paths and traversal (1 min):**
   * Analysis, Paths: choose two clients; the path is highlighted with numbered badges.
   * Traversal: choose a start, press Play, and watch the BFS order appear.
6. **Simulation (2 min):**
   * Simulator: set link failure probability 0.2 and seed 42, then run. You see an estimate, a Wilson
     interval, trials and charts.
   * Run again with the same seed: identical numbers.
   * Choose 20000 trials: a warning about 4 batches, then a real progress bar.
   * Run a Reliability Sweep, open "View data table" on a chart, then Download CSV.
7. **Dashboard (1 min):** open Dashboard. The numbers match the studio, the mini map shows components,
   and "Run simulation" opens the studio simulator.
8. **Offline (1 min):**
   * Stop `dev:all`, then start the two servers in separate terminals: `npm run backend` and
     `npm --prefix frontend run dev`. Now stop only the backend terminal (Ctrl C).
   * Reload the studio: "Cannot reach the analysis server" appears with Retry. Start the backend again and
     press Retry: the banner goes away.
   * Choose "Use demo mode": every result says "Demo result". Then press "Exit demo mode".
9. **Persistence and privacy (30 s):**
   * Reload the studio: your graph and view are back.
   * Open Privacy from the footer and press "Clear Saved Data", then return to the studio: the star
     example is back.
