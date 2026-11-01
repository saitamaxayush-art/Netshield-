/**
 * Editor graph types (React Flow compatible) and conversion to and from the API graph payload.
 *
 * Editing state only: positions, labels, types and the stored `failed` flags. Analysis results
 * (components, bridges, articulation points) live in the analysis store, never in node or edge data.
 */
import type { Edge, Node } from '@xyflow/react'
import type { ApiEdge, ApiNode } from '@/services/api/schemas'

export type NodeType = ApiNode['type']
export const NODE_TYPES: readonly NodeType[] = ['router', 'server', 'client', 'firewall']

export interface EditorNodeData extends Record<string, unknown> {
  label: string
  nodeType: NodeType
  failed: boolean
}

export interface EditorEdgeData extends Record<string, unknown> {
  failed: boolean
  weight?: number
  failureProbability?: number
}

export type EditorNode = Node<EditorNodeData, 'netshieldNode'>
export type EditorEdge = Edge<EditorEdgeData, 'netshieldEdge'>

export interface EditorGraph {
  nodes: EditorNode[]
  edges: EditorEdge[]
}

export interface ApiGraph {
  nodes: ApiNode[]
  edges: ApiEdge[]
}

export interface Position {
  x: number
  y: number
}

/** The API payload for the current editor state (contract section 2). */
export function toApiGraph(graph: EditorGraph): ApiGraph {
  return {
    nodes: graph.nodes.map((n) => ({ id: n.id, label: n.data.label, type: n.data.nodeType, failed: n.data.failed })),
    edges: graph.edges.map((e) => {
      const edge: ApiEdge = { id: e.id, source: e.source, target: e.target, failed: e.data?.failed ?? false }
      if (e.data?.weight !== undefined) edge.weight = e.data.weight
      if (e.data?.failureProbability !== undefined) edge.failureProbability = e.data.failureProbability
      return edge
    }),
  }
}

/** Positions on a circle, in node order: used when a graph arrives without positions. */
export function circleLayout(ids: string[], center: Position = { x: 400, y: 260 }, radius = 220): Record<string, Position> {
  const out: Record<string, Position> = {}
  ids.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / Math.max(1, ids.length) - Math.PI / 2
    out[id] = { x: Math.round(center.x + radius * Math.cos(angle)), y: Math.round(center.y + radius * Math.sin(angle)) }
  })
  return out
}

/** Editor graph from an API payload, placing nodes at the given positions (circle layout otherwise). */
export function fromApiGraph(graph: ApiGraph, positions: Record<string, Position> = {}): EditorGraph {
  const fallback = circleLayout(graph.nodes.map((n) => n.id))
  return {
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      type: 'netshieldNode',
      position: positions[n.id] ?? fallback[n.id],
      data: { label: n.label, nodeType: n.type, failed: n.failed ?? false },
    })),
    edges: graph.edges.map((e) => {
      const data: EditorEdgeData = { failed: e.failed ?? false }
      if (e.weight !== undefined && e.weight !== null) data.weight = e.weight
      if (e.failureProbability !== undefined && e.failureProbability !== null) data.failureProbability = e.failureProbability
      return { id: e.id, source: e.source, target: e.target, type: 'netshieldEdge', data }
    }),
  }
}

/**
 * A stable string for everything that affects computed results: node ids and failed flags, edge
 * endpoints, failed flags, weights and failure probabilities. Positions, selection, labels and node
 * types are excluded, so dragging or renaming a node does not mark results out of date.
 */
export function graphSignature(graph: EditorGraph): string {
  return JSON.stringify([
    graph.nodes.map((n) => [n.id, n.data.failed]),
    graph.edges.map((e) => [e.id, e.source, e.target, e.data?.failed ?? false, e.data?.weight ?? null, e.data?.failureProbability ?? null]),
  ])
}
