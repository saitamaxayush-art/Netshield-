# NetShield

A Graph-Theoretic Network Reliability and Failure Simulation System built with React, TypeScript, Tailwind CSS, Python FastAPI, and NetworkX.

---

## Architecture Overview

```
Netshield-/
├── frontend/             # React 19 + TypeScript + Vite + Tailwind CSS + GSAP + Three.js
│   ├── src/              # Application source code
│   │   ├── components/   # Shared UI primitives and app layout
│   │   ├── landing/      # Landing page: sections, components, motion engine, hero, worker
│   │   ├── features/     # Landing sections, studio editor, analysis panels
│   │   ├── lib/          # Graph algorithms (Tarjan DFS, bridge detection, BFS)
│   │   ├── pages/        # Route pages (Landing, Studio, Dashboard, Legal)
│   │   └── store/        # Zustand state store
│   ├── package.json      # Frontend dependencies & scripts
│   └── vite.config.ts    # Vite bundler configuration
│
├── backend/              # Python FastAPI & NetworkX backend
│   ├── main.py           # FastAPI server with Monte Carlo simulation & Tarjan endpoints
│   ├── test_main.py      # Automated backend unit tests (pytest)
│   ├── requirements.txt  # Python backend dependencies
│   └── __init__.py       # Backend module package
│
├── API_CONTRACT.md       # Target API contract
├── PROJECT_AUDIT.md      # Phase 0 audit
├── ALIGNMENT_AUDIT.md    # Multi-viewport alignment & defect audit
├── DESIGN.md             # Design tokens, color system, and typography spec
└── README.md             # Project documentation
```

---

## Getting Started

Prerequisites: Node.js 20 or newer, Python 3.12 or newer. All commands run from the repository root
unless stated otherwise.

### 1. Install

```bash
# Backend: private Python environment in .venv (details for beginners: backend/README.md)
python3 -m venv .venv                                         # Windows: py -m venv .venv
.venv/bin/python -m pip install -r backend/requirements-dev.txt   # Windows: .venv\Scripts\python -m pip ...

# Frontend (also installs the isolated lint and codegen tools in frontend/tools)
npm --prefix frontend install

# Root tools (runs backend and frontend together)
npm install
```

Optional: copy `frontend/.env.example` to `frontend/.env.local` to change `VITE_API_BASE_URL` or
`VITE_USE_DEMO_ADAPTER`.

### 2. Run in development

```bash
npm run dev:all
```

Starts FastAPI with auto reload on `http://127.0.0.1:8000` and Vite on `http://localhost:5173` (or
the next free port; it is printed). Open the Vite address. Vite proxies `/api` to FastAPI, so there are
no CORS issues in development. If port 8000 is taken: `NETSHIELD_API_PORT=8765 npm run dev:all`.

Health check through the proxy: `http://localhost:5173/api/health`.

**Demo mode** (no backend needed): `VITE_USE_DEMO_ADAPTER=true npm --prefix frontend run dev`. Demo mode
can also be entered from the app with the "Switch to demo mode" button, which appears only on a
"Backend unreachable" or "Request timed out" error. While it is on, a banner shows on every page and
every result is labelled **Demo result**. "Exit demo mode" in the banner goes back to the backend.
The app never switches to demo mode by itself.

**Saved data**: the studio graph and settings are saved in this browser's `localStorage` under
`netshield_workspace` (version 5, including the canvas viewport; older versions and the version 1 key `netshield_graph_state_v1` are migrated once).
Results are never saved. "Clear saved data" is in the studio tools and on the Privacy page.

**Studio**: press `?` for keyboard shortcuts. Below 1280px wide, the tools and panels open as sheets from the toolbar. On touch, tap a handle on one node and then on another to connect them.

### 3. Checks

| Command | What it runs |
| :-- | :-- |
| `scripts/verify.sh` (macOS, Linux) or `npm run verify` (any OS) | **Master check used by every phase gate**: backend ruff, mypy, pytest; frontend typecheck, lint, unit tests, API types in sync, build. Prints a PASS or FAIL summary. |
| `npm --prefix frontend run typecheck` | `tsc -b` (TypeScript 7, strict) |
| `npm --prefix frontend run lint` | ESLint with typescript-eslint and React hooks rules |
| `npm --prefix frontend test` | Vitest unit tests (React Testing Library available) |
| `npm --prefix frontend run test:e2e` | Production build, then Playwright (local Google Chrome). Starts the real FastAPI backend on port 8799 for the studio tests in `e2e/studio-backend.spec.ts`; needs `.venv` |
| `npx --prefix frontend playwright test e2e/studio-failure.spec.ts` (from `frontend/`, after a build) | Failure simulation against the real backend, no mocks: Star, Ring, paths, traversal, dashboard values |
| `npm --prefix frontend run build` | Type check and Vite production build |
| `npm --prefix frontend run gen:api` | Regenerates `frontend/src/types/api.generated.ts` from the FastAPI OpenAPI schema |
| `npm --prefix frontend run check:api-types` | Fails if the generated API types are out of date |
| `NETSHIELD_API_URL=http://127.0.0.1:8765 npm --prefix frontend run test:integration` | One real call per client method (health, analyze, simulate, reliabilitySweep, plus a 422 and a cancel) against a running backend; skipped in `npm test` |
| `NETSHIELD_API_URL=http://127.0.0.1:8765 npm --prefix frontend run capture:api-fixtures` | Re-captures the real backend responses in `frontend/src/test/fixtures/backend/` that the schema and demo adapter tests use. Run after any backend response change |
| `npm run test:backend` | pytest |

Why `frontend/tools/` exists: the app compiles with TypeScript 7 (the native compiler, which has no
JavaScript API). ESLint's TypeScript parser and openapi-typescript need that API, so they live in a
small separate package with its own TypeScript 5.9, installed automatically by `npm install` in
`frontend/`.

### 4. Landing page QA

```bash
cd frontend
npm run test:e2e                    # 81 tests: landing audits, interactions, scroll, routes, contrast, and the studio against the real backend
node scripts/alignment-report.mjs   # regenerates ../ALIGNMENT_AUDIT.md from the audit measurements
node scripts/perf.mjs               # full page scroll profile at 1440x900 (needs the preview server on :4317)
node scripts/contrast.mjs           # WCAG ratios for every landing colour pair
node scripts/font-metrics.mjs       # measures fallback font overrides
```

Screenshots from the audit are written to `audit-screenshots/landing/<viewport>/`.

### 5. Project documents

* `API_CONTRACT.md`: the API the backend must provide (target for later phases).
* `PROJECT_AUDIT.md`: state of the project at Phase 0, with real command output.
* `BUGLOG.md`: bugs found after release of a phase, with root cause, fix and the test that now catches each.
* `DESIGN.md`, `ALIGNMENT_AUDIT.md`: landing page design system and audit.
* `backend/README.md`: backend setup for first time Python users.

---

## Features

- **Interactive Topology Studio**: Custom canvas for constructing router, server, and gateway topologies.
- **Topological Degradation Simulation**: Stochastic failure simulation of nodes and links with real-time bridge and articulation point detection using Tarjan's algorithm.
- **Monte Carlo Reliability Estimation**: Repeated stochastic simulation to compute k-connectivity confidence intervals and all-terminal network reliability.
- **Interactive Landing Page**: visitors operate small, real pieces of NetShield (a break-a-network sandbox, a pinned how it works story, topology comparison, a Monte Carlo reliability estimator running in a Web Worker, and a BFS and DFS path explorer). Every widget runs on the same unit tested module (`frontend/src/lib/graphAlgorithms.ts`) as the dashboard and demo adapter. Landing code lives in `frontend/src/landing/`; tokens, grid, motion and measured results are in `DESIGN.md`.
