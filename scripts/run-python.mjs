// Runs the .venv Python with the given arguments (cross platform), from the repo root.
import { spawnSync } from 'node:child_process'
import { ROOT, venvPython } from './python.mjs'

const r = spawnSync(venvPython(), process.argv.slice(2), { cwd: ROOT, stdio: 'inherit' })
process.exit(r.status ?? 1)
