"""Runtime settings read from the environment."""

import os

# Server side time budget for one /api/simulate or /api/reliability-sweep call, in milliseconds.
SIMULATION_TIME_BUDGET_MS = float(os.environ.get("NETSHIELD_SIMULATION_BUDGET_MS", "10000"))
MAX_TRIALS = 20000
MAX_SWEEP_POINTS = 25
# Largest accepted request body. A graph at the node and edge limits is about 0.3 MB.
MAX_REQUEST_BYTES = int(os.environ.get("NETSHIELD_MAX_REQUEST_BYTES", str(1024 * 1024)))
