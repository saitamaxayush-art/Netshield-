# NetShield backend

The backend is a small Python web service. It receives a network (nodes and links) from the
browser, analyses it with the NetworkX graph library, and sends the results back as JSON. The API it
must provide is described in `../API_CONTRACT.md`.

All commands below are run from the **repository root** (the folder that contains `backend/` and
`frontend/`), not from inside `backend/`.

## 1. One time setup

You need Python 3.12 or newer. Check with:

```bash
python3 --version        # macOS and Linux
py --version             # Windows
```

Create a virtual environment. This is a private folder (`.venv`) holding the Python packages for
this project only, so nothing is installed system wide.

```bash
# macOS and Linux
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements-dev.txt

# Windows (PowerShell or cmd)
py -m venv .venv
.venv\Scripts\python -m pip install -r backend/requirements-dev.txt
```

`requirements.txt` lists what the server needs to run. `requirements-dev.txt` adds the testing and
checking tools (pytest, httpx, ruff, mypy, NetworkX type stubs). You only repeat this step when those
files change.

You do not need to "activate" the environment: every command below calls the `.venv` Python
directly.

## 2. Run the server

Easiest, together with the frontend (from the repository root):

```bash
npm install          # once, installs the tool that runs both servers
npm run dev:all
```

This starts the API on http://127.0.0.1:8000 and the website on http://localhost:5173 (Vite picks the
next free port if 5173 is busy and prints it). The website forwards every `/api` request to the API,
so open the website address in your browser.

Backend only:

```bash
npm run backend
# or, without npm:
.venv/bin/python -m uvicorn backend.main:app --reload --port 8000        # macOS and Linux
.venv\Scripts\python -m uvicorn backend.main:app --reload --port 8000    # Windows
```

`--reload` restarts the server automatically when you save a file in `backend/`.

Check that it is alive: open http://127.0.0.1:8000/api/health. You should see
`{"status":"ok", ...}`. Interactive API documentation is at http://127.0.0.1:8000/docs.

### Port 8000 already in use?

If you see `Address already in use`, another program (often an older copy of this server) is using
port 8000. Either stop that program, or run on another port; the website proxy follows the same
variable:

```bash
NETSHIELD_API_PORT=8765 npm run dev:all              # macOS and Linux
set NETSHIELD_API_PORT=8765 && npm run dev:all       # Windows cmd
```

## 3. Run the tests and checks

```bash
npm run test:backend                      # pytest only
.venv/bin/python -m pytest -q             # same, without npm
.venv/bin/python -m ruff check backend    # style and common mistakes
.venv/bin/python -m mypy                  # type checking (strict)
```

On Windows replace `.venv/bin/python` with `.venv\Scripts\python`.

The full project check (backend and frontend) is `scripts/verify.sh` on macOS and Linux, or
`npm run verify` anywhere.

## 4. Configuration

| Variable | Default | Purpose |
| :-- | :-- | :-- |
| `NETSHIELD_CORS_ORIGINS` | local dev origins (`http://localhost:5173`, `http://127.0.0.1:5173`, and the 4173 preview port) | Comma separated list of websites allowed to call the API from a browser. Set it to your production site, for example `https://netshield.example`. Not needed in development because of the proxy. |
| `NETSHIELD_SIMULATION_BUDGET_MS` | `10000` | Server side time budget for one simulation or sweep; exceeding it returns HTTP 504 with code `TIMEOUT`. |
| `NETSHIELD_API_PORT` | `8000` | Port used by `npm run backend` and `npm run dev:all` (and by the Vite proxy). |

## 5. Files

| Path | Purpose |
| :-- | :-- |
| `main.py` | Entry point (`backend.main:app`), re-exports the app from `app/main.py`. |
| `app/main.py` | Builds the FastAPI app: CORS, error handlers, routers. |
| `app/models.py` | Request and response models (Pydantic v2) and graph validation (limits, duplicates, unknown nodes, self loops, parallel edges). |
| `app/graph_ops.py` | Pure analysis functions on the operational graph (NetworkX). No web code, no side effects. |
| `app/errors.py`, `app/error_handlers.py` | The shared error body `{error: {code, message, details}}` and how every failure is rendered. |
| `app/simulation.py` | Monte Carlo engine: seeded `random.Random`, union find per trial, common random numbers for sweeps, Wilson interval, time budget. No web code. |
| `app/settings.py` | `NETSHIELD_SIMULATION_BUDGET_MS` (default 10000) and the trial and sweep point limits. |
| `app/routers/` | Thin HTTP layers: `health.py`, `analyze.py`, `simulate.py` (`/api/simulate`, `/api/reliability-sweep`, run in a worker thread). |
| `tests/` | pytest suite: `test_graph_ops.py` (hand verified cases and hypothesis property tests), `test_analyze.py` (HTTP, validation, limits, performance), `test_simulation.py` (closed forms, exact enumeration, Wilson coverage, common random numbers, union find against NetworkX, limits, time budget, performance), `test_health.py`, and `exact.py` (exact reliability by enumeration, tests only). |
| `export_openapi.py` | Prints the API schema; used by `npm run gen:api` to generate frontend types. |
| `requirements.txt`, `requirements-dev.txt` | Packages needed to run, and to test and check. |

Tool settings for ruff, mypy and pytest are in `pyproject.toml` at the repository root.

## 6. Property based tests

`tests/test_graph_ops.py` uses hypothesis to generate random simple graphs (with random failures) and
compares bridges, articulation points, components, degrees, BFS layers and path lengths with a brute
force check that does not use NetworkX. By default the run is derandomized (300 examples per test) so
results are reproducible. For a longer random search:

```bash
HYPOTHESIS_PROFILE=explore .venv/bin/python -m pytest -q backend/tests/test_graph_ops.py
```
