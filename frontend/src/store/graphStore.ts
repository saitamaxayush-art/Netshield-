import { create } from 'zustand'
import type { Node, Edge, Connection } from '@xyflow/react'
import type { NodeType, ElementStatus } from '@/types/graph'
import type { AnalyzeResponse, SimulateResponse, ReliabilitySweepResponse } from '@/types/api'
import { apiService } from '@/services/api'

export const STORAGE_KEY = 'netshield_graph_state_v1'

export interface NetShieldNodeData extends Record<string, unknown> {
  label: string
  nodeType: NodeType
  status: ElementStatus
  failureProb?: number
  componentIndex?: number
  isArticulationPoint?: boolean
}

export interface NetShieldEdgeData extends Record<string, unknown> {
  status: ElementStatus
  weight?: number
  failureProb?: number
  isBridge?: boolean
}

export type NetShieldNode = Node<NetShieldNodeData>
export type NetShieldEdge = Edge<NetShieldEdgeData>

export interface SimulationConfig {
  trials: number
  failureProb: number
  failTarget: 'nodes' | 'edges' | 'both'
}

interface GraphStoreState {
  // Graph Canvas State
  nodes: NetShieldNode[]
  edges: NetShieldEdge[]
  selectedNodeId: string | null
  selectedEdgeId: string | null
  failedNodeIds: string[]
  failedEdgeIds: string[]

  // Simulation parameters
  simulationConfig: SimulationConfig

  // Authoritative Analysis State
  analysisResult: AnalyzeResponse | null
  isAnalyzing: boolean
  analysisError: string | null

  // Authoritative Simulation State
  simulationResult: SimulateResponse | null
  isSimulating: boolean
  simulationError: string | null

  // Reliability Sweep State
  sweepResult: ReliabilitySweepResponse | null
  isSweeping: boolean
  sweepError: string | null

  // Graph actions
  setNodes: (nodes: NetShieldNode[] | ((prev: NetShieldNode[]) => NetShieldNode[])) => void
  setEdges: (edges: NetShieldEdge[] | ((prev: NetShieldEdge[]) => NetShieldEdge[])) => void
  addNode: (nodeType: NodeType, position?: { x: number; y: number }) => void
  updateNodeData: (id: string, data: Partial<NetShieldNodeData>) => void
  removeSelected: () => void
  deleteNode: (id: string) => void
  deleteEdge: (id: string) => void
  onConnect: (connection: Connection) => void
  selectNode: (id: string | null) => void
  selectEdge: (id: string | null) => void

  // Failure controls
  failNode: (id: string) => void
  restoreNode: (id: string) => void
  toggleNodeFailure: (id: string) => void
  failEdge: (id: string) => void
  restoreEdge: (id: string) => void
  toggleEdgeFailure: (id: string) => void
  resetFailures: () => void

  // Topology templates
  loadExample: (topology: 'star' | 'ring' | 'mesh') => void
  resetGraph: () => void

  // Settings
  setSimulationConfig: (cfg: Partial<SimulationConfig>) => void

  // Backend / Demo calls
  runAnalysis: (startNode?: string | null, targetNode?: string | null) => Promise<void>
  runSimulation: () => Promise<void>
  runSweep: () => Promise<void>

  // Persistence
  clearSavedData: () => void
}

/**
 * Default Star Topology Example
 */
const createStarTopology = (): { nodes: NetShieldNode[]; edges: NetShieldEdge[] } => {
  const nodes: NetShieldNode[] = [
    {
      id: 'hub_1',
      type: 'netshieldNode',
      position: { x: 400, y: 250 },
      data: { label: 'Core Router', nodeType: 'router', status: 'healthy' },
    },
    {
      id: 'srv_1',
      type: 'netshieldNode',
      position: { x: 400, y: 80 },
      data: { label: 'Primary Server', nodeType: 'server', status: 'healthy' },
    },
    {
      id: 'fw_1',
      type: 'netshieldNode',
      position: { x: 180, y: 250 },
      data: { label: 'Border Firewall', nodeType: 'firewall', status: 'healthy' },
    },
    {
      id: 'cli_1',
      type: 'netshieldNode',
      position: { x: 620, y: 160 },
      data: { label: 'Client Alpha', nodeType: 'client', status: 'healthy' },
    },
    {
      id: 'cli_2',
      type: 'netshieldNode',
      position: { x: 580, y: 380 },
      data: { label: 'Client Beta', nodeType: 'client', status: 'healthy' },
    },
    {
      id: 'cli_3',
      type: 'netshieldNode',
      position: { x: 260, y: 400 },
      data: { label: 'Client Gamma', nodeType: 'client', status: 'healthy' },
    },
  ]

  const edges: NetShieldEdge[] = [
    { id: 'e_hub_srv', source: 'hub_1', target: 'srv_1', type: 'netshieldEdge', data: { status: 'healthy' } },
    { id: 'e_hub_fw', source: 'hub_1', target: 'fw_1', type: 'netshieldEdge', data: { status: 'healthy' } },
    { id: 'e_hub_cli1', source: 'hub_1', target: 'cli_1', type: 'netshieldEdge', data: { status: 'healthy' } },
    { id: 'e_hub_cli2', source: 'hub_1', target: 'cli_2', type: 'netshieldEdge', data: { status: 'healthy' } },
    { id: 'e_hub_cli3', source: 'hub_1', target: 'cli_3', type: 'netshieldEdge', data: { status: 'healthy' } },
    { id: 'e_cli1_cli2', source: 'cli_1', target: 'cli_2', type: 'netshieldEdge', data: { status: 'healthy' } },
  ]

  return { nodes, edges }
}

const createRingTopology = (): { nodes: NetShieldNode[]; edges: NetShieldEdge[] } => {
  const ids = ['ring_1', 'ring_2', 'ring_3', 'ring_4', 'ring_5', 'ring_6']
  const types: NodeType[] = ['router', 'server', 'router', 'client', 'firewall', 'client']
  const labels = ['Router A', 'Server 1', 'Router B', 'Client 1', 'Firewall GW', 'Client 2']
  const radius = 200
  const cx = 400
  const cy = 250

  const nodes: NetShieldNode[] = ids.map((id, i) => {
    const angle = (i * 2 * Math.PI) / ids.length - Math.PI / 2
    return {
      id,
      type: 'netshieldNode',
      position: {
        x: Math.round(cx + radius * Math.cos(angle)),
        y: Math.round(cy + radius * Math.sin(angle)),
      },
      data: { label: labels[i], nodeType: types[i], status: 'healthy' },
    }
  })

  const edges: NetShieldEdge[] = ids.map((id, i) => {
    const nextId = ids[(i + 1) % ids.length]
    return {
      id: `e_${id}_${nextId}`,
      source: id,
      target: nextId,
      type: 'netshieldEdge',
      data: { status: 'healthy' },
    }
  })

  return { nodes, edges }
}

const createMeshTopology = (): { nodes: NetShieldNode[]; edges: NetShieldEdge[] } => {
  const nodes: NetShieldNode[] = [
    { id: 'm_r1', type: 'netshieldNode', position: { x: 220, y: 140 }, data: { label: 'Gateway 1', nodeType: 'firewall', status: 'healthy' } },
    { id: 'm_r2', type: 'netshieldNode', position: { x: 420, y: 110 }, data: { label: 'Core Router 1', nodeType: 'router', status: 'healthy' } },
    { id: 'm_r3', type: 'netshieldNode', position: { x: 620, y: 140 }, data: { label: 'Gateway 2', nodeType: 'firewall', status: 'healthy' } },
    { id: 'm_s1', type: 'netshieldNode', position: { x: 300, y: 320 }, data: { label: 'Database Cluster', nodeType: 'server', status: 'healthy' } },
    { id: 'm_s2', type: 'netshieldNode', position: { x: 540, y: 320 }, data: { label: 'Application Cluster', nodeType: 'server', status: 'healthy' } },
    { id: 'm_c1', type: 'netshieldNode', position: { x: 420, y: 440 }, data: { label: 'Aggregation Switch', nodeType: 'router', status: 'healthy' } },
  ]

  const edges: NetShieldEdge[] = [
    { id: 'em_1', source: 'm_r1', target: 'm_r2', type: 'netshieldEdge', data: { status: 'healthy' } },
    { id: 'em_2', source: 'm_r2', target: 'm_r3', type: 'netshieldEdge', data: { status: 'healthy' } },
    { id: 'em_3', source: 'm_r1', target: 'm_s1', type: 'netshieldEdge', data: { status: 'healthy' } },
    { id: 'em_4', source: 'm_r2', target: 'm_s1', type: 'netshieldEdge', data: { status: 'healthy' } },
    { id: 'em_5', source: 'm_r2', target: 'm_s2', type: 'netshieldEdge', data: { status: 'healthy' } },
    { id: 'em_6', source: 'm_r3', target: 'm_s2', type: 'netshieldEdge', data: { status: 'healthy' } },
    { id: 'em_7', source: 'm_s1', target: 'm_s2', type: 'netshieldEdge', data: { status: 'healthy' } },
    { id: 'em_8', source: 'm_s1', target: 'm_c1', type: 'netshieldEdge', data: { status: 'healthy' } },
    { id: 'em_9', source: 'm_s2', target: 'm_c1', type: 'netshieldEdge', data: { status: 'healthy' } },
  ]

  return { nodes, edges }
}

/**
 * Load initial state safely from localStorage
 */
function loadPersistedState(): {
  nodes: NetShieldNode[]
  edges: NetShieldEdge[]
  failedNodeIds: string[]
  failedEdgeIds: string[]
  simulationConfig: SimulationConfig
} {
  const fallback = {
    ...createStarTopology(),
    failedNodeIds: [] as string[],
    failedEdgeIds: [] as string[],
    simulationConfig: {
      trials: 500,
      failureProb: 0.15,
      failTarget: 'edges' as const,
    },
  }

  if (typeof window === 'undefined') return fallback

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
      return {
        nodes: parsed.nodes,
        edges: parsed.edges,
        failedNodeIds: Array.isArray(parsed.failedNodeIds) ? parsed.failedNodeIds : [],
        failedEdgeIds: Array.isArray(parsed.failedEdgeIds) ? parsed.failedEdgeIds : [],
        simulationConfig: parsed.simulationConfig || fallback.simulationConfig,
      }
    }
  } catch {
    // Ignore corrupt storage, fallback safely
  }
  return fallback
}

/**
 * Persist state safely to localStorage
 */
function saveStateToStorage(state: {
  nodes: NetShieldNode[]
  edges: NetShieldEdge[]
  failedNodeIds: string[]
  failedEdgeIds: string[]
  simulationConfig: SimulationConfig
}) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        nodes: state.nodes,
        edges: state.edges,
        failedNodeIds: state.failedNodeIds,
        failedEdgeIds: state.failedEdgeIds,
        simulationConfig: state.simulationConfig,
        version: 1,
      })
    )
  } catch {
    // Storage quota or restriction handled silently
  }
}

const initialState = loadPersistedState()

export const useGraphStore = create<GraphStoreState>((set, get) => ({
  nodes: initialState.nodes,
  edges: initialState.edges,
  selectedNodeId: null,
  selectedEdgeId: null,
  failedNodeIds: initialState.failedNodeIds,
  failedEdgeIds: initialState.failedEdgeIds,
  simulationConfig: initialState.simulationConfig,

  analysisResult: null,
  isAnalyzing: false,
  analysisError: null,

  simulationResult: null,
  isSimulating: false,
  simulationError: null,

  sweepResult: null,
  isSweeping: false,
  sweepError: null,

  setNodes: (updater) => {
    set((state) => {
      const nextNodes = typeof updater === 'function' ? updater(state.nodes) : updater
      saveStateToStorage({
        nodes: nextNodes,
        edges: state.edges,
        failedNodeIds: state.failedNodeIds,
        failedEdgeIds: state.failedEdgeIds,
        simulationConfig: state.simulationConfig,
      })
      return { nodes: nextNodes }
    })
  },

  setEdges: (updater) => {
    set((state) => {
      const nextEdges = typeof updater === 'function' ? updater(state.edges) : updater
      saveStateToStorage({
        nodes: state.nodes,
        edges: nextEdges,
        failedNodeIds: state.failedNodeIds,
        failedEdgeIds: state.failedEdgeIds,
        simulationConfig: state.simulationConfig,
      })
      return { edges: nextEdges }
    })
  },

  addNode: (nodeType: NodeType, position) => {
    set((state) => {
      const id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const typeLabels: Record<NodeType, string> = {
        router: 'Router Node',
        server: 'Compute Server',
        client: 'Workstation',
        firewall: 'Security Gateway',
      }

      const newNode: NetShieldNode = {
        id,
        type: 'netshieldNode',
        position: position || {
          x: 200 + (state.nodes.length % 5) * 80,
          y: 150 + Math.floor(state.nodes.length / 5) * 80,
        },
        data: {
          label: `${typeLabels[nodeType]} ${state.nodes.length + 1}`,
          nodeType,
          status: 'healthy',
        },
      }

      const nextNodes = [...state.nodes, newNode]
      saveStateToStorage({
        nodes: nextNodes,
        edges: state.edges,
        failedNodeIds: state.failedNodeIds,
        failedEdgeIds: state.failedEdgeIds,
        simulationConfig: state.simulationConfig,
      })
      return { nodes: nextNodes, selectedNodeId: id, selectedEdgeId: null }
    })
  },

  updateNodeData: (id, data) => {
    set((state) => {
      const nextNodes = state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...data } } : n
      )
      saveStateToStorage({
        nodes: nextNodes,
        edges: state.edges,
        failedNodeIds: state.failedNodeIds,
        failedEdgeIds: state.failedEdgeIds,
        simulationConfig: state.simulationConfig,
      })
      return { nodes: nextNodes }
    })
  },

  removeSelected: () => {
    const { selectedNodeId, selectedEdgeId, deleteNode, deleteEdge } = get()
    if (selectedNodeId) {
      deleteNode(selectedNodeId)
    } else if (selectedEdgeId) {
      deleteEdge(selectedEdgeId)
    }
  },

  deleteNode: (id) => {
    set((state) => {
      const nextNodes = state.nodes.filter((n) => n.id !== id)
      // Remove incident edges as well
      const nextEdges = state.edges.filter((e) => e.source !== id && e.target !== id)
      const nextFailedNodes = state.failedNodeIds.filter((fn) => fn !== id)

      saveStateToStorage({
        nodes: nextNodes,
        edges: nextEdges,
        failedNodeIds: nextFailedNodes,
        failedEdgeIds: state.failedEdgeIds,
        simulationConfig: state.simulationConfig,
      })

      return {
        nodes: nextNodes,
        edges: nextEdges,
        failedNodeIds: nextFailedNodes,
        selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      }
    })
  },

  deleteEdge: (id) => {
    set((state) => {
      const nextEdges = state.edges.filter((e) => e.id !== id)
      const nextFailedEdges = state.failedEdgeIds.filter((fe) => fe !== id)

      saveStateToStorage({
        nodes: state.nodes,
        edges: nextEdges,
        failedNodeIds: state.failedNodeIds,
        failedEdgeIds: nextFailedEdges,
        simulationConfig: state.simulationConfig,
      })

      return {
        edges: nextEdges,
        failedEdgeIds: nextFailedEdges,
        selectedEdgeId: state.selectedEdgeId === id ? null : state.selectedEdgeId,
      }
    })
  },

  onConnect: (connection) => {
    set((state) => {
      if (!connection.source || !connection.target) return state
      // Prevent self-loops
      if (connection.source === connection.target) return state

      // Prevent duplicate edges (undirected simple graph semantics)
      const exists = state.edges.some(
        (e) =>
          (e.source === connection.source && e.target === connection.target) ||
          (e.source === connection.target && e.target === connection.source)
      )
      if (exists) return state

      const newEdge: NetShieldEdge = {
        id: `e_${connection.source}_${connection.target}_${Date.now()}`,
        source: connection.source,
        target: connection.target,
        type: 'netshieldEdge',
        data: { status: 'healthy' },
      }

      const nextEdges = [...state.edges, newEdge]
      saveStateToStorage({
        nodes: state.nodes,
        edges: nextEdges,
        failedNodeIds: state.failedNodeIds,
        failedEdgeIds: state.failedEdgeIds,
        simulationConfig: state.simulationConfig,
      })
      return { edges: nextEdges }
    })
  },

  selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),

  failNode: (id) => {
    set((state) => {
      if (state.failedNodeIds.includes(id)) return state
      const nextFailedNodes = [...state.failedNodeIds, id]
      const nextNodes = state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, status: 'failed' as ElementStatus } } : n
      )

      saveStateToStorage({
        nodes: nextNodes,
        edges: state.edges,
        failedNodeIds: nextFailedNodes,
        failedEdgeIds: state.failedEdgeIds,
        simulationConfig: state.simulationConfig,
      })
      return { nodes: nextNodes, failedNodeIds: nextFailedNodes }
    })
  },

  restoreNode: (id) => {
    set((state) => {
      const nextFailedNodes = state.failedNodeIds.filter((nid) => nid !== id)
      const nextNodes = state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, status: 'healthy' as ElementStatus } } : n
      )

      saveStateToStorage({
        nodes: nextNodes,
        edges: state.edges,
        failedNodeIds: nextFailedNodes,
        failedEdgeIds: state.failedEdgeIds,
        simulationConfig: state.simulationConfig,
      })
      return { nodes: nextNodes, failedNodeIds: nextFailedNodes }
    })
  },

  toggleNodeFailure: (id) => {
    const { failedNodeIds, failNode, restoreNode } = get()
    if (failedNodeIds.includes(id)) {
      restoreNode(id)
    } else {
      failNode(id)
    }
  },

  failEdge: (id) => {
    set((state) => {
      if (state.failedEdgeIds.includes(id)) return state
      const nextFailedEdges = [...state.failedEdgeIds, id]
      const nextEdges = state.edges.map((e) =>
        e.id === id ? { ...e, data: { ...e.data, status: 'failed' as ElementStatus } } : e
      )

      saveStateToStorage({
        nodes: state.nodes,
        edges: nextEdges,
        failedNodeIds: state.failedNodeIds,
        failedEdgeIds: nextFailedEdges,
        simulationConfig: state.simulationConfig,
      })
      return { edges: nextEdges, failedEdgeIds: nextFailedEdges }
    })
  },

  restoreEdge: (id) => {
    set((state) => {
      const nextFailedEdges = state.failedEdgeIds.filter((eid) => eid !== id)
      const nextEdges = state.edges.map((e) =>
        e.id === id ? { ...e, data: { ...e.data, status: 'healthy' as ElementStatus } } : e
      )

      saveStateToStorage({
        nodes: state.nodes,
        edges: nextEdges,
        failedNodeIds: state.failedNodeIds,
        failedEdgeIds: nextFailedEdges,
        simulationConfig: state.simulationConfig,
      })
      return { edges: nextEdges, failedEdgeIds: nextFailedEdges }
    })
  },

  toggleEdgeFailure: (id) => {
    const { failedEdgeIds, failEdge, restoreEdge } = get()
    if (failedEdgeIds.includes(id)) {
      restoreEdge(id)
    } else {
      failEdge(id)
    }
  },

  resetFailures: () => {
    set((state) => {
      const nextNodes = state.nodes.map((n) => ({
        ...n,
        data: { ...n.data, status: 'healthy' as ElementStatus },
      }))
      const nextEdges = state.edges.map((e) => ({
        ...e,
        data: { ...e.data, status: 'healthy' as ElementStatus },
      }))

      saveStateToStorage({
        nodes: nextNodes,
        edges: nextEdges,
        failedNodeIds: [],
        failedEdgeIds: [],
        simulationConfig: state.simulationConfig,
      })

      return {
        nodes: nextNodes,
        edges: nextEdges,
        failedNodeIds: [],
        failedEdgeIds: [],
      }
    })
  },

  loadExample: (topology) => {
    let example: { nodes: NetShieldNode[]; edges: NetShieldEdge[] }
    if (topology === 'ring') example = createRingTopology()
    else if (topology === 'mesh') example = createMeshTopology()
    else example = createStarTopology()

    set((state) => {
      saveStateToStorage({
        nodes: example.nodes,
        edges: example.edges,
        failedNodeIds: [],
        failedEdgeIds: [],
        simulationConfig: state.simulationConfig,
      })

      return {
        nodes: example.nodes,
        edges: example.edges,
        failedNodeIds: [],
        failedEdgeIds: [],
        selectedNodeId: null,
        selectedEdgeId: null,
        analysisResult: null,
        simulationResult: null,
        sweepResult: null,
      }
    })
  },

  resetGraph: () => {
    set((state) => {
      saveStateToStorage({
        nodes: [],
        edges: [],
        failedNodeIds: [],
        failedEdgeIds: [],
        simulationConfig: state.simulationConfig,
      })

      return {
        nodes: [],
        edges: [],
        failedNodeIds: [],
        failedEdgeIds: [],
        selectedNodeId: null,
        selectedEdgeId: null,
        analysisResult: null,
        simulationResult: null,
        sweepResult: null,
      }
    })
  },

  setSimulationConfig: (cfg) => {
    set((state) => {
      const nextConfig = { ...state.simulationConfig, ...cfg }
      saveStateToStorage({
        nodes: state.nodes,
        edges: state.edges,
        failedNodeIds: state.failedNodeIds,
        failedEdgeIds: state.failedEdgeIds,
        simulationConfig: nextConfig,
      })
      return { simulationConfig: nextConfig }
    })
  },

  runAnalysis: async (startNode, targetNode) => {
    const { nodes, edges, failedNodeIds, failedEdgeIds } = get()
    set({ isAnalyzing: true, analysisError: null })

    try {
      const req = {
        nodes: nodes.map((n) => ({ id: n.id, label: n.data.label, type: n.data.nodeType })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
        failed_nodes: failedNodeIds,
        failed_edges: failedEdgeIds,
        start_node: startNode || null,
        target_node: targetNode || null,
      }

      const result = await apiService.analyze(req)

      // Color nodes by connected component and flag articulation points / bridges
      const compMap = new Map<string, number>()
      result.connected_components.forEach((comp, idx) => {
        comp.forEach((nodeId) => compMap.set(nodeId, idx))
      })

      const artSet = new Set(result.articulation_points)
      const bridgeKeys = new Set(
        result.bridges.map(([u, v]) => (u < v ? `${u}-${v}` : `${v}-${u}`))
      )

      set((state) => ({
        analysisResult: result,
        isAnalyzing: false,
        nodes: state.nodes.map((n) => ({
          ...n,
          data: {
            ...n.data,
            componentIndex: compMap.get(n.id),
            isArticulationPoint: artSet.has(n.id),
          },
        })),
        edges: state.edges.map((e) => {
          const key = e.source < e.target ? `${e.source}-${e.target}` : `${e.target}-${e.source}`
          return {
            ...e,
            data: {
              status: e.data?.status ?? 'healthy',
              ...e.data,
              isBridge: bridgeKeys.has(key),
            },
          }
        }),
      }))
    } catch (err: unknown) {
      set({
        isAnalyzing: false,
        analysisError: err instanceof Error ? err.message : 'Analysis failed',
      })
    }
  },

  runSimulation: async () => {
    const { nodes, edges, failedNodeIds, failedEdgeIds, simulationConfig } = get()
    set({ isSimulating: true, simulationError: null })

    try {
      const req = {
        nodes: nodes.map((n) => ({ id: n.id, label: n.data.label })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
        failed_nodes: failedNodeIds,
        failed_edges: failedEdgeIds,
        failure_prob: simulationConfig.failureProb,
        trials: simulationConfig.trials,
        fail_target: simulationConfig.failTarget,
      }

      const res = await apiService.simulate(req)
      set({ simulationResult: res, isSimulating: false })
    } catch (err: unknown) {
      set({
        isSimulating: false,
        simulationError: err instanceof Error ? err.message : 'Simulation failed',
      })
    }
  },

  runSweep: async () => {
    const { nodes, edges, failedNodeIds, failedEdgeIds, simulationConfig } = get()
    set({ isSweeping: true, sweepError: null })

    try {
      const probs = [0.0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.75]
      const req = {
        nodes: nodes.map((n) => ({ id: n.id, label: n.data.label })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
        failed_nodes: failedNodeIds,
        failed_edges: failedEdgeIds,
        probs,
        trials_per_prob: 100,
        fail_target: simulationConfig.failTarget,
      }

      const res = await apiService.reliabilitySweep(req)
      set({ sweepResult: res, isSweeping: false })
    } catch (err: unknown) {
      set({
        isSweeping: false,
        sweepError: err instanceof Error ? err.message : 'Sweep failed',
      })
    }
  },

  clearSavedData: () => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        // Safe clear
      }
    }
    const defaultTopology = createStarTopology()
    set({
      nodes: defaultTopology.nodes,
      edges: defaultTopology.edges,
      selectedNodeId: null,
      selectedEdgeId: null,
      failedNodeIds: [],
      failedEdgeIds: [],
      analysisResult: null,
      simulationResult: null,
      sweepResult: null,
      simulationConfig: {
        trials: 500,
        failureProb: 0.15,
        failTarget: 'edges',
      },
    })
  },
}))
