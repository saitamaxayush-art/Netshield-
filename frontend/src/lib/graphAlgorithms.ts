/**
 * Graph Theory Pure Algorithms for NetShield
 *
 * Implements deterministic graph analysis and Monte Carlo failure simulation.
 * Incident Edge Semantic:
 * When a node is failed, all edges incident to it are filtered out during active
 * graph construction. Stored edge failure states are preserved independently.
 */

export interface PureNode {
  id: string
  label: string
  type?: string
}

export interface PureEdge {
  id: string
  source: string
  target: string
}

export interface ActiveGraph {
  activeNodes: Set<string>
  activeEdges: PureEdge[]
  adjacency: Map<string, string[]>
}

/**
 * Filter graph to active elements according to failure rules:
 * 1. Node in failedNodeIds is inactive.
 * 2. Edge in failedEdgeIds is inactive.
 * 3. Edge connected to an inactive node is inactive.
 */
export function buildActiveGraph(
  nodes: PureNode[],
  edges: PureEdge[],
  failedNodeIds: Set<string>,
  failedEdgeIds: Set<string>
): ActiveGraph {
  const activeNodes = new Set<string>()
  for (const n of nodes) {
    if (!failedNodeIds.has(n.id)) {
      activeNodes.add(n.id)
    }
  }

  const activeEdges: PureEdge[] = []
  const adjacency = new Map<string, string[]>()
  for (const nodeId of activeNodes) {
    adjacency.set(nodeId, [])
  }

  for (const e of edges) {
    if (failedEdgeIds.has(e.id)) continue
    if (!activeNodes.has(e.source) || !activeNodes.has(e.target)) continue

    activeEdges.push(e)
    adjacency.get(e.source)?.push(e.target)
    adjacency.get(e.target)?.push(e.source)
  }

  return { activeNodes, activeEdges, adjacency }
}

/**
 * Connected components using iterative BFS/DFS.
 * Returns array of component arrays, each containing node IDs.
 */
export function findConnectedComponents(active: ActiveGraph): string[][] {
  const visited = new Set<string>()
  const components: string[][] = []

  for (const node of active.activeNodes) {
    if (!visited.has(node)) {
      const comp: string[] = []
      const queue: string[] = [node]
      visited.add(node)

      while (queue.length > 0) {
        const curr = queue.shift()!
        comp.push(curr)
        const neighbors = active.adjacency.get(curr) || []
        for (const nbr of neighbors) {
          if (!visited.has(nbr)) {
            visited.add(nbr)
            queue.push(nbr)
          }
        }
      }
      components.push(comp)
    }
  }

  return components
}

/**
 * Find Bridges using Tarjan's bridge-finding algorithm (O(V + E)).
 * A bridge is an edge whose removal strictly increases the number of connected components.
 */
export function findBridges(active: ActiveGraph): Array<[string, string]> {
  const disc = new Map<string, number>()
  const low = new Map<string, number>()
  let time = 0
  const bridges: Array<[string, string]> = []

  function dfs(u: string, parent: string | null) {
    disc.set(u, ++time)
    low.set(u, time)

    const neighbors = active.adjacency.get(u) || []
    for (const v of neighbors) {
      if (v === parent) continue

      if (disc.has(v)) {
        low.set(u, Math.min(low.get(u)!, disc.get(v)!))
      } else {
        dfs(v, u)
        low.set(u, Math.min(low.get(u)!, low.get(v)!))

        // Bridge condition: low[v] > disc[u]
        if (low.get(v)! > disc.get(u)!) {
          // Normalize ordering [u, v] where u < v lexicographically
          const bridge: [string, string] = u < v ? [u, v] : [v, u]
          bridges.push(bridge)
        }
      }
    }
  }

  for (const node of active.activeNodes) {
    if (!disc.has(node)) {
      dfs(node, null)
    }
  }

  return bridges
}

/**
 * Find Articulation Points (Cut Vertices) using Tarjan's algorithm (O(V + E)).
 * An articulation point is a vertex whose removal strictly increases the number of components.
 */
export function findArticulationPoints(active: ActiveGraph): string[] {
  const disc = new Map<string, number>()
  const low = new Map<string, number>()
  const isCut = new Set<string>()
  let time = 0

  function dfs(u: string, parent: string | null) {
    let children = 0
    disc.set(u, ++time)
    low.set(u, time)

    const neighbors = active.adjacency.get(u) || []
    for (const v of neighbors) {
      if (v === parent) continue

      if (disc.has(v)) {
        low.set(u, Math.min(low.get(u)!, disc.get(v)!))
      } else {
        children++
        dfs(v, u)
        low.set(u, Math.min(low.get(u)!, low.get(v)!))

        // Root with two or more children is an articulation point
        if (parent === null && children > 1) {
          isCut.add(u)
        }

        // Non-root u where child v cannot reach ancestors of u
        if (parent !== null && low.get(v)! >= disc.get(u)!) {
          isCut.add(u)
        }
      }
    }
  }

  for (const node of active.activeNodes) {
    if (!disc.has(node)) {
      dfs(node, null)
    }
  }

  return Array.from(isCut)
}

/**
 * Calculate Node Degrees
 */
export function calculateNodeDegrees(active: ActiveGraph): Record<string, number> {
  const degrees: Record<string, number> = {}
  for (const node of active.activeNodes) {
    degrees[node] = active.adjacency.get(node)?.length || 0
  }
  return degrees
}

/**
 * BFS Traversal Order starting from startNode
 */
export function bfsTraversal(active: ActiveGraph, startNode: string): string[] {
  if (!active.activeNodes.has(startNode)) return []
  const visited = new Set<string>([startNode])
  const queue = [startNode]
  const order: string[] = []

  while (queue.length > 0) {
    const curr = queue.shift()!
    order.push(curr)
    const neighbors = active.adjacency.get(curr) || []
    for (const nbr of neighbors) {
      if (!visited.has(nbr)) {
        visited.add(nbr)
        queue.push(nbr)
      }
    }
  }

  return order
}

/**
 * DFS Traversal Order starting from startNode
 */
export function dfsTraversal(active: ActiveGraph, startNode: string): string[] {
  if (!active.activeNodes.has(startNode)) return []
  const visited = new Set<string>()
  const order: string[] = []

  function dfs(u: string) {
    visited.add(u)
    order.push(u)
    const neighbors = active.adjacency.get(u) || []
    for (const nbr of neighbors) {
      if (!visited.has(nbr)) {
        dfs(nbr)
      }
    }
  }

  dfs(startNode)
  return order
}

/**
 * Shortest unweighted path between source and target using BFS
 */
export function findShortestPath(active: ActiveGraph, source: string, target: string): string[] | null {
  if (!active.activeNodes.has(source) || !active.activeNodes.has(target)) return null
  if (source === target) return [source]

  const visited = new Set<string>([source])
  const parent = new Map<string, string>()
  const queue = [source]

  let found = false
  while (queue.length > 0) {
    const curr = queue.shift()!
    if (curr === target) {
      found = true
      break
    }
    const neighbors = active.adjacency.get(curr) || []
    for (const nbr of neighbors) {
      if (!visited.has(nbr)) {
        visited.add(nbr)
        parent.set(nbr, curr)
        queue.push(nbr)
      }
    }
  }

  if (!found) return null

  const path: string[] = []
  let curr: string | undefined = target
  while (curr) {
    path.unshift(curr)
    curr = parent.get(curr)
  }
  return path
}

/**
 * Graph Density: 2 * |E| / (|V| * (|V| - 1)) for undirected simple graphs
 */
export function calculateDensity(nodeCount: number, edgeCount: number): number {
  if (nodeCount <= 1) return 0
  const maxEdges = (nodeCount * (nodeCount - 1)) / 2
  return Number((edgeCount / maxEdges).toFixed(4))
}

/**
 * Monte Carlo Simulation of Component Failures
 */
export function simulateReliability(
  nodes: PureNode[],
  edges: PureEdge[],
  baselineFailedNodes: string[],
  baselineFailedEdges: string[],
  failureProb: number,
  trials: number,
  failTarget: 'nodes' | 'edges' | 'both',
  // Deterministic seedable PRNG optional function
  randomFn: () => number = Math.random
) {
  const startTime = performance.now()
  let connectedTrials = 0
  const activeComponentsDist: Record<number, number> = {}

  for (let t = 0; t < trials; t++) {
    const failedNodes = new Set<string>(baselineFailedNodes)
    const failedEdges = new Set<string>(baselineFailedEdges)

    if (failTarget === 'nodes' || failTarget === 'both') {
      for (const n of nodes) {
        if (!failedNodes.has(n.id) && randomFn() < failureProb) {
          failedNodes.add(n.id)
        }
      }
    }

    if (failTarget === 'edges' || failTarget === 'both') {
      for (const e of edges) {
        if (!failedEdges.has(e.id) && randomFn() < failureProb) {
          failedEdges.add(e.id)
        }
      }
    }

    const active = buildActiveGraph(nodes, edges, failedNodes, failedEdges)
    const comps = findConnectedComponents(active)
    const compCount = comps.length

    activeComponentsDist[compCount] = (activeComponentsDist[compCount] || 0) + 1

    // If active nodes > 0 and compCount is 1, it remained connected
    if (active.activeNodes.size > 0 && compCount === 1) {
      connectedTrials++
    }
  }

  const p = trials > 0 ? connectedTrials / trials : 0
  const se = trials > 0 ? Math.sqrt((p * (1 - p)) / trials) : 0
  const margin = 1.96 * se
  const ciLow = Math.max(0, Number((p - margin).toFixed(4)))
  const ciHigh = Math.min(1, Number((p + margin).toFixed(4)))
  const executionTimeMs = Number((performance.now() - startTime).toFixed(2))

  return {
    trials,
    connected_trials: connectedTrials,
    estimated_reliability: Number(p.toFixed(4)),
    standard_error: Number(se.toFixed(4)),
    confidence_interval_95: [ciLow, ciHigh] as [number, number],
    failure_probability: failureProb,
    fail_target: failTarget,
    active_components_distribution: Object.fromEntries(
      Object.entries(activeComponentsDist).map(([k, v]) => [k, Number(v)])
    ),
    execution_time_ms: executionTimeMs,
  }
}
