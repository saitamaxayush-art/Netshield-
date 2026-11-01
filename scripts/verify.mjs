// Master check (cross platform, same steps as scripts/verify.sh).
// Runs every step, prints a summary, exits 1 if any step failed.
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { ROOT, venvPython } from './python.mjs'

const py = venvPython()
const frontend = path.join(ROOT, 'frontend')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const steps = [
  ['backend: ruff', py, ['-m', 'ruff', 'check', 'backend'], ROOT],
  ['backend: mypy', py, ['-m', 'mypy'], ROOT],
  ['backend: pytest', py, ['-m', 'pytest', '-q'], ROOT],
  ['frontend: typecheck', npm, ['run', 'typecheck'], frontend],
  ['frontend: lint', npm, ['run', 'lint'], frontend],
  ['frontend: unit tests', npm, ['test'], frontend],
  ['frontend: api types in sync', npm, ['run', 'check:api-types'], frontend],
  ['frontend: build', npm, ['run', 'build'], frontend],
]

const results = []
for (const [name, cmd, args, cwd] of steps) {
  console.log(`\n=== ${name} ===`)
  const t0 = Date.now()
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  results.push({ name, ok: r.status === 0, s: ((Date.now() - t0) / 1000).toFixed(1) })
}

console.log('\n=== verify summary ===')
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name} (${r.s}s)`)
const failed = results.filter((r) => !r.ok).length
console.log(failed ? `\n${failed} step(s) failed.` : '\nAll steps passed.')
process.exit(failed ? 1 : 0)
