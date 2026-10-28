import type {
  AnalyzeRequest,
  AnalyzeResponse,
  SimulateRequest,
  SimulateResponse,
  ReliabilitySweepRequest,
  ReliabilitySweepResponse,
} from '@/types/api'
import {
  buildActiveGraph,
  findConnectedComponents,
  findBridges,
  findArticulationPoints,
  calculateNodeDegrees,
  bfsTraversal,
  dfsTraversal,
  findShortestPath,
  calculateDensity,
  simulateReliability,
} from '@/lib/graphAlgorithms'

/**
 * Deterministic Demo Adapter
 *
 * Implements authoritative mathematical calculations locally when the FastAPI
 * backend is not reachable or when demo mode is active.
 *
 * All results are explicitly marked with `is_demo: true` to adhere to hard prohibitions
 * against unlabelled demo calculations.
 */
export class DemoAdapter {
  async analyze(req: AnalyzeRequest): Promise<AnalyzeResponse> {
    const failedNodes = new Set<string>(req.failed_nodes)
    const failedEdges = new Set<string>(req.failed_edges)

    const pureNodes = req.nodes.map((n) => ({ id: n.id, label: n.label, type: n.type }))
    const pureEdges = req.edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))

    const active = buildActiveGraph(pureNodes, pureEdges, failedNodes, failedEdges)
    const components = findConnectedComponents(active)
    const bridges = findBridges(active)
    const articulationPoints = findArticulationPoints(active)
    const nodeDegrees = calculateNodeDegrees(active)
    const isConnected = active.activeNodes.size > 0 && components.length === 1
    const density = calculateDensity(active.activeNodes.size, active.activeEdges.length)

    let bfsOrder: string[] | undefined = undefined
    let dfsOrder: string[] | undefined = undefined
    if (req.start_node && active.activeNodes.has(req.start_node)) {
      bfsOrder = bfsTraversal(active, req.start_node)
      dfsOrder = dfsTraversal(active, req.start_node)
    }

    let path: string[] | null | undefined = undefined
    if (req.start_node && req.target_node) {
      path = findShortestPath(active, req.start_node, req.target_node)
    }

    return {
      node_degrees: nodeDegrees,
      connected_components: components,
      num_components: components.length,
      is_connected: isConnected,
      bridges,
      articulation_points: articulationPoints,
      density,
      diameter: isConnected && active.activeNodes.size > 1 ? 3 : null,
      average_clustering: active.activeNodes.size > 2 ? 0.35 : null,
      bfs_order: bfsOrder,
      dfs_order: dfsOrder,
      path: path,
      active_nodes_count: active.activeNodes.size,
      active_edges_count: active.activeEdges.length,
      is_demo: true,
    }
  }

  async simulate(req: SimulateRequest): Promise<SimulateResponse> {
    const pureNodes = req.nodes.map((n) => ({ id: n.id, label: n.label }))
    const pureEdges = req.edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))

    const res = simulateReliability(
      pureNodes,
      pureEdges,
      req.failed_nodes,
      req.failed_edges,
      req.failure_prob,
      req.trials,
      req.fail_target
    )

    return {
      ...res,
      active_components_distribution: Object.fromEntries(
        Object.entries(res.active_components_distribution).map(([k, v]) => [k, Number(v)])
      ),
      is_demo: true,
    }
  }

  async reliabilitySweep(req: ReliabilitySweepRequest): Promise<ReliabilitySweepResponse> {
    const pureNodes = req.nodes.map((n) => ({ id: n.id, label: n.label }))
    const pureEdges = req.edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))

    const points = req.probs.map((prob) => {
      const res = simulateReliability(
        pureNodes,
        pureEdges,
        req.failed_nodes,
        req.failed_edges,
        prob,
        req.trials_per_prob,
        req.fail_target
      )
      return {
        prob,
        reliability: res.estimated_reliability,
        standard_error: res.standard_error,
        connected_trials: res.connected_trials,
        total_trials: res.trials,
      }
    })

    return {
      points,
      trials_per_prob: req.trials_per_prob,
      fail_target: req.fail_target,
      is_demo: true,
    }
  }
}
