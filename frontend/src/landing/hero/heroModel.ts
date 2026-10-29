import { analyzeNetwork, buildActiveGraph, findShortestPath } from '@/lib/graphAlgorithms'
import { createMulberry32, generateHeroGraph, type HeroGraph } from '@/lib/seededGraphGenerator'

export const HERO_SEED = 1729

/** Camera and group pose shared by the WebGL scene and the SVG fallback. */
export interface HeroPose {
  fov: number
  camZ: number
  gx: number
  gy: number
  rx: number
  ry: number
}

export const poseFor = (width: number): HeroPose =>
  width < 768
    ? { fov: 40, camZ: 13, gx: 0, gy: 1.9, rx: 0.22, ry: -0.3 }
    : width < 1024
      ? { fov: 38, camZ: 13, gx: 1.4, gy: 0.9, rx: 0.2, ry: -0.34 }
      : { fov: 36, camZ: 13, gx: 2.9, gy: 0.35, rx: 0.18, ry: -0.36 }

export interface HeroModel {
  graph: HeroGraph
  degree: Record<string, number>
  neighbours: Map<string, Set<string>>
  /** Seeded order of non bridge edges that the scene fails one at a time. */
  failureOrder: string[]
  /** Detour (node ids) that keeps the network connected when an edge fails. */
  detour: (edgeId: string) => string[] | null
}

export function buildHeroModel(count: number): HeroModel {
  const graph = generateHeroGraph(HERO_SEED, count)
  const nodes = graph.nodes.map((n) => ({ id: n.id, label: n.id }))
  const analysis = analyzeNetwork(nodes, graph.edges)
  const neighbours = new Map<string, Set<string>>(graph.nodes.map((n) => [n.id, new Set()]))
  for (const e of graph.edges) {
    neighbours.get(e.source)!.add(e.target)
    neighbours.get(e.target)!.add(e.source)
  }
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  // Prefer links on the visible (right, front) side of the cloud.
  const candidates = graph.edges.filter((e) => {
    if (analysis.bridgeEdgeIds.has(e.id)) return false
    const a = byId.get(e.source)!
    const b = byId.get(e.target)!
    return (a.x + b.x) / 2 > -1.5 && (a.z + b.z) / 2 > -1.2
  })
  const rng = createMulberry32(HERO_SEED + 1)
  const failureOrder = candidates.map((e) => e.id).map((id) => ({ id, k: rng() })).sort((p, q) => p.k - q.k).map((p) => p.id)
  const edgeById = new Map(graph.edges.map((e) => [e.id, e]))
  const detour = (edgeId: string) => {
    const e = edgeById.get(edgeId)
    if (!e) return null
    const active = buildActiveGraph(nodes, graph.edges, new Set(), new Set([edgeId]))
    return findShortestPath(active, e.source, e.target)
  }
  return { graph, degree: analysis.degrees, neighbours, failureOrder, detour }
}

/** Perspective projection identical to the three.js camera (Euler XYZ, camera on +z). */
export function projectNode(p: { x: number; y: number; z: number }, pose: HeroPose, w: number, h: number): [number, number, number] {
  const cy = Math.cos(pose.ry), sy = Math.sin(pose.ry)
  const cx = Math.cos(pose.rx), sx = Math.sin(pose.rx)
  // Ry then Rx (three.js XYZ order applies Rz, Ry, Rx to the vector).
  const x1 = p.x * cy + p.z * sy
  const z1 = -p.x * sy + p.z * cy
  const y2 = p.y * cx - z1 * sx
  const z2 = p.y * sx + z1 * cx
  const X = x1 + pose.gx
  const Y = y2 + pose.gy
  const Z = z2 - pose.camZ
  const f = 1 / Math.tan((pose.fov * Math.PI) / 360)
  const ndcX = (f * X) / (-Z * (w / h))
  const ndcY = (f * Y) / -Z
  return [((ndcX + 1) / 2) * w, ((1 - ndcY) / 2) * h, -Z]
}
