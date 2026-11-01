import { describe, it, expect } from 'vitest'
import { ApiError, NetworkApiClient, apiModeFromEnv } from '../services/api/client'
import type { AnalyzeRequestBody } from '../services/api/contract'
import { analyzeResponse } from './fixtures'

const request: AnalyzeRequestBody = { nodes: [{ id: 'A', label: 'A', type: 'router' }], edges: [] }

const okAnalysis = analyzeResponse()

function client(respond: () => Promise<Response>) {
  const calls: string[] = []
  const fetchImpl: typeof fetch = (input) => {
    calls.push(String(input))
    return respond()
  }
  return { api: new NetworkApiClient({ baseUrl: '', mode: 'backend', fetchImpl }), calls }
}

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (e) {
    if (e instanceof ApiError) return e
    throw new Error(`expected an ApiError, got ${String(e)}`, { cause: e })
  }
  throw new Error('expected the call to fail, but it returned a result')
}

describe('NetworkApiClient: no silent fallback', () => {
  it('returns a validated backend result labelled as backend', async () => {
    const { api, calls } = client(() => json(okAnalysis))
    const result = await api.analyze(request)
    expect(result.source).toBe('backend')
    expect(result.data).toEqual(okAnalysis)
    expect(calls).toEqual(['/api/analyze'])
  })

  it('throws a network error when the backend is unreachable', async () => {
    const { api } = client(() => Promise.reject(new TypeError('fetch failed')))
    const err = await failure(api.analyze(request))
    expect(err.kind).toBe('network')
    expect(err.message).toContain('Could not reach the NetShield backend')
  })

  it('surfaces the backend error message and code', async () => {
    const { api } = client(() => json({ error: { code: 'PARALLEL_EDGE', message: 'Edges e1 and e2 both connect A and B.' } }, 422))
    const err = await failure(api.analyze(request))
    expect([err.kind, err.status, err.code]).toEqual(['http', 422, 'PARALLEL_EDGE'])
    expect(err.message).toBe('Edges e1 and e2 both connect A and B. (PARALLEL_EDGE)')
  })

  it('reports an HTTP failure without an error body', async () => {
    const { api } = client(() => Promise.resolve(new Response('upstream down', { status: 502 })))
    const err = await failure(api.analyze(request))
    expect([err.kind, err.status]).toEqual(['http', 502])
  })

  it('rejects a 200 response that is not JSON', async () => {
    const { api } = client(() => Promise.resolve(new Response('<html>', { status: 200 })))
    expect((await failure(api.analyze(request))).kind).toBe('contract')
  })

  it('rejects a 200 response with the wrong shape (for example the pre-Phase-1 shape)', async () => {
    const { api } = client(() => json({ is_connected: true, num_components: 1, bridges: [] }))
    const err = await failure(api.analyze(request))
    expect(err.kind).toBe('contract')
    expect(err.message).toContain('did not match the expected format')
  })

  it('applies the same rules to simulate and sweep', async () => {
    const { api } = client(() => json({ unexpected: true }))
    const sim = { nodes: [], edges: [] }
    expect((await failure(api.simulate(sim))).kind).toBe('contract')
    expect((await failure(api.reliabilitySweep({ ...sim, probs: [0.1] }))).kind).toBe('contract')
  })
})

describe('demo mode is explicit', () => {
  it('is only enabled by the exact string "true"', () => {
    expect(apiModeFromEnv(undefined)).toBe('backend')
    expect(apiModeFromEnv('false')).toBe('backend')
    expect(apiModeFromEnv('1')).toBe('backend')
    expect(apiModeFromEnv('true')).toBe('demo')
  })

  it('never calls the network, labels results as demo, and offers no analysis', async () => {
    const calls: string[] = []
    const api = new NetworkApiClient({
      baseUrl: '',
      mode: 'demo',
      fetchImpl: (input) => {
        calls.push(String(input))
        return json({})
      },
    })
    const sim = await api.simulate({ nodes: [{ id: 'a', label: 'a' }], edges: [], trials: 10 })
    expect(sim.source).toBe('demo')
    expect((await failure(api.analyze(request))).kind).toBe('unavailable_in_demo')
    expect(calls).toEqual([])
  })
})
