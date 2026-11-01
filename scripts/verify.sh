#!/usr/bin/env bash
# Master check used by every phase gate. Same steps as scripts/verify.mjs
# (use `npm run verify` on Windows). Runs every step, then prints a summary.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY="$ROOT/.venv/bin/python"
[ -x "$PY" ] || PY="$ROOT/.venv/Scripts/python.exe"
if [ ! -x "$PY" ]; then echo "No virtual environment at .venv (see backend/README.md)."; exit 1; fi

names=()
codes=()
run() {
  local name="$1"; shift
  echo; echo "=== $name ==="
  "$@"
  local code=$?
  names+=("$name"); codes+=("$code")
}

cd "$ROOT"
run "backend: ruff" "$PY" -m ruff check backend
run "backend: mypy" "$PY" -m mypy
run "backend: pytest" "$PY" -m pytest -q
cd "$ROOT/frontend"
run "frontend: typecheck" npm run typecheck
run "frontend: lint" npm run lint
run "frontend: unit tests" npm test
run "frontend: api types in sync" npm run check:api-types
run "frontend: build" npm run build

echo; echo "=== verify summary ==="
failed=0
for i in "${!names[@]}"; do
  if [ "${codes[$i]}" -eq 0 ]; then echo "PASS  ${names[$i]}"; else echo "FAIL  ${names[$i]}"; failed=$((failed + 1)); fi
done
if [ "$failed" -gt 0 ]; then echo; echo "$failed step(s) failed."; exit 1; fi
echo; echo "All steps passed."
