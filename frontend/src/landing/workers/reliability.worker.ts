/// <reference lib="webworker" />
import { createReliabilityRun, exactAllTerminalReliability, type PureEdge, type PureNode } from '@/lib/graphAlgorithms'
import { createMulberry32 } from '@/lib/seededGraphGenerator'

export type WorkerRequest =
  | { type: 'run'; id: number; nodes: PureNode[]; edges: PureEdge[]; p: number; trials: number; seed: number; batches: number }
  | { type: 'sweep'; id: number; nodes: PureNode[]; edges: PureEdge[]; ps: number[]; trials: number; seed: number }
  | { type: 'cancel'; id: number }

export type WorkerResponse =
  | { type: 'progress'; id: number; done: number; estimate: number; standardError: number }
  | { type: 'done'; id: number; done: number; connected: number; estimate: number; standardError: number; exact: number | null; ms: number }
  | { type: 'sweep-point'; id: number; p: number; estimate: number; standardError: number; exact: number | null }
  | { type: 'sweep-done'; id: number }
  | { type: 'cancelled'; id: number }

// In a worker, `self` is the worker scope; declared here so no cast is needed.
declare const self: DedicatedWorkerGlobalScope
const ctx = self
let current = 0

/**
 * Runs Monte Carlo trials off the main thread. Work is split into batches
 * with a short yield between them so progress streams to the UI and a
 * cancel message is honoured between batches.
 */
ctx.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data
  if (msg.type === 'cancel') {
    if (current === msg.id) current = 0
    ctx.postMessage({ type: 'cancelled', id: msg.id } satisfies WorkerResponse)
    return
  }
  current = msg.id
  if (msg.type === 'run') {
    const t0 = performance.now()
    const run = createReliabilityRun(msg.nodes, msg.edges, msg.p, createMulberry32(msg.seed))
    const batch = Math.max(1, Math.ceil(msg.trials / msg.batches))
    const step = () => {
      if (current !== msg.id) return
      const left = msg.trials - run.progress().done
      const r = run.step(Math.min(batch, left))
      ctx.postMessage({ type: 'progress', id: msg.id, done: r.done, estimate: r.estimate, standardError: r.standardError } satisfies WorkerResponse)
      if (r.done < msg.trials) {
        setTimeout(step, 14)
        return
      }
      ctx.postMessage({
        type: 'done',
        id: msg.id,
        done: r.done,
        connected: r.connected,
        estimate: r.estimate,
        standardError: r.standardError,
        exact: exactAllTerminalReliability(msg.nodes, msg.edges, msg.p),
        ms: performance.now() - t0,
      } satisfies WorkerResponse)
      current = 0
    }
    step()
    return
  }
  // Sweep: one independent seeded run per failure probability.
  let k = 0
  const next = () => {
    if (current !== msg.id) return
    if (k >= msg.ps.length) {
      ctx.postMessage({ type: 'sweep-done', id: msg.id } satisfies WorkerResponse)
      current = 0
      return
    }
    const p = msg.ps[k]
    const r = createReliabilityRun(msg.nodes, msg.edges, p, createMulberry32(msg.seed + k)).step(msg.trials)
    ctx.postMessage({ type: 'sweep-point', id: msg.id, p, estimate: r.estimate, standardError: r.standardError, exact: exactAllTerminalReliability(msg.nodes, msg.edges, p) } satisfies WorkerResponse)
    k++
    setTimeout(next, 30)
  }
  next()
}
