import { describe, it, expect } from 'vitest'
import { AnalyzeResponseSchema, ErrorResponseSchema, SimulateResponseSchema } from '../services/api/contract'

const analysis = {
  summary: {
    nodeCount: 2,
    edgeCount: 1,
    operationalNodeCount: 2,
    operationalEdgeCount: 1,
    failedNodeCount: 0,
    failedEdgeCount: 0,
    unavailableEdgeCount: 0,
    density: 1,
    explanationKey: 'density_definition',
  },
  connectivity: {
    connected: true,
    componentCount: 1,
    reasonKey: 'single_component',
    reason: 'Single component',
    explanationKey: 'connectivity_definition',
  },
  components: { items: [['A', 'B']], componentOf: { A: 0, B: 0 }, explanationKey: 'component_definition' },
  degrees: {
    byNode: { A: { operational: 1, stored: 1 }, B: { operational: 1, stored: 1 } },
    explanationKey: 'degree_definition',
  },
  bridges: { edgeIds: ['e1'], explanationKey: 'bridge_definition' },
  articulationPoints: { nodeIds: [], explanationKey: 'articulation_point_definition' },
  traversal: null,
  path: null,
}
const valid = { current: analysis, healthy: null, meta: { engine: 'networkx', engineVersion: '3.7', apiVersion: '2.0.0' } }

describe('AnalyzeResponseSchema (mirror of the generated type)', () => {
  it('accepts a contract shaped response', () => {
    expect(AnalyzeResponseSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects the pre-Phase-1 response shape', () => {
    const legacy = { node_degrees: {}, connected_components: [], num_components: 0, is_connected: false, bridges: [] }
    expect(AnalyzeResponseSchema.safeParse(legacy).success).toBe(false)
  })

  it('rejects unknown fields instead of ignoring them', () => {
    expect(AnalyzeResponseSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false)
    const current = { ...analysis, summary: { ...analysis.summary, surprise: true } }
    expect(AnalyzeResponseSchema.safeParse({ ...valid, current }).success).toBe(false)
  })

  it('rejects a missing or mistyped field', () => {
    const { bridges: _bridges, ...withoutBridges } = analysis
    expect(AnalyzeResponseSchema.safeParse({ ...valid, current: withoutBridges }).success).toBe(false)
    const wrongType = { ...analysis, connectivity: { ...analysis.connectivity, connected: 'yes' } }
    expect(AnalyzeResponseSchema.safeParse({ ...valid, current: wrongType }).success).toBe(false)
  })

  it('rejects an unknown explanation key', () => {
    const current = { ...analysis, bridges: { ...analysis.bridges, explanationKey: 'something_else' } }
    expect(AnalyzeResponseSchema.safeParse({ ...valid, current }).success).toBe(false)
  })
})

describe('other schemas', () => {
  it('parses the shared error body', () => {
    const body = { error: { code: 'PARALLEL_EDGE', message: 'm', details: { edgeIds: ['a', 'b'], nodes: ['A', 'B'] } } }
    expect(ErrorResponseSchema.safeParse(body).success).toBe(true)
  })

  it('rejects a legacy simulate response with an unexpected field', () => {
    const sim = {
      confidence_interval_95: [0.1, 0.2],
      connected_trials: 1,
      estimated_reliability: 0.5,
      execution_time_ms: 1,
      fail_target: 'edges',
      failure_probability: 0.1,
      standard_error: 0.1,
      trials: 2,
    }
    expect(SimulateResponseSchema.safeParse(sim).success).toBe(true)
    expect(SimulateResponseSchema.safeParse({ ...sim, reliability: 0.5 }).success).toBe(false)
  })
})
