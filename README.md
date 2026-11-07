# NetShield

NetShield is a graph theoretic network reliability and failure simulation system, built as a Discrete
Mathematics project. You draw a network, fail nodes and links, and the backend computes connectivity,
components, bridges, articulation points, traversals, shortest paths and Monte Carlo reliability with
NetworkX. The browser only displays those results.

* `/` landing page with its own small demos
* `/studio` network editor with analysis and simulation panels
* `/dashboard` overview of the current graph
* `/privacy`, `/terms`

Project documents: `FINAL_REPORT.md` (results of the final verification), `API_CONTRACT.md` (the API,
authoritative), `PROJECT_AUDIT.md`, `BUGLOG.md`, `ALIGNMENT_AUDIT.md`, `DESIGN.md`, `backend/README.md`.

---

## Prerequisites

* Node.js and npm (developed and tested with Node.js 26.7; other versions are untested)
* Python (developed and tested with Python 3.14.3; other versions are untested)
* For end to end tests: Google Chrome installed locally; optionally WebKit (`npx playwright install webkit`)

## Install

```bash
# Backend: a private Python environment in .venv
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements-dev.txt     # Windows: .venv\Scripts\python -m pip ...

# Frontend (its postinstall also installs the lint and code generation tools in frontend/tools)
npm --prefix frontend install

# Root tools (run backend and frontend together)
npm install
```

`backend/requirements.txt` is what the server needs to run (pinned); `requirements-dev.txt` adds the
test and audit tools.

## Environment

Nothing is required for local development. Every variable is documented with its default in
`.env.example` (backend and scripts) and `frontend/.env.example` (Vite, copy to `frontend/.env.local`).
The ones you are most likely to set:

| Variable | Where | Purpose |
| :-- | :-- | :-- |
| `NETSHIELD_API_PORT` | scripts, Vite proxy | Backend port (default 8000) |
| `NETSHIELD_CORS_ORIGINS` | backend | Allowed browser origins, only for a frontend on another origin |
| `NETSHIELD_MAX_REQUEST_BYTES` | backend | Request size limit (default 1 MiB, 413 above it) |
| `NETSHIELD_SIMULATION_BUDGET_MS` | backend | Time budget per simulation (default 10000, 504 above it) |
| `NETSHIELD_STATIC_DIR` | backend | Serve the built frontend from the API process (production) |
| `VITE_API_BASE_URL` | frontend build | API origin when it differs from the app's (default: same origin) |
| `VITE_USE_DEMO_ADAPTER` | frontend build | `true` starts in demo mode (results computed in the browser, labelled) |

## Run in development

```bash
npm run dev:all
```

This starts FastAPI with auto reload on `http://127.0.0.1:8000` and Vite on `http://localhost:5173`
(or the next free port; it is printed). Open the Vite address. Vite proxies `/api` to FastAPI, so
there is no CORS in development. Health check through the proxy: `http://localhost:5173/api/health`.

## Tests and checks

| Command | What it runs |
| :-- | :-- |
| `scripts/verify.sh` or `npm run verify` | **Master check**: backend ruff, mypy, pytest; frontend typecheck (app, Vite config and end to end specs), lint, unit tests, API types in sync, build |
| `npm run test:backend` | pytest (175 tests, including Hypothesis property tests) |
| `npm --prefix frontend test` | Vitest unit and component tests |
| `npm --prefix frontend run test:e2e` | Production build, then Playwright against `vite preview` and a real backend on port 8799, in Chrome (every spec) and WebKit (journey, failure, simulation, layout) |
| `npm --prefix frontend run test:e2e:prod` | Build, then a smoke run (journey, code splitting) against the production server (`start:prod` on port 8811) |
| `NETSHIELD_API_URL=http://127.0.0.1:8765 npm --prefix frontend run test:integration` | One real call per API client method against a running backend |
| `.venv/bin/python scripts/crosscheck_networkx.py http://127.0.0.1:8765` | 20 seeded random graphs: `/api/analyze` against NetworkX called directly |
| `npm --prefix frontend run gen:api` / `check:api-types` | Regenerate / verify `frontend/src/types/api.generated.ts` from the backend OpenAPI schema |
| `npm --prefix frontend run capture:api-fixtures` | Re-capture the real backend responses the schema and demo adapter tests use |
| `npm --prefix frontend audit`, `.venv/bin/python -m pip_audit -r backend/requirements.txt` | Dependency vulnerability checks |

## Build

```bash
npm --prefix frontend run build      # type checks, then writes frontend/dist
npm --prefix frontend run preview    # serves dist on http://localhost:4173, proxying /api to the backend
```

## Production

The simplest deployment is one process: uvicorn without reload serves both the API and the built
frontend from the same origin, so no CORS settings are needed.

```bash
npm --prefix frontend run build
NETSHIELD_API_HOST=0.0.0.0 NETSHIELD_API_PORT=8000 npm run start:prod
# = python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 1 --proxy-headers
#   with NETSHIELD_STATIC_DIR=frontend/dist
```

* Client side routes (`/studio`, `/dashboard`, ...) fall back to `index.html`; unknown `/api/...` paths
  keep the JSON error shape. Hashed assets are served with a one year immutable cache.
* To host the frontend elsewhere (any static host with a fallback to `index.html`), build it with
  `VITE_API_BASE_URL=https://your-api.example` and start the backend with
  `NETSHIELD_CORS_ORIGINS=https://your-frontend.example` (without `NETSHIELD_STATIC_DIR`).
* Put a TLS terminating reverse proxy in front for public use. Logs are one JSON line per request on
  standard error, without graph contents (see `/privacy`).
* `Dockerfile` and `docker-compose.yml` package the same single process setup
  (`docker compose up --build`, then `http://localhost:8000`). They were written but not built in the
  development environment, where Docker was not installed; `test:e2e:prod` tests the same setup
  without Docker.

## Architecture

```text
frontend/src
├── pages/            Landing (lazy), Studio, Dashboard, Privacy, Terms, NotFound
├── features/studio/  Canvas node and edge, toolbar, properties, failure controls, analysis sections,
│                     simulation panel, import and export, explanations of the maths
├── features/analytics/  Recharts charts with data tables
├── services/api/     client.ts (typed fetch client), schemas.ts (Zod, bound to the generated types),
│                     demoAdapter.ts + demo/ (independent browser implementation for demo mode), registry.ts
├── store/            Zustand stores and their rules (see below)
├── hooks/            useAutoAnalyze (debounced re-analysis), useMediaQuery
├── components/       Navbar, Footer, banners, error boundaries, Button, Dialog, Sheet
├── landing/          The landing page and its own demos (never imported by app code; ESLint enforces it)
└── types/            api.generated.ts (from OpenAPI, never edited), graph.ts (editor graph types)

backend/app
├── main.py           App factory: middleware, error handlers, routers, optional static frontend
├── routers/          /api/health, /api/analyze, /api/simulate, /api/reliability-sweep
├── models.py         Pydantic request and response models (the OpenAPI schema)
├── graph_ops.py      NetworkX analysis on the operational graph
├── simulation.py     Seeded Monte Carlo reliability and sweeps
├── middleware.py     Request size limit and structured request logging
└── error_handlers.py Every failure as {"error": {"code", "message", "details"?}}
```

**Stores** (`frontend/src/store`):

* `graphStore`: nodes, links, selection, failure flags, undo and redo (100 steps), examples, import.
  Every edit is validated (no self loops, no duplicate links, unique ids, limits).
* `settingsStore`: failure probabilities, trials, seed, mode, traversal start, path and terminal nodes,
  sweep range, adapter mode (backend or demo, never saved).
* `analysisStore`: the latest analyze, simulate and sweep results with status, error, request ids
  (a stale response never overwrites a newer one) and a `stale` flag ("Results out of date").
* `persistence`: saves graph, view and settings to `localStorage` (`netshield_workspace`, versioned,
  validated, migrated); results are never saved.
* `healthStore`, `studioViewStore`, `toastStore`: server status, what the studio shows, messages.

**API client** (`services/api/client.ts`): timeouts, cancellation (a new request of the same kind
supersedes the old one), retries only for the health check, Zod validation of every response, and one
`ApiError` type with a `kind` (network, timeout, cancelled, validation, server, invalid response). The
app never falls back to demo results on its own; demo mode is an explicit choice and every demo result
is labelled "Demo result".

## The rules in plain language

These come from `API_CONTRACT.md` section 3, which is the authority.

1. **A failed node takes its links down with it.** Its links count as unavailable, but their own saved
   state does not change, so restoring the node brings back every link that was not failed on its own.
2. **The operational graph** is what is left: nodes that are not failed, and links that are not failed
   and whose two ends are both up. All analysis is about this graph.
3. **Connected** means at least one node and exactly one component. An empty network is not connected;
   a single node is.
4. **A bridge** is a link whose removal splits a component. **An articulation point** is a node whose
   removal (with its links) splits a component.
5. **Reliability** is the chance that the network stays connected when every link (and optionally every
   node) fails independently with the chosen probability. Two terminal reliability is the chance that
   two chosen nodes stay connected. Elements you already failed stay failed in every trial.
6. **The estimate** is successes divided by trials, with a standard error and a 95 percent Wilson
   interval. The same seed gives exactly the same result. Above 5000 trials the app sends batches of
   5000 with seeds derived from the run seed and adds up the counts.
7. **Limits**: 200 nodes, 1000 links, 20000 trials per request, 25 sweep points, 1 MiB per request.

## Troubleshooting

**"Cannot reach the analysis server" or "Backend unreachable"**
The backend is not running or not on the port the frontend expects. Start it with `npm run dev:all`
(or `npm run backend`), check `http://127.0.0.1:8000/api/health`, then press Retry. If you only want to
look around, choose "Use demo mode"; every result is then labelled "Demo result".

**Port 8000 or 5173 is already in use**
Run on another port: `NETSHIELD_API_PORT=8765 npm run dev:all` moves the backend and the Vite proxy
together. Vite picks the next free port itself and prints it. To see what holds a port on macOS or
Linux: `lsof -nP -iTCP:8000 -sTCP:LISTEN`.

**CORS errors in the browser console**
They only happen when the frontend and the API are on different origins. Either serve both from one
origin (development proxy, or `start:prod`), or set `NETSHIELD_CORS_ORIGINS` on the backend to the
exact frontend origin (scheme, host and port, no trailing slash) and build the frontend with
`VITE_API_BASE_URL`.

**`check:api-types` fails, or the app shows "did not match the expected format"**
The backend models changed and the generated types are out of date. With the backend code current,
run `npm --prefix frontend run gen:api`, then `npm --prefix frontend run typecheck` and fix what it
reports. If backend responses changed, also run `capture:api-fixtures` against a running backend.

**Playwright cannot start: browser not found**
The suite uses the installed Google Chrome. Install Chrome, or WebKit with `npx playwright install webkit`.

**A saved graph does not load**
The studio shows why ("Saved data was not loaded ..."). Invalid saved data is discarded, never applied
half way. "Clear saved data" (studio Import or export, or the Privacy page) resets everything.
