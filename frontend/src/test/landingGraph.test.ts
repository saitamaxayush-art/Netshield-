import { describe, it, expect } from 'vitest'
import {
  analyzeNetwork,
  bfsLayers,
  buildActiveGraph,
  calculateDensity,
  createReliabilityRun,
  dfsTraversal,
  dfsTree,
  exactAllTerminalReliability,
  findShortestPath,
  type PureEdge,
  type PureNode,
} from '../lib/graphAlgorithms'
import {
  createMulberry32,
  generateHeroGraph,
  generateLatticeGraph,
  generatePreset,
  generateReliabilityExample,
} from '../lib/seededGraphGenerator'

const N = (...ids: string[]): PureNode[] => ids.map((id) => ({ id, label: id }))
const E = (...pairs: string[]): PureEdge[] =>
  pairs.map((p, i) => ({ id: `e${i}`, source: p[0], target: p[1] }))

const path = (n: number) => {
  const ids = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i))
  return { nodes: N(...ids), edges: E(...ids.slice(1).map((id, i) => ids[i] + id)) }
}
const cycle = (n: number) => {
  const p = path(n)
  return { nodes: p.nodes, edges: [...p.edges, { id: 'close', source: p.nodes[n - 1].id, target: 'A' }] }
}
const complete = (n: number) => {
  const ids = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i))
  const pairs: string[] = []
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push(ids[i] + ids[j])
  return { nodes: N(...ids), edges: E(...pairs) }
}

describe('analyzeNetwork', () => {
  it('handles the empty graph', () => {
    const a = analyzeNetwork([], [])
    expect(a.components).toEqual([])
    expect(a.isConnected).toBe(false)
    expect(a.bridges).toEqual([])
    expect(a.articulationPoints.size).toBe(0)
    expect(a.density).toBe(0)
  })

  it('handles a single node', () => {
    const a = analyzeNetwork(N('A'), [])
    expect(a.components).toEqual([['A']])
    expect(a.isConnected).toBe(true)
    expect(a.degrees).toEqual({ A: 0 })
    expect(a.bridges).toEqual([])
  })

  it('sorts components largest first for disconnected graphs', () => {
    const a = analyzeNetwork(N('A', 'B', 'C', 'D', 'E'), E('AB', 'CD', 'DE'))
    expect(a.components.map((c) => c.length)).toEqual([3, 2])
    expect(a.componentOf.get('C')).toBe(0)
    expect(a.componentOf.get('A')).toBe(1)
    expect(a.isConnected).toBe(false)
  })

  it('marks every edge of a tree as a bridge and inner nodes as cut vertices', () => {
    const { nodes, edges } = path(5)
    const a = analyzeNetwork(nodes, edges)
    expect(a.bridgeEdgeIds.size).toBe(4)
    expect([...a.articulationPoints].sort()).toEqual(['B', 'C', 'D'])
  })

  it('finds no bridges or cut vertices in a cycle', () => {
    const { nodes, edges } = cycle(6)
    const a = analyzeNetwork(nodes, edges)
    expect(a.bridges).toEqual([])
    expect(a.articulationPoints.size).toBe(0)
    expect(a.isConnected).toBe(true)
  })

  it('turns a cycle into a path when one edge fails', () => {
    const { nodes, edges } = cycle(6)
    const a = analyzeNetwork(nodes, edges, new Set(), new Set(['close']))
    expect(a.bridgeEdgeIds.size).toBe(5)
    expect(a.articulationPoints.size).toBe(4)
  })

  it('has density 1 and no bridges for a complete graph', () => {
    const { nodes, edges } = complete(5)
    const a = analyzeNetwork(nodes, edges)
    expect(a.density).toBe(1)
    expect(a.bridges).toEqual([])
    expect(Object.values(a.degrees)).toEqual([4, 4, 4, 4, 4])
  })

  it('finds multiple bridges between triangles', () => {
    // Triangle ABC - bridge CD - triangle DEF - bridge FG - pendant G
    const a = analyzeNetwork(N('A', 'B', 'C', 'D', 'E', 'F', 'G'), E('AB', 'BC', 'CA', 'CD', 'DE', 'EF', 'FD', 'FG'))
    expect(a.bridges.map((b) => b.join('')).sort()).toEqual(['CD', 'FG'])
    expect([...a.articulationPoints].sort()).toEqual(['C', 'D', 'F'])
  })

  it('drops incident edges when a node fails', () => {
    const a = analyzeNetwork(N('A', 'B', 'C'), E('AB', 'BC'), new Set(['B']))
    expect(a.activeEdgeCount).toBe(0)
    expect(a.components.length).toBe(2)
  })
})

describe('traversals', () => {
  it('computes BFS layers and parents', () => {
    const active = buildActiveGraph(N('A', 'B', 'C', 'D'), E('AB', 'AC', 'BD', 'CD'), new Set(), new Set())
    const { order, layer, parent } = bfsLayers(active, 'A')
    expect(order).toEqual(['A', 'B', 'C', 'D'])
    expect(Object.fromEntries(layer)).toEqual({ A: 0, B: 1, C: 1, D: 2 })
    expect(parent.get('D')).toBe('B')
  })

  it('returns empty BFS layers for a missing start node', () => {
    const active = buildActiveGraph(N('A'), [], new Set(), new Set())
    expect(bfsLayers(active, 'Z').order).toEqual([])
  })

  it('agrees with shortest path and DFS order on a cycle', () => {
    const { nodes, edges } = cycle(6)
    const active = buildActiveGraph(nodes, edges, new Set(), new Set())
    expect(findShortestPath(active, 'A', 'D')?.length).toBe(4)
    expect(dfsTraversal(active, 'A')).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
  })

  it('builds a DFS tree consistent with the DFS order', () => {
    const active = buildActiveGraph(N('A', 'B', 'C', 'D'), E('AB', 'AC', 'BD', 'CD'), new Set(), new Set())
    const { order, parent } = dfsTree(active, 'A')
    expect(order).toEqual(dfsTraversal(active, 'A'))
    expect(order).toEqual(['A', 'B', 'D', 'C'])
    expect(Object.fromEntries(parent)).toEqual({ B: 'A', D: 'B', C: 'D' })
  })

  it('returns null path across components', () => {
    const active = buildActiveGraph(N('A', 'B', 'C'), E('AB'), new Set(), new Set())
    expect(findShortestPath(active, 'A', 'C')).toBeNull()
  })
})

describe('reliability', () => {
  it('matches closed forms for a tree and a cycle', () => {
    const p = 0.2
    const tree = path(5)
    expect(exactAllTerminalReliability(tree.nodes, tree.edges, p)).toBeCloseTo(0.8 ** 4, 12)
    const ring = cycle(5)
    // C_n survives with all edges up, or exactly one edge down.
    expect(exactAllTerminalReliability(ring.nodes, ring.edges, p)).toBeCloseTo(0.8 ** 5 + 5 * p * 0.8 ** 4, 12)
  })

  it('handles degenerate inputs', () => {
    expect(exactAllTerminalReliability([], [], 0.1)).toBe(0)
    expect(exactAllTerminalReliability(N('A'), [], 0.1)).toBe(1)
    const big = complete(8)
    expect(exactAllTerminalReliability(big.nodes, big.edges, 0.1)).toBeNull()
  })

  it('is reproducible for a seed and converges to the exact value', () => {
    const g = generateReliabilityExample()
    const p = 0.15
    const a = createReliabilityRun(g.nodes, g.edges, p, createMulberry32(99)).step(5000)
    const b = createReliabilityRun(g.nodes, g.edges, p, createMulberry32(99)).step(5000)
    expect(a).toEqual(b)
    const exact = exactAllTerminalReliability(g.nodes, g.edges, p)!
    expect(Math.abs(a.estimate - exact)).toBeLessThan(4 * a.standardError + 1e-9)
    expect(a.standardError).toBeCloseTo(Math.sqrt((a.estimate * (1 - a.estimate)) / 5000), 12)
  })

  it('steps incrementally to the same result as one batch', () => {
    const g = generateReliabilityExample()
    const run = createReliabilityRun(g.nodes, g.edges, 0.3, createMulberry32(5))
    for (let i = 0; i < 10; i++) run.step(50)
    const once = createReliabilityRun(g.nodes, g.edges, 0.3, createMulberry32(5)).step(500)
    expect(run.progress()).toEqual(once)
  })

  it('gives 1 at p = 0 and 0 at p = 1 for a connected graph', () => {
    const g = generateReliabilityExample()
    expect(createReliabilityRun(g.nodes, g.edges, 0, createMulberry32(1)).step(100).estimate).toBe(1)
    expect(createReliabilityRun(g.nodes, g.edges, 1, createMulberry32(1)).step(100).estimate).toBe(0)
  })
})

describe('seeded landing graphs', () => {
  it('reproduces presets exactly for the same seed', () => {
    for (const kind of ['star', 'ring', 'mesh'] as const) {
      expect(generatePreset(kind, 7)).toEqual(generatePreset(kind, 7))
    }
    expect(generatePreset('mesh', 7)).not.toEqual(generatePreset('mesh', 8))
  })

  it('gives presets their defining structure', () => {
    const star = analyzeNetwork(generatePreset('star').nodes, generatePreset('star').edges)
    expect(star.bridgeEdgeIds.size).toBe(6)
    expect([...star.articulationPoints]).toEqual(['A'])
    const ring = analyzeNetwork(generatePreset('ring').nodes, generatePreset('ring').edges)
    expect(ring.bridges.length).toBe(0)
    const meshGraph = generatePreset('mesh')
    const mesh = analyzeNetwork(meshGraph.nodes, meshGraph.edges)
    expect(mesh.isConnected).toBe(true)
    expect(mesh.bridgeEdgeIds.size).toBe(1)
    expect(mesh.articulationPoints.size).toBe(1)
  })

  it('keeps preset coordinates inside the unit frame', () => {
    for (const kind of ['star', 'ring', 'mesh'] as const) {
      for (const n of generatePreset(kind).nodes) {
        expect(n.x).toBeGreaterThanOrEqual(0)
        expect(n.x).toBeLessThanOrEqual(1)
        expect(n.y).toBeGreaterThanOrEqual(0)
        expect(n.y).toBeLessThanOrEqual(1)
      }
    }
  })

  it('builds connected lattice and hero graphs deterministically', () => {
    for (const seed of [1, 2, 3, 11, 42]) {
      const l = generateLatticeGraph(seed, 4, 3)
      expect(analyzeNetwork(l.nodes, l.edges).isConnected).toBe(true)
    }
    const hero = generateHeroGraph(1729, 64)
    expect(hero).toEqual(generateHeroGraph(1729, 64))
    const heroNodes = hero.nodes.map((n) => ({ id: n.id, label: n.id }))
    expect(analyzeNetwork(heroNodes, hero.edges).isConnected).toBe(true)
    expect(calculateDensity(hero.nodes.length, hero.edges.length)).toBeLessThan(0.1)
  })
})
