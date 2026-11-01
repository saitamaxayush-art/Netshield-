/**
 * Editing rules for the graph editor. They mirror the backend's request validation (contract
 * section 5) so the editor never builds a graph the backend would reject. They validate edits only:
 * no analysis is computed here.
 */
import type { EditorEdge, EditorGraph, EditorNode } from '@/types/graph'

export const MAX_ID_LENGTH = 64
export const MAX_LABEL_LENGTH = 100
export const MAX_NODES = 200
export const MAX_EDGES = 1000

export type EditResult = { ok: true; id?: string } | { ok: false; error: string }

export const ok = (id?: string): EditResult => (id === undefined ? { ok: true } : { ok: true, id })
export const fail = (error: string): EditResult => ({ ok: false, error })

export const pairKey = (a: string, b: string): string => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`)

export function checkId(id: string, kind: 'Node' | 'Edge'): string | null {
  if (id.length === 0) return `${kind} id must not be empty.`
  if (id.length > MAX_ID_LENGTH) return `${kind} id must be at most ${MAX_ID_LENGTH} characters.`
  return null
}

export function checkLabel(label: string): string | null {
  return label.length > MAX_LABEL_LENGTH ? `Label must be at most ${MAX_LABEL_LENGTH} characters.` : null
}

export function checkWeight(weight: number): string | null {
  return Number.isFinite(weight) && weight > 0 ? null : 'Weight must be a finite number greater than 0.'
}

export function checkProbability(p: number, name = 'Failure probability'): string | null {
  return Number.isFinite(p) && p >= 0 && p <= 1 ? null : `${name} must be between 0 and 1.`
}

/** Why an edge between source and target cannot be added, or null if it can. */
export function checkNewEdge(nodes: EditorNode[], edges: EditorEdge[], source: string, target: string, id: string): string | null {
  const ids = new Set(nodes.map((n) => n.id))
  if (!ids.has(source)) return `Unknown node '${source}'.`
  if (!ids.has(target)) return `Unknown node '${target}'.`
  if (source === target) return 'A link cannot connect a node to itself (no self loops).'
  const key = pairKey(source, target)
  if (edges.some((e) => pairKey(e.source, e.target) === key)) return `Nodes '${source}' and '${target}' are already linked.`
  if (edges.some((e) => e.id === id)) return `Edge id '${id}' is already used.`
  if (edges.length >= MAX_EDGES) return `A network can have at most ${MAX_EDGES} links.`
  return checkId(id, 'Edge')
}

/** Every rule at once, for graphs that arrive whole (saved data, presets). */
export function checkGraph(graph: EditorGraph): string | null {
  if (graph.nodes.length > MAX_NODES) return `A network can have at most ${MAX_NODES} nodes.`
  if (graph.edges.length > MAX_EDGES) return `A network can have at most ${MAX_EDGES} links.`
  const ids = new Set<string>()
  for (const n of graph.nodes) {
    const problem = checkId(n.id, 'Node') ?? checkLabel(n.data.label)
    if (problem) return problem
    if (ids.has(n.id)) return `Duplicate node id '${n.id}'.`
    ids.add(n.id)
  }
  const edgeIds = new Set<string>()
  const pairs = new Set<string>()
  for (const e of graph.edges) {
    const problem =
      checkId(e.id, 'Edge') ??
      (e.data?.weight !== undefined ? checkWeight(e.data.weight) : null) ??
      (e.data?.failureProbability !== undefined ? checkProbability(e.data.failureProbability) : null)
    if (problem) return problem
    if (edgeIds.has(e.id)) return `Duplicate edge id '${e.id}'.`
    edgeIds.add(e.id)
    if (!ids.has(e.source) || !ids.has(e.target)) return `Edge '${e.id}' refers to an unknown node.`
    if (e.source === e.target) return `Edge '${e.id}' connects a node to itself.`
    const key = pairKey(e.source, e.target)
    if (pairs.has(key)) return `Edge '${e.id}' duplicates another link between the same nodes.`
    pairs.add(key)
  }
  return null
}

/** The smallest unused id of the form `${prefix}${k}`, k >= 1: deterministic, unlike timestamps. */
export function nextId(prefix: string, used: Iterable<string>): string {
  const taken = new Set(used)
  for (let k = 1; ; k++) if (!taken.has(`${prefix}${k}`)) return `${prefix}${k}`
}
