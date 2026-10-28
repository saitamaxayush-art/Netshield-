import { describe, it, expect } from 'vitest'
import { DemoAdapter } from '../services/api/demoAdapter'

describe('Demo Adapter', () => {
  const adapter = new DemoAdapter()

  it('performs authoritative local analysis and marks is_demo as true', async () => {
    const req = {
      nodes: [
        { id: '1', label: 'Node 1', type: 'router' },
        { id: '2', label: 'Node 2', type: 'server' },
      ],
      edges: [{ id: 'e1', source: '1', target: '2' }],
      failed_nodes: [],
      failed_edges: [],
    }

    const res = await adapter.analyze(req)
    expect(res.is_demo).toBe(true)
    expect(res.is_connected).toBe(true)
    expect(res.num_components).toBe(1)
    expect(res.bridges.length).toBe(1)
  })

  it('simulates failures locally and reports accurate trials', async () => {
    const req = {
      nodes: [
        { id: '1', label: 'Node 1' },
        { id: '2', label: 'Node 2' },
      ],
      edges: [{ id: 'e1', source: '1', target: '2' }],
      failed_nodes: [],
      failed_edges: [],
      failure_prob: 0.1,
      trials: 300,
      fail_target: 'edges' as const,
    }

    const res = await adapter.simulate(req)
    expect(res.is_demo).toBe(true)
    expect(res.trials).toBe(300)
    expect(res.estimated_reliability).toBeGreaterThanOrEqual(0)
    expect(res.estimated_reliability).toBeLessThanOrEqual(1)
  })

  it('computes reliability sweeps across probability vectors', async () => {
    const req = {
      nodes: [
        { id: '1', label: 'Node 1' },
        { id: '2', label: 'Node 2' },
      ],
      edges: [{ id: 'e1', source: '1', target: '2' }],
      failed_nodes: [],
      failed_edges: [],
      probs: [0.0, 0.5, 1.0],
      trials_per_prob: 50,
      fail_target: 'edges' as const,
    }

    const res = await adapter.reliabilitySweep(req)
    expect(res.is_demo).toBe(true)
    expect(res.points.length).toBe(3)
    expect(res.points[0].reliability).toBe(1.0)
    expect(res.points[2].reliability).toBe(0.0)
  })
})
