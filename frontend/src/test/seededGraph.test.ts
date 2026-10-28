import { describe, it, expect } from 'vitest'
import { generateSeededGraph } from '../lib/seededGraphGenerator'

describe('Seeded Graph Generator', () => {
  it('generates identical graph structures for the same seed', () => {
    const graphA = generateSeededGraph(42)
    const graphB = generateSeededGraph(42)

    expect(graphA.nodes.length).toBe(graphB.nodes.length)
    expect(graphA.edges.length).toBe(graphB.edges.length)

    // Check vertex positions match exactly
    for (let i = 0; i < graphA.nodes.length; i++) {
      expect(graphA.nodes[i].x).toBe(graphB.nodes[i].x)
      expect(graphA.nodes[i].y).toBe(graphB.nodes[i].y)
      expect(graphA.nodes[i].z).toBe(graphB.nodes[i].z)
    }

    // Check edges match exactly
    for (let i = 0; i < graphA.edges.length; i++) {
      expect(graphA.edges[i].source).toBe(graphB.edges[i].source)
      expect(graphA.edges[i].target).toBe(graphB.edges[i].target)
    }
  })

  it('generates distinct graphs for different seeds', () => {
    const graph1 = generateSeededGraph(100)
    const graph2 = generateSeededGraph(200)

    // Node count is fixed by structure, but random positions differ
    expect(graph1.nodes[0].x).not.toBe(graph2.nodes[0].x)
  })

  it('contains deliberate bridges and articulation points', () => {
    const graph = generateSeededGraph(42)
    const bridges = graph.edges.filter((e) => e.isDeliberateBridge)
    expect(bridges.length).toBeGreaterThanOrEqual(2)

    const hubs = graph.nodes.filter((n) => n.cluster === 3)
    expect(hubs.length).toBe(1)
  })
})
