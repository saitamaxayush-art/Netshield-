/**
 * Demo Monte Carlo: an independent implementation of the contract's reliability model
 * (API_CONTRACT.md sections 3, 8 and 9) with its own seeded generator (mulberry32).
 *
 * Same model and draw order as the backend (one uniform per operational node, then per operational
 * edge, in request order), but a different generator, so numbers differ from the backend's for the
 * same seed while following the same statistics. Runs in chunks so the browser stays responsive and
 * honours an AbortSignal.
 */
import type { SimulateRequestBody } from '../schemas'

type ApiNode = SimulateRequestBody['nodes'][number]
type ApiEdge = SimulateRequestBody['edges'][number]

export const Z_95 = 1.959963984540054

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a hash: a deterministic default seed when the caller gives none. */
export function seedFrom(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function wilson95(successes: number, trials: number): { low: number; high: number } {
  if (trials === 0) return { low: 0, high: 1 }
  const p = successes / trials
  const z2 = Z_95 * Z_95
  const denominator = 1 + z2 / trials
  const center = (p + z2 / (2 * trials)) / denominator
  const half = (Z_95 / denominator) * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials))
  return {
    low: successes === 0 ? 0 : Math.max(0, center - half),
    high: successes === trials ? 1 : Math.min(1, center + half),
  }
}

export function standardError(successes: number, trials: number): number {
  const p = successes / trials
  return Math.sqrt((p * (1 - p)) / trials)
}

export interface Compiled {
  nodeIds: string[]
  edgeIds: string[]
  edgeA: number[]
  edgeB: number[]
  ownProbability: Array<number | null>
  indexOf: Map<string, number>
}

export function compile(nodes: ApiNode[], edges: ApiEdge[]): Compiled {
  const alive = nodes.filter((n) => !n.failed).map((n) => n.id)
  const indexOf = new Map(alive.map((id, i) => [id, i]))
  const live = edges.filter((e) => !e.failed && indexOf.has(e.source) && indexOf.has(e.target))
  return {
    nodeIds: alive,
    edgeIds: live.map((e) => e.id),
    edgeA: live.map((e) => indexOf.get(e.source)!),
    edgeB: live.map((e) => indexOf.get(e.target)!),
    ownProbability: live.map((e) => e.failureProbability ?? null),
    indexOf,
  }
}

export interface Tally {
  trials: number
  successes: number
  componentSum: number
  histogram: Map<number, number>
  pivotal: number[]
}

interface Outcome {
  success: boolean
  components: number
  pivotal: number[]
}

function evaluate(g: Compiled, nodeAlive: boolean[], edgeAlive: boolean[], terminals: [number, number] | null): Outcome {
  const parent = g.nodeIds.map((_, i) => i)
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }
  let components = nodeAlive.filter(Boolean).length
  for (let i = 0; i < g.edgeA.length; i++) {
    const a = g.edgeA[i]
    const b = g.edgeB[i]
    if (edgeAlive[i] && nodeAlive[a] && nodeAlive[b]) {
      const ra = find(a)
      const rb = find(b)
      if (ra !== rb) {
        parent[ra] = rb
        components--
      }
    }
  }
  let success: boolean
  let joinable: boolean
  let roots: [number, number] | null = null
  if (terminals === null) {
    success = components === 1
    joinable = components === 2
  } else {
    const [s, t] = terminals
    const bothAlive = s >= 0 && t >= 0 && nodeAlive[s] && nodeAlive[t]
    success = bothAlive && find(s) === find(t)
    joinable = bothAlive && !success
    if (joinable) roots = [find(s), find(t)]
  }
  const pivotal: number[] = []
  if (joinable) {
    for (let i = 0; i < g.edgeA.length; i++) {
      const a = g.edgeA[i]
      const b = g.edgeB[i]
      if (edgeAlive[i] || !nodeAlive[a] || !nodeAlive[b]) continue
      const ra = find(a)
      const rb = find(b)
      if (ra === rb) continue
      if (roots === null || (ra === roots[0] && rb === roots[1]) || (ra === roots[1] && rb === roots[0])) pivotal.push(i)
    }
  }
  return { success, components, pivotal }
}

export class DemoAbortError extends Error {}

/**
 * Run trials, evaluating every edge probability vector on the same draws (common random numbers).
 * Yields to the event loop every `chunk` trials.
 */
export async function runTrials(
  g: Compiled,
  edgeProbabilityVectors: number[][],
  nodeProbability: number,
  terminals: [string, string] | null,
  trials: number,
  seed: number,
  signal?: AbortSignal,
  chunk = 250
): Promise<Tally[]> {
  const random = mulberry32(seed)
  const pair: [number, number] | null = terminals
    ? [g.indexOf.get(terminals[0]) ?? -1, g.indexOf.get(terminals[1]) ?? -1]
    : null
  const tallies: Tally[] = edgeProbabilityVectors.map(() => ({
    trials: 0,
    successes: 0,
    componentSum: 0,
    histogram: new Map(),
    pivotal: g.edgeIds.map(() => 0),
  }))
  for (let trial = 0; trial < trials; trial++) {
    if (trial > 0 && trial % chunk === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0))
      if (signal?.aborted) throw new DemoAbortError('cancelled')
    }
    const nodeAlive = g.nodeIds.map(() => random() >= nodeProbability)
    const edgeU = g.edgeIds.map(() => random())
    edgeProbabilityVectors.forEach((probabilities, k) => {
      const edgeAlive = edgeU.map((u, i) => u >= probabilities[i])
      const outcome = evaluate(g, nodeAlive, edgeAlive, pair)
      const tally = tallies[k]
      tally.trials++
      if (outcome.success) tally.successes++
      tally.componentSum += outcome.components
      tally.histogram.set(outcome.components, (tally.histogram.get(outcome.components) ?? 0) + 1)
      for (const i of outcome.pivotal) tally.pivotal[i]++
    })
  }
  return tallies
}
