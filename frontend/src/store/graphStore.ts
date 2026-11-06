/**
 * Graph editing state: nodes, edges, selection, failure flags and undo history.
 *
 * Holds no analysis results (those live in analysisStore) and computes no graph metrics. Every edit
 * is validated against the rules in graphRules.ts and returns an EditResult instead of throwing.
 */
import { applyNodeChanges, type NodeChange } from '@xyflow/react'
import { create } from 'zustand'
import type { EditorEdge, EditorEdgeData, EditorGraph, EditorNode, NodeType, Position } from '@/types/graph'
import {
  checkGraph,
  checkId,
  checkLabel,
  checkNewEdge,
  checkProbability,
  checkWeight,
  fail,
  MAX_NODES,
  nextId,
  ok,
  type EditResult,
} from './graphRules'
import { preset, type PresetName } from './presets'
import { pickRandomOperational, type RandomPick } from './randomFailure'

export const HISTORY_LIMIT = 100

const TYPE_LABELS: Record<NodeType, string> = {
  router: 'Router',
  server: 'Server',
  client: 'Client',
  firewall: 'Firewall',
}

export interface NewNode {
  nodeType: NodeType
  id?: string
  label?: string
  position?: Position
}

export interface NewEdge {
  source: string
  target: string
  id?: string
  weight?: number
  failureProbability?: number
}

/** null clears an optional field; undefined leaves it unchanged. */
export interface EdgePatch {
  weight?: number | null
  failureProbability?: number | null
}

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export interface GraphState extends EditorGraph {
  /** Pan and zoom of the canvas, saved with the graph. Null: fit the graph on first show. */
  viewport: Viewport | null
  selectedNodeId: string | null
  selectedEdgeId: string | null
  /** The preset the graph was loaded from, so the UI can label it "Example". Null for the user's own graph. */
  example: PresetName | null
  past: HistoryEntry[]
  future: HistoryEntry[]
  /** Draws made by failRandom so far, and what the last one picked (shown to the user). */
  randomDraw: number
  lastRandom: (RandomPick & { seed: number; draw: number }) | null
  /** True between the first position change of a drag and its end (history is recorded once per drag). */
  dragging: boolean

  addNode: (input: NewNode) => EditResult
  updateNode: (id: string, patch: { label?: string; nodeType?: NodeType }) => EditResult
  removeNode: (id: string) => EditResult
  addEdge: (input: NewEdge) => EditResult
  updateEdge: (id: string, patch: EdgePatch) => EditResult
  removeEdge: (id: string) => EditResult
  removeSelected: () => EditResult
  /** React Flow node changes: positions and dimensions, plus removals routed through removeNode. */
  applyNodeChanges: (changes: NodeChange<EditorNode>[]) => void

  /** Commit final positions (end of a drag, or a keyboard nudge) as one undo step. */
  moveNodes: (positions: Record<string, Position>) => void
  setViewport: (viewport: Viewport) => void

  selectNode: (id: string | null) => void
  selectEdge: (id: string | null) => void

  failNode: (id: string) => EditResult
  restoreNode: (id: string) => EditResult
  toggleNodeFailure: (id: string) => EditResult
  failEdge: (id: string) => EditResult
  restoreEdge: (id: string) => EditResult
  toggleEdgeFailure: (id: string) => EditResult
  clearFailures: () => void
  /** Fail one operational node or link, picked from the seed and the next draw number. */
  failRandom: (seed: number) => EditResult

  undo: () => boolean
  redo: () => boolean

  loadPreset: (name: PresetName) => void
  /** Replace the whole graph (saved data): validated, clears history. */
  replaceGraph: (graph: EditorGraph, example?: PresetName | null) => EditResult
  /** Empty canvas. Recorded in history so it can be undone. */
  reset: () => void
}

/** The random draw state is part of history, so undoing a "Fail random" also takes back its pick. */
export type HistoryEntry = EditorGraph & Pick<GraphState, 'example' | 'randomDraw' | 'lastRandom'>

const snapshot = (s: HistoryEntry): HistoryEntry => ({ nodes: s.nodes, edges: s.edges, example: s.example, randomDraw: s.randomDraw, lastRandom: s.lastRandom })

/** State update that records the current graph in the undo history first. */
function withHistory(s: GraphState, next: Partial<GraphState>): Partial<GraphState> {
  const past = [...s.past, snapshot(s)]
  return { ...next, past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past, future: [] }
}

function setNodeFailed(nodes: EditorNode[], id: string, failed: boolean): EditorNode[] {
  return nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, failed } } : n))
}

function setEdgeFailed(edges: EditorEdge[], id: string, failed: boolean): EditorEdge[] {
  return edges.map((e) => (e.id === id ? { ...e, data: { ...(e.data ?? { failed: false }), failed } } : e))
}

export const initialGraph = (): Pick<GraphState, 'nodes' | 'edges' | 'example'> => ({ ...preset('star'), example: 'star' })

export const useGraphStore = create<GraphState>((set, get) => {
  /** Apply an edit with history, or return why it was refused. */
  const commit = (next: Partial<GraphState>, id?: string): EditResult => {
    set((s) => withHistory(s, next))
    return ok(id)
  }

  const setFailure = (kind: 'node' | 'edge', id: string, failed: boolean): EditResult => {
    const s = get()
    if (kind === 'node') {
      const current = s.nodes.find((n) => n.id === id)
      if (!current) return fail(`Unknown node '${id}'.`)
      if (current.data.failed === failed) return ok(id)
      return commit({ nodes: setNodeFailed(s.nodes, id, failed) }, id)
    }
    const current = s.edges.find((e) => e.id === id)
    if (!current) return fail(`Unknown edge '${id}'.`)
    if ((current.data?.failed ?? false) === failed) return ok(id)
    return commit({ edges: setEdgeFailed(s.edges, id, failed) }, id)
  }

  return {
    ...initialGraph(),
    viewport: null,
    selectedNodeId: null,
    selectedEdgeId: null,
    past: [],
    future: [],
    randomDraw: 0,
    lastRandom: null,
    dragging: false,

    addNode: ({ nodeType, id, label, position }) => {
      const s = get()
      if (s.nodes.length >= MAX_NODES) return fail(`A network can have at most ${MAX_NODES} nodes.`)
      const nodeId = id ?? nextId(`${nodeType}-`, s.nodes.map((n) => n.id))
      const problem = checkId(nodeId, 'Node') ?? (label !== undefined ? checkLabel(label) : null)
      if (problem) return fail(problem)
      if (s.nodes.some((n) => n.id === nodeId)) return fail(`Node id '${nodeId}' is already used.`)
      const count = s.nodes.filter((n) => n.data.nodeType === nodeType).length
      const node: EditorNode = {
        id: nodeId,
        type: 'netshieldNode',
        position: position ?? { x: 200 + (s.nodes.length % 5) * 90, y: 150 + Math.floor(s.nodes.length / 5) * 90 },
        data: { label: label ?? `${TYPE_LABELS[nodeType]} ${count + 1}`, nodeType, failed: false },
      }
      return commit({ nodes: [...s.nodes, node], selectedNodeId: nodeId, selectedEdgeId: null }, nodeId)
    },

    updateNode: (id, patch) => {
      const s = get()
      if (!s.nodes.some((n) => n.id === id)) return fail(`Unknown node '${id}'.`)
      if (patch.label !== undefined) {
        const problem = checkLabel(patch.label)
        if (problem) return fail(problem)
      }
      return commit({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)) }, id)
    },

    removeNode: (id) => {
      const s = get()
      if (!s.nodes.some((n) => n.id === id)) return fail(`Unknown node '${id}'.`)
      const edges = s.edges.filter((e) => e.source !== id && e.target !== id)
      return commit({
        nodes: s.nodes.filter((n) => n.id !== id),
        edges,
        selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
        selectedEdgeId: s.selectedEdgeId !== null && edges.some((e) => e.id === s.selectedEdgeId) ? s.selectedEdgeId : null,
      })
    },

    addEdge: ({ source, target, id, weight, failureProbability }) => {
      const s = get()
      const edgeId = id ?? nextId(`e-${source}-${target}-`, s.edges.map((e) => e.id))
      const problem =
        checkNewEdge(s.nodes, s.edges, source, target, edgeId) ??
        (weight !== undefined ? checkWeight(weight) : null) ??
        (failureProbability !== undefined ? checkProbability(failureProbability) : null)
      if (problem) return fail(problem)
      const data: EditorEdgeData = { failed: false }
      if (weight !== undefined) data.weight = weight
      if (failureProbability !== undefined) data.failureProbability = failureProbability
      return commit({ edges: [...s.edges, { id: edgeId, source, target, type: 'netshieldEdge', data }] }, edgeId)
    },

    updateEdge: (id, patch) => {
      const s = get()
      const current = s.edges.find((e) => e.id === id)
      if (!current) return fail(`Unknown edge '${id}'.`)
      const problem =
        (patch.weight != null ? checkWeight(patch.weight) : null) ??
        (patch.failureProbability != null ? checkProbability(patch.failureProbability) : null)
      if (problem) return fail(problem)
      const data: EditorEdgeData = { ...(current.data ?? { failed: false }) }
      if (patch.weight === null) delete data.weight
      else if (patch.weight !== undefined) data.weight = patch.weight
      if (patch.failureProbability === null) delete data.failureProbability
      else if (patch.failureProbability !== undefined) data.failureProbability = patch.failureProbability
      return commit({ edges: s.edges.map((e) => (e.id === id ? { ...e, data } : e)) }, id)
    },

    removeEdge: (id) => {
      const s = get()
      if (!s.edges.some((e) => e.id === id)) return fail(`Unknown edge '${id}'.`)
      return commit({
        edges: s.edges.filter((e) => e.id !== id),
        selectedEdgeId: s.selectedEdgeId === id ? null : s.selectedEdgeId,
      })
    },

    removeSelected: () => {
      const { selectedNodeId, selectedEdgeId, removeNode, removeEdge } = get()
      if (selectedNodeId) return removeNode(selectedNodeId)
      if (selectedEdgeId) return removeEdge(selectedEdgeId)
      return fail('Nothing is selected.')
    },

    applyNodeChanges: (changes) => {
      for (const change of changes) if (change.type === 'remove') get().removeNode(change.id)
      const rest = changes.filter((c) => c.type === 'position' || c.type === 'dimensions')
      if (rest.length === 0) return
      set((s) => {
        const dragStart = !s.dragging && rest.some((c) => c.type === 'position' && c.dragging === true)
        const dragEnd = rest.some((c) => c.type === 'position' && c.dragging === false)
        const nodes = applyNodeChanges(rest, s.nodes)
        const next: Partial<GraphState> = { nodes, dragging: dragEnd ? false : s.dragging || dragStart }
        // One history entry per drag: the graph as it was before the drag started.
        return dragStart ? withHistory(s, next) : next
      })
    },

    moveNodes: (positions) => {
      const s = get()
      const moved = (n: EditorNode) => {
        const p = positions[n.id]
        return p !== undefined && (p.x !== n.position.x || p.y !== n.position.y)
      }
      if (!s.nodes.some(moved)) return
      commit({ nodes: s.nodes.map((n) => (moved(n) ? { ...n, position: positions[n.id] } : n)) })
    },

    setViewport: (viewport) => {
      const v = get().viewport
      if (v && v.x === viewport.x && v.y === viewport.y && v.zoom === viewport.zoom) return
      set({ viewport })
    },

    selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
    selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

    failNode: (id) => setFailure('node', id, true),
    restoreNode: (id) => setFailure('node', id, false),
    toggleNodeFailure: (id) => setFailure('node', id, !(get().nodes.find((n) => n.id === id)?.data.failed ?? true)),
    failEdge: (id) => setFailure('edge', id, true),
    restoreEdge: (id) => setFailure('edge', id, false),
    toggleEdgeFailure: (id) => setFailure('edge', id, !(get().edges.find((e) => e.id === id)?.data?.failed ?? true)),
    clearFailures: () => {
      const s = get()
      if (!s.nodes.some((n) => n.data.failed) && !s.edges.some((e) => e.data?.failed)) return
      commit({
        nodes: s.nodes.map((n) => (n.data.failed ? { ...n, data: { ...n.data, failed: false } } : n)),
        edges: s.edges.map((e) => (e.data?.failed ? { ...e, data: { ...e.data, failed: false } } : e)),
      })
    },

    failRandom: (seed) => {
      if (!Number.isInteger(seed) || seed < 0) return fail('Seed must be a whole number, 0 or more.')
      const s = get()
      const draw = s.randomDraw + 1
      const pick = pickRandomOperational(s, seed, draw)
      if (!pick) return fail('Nothing is left to fail: no node or link is operational.')
      // One commit: the history entry holds the draw state from before this pick.
      const failed = pick.kind === 'node' ? { nodes: setNodeFailed(s.nodes, pick.id, true) } : { edges: setEdgeFailed(s.edges, pick.id, true) }
      return commit({ ...failed, randomDraw: draw, lastRandom: { ...pick, seed, draw } }, pick.id)
    },

    undo: () => {
      const s = get()
      const previous = s.past[s.past.length - 1]
      if (!previous) return false
      set({ ...previous, past: s.past.slice(0, -1), future: [snapshot(s), ...s.future], ...keepSelection(previous, s) })
      return true
    },

    redo: () => {
      const s = get()
      const next = s.future[0]
      if (!next) return false
      set({ ...next, past: [...s.past, snapshot(s)], future: s.future.slice(1), ...keepSelection(next, s) })
      return true
    },

    loadPreset: (name) => {
      commit({ ...preset(name), example: name, selectedNodeId: null, selectedEdgeId: null })
    },

    replaceGraph: (graph, example = null) => {
      const problem = checkGraph(graph)
      if (problem) return fail(problem)
      set({ nodes: graph.nodes, edges: graph.edges, example, selectedNodeId: null, selectedEdgeId: null, past: [], future: [], dragging: false })
      return ok()
    },

    reset: () => {
      commit({ nodes: [], edges: [], example: null, selectedNodeId: null, selectedEdgeId: null })
    },
  }
})

/** Drop a selection that no longer exists after undo or redo. */
function keepSelection(graph: EditorGraph, s: GraphState): Pick<GraphState, 'selectedNodeId' | 'selectedEdgeId'> {
  return {
    selectedNodeId: s.selectedNodeId !== null && graph.nodes.some((n) => n.id === s.selectedNodeId) ? s.selectedNodeId : null,
    selectedEdgeId: s.selectedEdgeId !== null && graph.edges.some((e) => e.id === s.selectedEdgeId) ? s.selectedEdgeId : null,
  }
}

/** Back to the initial state (the star example, empty history). Used by tests and clearSavedData. */
export function resetGraphStore(): void {
  useGraphStore.setState({ ...initialGraph(), viewport: null, selectedNodeId: null, selectedEdgeId: null, past: [], future: [], randomDraw: 0, lastRandom: null, dragging: false })
}
