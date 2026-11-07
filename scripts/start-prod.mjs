// Production server: uvicorn without reload, serving the API and the built frontend (frontend/dist)
// from one origin. Build first: npm --prefix frontend run build.
//   NETSHIELD_API_HOST (default 127.0.0.1), NETSHIELD_API_PORT (default 8000),
//   NETSHIELD_STATIC_DIR (default frontend/dist), NETSHIELD_WORKERS (default 1), plus the backend variables.
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { ROOT, venvPython } from './python.mjs'

const staticDir = process.env.NETSHIELD_STATIC_DIR ?? join(ROOT, 'frontend', 'dist')
if (!existsSync(join(staticDir, 'index.html'))) {
  console.error(`No built frontend at ${staticDir}. Run: npm --prefix frontend run build`)
  process.exit(1)
}
const args = [
  '-m', 'uvicorn', 'backend.main:app',
  '--host', process.env.NETSHIELD_API_HOST ?? '127.0.0.1',
  '--port', process.env.NETSHIELD_API_PORT ?? '8000',
  '--workers', process.env.NETSHIELD_WORKERS ?? '1',
  '--proxy-headers',
]
const child = spawn(venvPython(), args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, NETSHIELD_STATIC_DIR: staticDir } })
child.on('exit', (code) => process.exit(code ?? 0))
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig))
