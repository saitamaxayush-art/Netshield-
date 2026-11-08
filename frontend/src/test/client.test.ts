import { describe, expect, it } from 'vitest'
import { ApiError, HttpApiClient } from '../services/api/client'
import { apiModeFromEnv, getApi, demoApi, httpApi } from '../services/api/registry'
import type { AnalyzeRequestBody } from '../services/api/schemas'
import { ANALYZE_CASES, SIMULATE_CASES, SWEEP_CASES } from './fixtures/apiCases'
import { backendFixture, deferred, fakeFetch, json } from './fixtures'

const request: AnalyzeRequestBody = ANALYZE_CASES['analyze-star']
const okAnalysis = backendFixture('analyze-star').response

function client(respond: Parameters<typeof fakeFetch>[0], options: Partial<ConstructorParameters<typeof HttpApiClient>[0]> = {}) {
  const fake = fakeFetch(respond)
  const sleeps: number[] = []
  const api = new HttpApiClient({
    baseUrl: 'http://api.test/',
    fetchImpl: fake.fetchImpl,
    sleep: async (ms) => {
      sleeps.push(ms)
    },
    ...options,
  })
  return { api, calls: fake.calls, sleeps }
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (e) {
    if (e instanceof ApiError) return e
    throw new Error(`expected an ApiError, got ${String(e)}`, { cause: e })
  }
  throw new Error('expected the call to fail, but it returned a result')
}

describe('HttpApiClient: success path', () => {
  it('validates the body and stamps isDemo: false', async () => {
    const { api, calls } = client(() => json(okAnalysis))
    const result = await api.analyze(request)
    expect(result.isDemo).toBe(false)
    expect(result.current.bridges.edgeIds).toEqual(['e1', 'e2', 'e3', 'e4'])
    expect(calls.map((c) => [c.url, c.init?.method])).toEqual([['http://api.test/api/analyze', 'POST']])
    expect(calls[0].body).toEqual(request)
  })

  it('serves each method from its endpoint', async () => {
    const bodies: Record<string, unknown> = {
      '/api/health': backendFixture('health').response,
      '/api/simulate': backendFixture('simulate-all-terminal').response,
      '/api/reliability-sweep': backendFixture('sweep').response,
    }
    const { api, calls } = client((call) => json(bodies[new URL(call.url).pathname]))
    expect((await api.health()).status).toBe('ok')
    expect((await api.simulate(SIMULATE_CASES['simulate-all-terminal'])).estimate).toBeGreaterThan(0)
    expect((await api.reliabilitySweep(SWEEP_CASES.sweep)).points).toHaveLength(6)
    expect(calls.map((c) => `${c.init?.method} ${new URL(c.url).pathname}`)).toEqual(['GET /api/health', 'POST /api/simulate', 'POST /api/reliability-sweep'])
  })
})

describe('HttpApiClient: every failure is one ApiError kind', () => {
  it('network: the request never got a response', async () => {
    const { api } = client(() => Promise.reject(new TypeError('fetch failed')))
    const err = await failure(api.analyze(request))
    expect([err.kind, err.code, err.status, err.isNetworkError]).toEqual(['network', 'NETWORK_ERROR', null, true])
    expect(err.message).toContain('Could not reach the NetShield backend')
  })

  it('timeout: no response within the client timeout', async () => {
    const { api } = client(() => new Promise<Response>(() => undefined), { timeoutsMs: { analyze: 20 } })
    const err = await failure(api.analyze(request))
    expect([err.kind, err.code, err.isTimeout]).toEqual(['timeout', 'CLIENT_TIMEOUT', true])
    expect(err.message).toBe('No response from /api/analyze within 20 ms.')
  })

  it('timeout per call overrides the default', async () => {
    const { api } = client(() => new Promise<Response>(() => undefined))
    const err = await failure(api.simulate(SIMULATE_CASES['simulate-all-terminal'], { timeoutMs: 15 }))
    expect(err.message).toBe('No response from /api/simulate within 15 ms.')
  })

  it('validation: HTTP 4xx keeps the server code, message and status', async () => {
    const captured = backendFixture('error-parallel-edge')
    const { api } = client(() => json(captured.response, captured.status))
    const err = await failure(api.analyze(request))
    expect([err.kind, err.status, err.code, err.isValidationError]).toEqual(['validation', 422, 'PARALLEL_EDGE', true])
    expect(err.message).toMatch(/\(PARALLEL_EDGE\)$/)
  })

  it('server: HTTP 5xx, including the backend time budget (504 TIMEOUT)', async () => {
    const { api } = client(() => json({ error: { code: 'TIMEOUT', message: 'Simulation exceeded the time budget.' } }, 504))
    const err = await failure(api.simulate(SIMULATE_CASES['simulate-all-terminal']))
    expect([err.kind, err.status, err.code, err.isServerError, err.isTimeout]).toEqual(['server', 504, 'TIMEOUT', true, false])
  })

  it('server: HTTP 500 without an error body', async () => {
    const { api } = client(() => new Response('boom', { status: 500 }))
    const err = await failure(api.analyze(request))
    expect([err.kind, err.status, err.code]).toEqual(['server', 500, 'HTTP_500'])
  })

  // BUG-027: with the backend stopped, the Vite proxy (or a reverse proxy) answers 502 with no body, so the
  // browser never sees a connection error. It must still count as unreachable: offline banner, demo mode offer.
  it.each([
    ['502, empty body (Vite proxy)', () => new Response('', { status: 502 })],
    ['502, HTML page (reverse proxy)', () => new Response('<html>Bad Gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } })],
    ['503, JSON that is not ours', () => json({ message: 'Service Unavailable' }, 503)],
    ['504, empty body', () => new Response(null, { status: 504 })],
  ])('network: %s means the backend cannot be reached', async (_name, respond) => {
    const { api } = client(respond)
    const err = await failure(api.analyze(request))
    expect([err.kind, err.code, err.isNetworkError, err.isServerError]).toEqual(['network', 'BACKEND_UNREACHABLE', true, false])
    expect(err.message).toMatch(/^Could not reach the NetShield backend \(\/api\/analyze\)/)
  })

  it('invalid_response: HTTP 200 that is not JSON', async () => {
    const { api } = client(() => new Response('<html>', { status: 200 }))
    const err = await failure(api.analyze(request))
    expect([err.kind, err.code, err.isInvalidResponse]).toEqual(['invalid_response', 'INVALID_RESPONSE', true])
  })

  it('invalid_response: HTTP 200 with the wrong shape names the field', async () => {
    const { api } = client(() => json({ is_connected: true }))
    const err = await failure(api.analyze(request))
    expect(err.kind).toBe('invalid_response')
    expect(err.message).toContain('did not match the expected format')
  })

  it('invalid_response: an estimate outside [0, 1] is rejected at the boundary', async () => {
    const good = backendFixture('simulate-all-terminal').response
    const { api } = client(() => json(typeof good === 'object' && good !== null ? { ...good, estimate: 1.2 } : good))
    const err = await failure(api.simulate(SIMULATE_CASES['simulate-all-terminal']))
    expect([err.kind, err.message.includes('estimate')]).toEqual(['invalid_response', true])
  })
})

describe('HttpApiClient: cancellation and supersession', () => {
  it('a caller can cancel an in flight request', async () => {
    const { api } = client(() => new Promise<Response>(() => undefined))
    const controller = new AbortController()
    const pending = failure(api.analyze(request, { signal: controller.signal }))
    controller.abort()
    const err = await pending
    expect([err.kind, err.code, err.isCancelled]).toEqual(['cancelled', 'CANCELLED', true])
  })

  it('an already aborted signal never sends', async () => {
    const { api } = client(() => json(okAnalysis))
    const controller = new AbortController()
    controller.abort()
    expect((await failure(api.analyze(request, { signal: controller.signal }))).code).toBe('CANCELLED')
  })

  it('a new request of the same kind supersedes the stale one', async () => {
    const first = deferred<Response>()
    let n = 0
    const { api, calls } = client(() => (++n === 1 ? first.promise : json(okAnalysis)))
    const stale = failure(api.analyze(request))
    const fresh = api.analyze(request)
    const err = await stale
    expect([err.kind, err.code]).toEqual(['cancelled', 'SUPERSEDED'])
    expect((await fresh).isDemo).toBe(false)
    expect(calls[0].init?.signal?.aborted).toBe(true)
    first.resolve(json(okAnalysis))
  })

  it('different methods do not supersede each other, and supersede: false opts out', async () => {
    const gate = deferred<void>()
    const { api, calls } = client((call) =>
      call.url.endsWith('/api/analyze') ? gate.promise.then(() => json(okAnalysis)) : json(backendFixture('simulate-all-terminal').response)
    )
    const a = api.analyze(request, { supersede: false })
    const b = api.analyze(request, { supersede: false })
    expect((await api.simulate(SIMULATE_CASES['simulate-all-terminal'])).trials).toBe(2000)
    gate.resolve()
    const [ra, rb] = await Promise.all([a, b])
    expect([ra.isDemo, rb.isDemo]).toEqual([false, false])
    expect(calls.map((c) => c.init?.signal?.aborted)).toEqual([false, false, false])
  })
})

describe('HttpApiClient: retries only for health', () => {
  it('health retries network failures with growing delays, then succeeds', async () => {
    let n = 0
    const { api, calls, sleeps } = client(() => (++n < 3 ? Promise.reject(new TypeError('down')) : json(backendFixture('health').response)))
    expect((await api.health()).status).toBe('ok')
    expect(calls).toHaveLength(3)
    expect(sleeps).toEqual([250, 500])
  })

  it('health gives up after the configured attempts with the last error', async () => {
    const { api, calls } = client(() => new Response('x', { status: 503 }), { healthRetry: { attempts: 2, delayMs: 1 } })
    const err = await failure(api.health())
    expect([err.kind, err.status]).toEqual(['network', 503])
    expect(calls).toHaveLength(2)
  })

  it('health does not retry a response that is malformed', async () => {
    const { api, calls } = client(() => json({ status: 'maybe' }))
    expect((await failure(api.health())).kind).toBe('invalid_response')
    expect(calls).toHaveLength(1)
  })

  it('POST endpoints never retry', async () => {
    const { api, calls } = client(() => Promise.reject(new TypeError('down')))
    await failure(api.analyze(request))
    await failure(api.simulate(SIMULATE_CASES['simulate-all-terminal']))
    await failure(api.reliabilitySweep(SWEEP_CASES.sweep))
    expect(calls).toHaveLength(3)
  })
})

describe('adapter selection', () => {
  it('only the exact string "true" selects demo mode', () => {
    expect(apiModeFromEnv('true')).toBe('demo')
    for (const value of [undefined, '', 'false', 'TRUE', '1', 'yes']) expect(apiModeFromEnv(value)).toBe('backend')
  })

  it('getApi returns the matching implementation', () => {
    expect(getApi('backend')).toBe(httpApi)
    expect(getApi('demo')).toBe(demoApi)
    expect([httpApi.isDemo, demoApi.isDemo]).toEqual([false, true])
  })
})
