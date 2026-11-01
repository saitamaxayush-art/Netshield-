/**
 * Requests whose real backend responses are captured in ./backend/*.json by
 * scripts/capture-api-fixtures.mjs (which imports this file through Node's type stripping, so keep
 * imports type only). Tests send the same requests to the demo adapter and parse the responses.
 */
import type { AnalyzeRequestBody, ApiEdge, ApiNode, SimulateRequestBody, SweepRequestBody } from '../../services/api/schemas'

const node = (id: string, failed = false): ApiNode => ({ id, label: `Node ${id}`, type: 'router', failed })
const edge = (id: string, source: string, target: string, extra: Partial<ApiEdge> = {}): ApiEdge => ({ id, source, target, failed: false, ...extra })

const star = {
  nodes: ['hub', 'L1', 'L2', 'L3', 'L4'].map((id) => node(id)),
  edges: ['L1', 'L2', 'L3', 'L4'].map((l, i) => edge(`e${i + 1}`, 'hub', l)),
}
const twoTriangles = {
  nodes: ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => node(id)),
  edges: [edge('ab', 'a', 'b'), edge('bc', 'b', 'c'), edge('ca', 'c', 'a'), edge('cd', 'c', 'd'), edge('de', 'd', 'e'), edge('ef', 'e', 'f'), edge('fd', 'f', 'd')],
}
const ring = {
  nodes: ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'].map((id) => node(id, id === 'r4')),
  edges: [1, 2, 3, 4, 5, 6].map((i) => edge(`e-r${i}`, `r${i}`, `r${(i % 6) + 1}`, i === 1 ? { failed: true } : {})),
}
const weighted = {
  nodes: ['s', 'x', 'y', 't'].map((id) => node(id)),
  edges: [
    edge('sx', 's', 'x', { weight: 1 }),
    edge('xt', 'x', 't', { weight: 1 }),
    edge('sy', 's', 'y', { weight: 0.5 }),
    edge('yt', 'y', 't', { weight: 0.5 }),
    edge('st', 's', 't', { weight: 5 }),
  ],
}
// Ids whose code point order differs from UTF-16 order (U+FF5E sorts before U+1F600), plus mixed case.
const unicode = {
  nodes: ['B', 'a', '～', '\u{1F600}', 'Z'].map((id) => node(id)),
  edges: [edge('x1', 'B', 'a'), edge('x2', 'a', '～'), edge('x3', '～', '\u{1F600}'), edge('x4', '\u{1F600}', 'B'), edge('x5', 'Z', 'a')],
}

export const ANALYZE_CASES: Record<string, AnalyzeRequestBody> = {
  'analyze-star': { ...star, startNodeId: 'L1', pathSource: 'L1', pathTarget: 'L4', compareHealthy: true },
  'analyze-two-triangles': { ...twoTriangles, startNodeId: 'a', pathSource: 'a', pathTarget: 'f' },
  'analyze-ring-failures': { ...ring, startNodeId: 'r4', pathSource: 'r2', pathTarget: 'r6', compareHealthy: true },
  'analyze-weighted': { ...weighted, pathSource: 's', pathTarget: 't', useWeights: true },
  'analyze-missing-weights': {
    ...weighted,
    edges: [...weighted.edges.slice(0, 4), edge('st', 's', 't')],
    pathSource: 's',
    pathTarget: 't',
    useWeights: true,
  },
  'analyze-unicode': { ...unicode, startNodeId: 'Z', pathSource: 'Z', pathTarget: '\u{1F600}' },
  'analyze-empty': { nodes: [], edges: [] },
}

export const SIMULATE_CASES: Record<string, SimulateRequestBody> = {
  'simulate-all-terminal': { ...twoTriangles, edgeFailureProbability: 0.2, trials: 2000, seed: 7 },
  'simulate-two-terminal': {
    ...star,
    mode: 'two-terminal',
    source: 'L1',
    target: 'L2',
    edgeFailureProbability: 0.1,
    nodeFailureProbability: 0.05,
    trials: 1000,
    seed: 11,
  },
}

/** Ring with r4 failed: the survivors form the path r5 r6 r1 r2 r3, so R(p) = (1 - p)^4 exactly. */
export const SWEEP_CASES: Record<string, SweepRequestBody> = {
  sweep: { nodes: ring.nodes, edges: ring.edges.map((e) => ({ ...e, failed: false })), pMin: 0, pMax: 0.5, points: 6, trialsPerPoint: 500, seed: 3 },
}

/** Requests the backend rejects (HTTP 422), with the endpoint they go to. */
export const ERROR_CASES: Record<string, { path: '/api/analyze'; request: AnalyzeRequestBody } | { path: '/api/simulate'; request: SimulateRequestBody }> = {
  'error-parallel-edge': { path: '/api/analyze', request: { nodes: [node('A'), node('B')], edges: [edge('e1', 'A', 'B'), edge('e2', 'B', 'A')] } },
  'error-validation': { path: '/api/simulate', request: { ...star, edgeFailureProbability: 1.5 } },
  'error-two-terminal-missing': { path: '/api/simulate', request: { ...star, mode: 'two-terminal', edgeFailureProbability: 0.1 } },
}
