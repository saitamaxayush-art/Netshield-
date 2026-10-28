# NetShield

A Graph-Theoretic Network Reliability and Failure Simulation System built with React, TypeScript, Tailwind CSS, Python FastAPI, and NetworkX.

---

## Architecture Overview

```
Netshield-/
├── frontend/             # React 19 + TypeScript + Vite + Tailwind CSS + GSAP + Three.js
│   ├── src/              # Application source code
│   │   ├── components/   # UI primitives, editorial layout, and motion components
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
├── ALIGNMENT_AUDIT.md    # Multi-viewport alignment & defect audit
├── DESIGN.md             # Design tokens, color system, and typography spec
└── README.md             # Project documentation
```

---

## Getting Started

### 1. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend development server will launch at `http://127.0.0.1:5173/`.

To run frontend tests and linting:

```bash
cd frontend
npm run lint    # Oxlint static analysis
npm test        # Vitest unit test suite (20 tests)
npm run build   # Production TypeScript & Vite bundle build
```

### 2. Backend Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

The FastAPI REST API will be available at `http://127.0.0.1:8000/`.

To run backend tests:

```bash
pytest backend/test_main.py
```

---

## Features

- **Interactive Topology Studio**: Custom canvas for constructing router, server, and gateway topologies.
- **Topological Degradation Simulation**: Stochastic failure simulation of nodes and links with real-time bridge and articulation point detection using Tarjan's algorithm.
- **Monte Carlo Reliability Estimation**: Repeated stochastic simulation to compute k-connectivity confidence intervals and all-terminal network reliability.
- **Editorial Landing Experience**: Charcoal Grey (`#17181B`), Moonlit Silver (`#F3F5F7`), and Signal Red (`#E5484D`) design system with 3D ribbon network visualization and smooth scroll choreography.
