/**
 * "Fail random": picks one operational node or link from a seed and a draw number, so the same seed,
 * draw and network always pick the same element. Selection only: no analysis is computed here.
 */
import type { EditorGraph } from '@/types/graph'

export type RandomPick = { kind: 'node' | 'edge'; id: string }

function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  // A final mix, so consecutive draws do not pick neighbouring indices.
  h ^= h >>> 15
  h = Math.imul(h, 0x2c1b3c6d)
  h ^= h >>> 13
  return h >>> 0
}

/** The candidates in a stable order: operational nodes, then operational links, each by request order. */
export function operationalElements(graph: EditorGraph): RandomPick[] {
  const down = new Set(graph.nodes.filter((n) => n.data.failed).map((n) => n.id))
  return [
    ...graph.nodes.filter((n) => !n.data.failed).map((n): RandomPick => ({ kind: 'node', id: n.id })),
    ...graph.edges
      .filter((e) => !e.data?.failed && !down.has(e.source) && !down.has(e.target))
      .map((e): RandomPick => ({ kind: 'edge', id: e.id })),
  ]
}

export function pickRandomOperational(graph: EditorGraph, seed: number, draw: number): RandomPick | null {
  const candidates = operationalElements(graph)
  return candidates.length === 0 ? null : candidates[hash(`${seed}:${draw}`) % candidates.length]
}
