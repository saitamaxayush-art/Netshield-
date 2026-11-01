// Starts the FastAPI backend (auto reload by default), using the .venv Python (cross platform).
import { spawn } from 'node:child_process'
import { ROOT, venvPython } from './python.mjs'

const port = process.env.NETSHIELD_API_PORT ?? '8000'
// NETSHIELD_API_RELOAD=0 disables auto reload (used by the end to end tests).
const reload = process.env.NETSHIELD_API_RELOAD === '0' ? [] : ['--reload', '--reload-dir', 'backend']
const child = spawn(
  venvPython(),
  ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', port, ...reload],
  { cwd: ROOT, stdio: 'inherit' }
)
child.on('exit', (code) => process.exit(code ?? 0))
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig))
