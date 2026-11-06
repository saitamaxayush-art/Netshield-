/**
 * Read only views of the latest analysis for canvas decoration. Each returns primitives, so a node
 * or edge re-renders only when its own annotation changes. Nothing is shown from a result that is
 * out of date, failed, or missing: annotations come from the backend (or a labelled demo result) only.
 */
import { useAnalysisStore, type AnalysisState } from './analysisStore'
import { useHighlight } from './studioViewStore'

const freshAnalysis = (s: AnalysisState) => (s.analyze.result && !s.analyze.stale ? s.analyze.result.current : null)

/** Component index of a node in the current analysis, or null. */
export const useComponentIndex = (nodeId: string): number | null =>
  useAnalysisStore((s) => freshAnalysis(s)?.components.componentOf[nodeId] ?? null)

export const useIsArticulationPoint = (nodeId: string): boolean =>
  useAnalysisStore((s) => freshAnalysis(s)?.articulationPoints.nodeIds.includes(nodeId) ?? false)

export const useIsBridge = (edgeId: string): boolean =>
  useAnalysisStore((s) => freshAnalysis(s)?.bridges.edgeIds.includes(edgeId) ?? false)

/** Operational and stored degree from the backend's analysis, or null when there is none. */
export const useDegree = (nodeId: string): { operational: number; stored: number } | null =>
  useAnalysisStore((s) => freshAnalysis(s)?.degrees.byNode[nodeId] ?? null)

/** The badge of a highlighted node ('' for no badge), or undefined when it is not highlighted. */
export const useNodeHighlight = (nodeId: string): string | undefined => useHighlight((s) => s.nodes[nodeId])

export const useEdgeHighlighted = (edgeId: string): boolean => useHighlight((s) => s.edges[edgeId] === true)
