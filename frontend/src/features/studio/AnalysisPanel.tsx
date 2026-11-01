import React, { useState } from 'react'
import { useGraphStore } from '@/store/graphStore'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Play,
  RotateCcw,
  AlertTriangle,
  GitCommit,
  Network,
  Share2,
  HelpCircle,
} from 'lucide-react'

const PATH_REASON: Record<'SOURCE_FAILED' | 'TARGET_FAILED' | 'DISCONNECTED', string> = {
  SOURCE_FAILED: 'No path: the start vertex is failed.',
  TARGET_FAILED: 'No path: the target vertex is failed.',
  DISCONNECTED: 'No path exists (disconnected vertices).',
}

export const AnalysisPanel: React.FC = () => {
  const {
    nodes,
    edges,
    runAnalysis,
    analysisResult,
    isAnalyzing,
    analysisError,
  } = useGraphStore()

  const [startNode, setStartNode] = useState<string>('')
  const [targetNode, setTargetNode] = useState<string>('')

  const current = analysisResult?.data.current ?? null
  const labelOf = (id: string) => nodes.find((n) => n.id === id)?.data.label ?? id
  const edgeById = new Map(edges.map((e) => [e.id, e]))

  const handleRunAnalysis = () => {
    runAnalysis(startNode || null, targetNode || null)
  }

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
        {analysisResult && (
          <Badge variant="accent" size="sm" data-testid="analysis-source" data-source={analysisResult.source}>
            FastAPI NetworkX
          </Badge>
        )}
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
              onChange={(e) => setStartNode(e.target.value)}
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
              onChange={(e) => setTargetNode(e.target.value)}
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
      {analysisError && (
        <div
          role="alert"
          data-testid="analysis-error"
          className="p-3 bg-state-failure-dim border border-state-failure/40 rounded-[2px] text-state-failure space-y-2"
        >
          <div className="flex items-center gap-1.5 font-semibold text-xs">
            <AlertTriangle className="w-4 h-4" />
            <span>Analysis Request Failed</span>
          </div>
          <p className="text-[11px]">{analysisError}</p>
          <p className="text-[11px]">No result is shown. Nothing was computed in the browser.</p>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<RotateCcw className="w-3 h-3" />}
            onClick={handleRunAnalysis}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Results Display: only ever a validated backend response */}
      {current ? (
        <div className="space-y-4" data-testid="analysis-results">
          <div className="text-[10px] font-mono text-text-muted" data-testid="analysis-engine">
            NetworkX {analysisResult?.data.meta.engineVersion}, API {analysisResult?.data.meta.apiVersion}
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
                  {current.path.nodeIds.map(labelOf).join(' \u2192 ')} ({current.path.hops} hops)
                </div>
              ) : (
                <div className="text-state-failure">{PATH_REASON[current.path.reason ?? 'DISCONNECTED']}</div>
              )}
            </div>
          )}
        </div>
      ) : !analysisError && (
        <div className="text-center py-8 text-text-muted space-y-2">
          <HelpCircle className="w-6 h-6 mx-auto stroke-1" />
          <p className="text-[11px]">
            Click &ldquo;Compute Graph Metrics&rdquo; to execute Tarjan cut detection and component analysis.
          </p>
        </div>
      )}
    </div>
  )
}
