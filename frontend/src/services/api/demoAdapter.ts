/**
 * Demo adapter: a deterministic, browser side implementation of the NetShield API.
 *
 * Selected only by VITE_USE_DEMO_ADAPTER=true or the explicit "Switch to demo mode" action, which the
 * app shows with a persistent banner. Never used as a fallback for a failed backend call.
 * Every response is stamped `isDemo: true` and carries `meta.engine: "demo"`.
 *
 * Its analysis and simulation code (./demo/) is independent: it shares nothing with the backend or
 * with the landing page helpers.
 */
import { ApiError, type NetShieldApi, type RequestOptions, type Stamped } from './client'
import { analyzeGraph, compareIds } from './demo/analysis'
import { compile, DemoAbortError, runTrials, seedFrom, standardError, wilson95, type Compiled, type Tally } from './demo/simulation'
import type {
  AnalyzeRequestBody,
  AnalyzeResponseBody,
  HealthResponseBody,
  Meta,
  SimulateRequestBody,
  SimulateResponseBody,
  SweepRequestBody,
  SweepResponseBody,
} from './schemas'

export const DEMO_META: Meta = { engine: 'demo', engineVersion: 'netshield-demo-1', apiVersion: '2.0.0' }
const LIMITS = { maxNodes: 200, maxEdges: 1000, maxTrials: 20000, maxSweepPoints: 25 }

function reject(code: string, message: string): never {
  throw new ApiError('validation', code, `${message} (${code})`, 422)
}

const isUnit = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1
const isCount = (v: number, min = 1) => Number.isInteger(v) && v >= min

/** Field constraints the backend's Pydantic models enforce (contract section 2): VALIDATION_ERROR. */
function checkField(ok: boolean, message: string): void {
  if (!ok) reject('VALIDATION_ERROR', message)
}

function checkRunOptions(body: SimulateRequestBody | SweepRequestBody): void {
  checkField(isUnit(body.nodeFailureProbability ?? 0), 'nodeFailureProbability must be between 0 and 1')
  checkField(body.seed == null || (isCount(body.seed, 0) && body.seed <= 2 ** 32 - 1), 'seed must be an integer from 0 to 4294967295')
}

/** The same graph rules and codes as the backend (contract section 5), checked in the same order. */
function validateGraph(body: { nodes: AnalyzeRequestBody['nodes']; edges: AnalyzeRequestBody['edges'] }): void {
  for (const n of body.nodes) {
    checkField(n.id.length >= 1 && n.id.length <= 64, 'node id must be 1 to 64 characters')
    checkField(n.label.length <= 100, 'node label must be at most 100 characters')
  }
  for (const e of body.edges) {
    checkField(e.id.length >= 1 && e.id.length <= 64, 'edge id must be 1 to 64 characters')
    checkField(e.weight == null || (Number.isFinite(e.weight) && e.weight > 0), 'edge weight must be greater than 0')
    checkField(e.failureProbability == null || isUnit(e.failureProbability), 'edge failureProbability must be between 0 and 1')
  }
  if (body.nodes.length > LIMITS.maxNodes) reject('LIMIT_EXCEEDED', `Too many nodes: ${body.nodes.length} given, maximum is ${LIMITS.maxNodes} (maxNodes).`)
  if (body.edges.length > LIMITS.maxEdges) reject('LIMIT_EXCEEDED', `Too many edges: ${body.edges.length} given, maximum is ${LIMITS.maxEdges} (maxEdges).`)
  const ids = new Set<string>()
  for (const n of body.nodes) {
    if (ids.has(n.id)) reject('DUPLICATE_NODE_ID', `Duplicate node id '${n.id}'.`)
    ids.add(n.id)
  }
  const edgeIds = new Set<string>()
  const pairs = new Set<string>()
  for (const e of body.edges) {
    if (edgeIds.has(e.id)) reject('DUPLICATE_EDGE_ID', `Duplicate edge id '${e.id}'.`)
    edgeIds.add(e.id)
    for (const end of [e.source, e.target]) if (!ids.has(end)) reject('UNKNOWN_NODE', `Edge '${e.id}' refers to unknown node '${end}'.`)
    if (e.source === e.target) reject('SELF_LOOP', `Edge '${e.id}' connects a node to itself.`)
    const key = [e.source, e.target].sort(compareIds).join('\u0000')
    if (pairs.has(key)) reject('PARALLEL_EDGE', `Edge '${e.id}' duplicates another edge between the same nodes.`)
    pairs.add(key)
  }
}

function requireKnown(ids: Set<string>, value: string | null | undefined, field: string): void {
  if (value !== null && value !== undefined && !ids.has(value)) reject('UNKNOWN_NODE', `${field} refers to unknown node '${value}'.`)
}

function terminalsOf(body: SimulateRequestBody | SweepRequestBody): [string, string] | null {
  if ((body.mode ?? 'all-terminal') !== 'two-terminal') return null
  if (!body.source || !body.target) reject('VALIDATION_ERROR', 'two-terminal mode needs both source and target')
  if (body.source === body.target) reject('VALIDATION_ERROR', 'source and target must be different nodes')
  return [body.source, body.target]
}

function assumptions(body: SimulateRequestBody | SweepRequestBody, edgeText: string, trialsText: string, seed: number): string[] {
  const terminals = terminalsOf(body)
  return [
    'Computed in your browser by the demo adapter (demo mode), not by the NetShield backend.',
    `Each operational link fails independently with probability ${edgeText}.`,
    `Each operational node fails independently with probability ${body.nodeFailureProbability ?? 0}.`,
    'Nodes and links marked failed stay failed in every trial; a link whose endpoint failed is unavailable in that trial.',
    terminals
      ? `A trial succeeds when nodes ${terminals[0]} and ${terminals[1]} both survive and are connected (two-terminal).`
      : 'A trial succeeds when the surviving network has at least one node and exactly one connected component (all-terminal).',
    `${trialsText} with seed ${seed}; the interval is the Wilson score interval at 95 percent.`,
  ]
}

function histogram(t: Tally) {
  return [...t.histogram.entries()].sort((a, b) => a[0] - b[0]).map(([components, trials]) => ({ components, trials }))
}

function criticalEdge(g: Compiled, t: Tally) {
  const top = Math.max(0, ...t.pivotal)
  if (top === 0) return null
  const edgeId = g.edgeIds.filter((_, i) => t.pivotal[i] === top).sort(compareIds)[0]
  return { edgeId, pivotalTrials: top, share: top / t.trials, explanationKey: 'critical_edge_definition' as const }
}

export class DemoApi implements NetShieldApi {
  readonly isDemo = true
  private readonly inFlight = new Map<string, AbortController>()

  async health(): Promise<Stamped<HealthResponseBody>> {
    return { status: 'ok', service: 'NetShield demo adapter (in the browser)', engine: 'demo', version: DEMO_META.engineVersion, isDemo: true }
  }

  async analyze(body: AnalyzeRequestBody): Promise<Stamped<AnalyzeResponseBody>> {
    validateGraph(body)
    if ((body.pathSource == null) !== (body.pathTarget == null)) reject('VALIDATION_ERROR', 'pathSource and pathTarget must be given together')
    const ids = new Set(body.nodes.map((n) => n.id))
    requireKnown(ids, body.startNodeId, 'startNodeId')
    requireKnown(ids, body.pathSource, 'pathSource')
    requireKnown(ids, body.pathTarget, 'pathTarget')
    const current = analyzeGraph(body)
    const healthy = body.compareHealthy
      ? analyzeGraph({
          ...body,
          nodes: body.nodes.map((n) => ({ ...n, failed: false })),
          edges: body.edges.map((e) => ({ ...e, failed: false })),
        })
      : null
    return { current, healthy, meta: DEMO_META, isDemo: true }
  }

  async simulate(body: SimulateRequestBody, options: RequestOptions = {}): Promise<Stamped<SimulateResponseBody>> {
    validateGraph(body)
    checkField(isUnit(body.edgeFailureProbability), 'edgeFailureProbability must be between 0 and 1')
    checkRunOptions(body)
    const trials = body.trials ?? 1000
    checkField(isCount(trials), 'trials must be a positive integer')
    if (trials > LIMITS.maxTrials) reject('LIMIT_EXCEEDED', `Too many trials: ${trials} given, maximum is ${LIMITS.maxTrials} (maxTrials).`)
    const terminals = terminalsOf(body)
    requireKnown(new Set(body.nodes.map((n) => n.id)), body.source, 'source')
    requireKnown(new Set(body.nodes.map((n) => n.id)), body.target, 'target')
    const seed = body.seed ?? seedFrom(JSON.stringify(body))
    const g = compile(body.nodes, body.edges)
    const p = body.edgeFailureProbability
    const started = performance.now()
    const [tally] = await this.guard('simulate', options, (signal) =>
      runTrials(g, [g.ownProbability.map((own) => own ?? p)], body.nodeFailureProbability ?? 0, terminals, trials, seed, signal)
    )
    return {
      mode: body.mode ?? 'all-terminal',
      source: body.source ?? null,
      target: body.target ?? null,
      trials: tally.trials,
      connectedTrials: tally.successes,
      estimate: tally.successes / tally.trials,
      standardError: standardError(tally.successes, tally.trials),
      wilson95: wilson95(tally.successes, tally.trials),
      seed,
      edgeFailureProbability: p,
      nodeFailureProbability: body.nodeFailureProbability ?? 0,
      averageComponents: tally.componentSum / tally.trials,
      componentHistogram: histogram(tally),
      criticalEdge: criticalEdge(g, tally),
      assumptions: assumptions(body, String(p), `${tally.trials} trials`, seed),
      elapsedMs: Math.round((performance.now() - started) * 100) / 100,
      explanationKey: 'monte_carlo_estimate',
      meta: DEMO_META,
      isDemo: true,
    }
  }

  async reliabilitySweep(body: SweepRequestBody, options: RequestOptions = {}): Promise<Stamped<SweepResponseBody>> {
    validateGraph(body)
    checkField(isUnit(body.pMin) && isUnit(body.pMax), 'pMin and pMax must be between 0 and 1')
    checkRunOptions(body)
    const points = body.points ?? 11
    const trials = body.trialsPerPoint ?? 1000
    checkField(isCount(points) && isCount(trials), 'points and trialsPerPoint must be positive integers')
    if (points > LIMITS.maxSweepPoints) reject('LIMIT_EXCEEDED', `Too many sweep points: ${points} given, maximum is ${LIMITS.maxSweepPoints} (maxSweepPoints).`)
    if (trials > LIMITS.maxTrials) reject('LIMIT_EXCEEDED', `Too many trials per point: ${trials} given, maximum is ${LIMITS.maxTrials} (maxTrials).`)
    if (body.pMin > body.pMax) reject('VALIDATION_ERROR', 'pMin must be less than or equal to pMax')
    const terminals = terminalsOf(body)
    const seed = body.seed ?? seedFrom(JSON.stringify(body))
    const step = points === 1 ? 0 : (body.pMax - body.pMin) / (points - 1)
    const ps = Array.from({ length: points }, (_, i) => Math.round((body.pMin + i * step) * 1e12) / 1e12)
    const g = compile(body.nodes, body.edges)
    const started = performance.now()
    const tallies = await this.guard('reliabilitySweep', options, (signal) =>
      runTrials(g, ps.map((p) => g.ownProbability.map((own) => own ?? p)), body.nodeFailureProbability ?? 0, terminals, trials, seed, signal)
    )
    return {
      mode: body.mode ?? 'all-terminal',
      source: body.source ?? null,
      target: body.target ?? null,
      trialsPerPoint: trials,
      seed,
      nodeFailureProbability: body.nodeFailureProbability ?? 0,
      points: ps.map((p, k) => ({
        p,
        estimate: tallies[k].successes / tallies[k].trials,
        connectedTrials: tallies[k].successes,
        standardError: standardError(tallies[k].successes, tallies[k].trials),
        wilson95: wilson95(tallies[k].successes, tallies[k].trials),
      })),
      assumptions: [
        ...assumptions(body, `p from ${body.pMin} to ${body.pMax} in ${points} step(s)`, `${trials} trials per point`, seed),
        'Every point reuses the same random draws (common random numbers), so the estimate never increases with p.',
      ],
      elapsedMs: Math.round((performance.now() - started) * 100) / 100,
      explanationKey: 'reliability_sweep',
      meta: DEMO_META,
      isDemo: true,
    }
  }

  /** Cancellation and supersession with the same semantics as the HTTP client. */
  private async guard<T>(method: string, options: RequestOptions, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController()
    if (options.supersede ?? true) {
      const previous = this.inFlight.get(method)
      if (previous) previous.abort('superseded')
      this.inFlight.set(method, controller)
    }
    const onAbort = () => controller.abort('cancelled')
    options.signal?.addEventListener('abort', onAbort)
    if (options.signal?.aborted) controller.abort('cancelled')
    try {
      return await run(controller.signal)
    } catch (error) {
      if (error instanceof DemoAbortError || controller.signal.aborted) {
        const superseded = controller.signal.reason === 'superseded'
        throw new ApiError('cancelled', superseded ? 'SUPERSEDED' : 'CANCELLED', superseded ? 'Request was replaced by a newer one.' : 'Request was cancelled.')
      }
      throw error
    } finally {
      options.signal?.removeEventListener('abort', onAbort)
      if (this.inFlight.get(method) === controller) this.inFlight.delete(method)
    }
  }
}
