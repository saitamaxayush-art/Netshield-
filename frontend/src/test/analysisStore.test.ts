import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAnalysisStore } from '../store/analysisStore'
import { useGraphStore } from '../store/graphStore'
import { useSettingsStore } from '../store/settingsStore'
import { buildAnalyzeRequest, buildSimulateRequest, buildSweepRequest, inputKey } from '../store/requests'
import { createAutoAnalyzer } from '../hooks/autoAnalyzer'
import { useAutoAnalyze } from '../hooks/useAutoAnalyze'
import { preset } from '../store/presets'
import { backendFixture, deferred, fakeFetch, json, resetStores, settle, type FetchCall } from './fixtures'

const analysis = () => useAnalysisStore.getState()
const graph = () => useGraphStore.getState()
const okBody = backendFixture('analyze-star').response

/** Route global fetch (used by the app's HttpApiClient) to a test responder. */
function serve(respond: (call: FetchCall) => Response | Promise<Response>) {
  const fake = fakeFetch(respond)
  vi.stubGlobal('fetch', fake.fetchImpl)
  return fake.calls
}

beforeEach(resetStores)
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('analysisStore: status and results', () => {
  it('idle, loading, success with the stamped result', async () => {
    serve(() => json(okBody))
    expect(analysis().analyze.status).toBe('idle')
    const run = analysis().run('analyze')
    expect(analysis().analyze.status).toBe('loading')
    await run
    expect(analysis().analyze).toMatchObject({ status: 'success', error: null, stale: false })
    expect(analysis().analyze.result?.isDemo).toBe(false)
  })

  it('error clears the previous result and records the ApiError', async () => {
    let fail = false
    serve(() => (fail ? json({ error: { code: 'INTERNAL_ERROR', message: 'boom' } }, 500) : json(okBody)))
    await analysis().run('analyze')
    fail = true
    await analysis().run('analyze')
    expect(analysis().analyze.status).toBe('error')
    expect(analysis().analyze.result).toBeNull()
    expect([analysis().analyze.error?.kind, analysis().analyze.error?.code]).toEqual(['server', 'INTERNAL_ERROR'])
  })

  it('a failure never switches to demo mode by itself', async () => {
    serve(() => Promise.reject(new TypeError('offline')))
    await analysis().run('analyze')
    await analysis().run('simulate')
    expect(useSettingsStore.getState().adapterMode).toBe('backend')
    expect(analysis().analyze.error?.kind).toBe('network')
    expect(analysis().simulate.result).toBeNull()
  })

  it('a stale response is ignored: only the latest request id is applied', async () => {
    const first = deferred<Response>()
    let n = 0
    const calls = serve(() => (++n === 1 ? first.promise : json(okBody)))
    const a = analysis().run('analyze')
    const b = analysis().run('analyze')
    await b
    const latest = analysis().analyze
    first.resolve(json(backendFixture("analyze-two-triangles").response))
    await a
    expect(analysis().analyze).toBe(latest)
    expect(calls[0].init?.signal?.aborted).toBe(true)
  })

  it('a stale response that arrives anyway (fetch ignored the abort) is still ignored', async () => {
    const late = deferred<Response>()
    let n = 0
    // Unlike fakeFetch, this fetch does not reject on abort, so the stale response does arrive.
    vi.stubGlobal('fetch', () => (++n === 1 ? late.promise : Promise.resolve(json(okBody))))
    const a = analysis().run('analyze')
    const b = analysis().run('analyze')
    expect(analysis().analyze.status).toBe('loading')
    await b
    late.resolve(json(backendFixture('analyze-two-triangles').response))
    await a
    expect(analysis().analyze.result?.current.bridges.edgeIds).toEqual(['e1', 'e2', 'e3', 'e4'])
  })

  it('cancel keeps the earlier result and returns to success', async () => {
    let hang = false
    serve(() => (hang ? new Promise<Response>(() => undefined) : json(okBody)))
    await analysis().run('analyze')
    const result = analysis().analyze.result
    hang = true
    const pending = analysis().run('analyze')
    analysis().cancel('analyze')
    await pending
    expect(analysis().analyze.status).toBe('success')
    expect(analysis().analyze.result).toBe(result)
  })

  it('cancel with no earlier result returns to idle', async () => {
    serve(() => new Promise<Response>(() => undefined))
    const pending = analysis().run('simulate')
    analysis().cancel('simulate')
    await pending
    expect(analysis().simulate).toMatchObject({ status: 'idle', result: null, error: null })
  })

  it('demo mode results are stamped and switching modes clears all results', async () => {
    useSettingsStore.getState().switchToDemoMode()
    await analysis().run('analyze')
    await analysis().run('simulate')
    expect(analysis().analyze.result?.isDemo).toBe(true)
    expect(analysis().analyze.result?.meta.engine).toBe('demo')
    expect(analysis().simulate.result?.isDemo).toBe(true)
    useSettingsStore.getState().exitDemoMode()
    expect([analysis().analyze.result, analysis().simulate.result]).toEqual([null, null])
  })
})

const byPath = (call: FetchCall) =>
  json(call.url.endsWith('/api/simulate') ? backendFixture('simulate-all-terminal').response : okBody)

describe('analysisStore: stale flag', () => {
  beforeEach(() => serve(byPath))

  it('turns on when the graph changes after a result, and off again when it changes back', async () => {
    await analysis().run('analyze')
    expect(analysis().analyze.stale).toBe(false)
    graph().failNode('hub')
    expect(analysis().analyze.stale).toBe(true)
    graph().restoreNode('hub')
    expect(analysis().analyze.stale).toBe(false)
  })

  it('does not turn on for moves, renames or selection', async () => {
    await analysis().run('analyze')
    graph().applyNodeChanges([{ type: 'position', id: 'hub', position: { x: 1, y: 1 }, dragging: false }])
    graph().updateNode('hub', { label: 'Renamed', nodeType: 'server' })
    graph().selectNode('hub')
    expect(analysis().analyze.stale).toBe(false)
  })

  it('tracks the settings each result depends on', async () => {
    await analysis().run('analyze')
    await analysis().run('simulate')
    expect([analysis().analyze.status, analysis().simulate.status]).toEqual(['success', 'success'])
    useSettingsStore.getState().update({ edgeFailureProbability: 0.3 })
    expect([analysis().analyze.stale, analysis().simulate.stale]).toEqual([false, true])
    useSettingsStore.getState().update({ terminalSource: 'c1' })
    expect(analysis().analyze.stale).toBe(false)
    useSettingsStore.getState().update({ traversalStart: 'hub' })
    expect(analysis().analyze.stale).toBe(true)
  })

  it('is set at once if the graph changed while the request was in flight', async () => {
    const gate = deferred<Response>()
    vi.unstubAllGlobals()
    serve(() => gate.promise)
    const pending = analysis().run('analyze')
    graph().failEdge('e-hub-srv')
    gate.resolve(json(okBody))
    await pending
    expect(analysis().analyze).toMatchObject({ status: 'success', stale: true })
  })

  it('a slot without a result is never stale', () => {
    graph().failNode('hub')
    expect(analysis().analyze.stale).toBe(false)
  })
})

describe('request builders', () => {
  const settings = () => useSettingsStore.getState()

  it('analyze sends the graph, endpoints that exist, and asks for the healthy comparison', () => {
    settings().update({ traversalStart: 'hub', pathSource: 'hub', pathTarget: 'c3' })
    const body = buildAnalyzeRequest(preset('star'), settings())
    expect(body).toMatchObject({ startNodeId: 'hub', pathSource: 'hub', pathTarget: 'c3', compareHealthy: true })
    expect(body.useWeights).toBeUndefined()
    settings().update({ pathTarget: 'gone' })
    const stale = buildAnalyzeRequest(preset('star'), settings())
    expect([stale.pathSource, stale.pathTarget]).toEqual([undefined, undefined])
  })

  it('asks for a weighted path only when chosen and every link has a weight', () => {
    const g = preset('star')
    settings().update({ pathSource: 'hub', pathTarget: 'c3', useWeights: true })
    expect(buildAnalyzeRequest(g, settings()).useWeights).toBeUndefined()
    g.edges = g.edges.map((e, i) => (i === 0 ? e : { ...e, data: { failed: false, weight: 2 } }))
    expect(buildAnalyzeRequest(g, settings()).useWeights).toBeUndefined()
    g.edges = g.edges.map((e) => ({ ...e, data: { failed: false, weight: 2 } }))
    expect(buildAnalyzeRequest(g, settings()).useWeights).toBe(true)
    settings().update({ useWeights: false })
    expect(buildAnalyzeRequest(g, settings()).useWeights).toBeUndefined()
  })

  it('simulate and sweep carry the settings; the seed only when set', () => {
    settings().update({ edgeFailureProbability: 0.25, nodeFailureProbability: 0.05, trials: 300, sweepPoints: 4, trialsPerPoint: 50 })
    const sim = buildSimulateRequest(preset('ring'), settings())
    expect(sim).toMatchObject({ mode: 'all-terminal', edgeFailureProbability: 0.25, nodeFailureProbability: 0.05, trials: 300 })
    expect('seed' in sim).toBe(false)
    settings().update({ seed: 9, mode: 'two-terminal', terminalSource: 'r1', terminalTarget: 'r4', pathSource: 'r2', pathTarget: 'r3' })
    expect(buildSimulateRequest(preset('ring'), settings())).toMatchObject({ seed: 9, mode: 'two-terminal', source: 'r1', target: 'r4' })
    // Terminals and path endpoints are independent fields.
    expect(buildAnalyzeRequest(preset('ring'), settings())).toMatchObject({ pathSource: 'r2', pathTarget: 'r3' })
    expect(buildSweepRequest(preset('ring'), settings())).toMatchObject({ points: 4, trialsPerPoint: 50, pMin: 0, pMax: 1, seed: 9 })
  })

  it('settings refuse invalid values and leave them unchanged', () => {
    expect(settings().update({ edgeFailureProbability: 1.5 }).ok).toBe(false)
    expect(settings().update({ trials: 0 }).ok).toBe(false)
    expect(settings().update({ seed: -1 }).ok).toBe(false)
    expect(settings().update({ sweepPMin: 0.8, sweepPMax: 0.2 }).ok).toBe(false)
    expect([settings().edgeFailureProbability, settings().trials, settings().seed]).toEqual([0.1, 1000, null])
  })

  it('inputKey ignores labels and types but not failures', () => {
    const g = preset('star')
    const renamed = { ...g, nodes: g.nodes.map((n) => ({ ...n, data: { ...n.data, label: 'x', nodeType: 'client' as const } })) }
    const failed = { ...g, nodes: g.nodes.map((n, i) => (i === 0 ? { ...n, data: { ...n.data, failed: true } } : n)) }
    expect(inputKey('analyze', renamed, settings())).toBe(inputKey('analyze', g, settings()))
    expect(inputKey('analyze', failed, settings())).not.toBe(inputKey('analyze', g, settings()))
  })
})

describe('auto analysis: debounce and supersede', () => {
  it('runs once, 300 ms after the last change', () => {
    vi.useFakeTimers()
    const run = vi.fn()
    const auto = createAutoAnalyzer(run, vi.fn())
    auto.notify('k1', true)
    vi.advanceTimersByTime(200)
    auto.notify('k2', true)
    vi.advanceTimersByTime(299)
    expect(run).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('an unchanged key does not run again; an empty graph clears instead of running', () => {
    vi.useFakeTimers()
    const run = vi.fn()
    const clear = vi.fn()
    const auto = createAutoAnalyzer(run, clear)
    auto.notify('k1', true)
    vi.advanceTimersByTime(300)
    auto.notify('k1', true)
    vi.advanceTimersByTime(300)
    expect(run).toHaveBeenCalledTimes(1)
    auto.notify('empty', false)
    vi.advanceTimersByTime(300)
    expect([run.mock.calls.length, clear.mock.calls.length]).toEqual([1, 1])
  })

  it('dispose cancels a pending run', () => {
    vi.useFakeTimers()
    const run = vi.fn()
    const auto = createAutoAnalyzer(run, vi.fn())
    auto.notify('k1', true)
    auto.dispose()
    vi.advanceTimersByTime(1000)
    expect(run).not.toHaveBeenCalled()
  })

  it('useAutoAnalyze: rapid edits send one request, and an edit in flight supersedes it', async () => {
    vi.useFakeTimers()
    const gates: Array<ReturnType<typeof deferred<Response>>> = []
    const calls = serve(() => {
      const gate = deferred<Response>()
      gates.push(gate)
      return gate.promise
    })
    const hook = renderHook(() => useAutoAnalyze())
    graph().failNode('c1')
    graph().failNode('c2')
    await vi.advanceTimersByTimeAsync(300)
    expect(calls).toHaveLength(1)
    expect(calls[0].body).toMatchObject({ nodes: expect.arrayContaining([expect.objectContaining({ id: 'c2', failed: true })]) })

    graph().restoreNode('c2')
    await vi.advanceTimersByTimeAsync(300)
    expect(calls).toHaveLength(2)
    expect(calls[0].init?.signal?.aborted).toBe(true)

    gates[1].resolve(json(okBody))
    await settle()
    expect(analysis().analyze.status).toBe('success')

    hook.unmount()
  })

  it('useAutoAnalyze: an empty graph sends nothing and clears the result', async () => {
    vi.useFakeTimers()
    const calls = serve(() => json(okBody))
    renderHook(() => useAutoAnalyze())
    await vi.advanceTimersByTimeAsync(300)
    expect(calls).toHaveLength(1)
    expect(analysis().analyze.result).not.toBeNull()
    graph().reset()
    await vi.advanceTimersByTimeAsync(1000)
    expect(calls).toHaveLength(1)
    expect(analysis().analyze.result).toBeNull()
  })
})
