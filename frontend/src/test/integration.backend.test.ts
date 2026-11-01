// @vitest-environment node
/**
 * One real call per client method against a running backend. Skipped unless NETSHIELD_API_URL is set:
 *
 *   NETSHIELD_API_URL=http://127.0.0.1:8765 npm run test:integration
 */
import { describe, expect, it } from 'vitest'
import { ApiError, HttpApiClient } from '../services/api/client'
import { ANALYZE_CASES, ERROR_CASES, SIMULATE_CASES, SWEEP_CASES } from './fixtures/apiCases'

// Vitest exposes the process environment on import.meta.env; the app's env type does not list it.
const configured: unknown = Reflect.get(import.meta.env, 'NETSHIELD_API_URL')
const baseUrl = typeof configured === 'string' ? configured : ''
const log = (method: string, text: string) => console.log(`[${method}] ${text}`)

describe.runIf(baseUrl !== '')(`HttpApiClient against the backend at ${baseUrl}`, () => {
  const api = new HttpApiClient({ baseUrl })

  it('health', async () => {
    const r = await api.health()
    log('health', `status=${r.status} service="${r.service}" engine=${r.engine} version=${r.version} isDemo=${r.isDemo}`)
    expect([r.status, r.isDemo]).toEqual(['ok', false])
  })

  it('analyze', async () => {
    const r = await api.analyze(ANALYZE_CASES['analyze-star'])
    const c = r.current
    log(
      'analyze',
      `engine=${r.meta.engine} ${r.meta.engineVersion} api=${r.meta.apiVersion} isDemo=${r.isDemo} connected=${c.connectivity.connected} ` +
        `components=${c.connectivity.componentCount} density=${c.summary.density} bridges=[${c.bridges.edgeIds.join(',')}] ` +
        `articulation=[${c.articulationPoints.nodeIds.join(',')}] bfs=[${c.traversal?.bfs.map((s) => `${s.nodeId}:${s.layer}`).join(',')}] ` +
        `path=[${c.path?.nodeIds?.join(',')}] healthy=${r.healthy?.connectivity.reason}`
    )
    expect(c.bridges.edgeIds).toEqual(['e1', 'e2', 'e3', 'e4'])
    expect(c.articulationPoints.nodeIds).toEqual(['hub'])
    expect(c.path?.nodeIds).toEqual(['L1', 'hub', 'L4'])
  })

  it('simulate', async () => {
    const r = await api.simulate(SIMULATE_CASES['simulate-all-terminal'])
    log(
      'simulate',
      `mode=${r.mode} trials=${r.trials} connected=${r.connectedTrials} estimate=${r.estimate} se=${r.standardError.toFixed(6)} ` +
        `wilson95=[${r.wilson95.low.toFixed(6)}, ${r.wilson95.high.toFixed(6)}] seed=${r.seed} criticalEdge=${r.criticalEdge?.edgeId} ` +
        `elapsedMs=${r.elapsedMs} isDemo=${r.isDemo}`
    )
    expect(r.trials).toBe(2000)
    expect(r.criticalEdge?.edgeId).toBe('cd')
    expect(r.wilson95.low).toBeLessThanOrEqual(r.estimate)
    expect(r.wilson95.high).toBeGreaterThanOrEqual(r.estimate)
  })

  it('reliabilitySweep', async () => {
    const r = await api.reliabilitySweep(SWEEP_CASES.sweep)
    log('reliabilitySweep', `points=${r.points.length} trialsPerPoint=${r.trialsPerPoint} isDemo=${r.isDemo}`)
    for (const p of r.points) log('reliabilitySweep', `  p=${p.p} estimate=${p.estimate} connected=${p.connectedTrials} se=${p.standardError.toFixed(6)}`)
    expect(r.points.map((p) => p.p)).toEqual([0, 0.1, 0.2, 0.3, 0.4, 0.5])
    for (let i = 1; i < r.points.length; i++) expect(r.points[i].estimate).toBeLessThanOrEqual(r.points[i - 1].estimate)
  })

  it('a rejected request becomes a validation ApiError with the server code', async () => {
    const { request } = ERROR_CASES['error-parallel-edge']
    try {
      await api.analyze(request)
      throw new Error('expected a rejection')
    } catch (e) {
      if (!(e instanceof ApiError)) throw e
      log('analyze (error)', `kind=${e.kind} status=${e.status} code=${e.code} message="${e.message}"`)
      expect([e.kind, e.status, e.code]).toEqual(['validation', 422, 'PARALLEL_EDGE'])
    }
  })

  it('a cancelled call is a cancelled ApiError', async () => {
    const controller = new AbortController()
    const pending = api.simulate({ ...SIMULATE_CASES['simulate-all-terminal'], trials: 20000 }, { signal: controller.signal })
    controller.abort()
    try {
      await pending
      throw new Error('expected cancellation')
    } catch (e) {
      if (!(e instanceof ApiError)) throw e
      log('simulate (cancel)', `kind=${e.kind} code=${e.code}`)
      expect(e.code).toBe('CANCELLED')
    }
  })
})
