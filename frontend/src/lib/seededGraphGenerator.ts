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
