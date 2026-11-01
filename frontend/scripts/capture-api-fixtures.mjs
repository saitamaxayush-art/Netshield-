#!/usr/bin/env node
/**
 * Capture real responses from a running NetShield backend into src/test/fixtures/backend/.
 * The schema tests parse these exact bodies, and the demo adapter tests compare against them.
 *
 *   NETSHIELD_API_URL=http://127.0.0.1:8765 node scripts/capture-api-fixtures.mjs
 *
 * Each file holds { method, path, request, status, response }. elapsedMs is kept as captured (it is
 * the one nondeterministic field); tests never compare it.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const base = (process.env.NETSHIELD_API_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'test', 'fixtures', 'backend')
mkdirSync(out, { recursive: true })

// The requests are defined once, typed, in src/test/fixtures/apiCases.ts (Node strips the types).
const { ANALYZE_CASES, SIMULATE_CASES, SWEEP_CASES, ERROR_CASES } = await import('../src/test/fixtures/apiCases.ts')

const cases = [
  ['health', 'GET', '/api/health', undefined],
  ...Object.entries(ANALYZE_CASES).map(([name, body]) => [name, 'POST', '/api/analyze', body]),
  ...Object.entries(SIMULATE_CASES).map(([name, body]) => [name, 'POST', '/api/simulate', body]),
  ...Object.entries(SWEEP_CASES).map(([name, body]) => [name, 'POST', '/api/reliability-sweep', body]),
  ...Object.entries(ERROR_CASES).map(([name, { path, request }]) => [name, 'POST', path, request]),
]

for (const [name, method, path, request] of cases) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: request ? { 'Content-Type': 'application/json' } : undefined,
    body: request ? JSON.stringify(request) : undefined,
  })
  const body = await response.json()
  writeFileSync(join(out, `${name}.json`), JSON.stringify({ method, path, request: request ?? null, status: response.status, response: body }, null, 2) + '\n')
  console.log(`${String(response.status).padEnd(4)} ${method.padEnd(4)} ${path.padEnd(24)} -> ${name}.json`)
}
