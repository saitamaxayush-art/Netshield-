import React from 'react'
import { useGraphStore } from '@/store/graphStore'
import { useAnalysisStore } from '@/store/analysisStore'
import { useSettingsStore } from '@/store/settingsStore'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ApiErrorBox, SourceBadge, StaleNotice } from './ResultStatus'
import { Play, GitCommit, Network, Share2, HelpCircle } from 'lucide-react'

const PATH_REASON: Record<'SOURCE_FAILED' | 'TARGET_FAILED' | 'DISCONNECTED', string> = {
  SOURCE_FAILED: 'No path: the start vertex is failed.',
  TARGET_FAILED: 'No path: the target vertex is failed.',
  DISCONNECTED: 'No path exists (disconnected vertices).',
}

export const AnalysisPanel: React.FC = () => {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const slot = useAnalysisStore((s) => s.analyze)
  const run = useAnalysisStore((s) => s.run)
  const startNode = useSettingsStore((s) => s.traversalStart) ?? ''
  const targetNode = useSettingsStore((s) => s.pathTarget) ?? ''
  const update = useSettingsStore((s) => s.update)

  const analysisResult = slot.result
  const isAnalyzing = slot.status === 'loading'
  const current = analysisResult?.current ?? null
  const labelOf = (id: string) => nodes.find((n) => n.id === id)?.data.label ?? id
  const edgeById = new Map(edges.map((e) => [e.id, e]))

  // The traversal start is also the path source.
  const setStart = (id: string) => update({ traversalStart: id || null, pathSource: id || null })
  const setTarget = (id: string) => update({ pathTarget: id || null })
  const handleRunAnalysis = () => void run('analyze')

  return (
    <div className="p-5 space-y-6 text-xs text-text-primary">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-accent-teal" />
          <span className="font-semibold uppercase tracking-wider text-[11px] font-mono">
            Graph Analysis
          </span>
        </div>
        {analysisResult && <SourceBadge isDemo={analysisResult.isDemo} testId="analysis-source" backendLabel="FastAPI NetworkX" />}
      </div>

      {/* Traversal Controls */}
      <div className="space-y-3 bg-bg-primary p-3 rounded-[2px] border border-border-subtle">
        <div className="text-[11px] font-mono text-text-muted uppercase">
          Traversal &amp; Path Targets
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] text-text-muted mb-1 font-mono">
              Start Vertex:
            </label>
            <select
              value={startNode}
              onChange={(e) => setStart(e.target.value)}
              className="w-full px-2 py-1 bg-bg-surface border border-border-strong rounded-[2px] text-text-primary text-xs focus:border-accent-teal focus:outline-none"
            >
              <option value="">(Select start)</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.data.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] text-text-muted mb-1 font-mono">
              Target Vertex:
            </label>
            <select
              value={targetNode}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full px-2 py-1 bg-bg-surface border border-border-strong rounded-[2px] text-text-primary text-xs focus:border-accent-teal focus:outline-none"
            >
              <option value="">(Select target)</option>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.data.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {targetNode && !startNode && (
          <p className="text-[10px] text-text-muted">Choose a start vertex as well to compute a shortest path.</p>
        )}

        <Button
          variant="primary"
          size="sm"
          className="w-full mt-1"
          leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
          isLoading={isAnalyzing}
          onClick={handleRunAnalysis}
        >
          Compute Graph Metrics
        </Button>
      </div>

      {/* Error state */}
      {slot.error && <ApiErrorBox title="Analysis Request Failed" error={slot.error} testId="analysis-error" onRetry={handleRunAnalysis} />}

      {current && slot.stale && <StaleNotice testId="analysis-stale" onRefresh={handleRunAnalysis} isLoading={isAnalyzing} />}

      {/* Results Display: only ever a validated backend response */}
      {current ? (
        <div className="space-y-4" data-testid="analysis-results">
          <div className="text-[10px] font-mono text-text-muted" data-testid="analysis-engine">
            {analysisResult?.isDemo ? 'Demo adapter' : 'NetworkX'} {analysisResult?.meta.engineVersion}, API {analysisResult?.meta.apiVersion}
          </div>

          {/* Overall Connectivity */}
          <div className="p-3 bg-bg-surface-elevated rounded-[2px] border border-border-subtle">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-text-muted font-mono uppercase">
                Connectivity Status
              </span>
              <Badge variant={current.connectivity.connected ? 'success' : 'failure'} size="sm" data-testid="analysis-connected">
                {current.connectivity.connected ? 'Fully Connected' : 'Disconnected'}
              </Badge>
            </div>
            <p className="text-[11px] text-text-secondary leading-normal mt-1" data-testid="analysis-reason">
              {current.connectivity.reason}
            </p>
          </div>

          {/* Density & Components */}
          <div className="grid grid-cols-2 gap-2 text-mono">
            <div className="p-2.5 bg-bg-primary rounded-[2px] border border-border-subtle">
              <div className="text-[10px] text-text-muted">Density D:</div>
              <div className="text-base font-semibold text-text-primary mt-0.5" data-testid="analysis-density">
                {current.summary.density.toFixed(4)}
              </div>
              <div className="text-[9px] text-text-muted">2|E| / (|V|(|V|-1))</div>
            </div>

            <div className="p-2.5 bg-bg-primary rounded-[2px] border border-border-subtle">
              <div className="text-[10px] text-text-muted">Components k:</div>
              <div className="text-base font-semibold text-accent-teal mt-0.5" data-testid="analysis-component-count">
                {current.connectivity.componentCount}
              </div>
              <div className="text-[9px] text-text-muted">Equivalence classes</div>
            </div>
          </div>

          {/* Bridges List */}
          <div className="p-3 bg-bg-surface-elevated rounded-[2px] border border-border-subtle space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-[11px] uppercase tracking-wider font-mono">
                <GitCommit className="w-3.5 h-3.5 text-accent-teal" />
                <span>Bridges ({current.bridges.edgeIds.length})</span>
              </div>
            </div>
            <p className="text-[10px] text-text-muted leading-tight">
              Edges whose removal increases the number of connected components: k(G - e) &gt; k(G).
            </p>
            {current.bridges.edgeIds.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5 pt-1" data-testid="analysis-bridges">
                {current.bridges.edgeIds.map((edgeId) => {
                  const edge = edgeById.get(edgeId)
                  return (
                    <li
                      key={edgeId}
                      data-edge-id={edgeId}
                      className="px-2 py-0.5 bg-bg-primary border border-accent-teal/30 rounded-[2px] font-mono text-[10px] text-accent-teal"
                    >
                      {edge ? `${labelOf(edge.source)} \u2194 ${labelOf(edge.target)}` : edgeId}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <span className="text-[11px] text-text-muted italic block pt-1" data-testid="analysis-bridges-none">
                No bridges detected; network possesses edge redundancy.
              </span>
            )}
          </div>

          {/* Articulation Points */}
          <div className="p-3 bg-bg-surface-elevated rounded-[2px] border border-border-subtle space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-[11px] uppercase tracking-wider font-mono">
                <Share2 className="w-3.5 h-3.5 text-accent-teal" />
                <span>Articulation Points ({current.articulationPoints.nodeIds.length})</span>
              </div>
            </div>
            <p className="text-[10px] text-text-muted leading-tight">
              Vertices whose removal increases connected components: k(G - v) &gt; k(G).
            </p>
            {current.articulationPoints.nodeIds.length > 0 ? (
              <ul className="flex flex-wrap gap-1.5 pt-1" data-testid="analysis-articulation">
                {current.articulationPoints.nodeIds.map((nodeId) => (
                  <li
                    key={nodeId}
                    data-node-id={nodeId}
                    className="px-2 py-0.5 bg-bg-primary border border-accent-teal/30 rounded-[2px] font-mono text-[10px] text-accent-teal"
                  >
                    {labelOf(nodeId)}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-[11px] text-text-muted italic block pt-1" data-testid="analysis-articulation-none">
                No cut vertices detected; network is 2-vertex connected.
              </span>
            )}
          </div>

          {/* BFS & DFS when a start vertex was chosen */}
          {current.traversal && (
            <div className="p-3 bg-bg-primary rounded-[2px] border border-border-subtle space-y-1.5 font-mono text-[10px]" data-testid="analysis-traversal">
              {current.traversal.error ? (
                <div className="text-state-failure">{current.traversal.error.message}</div>
              ) : (
                <>
                  <div className="text-text-muted uppercase">Breadth-First Search (BFS), with layer:</div>
                  <div className="text-text-primary break-all" data-testid="analysis-bfs">
                    {current.traversal.bfs.map((step) => `${labelOf(step.nodeId)} (${step.layer})`).join(' \u2192 ')}
                  </div>
                  <div className="text-text-muted uppercase pt-1">Depth-First Search (DFS):</div>
                  <div className="text-text-primary break-all" data-testid="analysis-dfs">
                    {current.traversal.dfs.map(labelOf).join(' \u2192 ')}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Shortest path when start and target were chosen */}
          {current.path && (
            <div className="p-3 bg-bg-primary rounded-[2px] border border-border-subtle space-y-1.5 font-mono text-[10px]" data-testid="analysis-path">
              <div className="text-text-muted uppercase">Shortest Path:</div>
              {current.path.found && current.path.nodeIds ? (
                <div className="text-accent-teal font-semibold break-all">
                  {current.path.nodeIds.map(labelOf).join(' \u2192 ')} ({current.path.hops} hops
                  {current.path.metric === 'weight' ? `, total weight ${current.path.length}` : ''})
                </div>
              ) : (
                <div className="text-state-failure">{PATH_REASON[current.path.reason ?? 'DISCONNECTED']}</div>
              )}
              {current.path.weightsIgnoredReason === 'MISSING_WEIGHTS' && (
                <div className="text-state-warning" data-testid="analysis-weights-ignored">
                  Weights ignored: not every link has a weight, so the path counts hops.
                </div>
              )}
            </div>
          )}
        </div>
      ) : !slot.error && (
        <div className="text-center py-8 text-text-muted space-y-2" data-testid="analysis-empty">
          <HelpCircle className="w-6 h-6 mx-auto stroke-1" />
          <p className="text-[11px]">
            {nodes.length === 0
              ? 'Add nodes to the canvas to analyze the network.'
              : isAnalyzing
                ? 'Analyzing on the backend...'
                : 'Analysis runs automatically after each change. Click \u201cCompute Graph Metrics\u201d to run it now.'}
          </p>
        </div>
      )}
    </div>
  )
}
