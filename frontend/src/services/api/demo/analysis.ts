/**
 * Demo analysis: an independent implementation of POST /api/analyze (API_CONTRACT.md section 7).
 *
 * It does not import the landing page helpers or share code with the backend. Its orderings follow
 * the contract exactly (ids compared by Unicode code point, like Python), so its output can be checked
 * against real backend responses in tests.
 */
import type { Analysis, AnalyzeRequestBody } from '../schemas'

type ApiNode = AnalyzeRequestBody['nodes'][number]
type ApiEdge = AnalyzeRequestBody['edges'][number]
type PathResult = NonNullable<Analysis['path']>

/** Compare strings by Unicode code point (Python's str ordering), not UTF-16 units. */
export function compareIds(a: string, b: string): number {
  const ai = a[Symbol.iterator]()
  const bi = b[Symbol.iterator]()
  for (;;) {
    const x = ai.next()
    const y = bi.next()
    if (x.done || y.done) return x.done && y.done ? 0 : x.done ? -1 : 1
    const cx = x.value.codePointAt(0) ?? 0
    const cy = y.value.codePointAt(0) ?? 0
    if (cx !== cy) return cx - cy
  }
}

const byId = (ids: Iterable<string>): string[] => [...ids].sort(compareIds)
const pairKey = (a: string, b: string) => (compareIds(a, b) < 0 ? `${a}\u0000${b}` : `${b}\u0000${a}`)

interface Operational {
  nodes: string[]
  adjacency: Map<string, string[]>
  edgeIdByPair: Map<string, string>
  weightByPair: Map<string, number>
  failed: Set<string>
}

export function buildOperational(nodes: ApiNode[], edges: ApiEdge[]): Operational {
  const failed = new Set(nodes.filter((n) => n.failed).map((n) => n.id))
  const alive = byId(nodes.filter((n) => !n.failed).map((n) => n.id))
  const adjacency = new Map<string, string[]>(alive.map((id) => [id, []]))
  const edgeIdByPair = new Map<string, string>()
  const weightByPair = new Map<string, number>()
  for (const e of [...edges].sort((a, b) => compareIds(a.id, b.id))) {
    if (e.failed || !adjacency.has(e.source) || !adjacency.has(e.target)) continue
    adjacency.get(e.source)!.push(e.target)
    adjacency.get(e.target)!.push(e.source)
    edgeIdByPair.set(pairKey(e.source, e.target), e.id)
    weightByPair.set(pairKey(e.source, e.target), e.weight ?? 1)
  }
  for (const list of adjacency.values()) list.sort(compareIds)
  return { nodes: alive, adjacency, edgeIdByPair, weightByPair, failed }
}

function components(op: Operational): string[][] {
  const seen = new Set<string>()
  const out: string[][] = []
  for (const start of op.nodes) {
    if (seen.has(start)) continue
    const comp: string[] = []
    const stack = [start]
    seen.add(start)
    while (stack.length) {
      const u = stack.pop()!
      comp.push(u)
      for (const v of op.adjacency.get(u)!) {
        if (!seen.has(v)) {
          seen.add(v)
          stack.push(v)
        }
      }
    }
    out.push(byId(comp))
  }
  return out.sort((a, b) => b.length - a.length || compareIds(a[0], b[0]))
}

/** Bridges and articulation points by Tarjan's low-link method (iterative, no recursion limit). */
function cutElements(op: Operational): { bridges: string[]; articulation: string[] } {
  const disc = new Map<string, number>()
  const low = new Map<string, number>()
  const bridges: string[] = []
  const articulation = new Set<string>()
  let time = 0
  for (const root of op.nodes) {
    if (disc.has(root)) continue
    disc.set(root, time)
    low.set(root, time++)
    let rootChildren = 0
    const stack: Array<{ u: string; parent: string | null; i: number }> = [{ u: root, parent: null, i: 0 }]
    while (stack.length) {
      const frame = stack[stack.length - 1]
      const neighbours = op.adjacency.get(frame.u)!
      if (frame.i < neighbours.length) {
        const v = neighbours[frame.i++]
        if (v === frame.parent) continue // simple graph: exactly one edge back to the parent
        if (disc.has(v)) {
          low.set(frame.u, Math.min(low.get(frame.u)!, disc.get(v)!))
        } else {
          disc.set(v, time)
          low.set(v, time++)
          if (frame.u === root) rootChildren++
          stack.push({ u: v, parent: frame.u, i: 0 })
        }
        continue
      }
      stack.pop()
      const parent = frame.parent
      if (parent === null) continue
      low.set(parent, Math.min(low.get(parent)!, low.get(frame.u)!))
      if (low.get(frame.u)! > disc.get(parent)!) bridges.push(op.edgeIdByPair.get(pairKey(parent, frame.u))!)
      if (parent !== root && low.get(frame.u)! >= disc.get(parent)!) articulation.add(parent)
    }
    if (rootChildren > 1) articulation.add(root)
  }
  return { bridges: byId(bridges), articulation: byId(articulation) }
}

function traversal(op: Operational, start: string): NonNullable<Analysis['traversal']> {
  const keys = { bfsExplanationKey: 'bfs_definition', dfsExplanationKey: 'dfs_definition' } as const
  if (op.failed.has(start)) {
    return {
      startNodeId: start,
      error: { code: 'START_NODE_FAILED', message: `Start node '${start}' is failed, so no traversal is possible.` },
      bfs: [],
      dfs: [],
      ...keys,
    }
  }
  const layer = new Map([[start, 0]])
  const bfs = [{ nodeId: start, layer: 0 }]
  for (let head = 0; head < bfs.length; head++) {
    const u = bfs[head].nodeId
    for (const v of op.adjacency.get(u)!) {
      if (!layer.has(v)) {
        layer.set(v, layer.get(u)! + 1)
        bfs.push({ nodeId: v, layer: layer.get(v)! })
      }
    }
  }
  // Depth first preorder with neighbours in ascending order (iterator stack, like the recursive form).
  const dfs: string[] = [start]
  const visited = new Set([start])
  const stack: Array<{ u: string; i: number }> = [{ u: start, i: 0 }]
  while (stack.length) {
    const frame = stack[stack.length - 1]
    const neighbours = op.adjacency.get(frame.u)!
    if (frame.i >= neighbours.length) {
      stack.pop()
      continue
    }
    const v = neighbours[frame.i++]
    if (!visited.has(v)) {
      visited.add(v)
      dfs.push(v)
      stack.push({ u: v, i: 0 })
    }
  }
  return { startNodeId: start, error: null, bfs, dfs, ...keys }
}

function distancesTo(op: Operational, target: string, weighted: boolean): Map<string, number> {
  const dist = new Map<string, number>([[target, 0]])
  if (!weighted) {
    const queue = [target]
    for (let head = 0; head < queue.length; head++) {
      const u = queue[head]
      for (const v of op.adjacency.get(u)!) {
        if (!dist.has(v)) {
          dist.set(v, dist.get(u)! + 1)
          queue.push(v)
        }
      }
    }
    return dist
  }
  // Dijkstra (O(V^2) is ample for 200 nodes). dist(v) = dist(u) + w, the same addition the backend uses.
  const done = new Set<string>()
  for (;;) {
    let u: string | null = null
    for (const [node, d] of dist) if (!done.has(node) && (u === null || d < dist.get(u)!)) u = node
    if (u === null) return dist
    done.add(u)
    for (const v of op.adjacency.get(u)!) {
      const candidate = dist.get(u)! + op.weightByPair.get(pairKey(u, v))!
      if (!done.has(v) && (!dist.has(v) || candidate < dist.get(v)!)) dist.set(v, candidate)
    }
  }
}

function shortestPath(op: Operational, edges: ApiEdge[], source: string, target: string, useWeights: boolean): PathResult {
  const allWeighted = edges.every((e) => e.weight !== undefined && e.weight !== null)
  const weighted = useWeights && allWeighted
  const base = {
    source,
    target,
    metric: weighted ? ('weight' as const) : ('hops' as const),
    weightsIgnoredReason: useWeights && !allWeighted ? ('MISSING_WEIGHTS' as const) : null,
    explanationKey: weighted ? ('shortest_path_weighted' as const) : ('shortest_path_hops' as const),
  }
  const notFound = (reason: PathResult['reason'], reasonKey: PathResult['reasonKey']): PathResult => ({
    ...base,
    found: false,
    reason,
    reasonKey,
    nodeIds: null,
    edgeIds: null,
    hops: null,
    length: null,
  })
  if (op.failed.has(source)) return notFound('SOURCE_FAILED', 'path_source_failed')
  if (op.failed.has(target)) return notFound('TARGET_FAILED', 'path_target_failed')
  const dist = distancesTo(op, target, weighted)
  if (!dist.has(source)) return notFound('DISCONNECTED', 'path_disconnected')
  const path = [source]
  let current = source
  while (current !== target) {
    const from = current
    current = op.adjacency.get(from)!.find((v) => {
      const step = weighted ? op.weightByPair.get(pairKey(from, v))! : 1
      return dist.has(v) && dist.get(v)! + step === dist.get(from)!
    })!
    path.push(current)
  }
  return {
    ...base,
    found: true,
    reason: null,
    reasonKey: null,
    nodeIds: path,
    edgeIds: path.slice(1).map((v, i) => op.edgeIdByPair.get(pairKey(path[i], v))!),
    hops: path.length - 1,
    length: weighted ? dist.get(source)! : path.length - 1,
  }
}

export function analyzeGraph(request: AnalyzeRequestBody): Analysis {
  const { nodes, edges } = request
  const op = buildOperational(nodes, edges)
  const items = components(op)
  const operationalEdges = op.edgeIdByPair.size
  const n = op.nodes.length
  // NetworkX's order of operations, so the float is identical: m / (n (n - 1)), then times 2.
  const density = n >= 2 ? (operationalEdges / (n * (n - 1))) * 2 : 0
  const componentOf: Record<string, number | null> = {}
  const index = new Map(items.flatMap((comp, i) => comp.map((id) => [id, i] as const)))
  for (const id of byId(nodes.map((x) => x.id))) componentOf[id] = index.get(id) ?? null
  const stored = new Map(nodes.map((x) => [x.id, 0]))
  for (const e of edges) {
    stored.set(e.source, stored.get(e.source)! + 1)
    stored.set(e.target, stored.get(e.target)! + 1)
  }
  const byNode: Record<string, { operational: number; stored: number }> = {}
  for (const id of byId(stored.keys())) byNode[id] = { operational: op.adjacency.get(id)?.length ?? 0, stored: stored.get(id)! }
  const { bridges, articulation } = cutElements(op)
  const count = items.length
  return {
    summary: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      operationalNodeCount: n,
      operationalEdgeCount: operationalEdges,
      failedNodeCount: nodes.filter((x) => x.failed).length,
      failedEdgeCount: edges.filter((e) => e.failed).length,
      unavailableEdgeCount: edges.length - operationalEdges,
      density,
      explanationKey: 'density_definition',
    },
    connectivity:
      count === 0
        ? { connected: false, componentCount: 0, reasonKey: 'empty_network', reason: 'Empty network', explanationKey: 'connectivity_definition' }
        : count === 1
          ? { connected: true, componentCount: 1, reasonKey: 'single_component', reason: 'Single component', explanationKey: 'connectivity_definition' }
          : {
              connected: false,
              componentCount: count,
              reasonKey: 'multiple_components',
              reason: `${count} components`,
              explanationKey: 'connectivity_definition',
            },
    components: { items, componentOf, explanationKey: 'component_definition' },
    degrees: { byNode, explanationKey: 'degree_definition' },
    bridges: { edgeIds: bridges, explanationKey: 'bridge_definition' },
    articulationPoints: { nodeIds: articulation, explanationKey: 'articulation_point_definition' },
    traversal: request.startNodeId ? traversal(op, request.startNodeId) : null,
    path:
      request.pathSource && request.pathTarget
        ? shortestPath(op, edges, request.pathSource, request.pathTarget, request.useWeights ?? false)
        : null,
  }
}
