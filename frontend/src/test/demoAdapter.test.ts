import { describe, it, expect } from 'vitest'
import { DemoAdapter } from '../services/api/demoAdapter'
import { SimulateResponseSchema, SweepResponseSchema } from '../services/api/contract'

const graph = {
  nodes: [
    { id: '1', label: 'Node 1' },
    { id: '2', label: 'Node 2' },
  ],
  edges: [{ id: 'e1', source: '1', target: '2' }],
}

describe('DemoAdapter (explicit demo mode only)', () => {
  it('has no analysis method: demo mode never fabricates analysis results', () => {
    expect('analyze' in new DemoAdapter()).toBe(false)
  })

  it('simulates failures locally in the legacy response shape', () => {
    const res = new DemoAdapter().simulate({ ...graph, failure_prob: 0.1, trials: 300, fail_target: 'edges' })
    expect(SimulateResponseSchema.parse(res)).toEqual(res)
    expect(res.trials).toBe(300)
    expect(res.estimated_reliability).toBeGreaterThanOrEqual(0)
    expect(res.estimated_reliability).toBeLessThanOrEqual(1)
  })

  it('uses the backend defaults when optional fields are omitted', () => {
    const res = new DemoAdapter().simulate(graph)
    expect(res.trials).toBe(500)
    expect(res.failure_probability).toBe(0.1)
    expect(res.fail_target).toBe('edges')
  })

  it('computes reliability sweeps across probability vectors', () => {
    const res = new DemoAdapter().reliabilitySweep({ ...graph, probs: [0.0, 0.5, 1.0], trials_per_prob: 50 })
    expect(SweepResponseSchema.parse(res)).toEqual(res)
    expect(res.points.map((p) => p.prob)).toEqual([0.0, 0.5, 1.0])
    expect(res.points[0].reliability).toBe(1.0)
    expect(res.points[2].reliability).toBe(0.0)
  })
})
