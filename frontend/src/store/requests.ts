/**
 * Request bodies for the three POST endpoints, built from the editor graph and the settings.
 * Endpoint settings that name a node no longer in the graph are left out, so a stale selection
 * never turns into a 422.
 */
import { toApiGraph, type EditorGraph } from '@/types/graph'
import type { AnalyzeRequestBody, SimulateRequestBody, SweepRequestBody } from '@/services/api/schemas'
import type { Settings } from './settingsStore'

function present(graph: EditorGraph, id: string | null): string | null {
  return id !== null && graph.nodes.some((n) => n.id === id) ? id : null
}

export function buildAnalyzeRequest(graph: EditorGraph, settings: Settings): AnalyzeRequestBody {
  const body: AnalyzeRequestBody = { ...toApiGraph(graph), compareHealthy: true }
  const start = present(graph, settings.traversalStart)
  const source = present(graph, settings.pathSource)
  const target = present(graph, settings.pathTarget)
  if (start) body.startNodeId = start
  if (source && target) {
    body.pathSource = source
    body.pathTarget = target
    // Any weight asks for a weighted path; the backend reports MISSING_WEIGHTS if some links have none.
    if (graph.edges.some((e) => e.data?.weight !== undefined)) body.useWeights = true
  }
  return body
}

function terminals(graph: EditorGraph, settings: Settings): Pick<SimulateRequestBody, 'mode' | 'source' | 'target'> {
  if (settings.mode !== 'two-terminal') return { mode: 'all-terminal' }
  // Missing terminals are sent as null: the backend answers with a clear VALIDATION_ERROR.
  return { mode: 'two-terminal', source: present(graph, settings.terminalSource), target: present(graph, settings.terminalTarget) }
}

export function buildSimulateRequest(graph: EditorGraph, settings: Settings): SimulateRequestBody {
  return {
    ...toApiGraph(graph),
    ...terminals(graph, settings),
    edgeFailureProbability: settings.edgeFailureProbability,
    nodeFailureProbability: settings.nodeFailureProbability,
    trials: settings.trials,
    ...(settings.seed !== null ? { seed: settings.seed } : {}),
  }
}

export function buildSweepRequest(graph: EditorGraph, settings: Settings): SweepRequestBody {
  return {
    ...toApiGraph(graph),
    ...terminals(graph, settings),
    nodeFailureProbability: settings.nodeFailureProbability,
    pMin: settings.sweepPMin,
    pMax: settings.sweepPMax,
    points: settings.sweepPoints,
    trialsPerPoint: settings.trialsPerPoint,
    ...(settings.seed !== null ? { seed: settings.seed } : {}),
  }
}

export type RequestKind = 'analyze' | 'simulate' | 'sweep'

/**
 * Everything a result depends on, as a string. Labels and node types are part of the request but do
 * not change any computed number, so they are excluded: renaming a node does not mark results out
 * of date. Positions are not part of any request.
 */
export function inputKey(kind: RequestKind, graph: EditorGraph, settings: Settings): string {
  const body = kind === 'analyze' ? buildAnalyzeRequest(graph, settings) : kind === 'simulate' ? buildSimulateRequest(graph, settings) : buildSweepRequest(graph, settings)
  return JSON.stringify({ ...body, nodes: body.nodes.map((n) => [n.id, n.failed]) })
}
