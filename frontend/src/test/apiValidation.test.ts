import { describe, it, expect } from 'vitest'
import {
  AnalyzeResponseSchema,
  SimulateResponseSchema,
  ReliabilitySweepResponseSchema,
} from '../types/api'

describe('API Zod Validation', () => {
  it('validates valid AnalyzeResponse data', () => {
    const validData = {
      node_degrees: { n1: 2, n2: 1 },
      connected_components: [['n1', 'n2']],
      num_components: 1,
      is_connected: true,
      bridges: [['n1', 'n2']],
      articulation_points: ['n1'],
      density: 0.5,
      active_nodes_count: 2,
      active_edges_count: 1,
      is_demo: false,
    }

    const parsed = AnalyzeResponseSchema.parse(validData)
    expect(parsed.is_connected).toBe(true)
  })

  it('rejects invalid AnalyzeResponse data missing required fields', () => {
    const invalidData = {
      is_connected: true,
    }

    expect(() => AnalyzeResponseSchema.parse(invalidData)).toThrow()
  })

  it('validates SimulateResponseSchema data', () => {
    const validSim = {
      trials: 500,
      connected_trials: 450,
      estimated_reliability: 0.9,
      standard_error: 0.0134,
      confidence_interval_95: [0.8737, 0.9263],
      failure_probability: 0.1,
      fail_target: 'edges',
      execution_time_ms: 12.5,
      is_demo: false,
    }

    const parsed = SimulateResponseSchema.parse(validSim)
    expect(parsed.estimated_reliability).toBe(0.9)
  })

  it('validates ReliabilitySweepResponseSchema data', () => {
    const validSweep = {
      points: [
        {
          prob: 0.1,
          reliability: 0.95,
          standard_error: 0.02,
          connected_trials: 95,
          total_trials: 100,
        },
      ],
      trials_per_prob: 100,
      fail_target: 'edges',
      is_demo: true,
    }

    const parsed = ReliabilitySweepResponseSchema.parse(validSweep)
    expect(parsed.points.length).toBe(1)
  })
})
