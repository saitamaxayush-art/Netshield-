import { describe, it, expect } from 'vitest'
import {
  buildActiveGraph,
  findConnectedComponents,
  findBridges,
  findArticulationPoints,
  findShortestPath,
  bfsTraversal,
  dfsTraversal,
  simulateReliability,
} from '../lib/graphAlgorithms'

describe('Graph Theory Algorithms', () => {
  it('correctly identifies bridges and articulation points in a barbell graph', () => {
    // Two triangles joined by a single edge e_bridge between v3 and v4:
    // v1 - v2 - v3 - v1
    // v4 - v5 - v6 - v4
    // v3 - v4 (Bridge)
    const nodes = [
      { id: 'v1', label: 'v1' },
      { id: 'v2', label: 'v2' },
      { id: 'v3', label: 'v3' },
      { id: 'v4', label: 'v4' },
      { id: 'v5', label: 'v5' },
      { id: 'v6', label: 'v6' },
    ]

    const edges = [
      { id: 'e1', source: 'v1', target: 'v2' },
      { id: 'e2', source: 'v2', target: 'v3' },
      { id: 'e3', source: 'v1', target: 'v3' },
      { id: 'e_bridge', source: 'v3', target: 'v4' },
      { id: 'e4', source: 'v4', target: 'v5' },
      { id: 'e5', source: 'v5', target: 'v6' },
      { id: 'e6', source: 'v4', target: 'v6' },
    ]

    const active = buildActiveGraph(nodes, edges, new Set(), new Set())
    const comps = findConnectedComponents(active)
    const bridges = findBridges(active)
    const artPoints = findArticulationPoints(active)

    expect(comps.length).toBe(1)
    expect(bridges.length).toBe(1)
    expect(bridges[0].sort()).toEqual(['v3', 'v4'])
    expect(new Set(artPoints)).toEqual(new Set(['v3', 'v4']))
  })

  it('implements incident edge failure semantics accurately', () => {
    const nodes = [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
    ]
    const edges = [
      { id: 'e_ab', source: 'a', target: 'b' },
      { id: 'e_bc', source: 'b', target: 'c' },
    ]

    // Fail node B: incident edges e_ab and e_bc must become unavailable
    const active = buildActiveGraph(nodes, edges, new Set(['b']), new Set())
    expect(active.activeNodes.size).toBe(2)
    expect(active.activeNodes.has('a')).toBe(true)
    expect(active.activeNodes.has('c')).toBe(true)
    expect(active.activeEdges.length).toBe(0)

    const comps = findConnectedComponents(active)
    expect(comps.length).toBe(2)
  })

  it('computes BFS and DFS traversals properly', () => {
    const nodes = [
      { id: '1', label: '1' },
      { id: '2', label: '2' },
      { id: '3', label: '3' },
      { id: '4', label: '4' },
    ]
    const edges = [
      { id: 'e12', source: '1', target: '2' },
      { id: 'e13', source: '1', target: '3' },
      { id: 'e24', source: '2', target: '4' },
    ]

    const active = buildActiveGraph(nodes, edges, new Set(), new Set())
    const bfs = bfsTraversal(active, '1')
    expect(bfs[0]).toBe('1')
    expect(bfs.length).toBe(4)

    const dfs = dfsTraversal(active, '1')
    expect(dfs[0]).toBe('1')
    expect(dfs.length).toBe(4)
  })

  it('finds the shortest path between source and target', () => {
    const nodes = [
      { id: 's', label: 'S' },
      { id: 'm1', label: 'M1' },
      { id: 'm2', label: 'M2' },
      { id: 't', label: 'T' },
    ]
    const edges = [
      { id: 'e1', source: 's', target: 'm1' },
      { id: 'e2', source: 'm1', target: 't' },
      { id: 'e3', source: 's', target: 'm2' },
      { id: 'e4', source: 'm2', target: 't' },
    ]

    const active = buildActiveGraph(nodes, edges, new Set(), new Set())
    const path = findShortestPath(active, 's', 't')
    expect(path).not.toBeNull()
    expect(path?.length).toBe(3)
    expect(path![0]).toBe('s')
    expect(path![2]).toBe('t')
  })

  it('runs Monte Carlo reliability estimation with valid CI and SE', () => {
    const nodes = [
      { id: 'n1', label: 'N1' },
      { id: 'n2', label: 'N2' },
    ]
    const edges = [{ id: 'e1', source: 'n1', target: 'n2' }]

    const res = simulateReliability(nodes, edges, [], [], 0.1, 500, 'edges')
    expect(res.trials).toBe(500)
    expect(res.estimated_reliability).toBeGreaterThanOrEqual(0.7)
    expect(res.confidence_interval_95[0]).toBeLessThanOrEqual(res.estimated_reliability)
    expect(res.confidence_interval_95[1]).toBeGreaterThanOrEqual(res.estimated_reliability)
  })
})
