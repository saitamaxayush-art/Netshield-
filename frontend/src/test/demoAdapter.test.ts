/**
 * The demo adapter: an independent implementation, labelled on every response, checked against real
 * backend responses for the same requests.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '../services/api/client'
import { DemoApi, DEMO_META } from '../services/api/demoAdapter'
import {
  AnalyzeResponseSchema,
  ErrorResponseSchema,
  HealthResponseSchema,
  SimulateResponseSchema,
  SweepResponseSchema,
} from '../services/api/schemas'
import { ANALYZE_CASES, ERROR_CASES, SIMULATE_CASES, SWEEP_CASES } from './fixtures/apiCases'
import { backendFixture } from './fixtures'

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (e) {
    if (e instanceof ApiError) return e
    throw new Error(`expected an ApiError, got ${String(e)}`, { cause: e })
  }
  throw new Error('expected the call to fail')
}

const withoutElapsed = <T extends { elapsedMs: number }>({ elapsedMs: _e, ...rest }: T) => rest

describe('demo adapter labelling', () => {
  const demo = new DemoApi()

  it('stamps every response isDemo: true and meta.engine "demo"', async () => {
    const health = await demo.health()
    const analysis = await demo.analyze(ANALYZE_CASES['analyze-star'])
    const sim = await demo.simulate(SIMULATE_CASES['simulate-all-terminal'])
    const sweep = await demo.reliabilitySweep(SWEEP_CASES.sweep)
    expect([demo.isDemo, health.isDemo, analysis.isDemo, sim.isDemo, sweep.isDemo]).toEqual([true, true, true, true, true])
    expect(health.engine).toBe('demo')
    for (const meta of [analysis.meta, sim.meta, sweep.meta]) expect(meta).toEqual(DEMO_META)
    expect(sim.assumptions[0]).toContain('demo adapter')
    expect(sweep.assumptions[0]).toContain('demo adapter')
  })

  it('every response passes the same schemas as the backend', async () => {
    const { isDemo: _a, ...health } = await demo.health()
    const { isDemo: _b, ...analysis } = await demo.analyze(ANALYZE_CASES['analyze-ring-failures'])
    const { isDemo: _c, ...sim } = await demo.simulate(SIMULATE_CASES['simulate-two-terminal'])
    const { isDemo: _d, ...sweep } = await demo.reliabilitySweep(SWEEP_CASES.sweep)
    expect(HealthResponseSchema.safeParse(health).success).toBe(true)
    expect(AnalyzeResponseSchema.safeParse(analysis).success).toBe(true)
    expect(SimulateResponseSchema.safeParse(sim).success).toBe(true)
    expect(SweepResponseSchema.safeParse(sweep).success).toBe(true)
  })
})

describe('demo analysis agrees exactly with the backend', () => {
  const demo = new DemoApi()
  for (const [name, request] of Object.entries(ANALYZE_CASES)) {
    it(name, async () => {
      const backend = AnalyzeResponseSchema.parse(backendFixture(name).response)
      const result = await demo.analyze(request)
      expect(result.current).toEqual(backend.current)
      expect(result.healthy).toEqual(backend.healthy)
    })
  }
})

describe('demo validation uses the backend error codes', () => {
  const demo = new DemoApi()
  for (const [name, { path, request }] of Object.entries(ERROR_CASES)) {
    it(name, async () => {
      const backend = ErrorResponseSchema.parse(backendFixture(name).response)
      const err = await failure(path === '/api/analyze' ? demo.analyze(request) : demo.simulate(request))
      expect([err.kind, err.status, err.code]).toEqual(['validation', 422, backend.error.code])
    })
  }

  it('self loops, unknown nodes and duplicate ids', async () => {
    const n = (id: string) => ({ id, label: id, type: 'router' as const })
    const e = (id: string, source: string, target: string) => ({ id, source, target })
    const code = async (body: Parameters<DemoApi['analyze']>[0]) => (await failure(demo.analyze(body))).code
    expect(await code({ nodes: [n('A')], edges: [e('x', 'A', 'A')] })).toBe('SELF_LOOP')
    expect(await code({ nodes: [n('A')], edges: [e('x', 'A', 'B')] })).toBe('UNKNOWN_NODE')
    expect(await code({ nodes: [n('A'), n('A')], edges: [] })).toBe('DUPLICATE_NODE_ID')
    expect(await code({ nodes: [n('A'), n('B'), n('C')], edges: [e('x', 'A', 'B'), e('x', 'B', 'C')] })).toBe('DUPLICATE_EDGE_ID')
    expect(await code({ nodes: [n('A')], edges: [], startNodeId: 'Q' })).toBe('UNKNOWN_NODE')
  })
})

describe('demo simulation', () => {
  it('is deterministic for a seed (apart from elapsedMs)', async () => {
    const a = await new DemoApi().simulate(SIMULATE_CASES['simulate-all-terminal'])
    const b = await new DemoApi().simulate(SIMULATE_CASES['simulate-all-terminal'])
    expect(withoutElapsed(a)).toEqual(withoutElapsed(b))
  })

  it('is deterministic without a seed too (seed derived from the request) and reports the seed', async () => {
    const { seed: _s, ...request } = SIMULATE_CASES['simulate-all-terminal']
    const a = await new DemoApi().simulate(request)
    const b = await new DemoApi().simulate(request)
    expect(a.seed).toBe(b.seed)
    expect(a.estimate).toBe(b.estimate)
  })

  it('agrees statistically with the backend on the same request', async () => {
    for (const name of Object.keys(SIMULATE_CASES)) {
      const backend = SimulateResponseSchema.parse(backendFixture(name).response)
      const demo = await new DemoApi().simulate(SIMULATE_CASES[name])
      const se = Math.hypot(backend.standardError, demo.standardError)
      // Independent generators: the difference of two unbiased estimates is within 4 SE (p > 0.9999).
      expect(Math.abs(demo.estimate - backend.estimate)).toBeLessThan(4 * se + 1e-9)
      expect([demo.trials, demo.mode, demo.source, demo.target]).toEqual([backend.trials, backend.mode, backend.source, backend.target])
    }
  })

  it('sweep points never rise with p and each equals simulate at that p and seed', async () => {
    const sweep = await new DemoApi().reliabilitySweep(SWEEP_CASES.sweep)
    expect(sweep.points.map((pt) => pt.p)).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5])
    for (let i = 1; i < sweep.points.length; i++) expect(sweep.points[i].estimate).toBeLessThanOrEqual(sweep.points[i - 1].estimate)
    const { pMin: _a, pMax: _b, points: _c, trialsPerPoint, ...graph } = SWEEP_CASES.sweep
    const at = await new DemoApi().simulate({ ...graph, edgeFailureProbability: 0.3, trials: trialsPerPoint })
    expect(at.connectedTrials).toBe(sweep.points[3].connectedTrials)
  })

  it('demo and backend sweeps both match the exact R(p) = (1 - p)^4 of a 5 node path', async () => {
    const demo = await new DemoApi().reliabilitySweep(SWEEP_CASES.sweep)
    const backend = SweepResponseSchema.parse(backendFixture('sweep').response)
    for (const sweep of [demo, backend]) {
      for (const pt of sweep.points) {
        const exact = (1 - pt.p) ** 4
        const se = Math.sqrt((exact * (1 - exact)) / sweep.trialsPerPoint)
        expect(Math.abs(pt.estimate - exact)).toBeLessThanOrEqual(4 * se + 1e-12)
      }
      expect(sweep.points[0].estimate).toBe(1)
    }
  })

  it('can be cancelled and superseded like the HTTP client', async () => {
    const demo = new DemoApi()
    const big = { ...SIMULATE_CASES['simulate-all-terminal'], trials: 20000 }
    const controller = new AbortController()
    const cancelled = failure(demo.simulate(big, { signal: controller.signal }))
    controller.abort()
    expect((await cancelled).code).toBe('CANCELLED')

    const stale = failure(demo.simulate(big))
    const fresh = demo.simulate(SIMULATE_CASES['simulate-all-terminal'])
    expect((await stale).code).toBe('SUPERSEDED')
    expect((await fresh).isDemo).toBe(true)
  })
})
