import type { Analysis, AnalyzeResponseBody } from '../services/api/contract'

/** A complete, typed analysis for unit tests; override the parts a test cares about. */
export function analysis(overrides: Partial<Analysis> = {}): Analysis {
  return {
    summary: {
      nodeCount: 1,
      edgeCount: 0,
      operationalNodeCount: 1,
      operationalEdgeCount: 0,
      failedNodeCount: 0,
      failedEdgeCount: 0,
      unavailableEdgeCount: 0,
      density: 0,
      explanationKey: 'density_definition',
    },
    connectivity: {
      connected: true,
      componentCount: 1,
      reasonKey: 'single_component',
      reason: 'Single component',
      explanationKey: 'connectivity_definition',
    },
    components: { items: [['A']], componentOf: { A: 0 }, explanationKey: 'component_definition' },
    degrees: { byNode: { A: { operational: 0, stored: 0 } }, explanationKey: 'degree_definition' },
    bridges: { edgeIds: [], explanationKey: 'bridge_definition' },
    articulationPoints: { nodeIds: [], explanationKey: 'articulation_point_definition' },
    traversal: null,
    path: null,
    ...overrides,
  }
}

export function analyzeResponse(overrides: Partial<Analysis> = {}): AnalyzeResponseBody {
  return { current: analysis(overrides), healthy: null, meta: { engine: 'networkx', engineVersion: '3.7', apiVersion: '2.0.0' } }
}
