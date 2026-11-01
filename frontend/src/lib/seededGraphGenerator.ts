/**
 * Seeded Reproducible Graph Generator
 *
 * Uses Mulberry32 PRNG to generate a deterministic 3D and 2D network model
 * containing structured redundancy, deliberate bridges, and articulation points.
 * Guarantees identical topology and vertex positions across runs for the same seed.
 */

export interface SeededNode {
  id: string
  label: string
  x: number
  y: number
  z: number
  cluster: number
}

export interface SeededEdge {
  id: string
  source: string
  target: string
  isDeliberateBridge?: boolean
}

export interface SeededGraph {
  nodes: SeededNode[]
  edges: SeededEdge[]
  seed: number
}

/**
 * Fast, 32-bit seeded pseudo-random number generator (Mulberry32)
 */
export function createMulberry32(seed: number): () => number {
  let s = seed >>> 0
  return function () {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Generate a deterministic architectural 3D network topology.
 * Generates 3 cohesive clusters connected by bridge corridors.
 */
export function generateSeededGraph(seed: number = 42): SeededGraph {
  const rng = createMulberry32(seed)
  const nodes: SeededNode[] = []
  const edges: SeededEdge[] = []

  // Define 3 cluster centers in 3D space
  const clusters = [
    { cx: -3.5, cy: 0.5, cz: -1.0, count: 8, name: 'Core Alpha' },
    { cx: 1.0, cy: -1.2, cz: 1.5, count: 9, name: 'Relay Beta' },
    { cx: 3.8, cy: 1.8, cz: -0.5, count: 7, name: 'Gateway Gamma' },
  ]

  let nodeIndex = 1
  const clusterNodeIds: string[][] = [[], [], []]

  // Generate clustered nodes
  clusters.forEach((cluster, cIdx) => {
    for (let i = 0; i < cluster.count; i++) {
      const id = `n_${nodeIndex}`
      const label = `Node ${nodeIndex}`

      // Layered subtle dispersion around cluster center
      const theta = rng() * Math.PI * 2
      const phi = (rng() - 0.5) * Math.PI
      const r = 1.0 + rng() * 1.5

      const x = Number((cluster.cx + r * Math.cos(theta) * Math.cos(phi)).toFixed(3))
      const y = Number((cluster.cy + r * Math.sin(phi) * 0.8).toFixed(3))
      const z = Number((cluster.cz + r * Math.sin(theta) * Math.cos(phi)).toFixed(3))

      nodes.push({ id, label, x, y, z, cluster: cIdx })
      clusterNodeIds[cIdx].push(id)
      nodeIndex++
    }
  })

  // Intra-cluster edges (create rich redundant mesh within clusters)
  let edgeIndex = 1
  const edgeSet = new Set<string>()

  function addEdge(source: string, target: string, isDeliberateBridge: boolean = false) {
    if (source === target) return
    const key = source < target ? `${source}-${target}` : `${target}-${source}`
    if (edgeSet.has(key)) return
    edgeSet.add(key)
    edges.push({
      id: `e_${edgeIndex++}`,
      source,
      target,
      isDeliberateBridge,
    })
  }

  // Connect inside each cluster
  clusterNodeIds.forEach((cNodes) => {
    // Ring base
    for (let i = 0; i < cNodes.length; i++) {
      const next = (i + 1) % cNodes.length
      addEdge(cNodes[i], cNodes[next])
    }
    // Random chords for redundancy
    for (let i = 0; i < cNodes.length; i++) {
      for (let j = i + 2; j < cNodes.length; j++) {
        if (rng() < 0.35) {
          addEdge(cNodes[i], cNodes[j])
        }
      }
    }
  })

  // Inter-cluster connections:
  // Cluster 0 connects to Cluster 1 through a single critical bridge edge!
  const bridge1Source = clusterNodeIds[0][0]
  const bridge1Target = clusterNodeIds[1][0]
  addEdge(bridge1Source, bridge1Target, true)

  // Cluster 1 connects to Cluster 2 through a critical articulation point hub
  const hubId = `n_${nodeIndex}`
  nodes.push({
    id: hubId,
    label: `Relay Hub ${nodeIndex}`,
    x: 2.2,
    y: 0.2,
    z: 0.4,
    cluster: 3,
  })
  nodeIndex++

  // Hub connects to Cluster 1 and Cluster 2 (making hub an articulation point)
  addEdge(clusterNodeIds[1][1], hubId, true)
  addEdge(hubId, clusterNodeIds[2][0], true)

  return { nodes, edges, seed }
}

/* ------------------------------------------------------------------ */
/* Landing presets: small 2D example graphs in unit coordinates (0..1) */
/* ------------------------------------------------------------------ */

export interface LayoutNode {
  id: string
  label: string
  x: number
  y: number
}

export interface LayoutEdge {
  id: string
  source: string
  target: string
}

export interface LayoutGraph {
  name: string
  seed: number
  nodes: LayoutNode[]
  edges: LayoutEdge[]
}

export type PresetKind = 'star' | 'ring' | 'mesh'

const round3 = (v: number) => Math.round(v * 1000) / 1000

function edgeBuilder() {
  const edges: LayoutEdge[] = []
  const seen = new Set<string>()
  return {
    edges,
    add(a: string, b: string) {
      if (a === b) return
      const key = a < b ? `${a}|${b}` : `${b}|${a}`
      if (seen.has(key)) return
      seen.add(key)
      edges.push({ id: `e${edges.length + 1}`, source: a, target: b })
    },
  }
}

const letter = (i: number) => String.fromCharCode(65 + i)

/** Star: one hub, leaves on a jittered circle. Every edge is a bridge. */
function starPreset(seed: number): LayoutGraph {
  const rng = createMulberry32(seed)
  const leaves = 6
  const nodes: LayoutNode[] = [{ id: 'A', label: 'A', x: 0.5, y: 0.5 }]
  const b = edgeBuilder()
  for (let i = 0; i < leaves; i++) {
    const angle = -Math.PI / 2 + (i / leaves) * Math.PI * 2 + (rng() - 0.5) * 0.25
    const r = 0.36 + rng() * 0.06
    const id = letter(i + 1)
    nodes.push({ id, label: id, x: round3(0.5 + Math.cos(angle) * r), y: round3(0.5 + Math.sin(angle) * r) })
    b.add('A', id)
  }
  return { name: 'Star', seed, nodes, edges: b.edges }
}

/** Ring: a single cycle. No bridges until one edge fails. */
function ringPreset(seed: number): LayoutGraph {
  const rng = createMulberry32(seed)
  const count = 8
  const nodes: LayoutNode[] = []
  const b = edgeBuilder()
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.12
    const r = 0.38 + (rng() - 0.5) * 0.04
    const id = letter(i)
    nodes.push({ id, label: id, x: round3(0.5 + Math.cos(angle) * r), y: round3(0.5 + Math.sin(angle) * r) })
  }
  for (let i = 0; i < count; i++) b.add(nodes[i].id, nodes[(i + 1) % count].id)
  return { name: 'Ring', seed, nodes, edges: b.edges }
}

/**
 * Mesh: a partial mesh on a jittered 3 by 3 lattice with seeded diagonals,
 * plus one pendant node so the example contains a bridge and a cut vertex.
 */
function meshPreset(seed: number): LayoutGraph {
  const rng = createMulberry32(seed)
  const nodes: LayoutNode[] = []
  const b = edgeBuilder()
  const grid: string[][] = []
  let k = 0
  for (let r = 0; r < 3; r++) {
    grid.push([])
    for (let c = 0; c < 3; c++) {
      const id = letter(k++)
      grid[r].push(id)
      nodes.push({
        id,
        label: id,
        x: round3(0.14 + c * 0.3 + (rng() - 0.5) * 0.08),
        y: round3(0.16 + r * 0.32 + (rng() - 0.5) * 0.08),
      })
    }
  }
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (c < 2) b.add(grid[r][c], grid[r][c + 1])
      if (r < 2) b.add(grid[r][c], grid[r + 1][c])
      if (r < 2 && c < 2 && rng() < 0.5) b.add(grid[r][c], grid[r + 1][c + 1])
    }
  }
  const pendant = letter(k)
  const anchor = nodes.find((n) => n.id === grid[1][2])!
  nodes.push({ id: pendant, label: pendant, x: round3(Math.min(0.94, anchor.x + 0.2)), y: round3(anchor.y + 0.02) })
  // Shift the lattice left so the pendant fits inside the frame.
  for (const n of nodes) n.x = round3(n.x * 0.84 + 0.02)
  b.add(grid[1][2], pendant)
  return { name: 'Mesh', seed, nodes, edges: b.edges }
}

export function generatePreset(kind: PresetKind, seed: number = 7): LayoutGraph {
  if (kind === 'star') return starPreset(seed)
  if (kind === 'ring') return ringPreset(seed)
  return meshPreset(seed)
}

/**
 * Lattice example used by the path explorer and the how it works story:
 * a jittered cols by rows grid, lattice edges kept with probability keep,
 * seeded diagonals, then repaired so the graph is connected.
 */
export function generateLatticeGraph(
  seed: number,
  cols: number,
  rows: number,
  keep: number = 0.82,
  diagonal: number = 0.22
): LayoutGraph {
  const rng = createMulberry32(seed)
  const nodes: LayoutNode[] = []
  const b = edgeBuilder()
  const id = (r: number, c: number) => letter(r * cols + c)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      nodes.push({
        id: id(r, c),
        label: id(r, c),
        x: round3(0.08 + (c / Math.max(1, cols - 1)) * 0.84 + (rng() - 0.5) * (0.5 / cols)),
        y: round3(0.1 + (r / Math.max(1, rows - 1)) * 0.8 + (rng() - 0.5) * (0.4 / rows)),
      })
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c < cols - 1 && rng() < keep) b.add(id(r, c), id(r, c + 1))
      if (r < rows - 1 && rng() < keep) b.add(id(r, c), id(r + 1, c))
      if (r < rows - 1 && c < cols - 1 && rng() < diagonal) b.add(id(r, c), id(r + 1, c + 1))
    }
  }
  // Repair: join any node left unreachable from A to its left or upper neighbour.
  const adjacency = new Map<string, Set<string>>(nodes.map((n) => [n.id, new Set()]))
  for (const e of b.edges) {
    adjacency.get(e.source)!.add(e.target)
    adjacency.get(e.target)!.add(e.source)
  }
  const reach = new Set<string>([nodes[0].id])
  const grow = () => {
    const stack = [...reach]
    while (stack.length) {
      const u = stack.pop()!
      for (const v of adjacency.get(u)!) if (!reach.has(v)) { reach.add(v); stack.push(v) }
    }
  }
  grow()
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const n = id(r, c)
      if (reach.has(n)) continue
      const link = c > 0 ? id(r, c - 1) : id(r - 1, c)
      b.add(link, n)
      adjacency.get(link)!.add(n)
      adjacency.get(n)!.add(link)
      reach.add(n)
      grow()
    }
  }
  return { name: 'Lattice', seed, nodes, edges: b.edges }
}

/**
 * Reliability example: two redundant clusters joined by a single link, so
 * the estimate is visibly below one at small failure probabilities.
 * Small enough (11 edges) for exact enumeration.
 */
export function generateReliabilityExample(): LayoutGraph {
  const nodes: LayoutNode[] = [
    { id: 'A', label: 'A', x: 0.1, y: 0.3 },
    { id: 'B', label: 'B', x: 0.3, y: 0.12 },
    { id: 'C', label: 'C', x: 0.34, y: 0.62 },
    { id: 'D', label: 'D', x: 0.12, y: 0.82 },
    { id: 'E', label: 'E', x: 0.62, y: 0.44 },
    { id: 'F', label: 'F', x: 0.84, y: 0.16 },
    { id: 'G', label: 'G', x: 0.9, y: 0.6 },
    { id: 'H', label: 'H', x: 0.7, y: 0.86 },
  ]
  const b = edgeBuilder()
  ;[
    ['A', 'B'], ['B', 'C'], ['A', 'C'], ['C', 'D'], ['A', 'D'],
    ['C', 'E'],
    ['E', 'F'], ['F', 'G'], ['E', 'G'], ['G', 'H'], ['E', 'H'],
  ].forEach(([s, t]) => b.add(s, t))
  return { name: 'Two clusters', seed: 0, nodes, edges: b.edges }
}

/* ------------------------------------------------------------------ */
/* Hero: a wide, shallow 3D network, connected by construction          */
/* ------------------------------------------------------------------ */

export interface HeroGraph {
  seed: number
  nodes: Array<{ id: string; x: number; y: number; z: number }>
  edges: LayoutEdge[]
}

export function generateHeroGraph(seed: number = 1729, count: number = 64): HeroGraph {
  const rng = createMulberry32(seed)
  const nodes: HeroGraph['nodes'] = []
  for (let i = 0; i < count; i++) {
    // Rejection sample inside a flattened ellipsoid.
    let x: number, y: number, z: number
    do {
      x = rng() * 2 - 1
      y = rng() * 2 - 1
      z = rng() * 2 - 1
    } while (x * x + y * y + z * z > 1)
    nodes.push({ id: `h${i}`, x: round3(x * 5.2), y: round3(y * 2.6), z: round3(z * 2.4) })
  }
  const b = edgeBuilder()
  const dist = (a: number, c: number) => {
    const p = nodes[a], q = nodes[c]
    return (p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2
  }
  // k nearest neighbours (k = 2 or 3, seeded) gives a sparse, organic mesh.
  for (let i = 0; i < count; i++) {
    const k = rng() < 0.55 ? 3 : 2
    const order = nodes.map((_, j) => j).filter((j) => j !== i).sort((a, c) => dist(i, a) - dist(i, c))
    for (let n = 0; n < k; n++) b.add(nodes[i].id, nodes[order[n]].id)
  }
  // Connect components greedily through their closest pair.
  const comp = new Int32Array(count).map((_, i) => i)
  const find = (x: number): number => (comp[x] === x ? x : (comp[x] = find(comp[x])))
  for (const e of b.edges) comp[find(+e.source.slice(1))] = find(+e.target.slice(1))
  for (;;) {
    const roots = new Set<number>()
    for (let i = 0; i < count; i++) roots.add(find(i))
    if (roots.size <= 1) break
    const root = find(0)
    let best: [number, number] = [0, 0]
    let bestD = Infinity
    for (let i = 0; i < count; i++) {
      if (find(i) !== root) continue
      for (let j = 0; j < count; j++) {
        if (find(j) === root) continue
        const d = dist(i, j)
        if (d < bestD) { bestD = d; best = [i, j] }
      }
    }
    b.add(nodes[best[0]].id, nodes[best[1]].id)
    comp[find(best[1])] = root
  }
  return { seed, nodes, edges: b.edges }
}
