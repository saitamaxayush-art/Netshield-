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

/**
 * BFS layers: distance (in hops) from startNode to every reachable node,
 * plus the visit order. Layer 0 is the start node.
 */
export function bfsLayers(
  active: ActiveGraph,
  startNode: string
): { order: string[]; layer: Map<string, number>; parent: Map<string, string> } {
  const layer = new Map<string, number>()
  const parent = new Map<string, string>()
  const order: string[] = []
  if (!active.activeNodes.has(startNode)) return { order, layer, parent }

  layer.set(startNode, 0)
  const queue = [startNode]
  let head = 0
  while (head < queue.length) {
    const curr = queue[head++]
    order.push(curr)
    for (const nbr of active.adjacency.get(curr) || []) {
      if (!layer.has(nbr)) {
        layer.set(nbr, layer.get(curr)! + 1)
        parent.set(nbr, curr)
        queue.push(nbr)
      }
    }
  }
  return { order, layer, parent }
}

export interface NetworkAnalysis {
  components: string[][]
  /** Node id to component index (components sorted largest first). */
  componentOf: Map<string, number>
  bridges: Array<[string, string]>
  /** Ids of the active edges that are bridges. */
  bridgeEdgeIds: Set<string>
  articulationPoints: Set<string>
  degrees: Record<string, number>
  isConnected: boolean
  activeNodeCount: number
  activeEdgeCount: number
  density: number
}

/**
 * One call summary used by every landing widget so they all share the
 * same definitions as the dashboard and demo adapter.
 */
export function analyzeNetwork(
  nodes: PureNode[],
  edges: PureEdge[],
  failedNodeIds: Set<string> = new Set(),
  failedEdgeIds: Set<string> = new Set()
): NetworkAnalysis {
  const active = buildActiveGraph(nodes, edges, failedNodeIds, failedEdgeIds)
  const components = findConnectedComponents(active).sort((a, b) => b.length - a.length)
  const componentOf = new Map<string, number>()
  components.forEach((comp, i) => comp.forEach((id) => componentOf.set(id, i)))

  const bridges = findBridges(active)
  const bridgeKeys = new Set(bridges.map(([u, v]) => `${u}|${v}`))
  const bridgeEdgeIds = new Set<string>()
  for (const e of active.activeEdges) {
    const key = e.source < e.target ? `${e.source}|${e.target}` : `${e.target}|${e.source}`
    if (bridgeKeys.has(key)) bridgeEdgeIds.add(e.id)
  }

  return {
    components,
    componentOf,
    bridges,
    bridgeEdgeIds,
    articulationPoints: new Set(findArticulationPoints(active)),
    degrees: calculateNodeDegrees(active),
    isConnected: active.activeNodes.size > 0 && components.length === 1,
    activeNodeCount: active.activeNodes.size,
    activeEdgeCount: active.activeEdges.length,
    density: calculateDensity(active.activeNodes.size, active.activeEdges.length),
  }
}

/** Union find connectivity check used by the trial runner (fast inner loop). */
function isConnectedUnderEdgeMask(
  nodeIndex: Map<string, number>,
  nodeCount: number,
  edges: PureEdge[],
  alive: (i: number) => boolean
): boolean {
  if (nodeCount <= 1) return nodeCount === 1
  const parent = new Int32Array(nodeCount)
  for (let i = 0; i < nodeCount; i++) parent[i] = i
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }
  let sets = nodeCount
  for (let i = 0; i < edges.length; i++) {
    if (!alive(i)) continue
    const a = find(nodeIndex.get(edges[i].source)!)
    const b = find(nodeIndex.get(edges[i].target)!)
    if (a !== b) {
      parent[a] = b
      if (--sets === 1) return true
    }
  }
  return sets === 1
}

export interface ReliabilityProgress {
  done: number
  connected: number
  estimate: number
  standardError: number
}

/**
 * Incremental all-terminal reliability estimator under independent edge
 * failures with probability p. Deterministic for a given random function,
 * so a seeded PRNG reproduces a run exactly. `step(n)` runs n more trials.
 */
export function createReliabilityRun(
  nodes: PureNode[],
  edges: PureEdge[],
  failureProb: number,
  randomFn: () => number
) {
  const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]))
  const alive = new Uint8Array(edges.length)
  let done = 0
  let connected = 0

  const progress = (): ReliabilityProgress => {
    const estimate = done > 0 ? connected / done : 0
    return {
      done,
      connected,
      estimate,
      standardError: done > 0 ? Math.sqrt((estimate * (1 - estimate)) / done) : 0,
    }
  }

  return {
    step(count: number): ReliabilityProgress {
      for (let t = 0; t < count; t++) {
        for (let i = 0; i < edges.length; i++) alive[i] = randomFn() < failureProb ? 0 : 1
        if (isConnectedUnderEdgeMask(nodeIndex, nodes.length, edges, (i) => alive[i] === 1)) {
          connected++
        }
        done++
      }
      return progress()
    },
    progress,
  }
}

/**
 * Exact all-terminal reliability by enumerating all 2^|E| edge states.
 * Only for small graphs (|E| <= 20); returns null otherwise.
 */
export function exactAllTerminalReliability(
  nodes: PureNode[],
  edges: PureEdge[],
  failureProb: number
): number | null {
  if (edges.length > 20) return null
  if (nodes.length <= 1) return nodes.length === 1 ? 1 : 0
  const nodeIndex = new Map(nodes.map((n, i) => [n.id, i]))
  const q = 1 - failureProb
  let total = 0
  const states = 1 << edges.length
  for (let mask = 0; mask < states; mask++) {
    let up = 0
    for (let m = mask; m; m &= m - 1) up++
    if (up < nodes.length - 1) continue
    if (isConnectedUnderEdgeMask(nodeIndex, nodes.length, edges, (i) => (mask & (1 << i)) !== 0)) {
      total += q ** up * failureProb ** (edges.length - up)
    }
  }
  return total
}

/**
 * DFS visit order plus the tree edge that discovered each node. Uses the
 * same recursion and neighbour order as dfsTraversal, so orders agree.
 */
export function dfsTree(
  active: ActiveGraph,
  startNode: string
): { order: string[]; parent: Map<string, string> } {
  const order = dfsTraversal(active, startNode)
  const parent = new Map<string, string>()
  const visited = new Set<string>()
  function dfs(u: string) {
    visited.add(u)
    for (const nbr of active.adjacency.get(u) || []) {
      if (!visited.has(nbr)) {
        parent.set(nbr, u)
        dfs(nbr)
      }
    }
  }
  if (active.activeNodes.has(startNode)) dfs(startNode)
  return { order, parent }
}
