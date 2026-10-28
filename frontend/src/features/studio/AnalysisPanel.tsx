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

export const AnalysisPanel: React.FC = () => {
  const {
    nodes,
    runAnalysis,
    analysisResult,
    isAnalyzing,
    analysisError,
  } = useGraphStore()

  const [startNode, setStartNode] = useState<string>('')
  const [targetNode, setTargetNode] = useState<string>('')

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
          <Badge variant={analysisResult.is_demo ? 'outline' : 'accent'} size="sm">
            {analysisResult.is_demo ? 'Demo Adapter' : 'FastAPI NetworkX'}
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
        <div className="p-3 bg-state-failure-dim border border-state-failure/40 rounded-[2px] text-state-failure space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-xs">
            <AlertTriangle className="w-4 h-4" />
            <span>Analysis Request Failed</span>
          </div>
          <p className="text-[11px]">{analysisError}</p>
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

      {/* Results Display */}
      {analysisResult ? (
        <div className="space-y-4">
          {/* Overall Connectivity */}
          <div className="p-3 bg-bg-surface-elevated rounded-[2px] border border-border-subtle">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-text-muted font-mono uppercase">
                Connectivity Status
              </span>
              <Badge variant={analysisResult.is_connected ? 'success' : 'failure'} size="sm">
                {analysisResult.is_connected ? 'Fully Connected' : 'Disconnected'}
              </Badge>
            </div>
            <p className="text-[11px] text-text-secondary leading-normal mt-1">
              {analysisResult.is_connected
                ? 'Every active vertex has an existing path to every other active vertex in the graph.'
                : `The graph has fragmented into ${analysisResult.num_components} disconnected components.`}
            </p>
          </div>

          {/* Density & Vertices */}
          <div className="grid grid-cols-2 gap-2 text-mono">
            <div className="p-2.5 bg-bg-primary rounded-[2px] border border-border-subtle">
              <div className="text-[10px] text-text-muted">Density D:</div>
              <div className="text-base font-semibold text-text-primary mt-0.5">
                {analysisResult.density}
              </div>
              <div className="text-[9px] text-text-muted">2|E| / (|V|(|V|-1))</div>
            </div>

            <div className="p-2.5 bg-bg-primary rounded-[2px] border border-border-subtle">
              <div className="text-[10px] text-text-muted">Components k:</div>
              <div className="text-base font-semibold text-accent-teal mt-0.5">
                {analysisResult.num_components}
              </div>
              <div className="text-[9px] text-text-muted">Equivalence classes</div>
            </div>
          </div>

          {/* Bridges List */}
          <div className="p-3 bg-bg-surface-elevated rounded-[2px] border border-border-subtle space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-[11px] uppercase tracking-wider font-mono">
                <GitCommit className="w-3.5 h-3.5 text-accent-teal" />
                <span>Bridges ({analysisResult.bridges.length})</span>
              </div>
            </div>
            <p className="text-[10px] text-text-muted leading-tight">
              Edges whose removal increases the number of connected components: k(G - e) &gt; k(G).
            </p>
            {analysisResult.bridges.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {analysisResult.bridges.map(([u, v], idx) => {
                  const nodeU = nodes.find((n) => n.id === u)?.data.label || u
                  const nodeV = nodes.find((n) => n.id === v)?.data.label || v
                  return (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-bg-primary border border-accent-teal/30 rounded-[2px] font-mono text-[10px] text-accent-teal"
                    >
                      {nodeU} &harr; {nodeV}
                    </span>
                  )
                })}
              </div>
            ) : (
              <span className="text-[11px] text-text-muted italic block pt-1">
                No bridges detected; network possesses edge redundancy.
              </span>
            )}
          </div>

          {/* Articulation Points */}
          <div className="p-3 bg-bg-surface-elevated rounded-[2px] border border-border-subtle space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-[11px] uppercase tracking-wider font-mono">
                <Share2 className="w-3.5 h-3.5 text-accent-teal" />
                <span>Articulation Points ({analysisResult.articulation_points.length})</span>
              </div>
            </div>
            <p className="text-[10px] text-text-muted leading-tight">
              Vertices whose removal increases connected components: k(G - v) &gt; k(G).
            </p>
            {analysisResult.articulation_points.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {analysisResult.articulation_points.map((artId) => {
                  const label = nodes.find((n) => n.id === artId)?.data.label || artId
                  return (
                    <span
                      key={artId}
                      className="px-2 py-0.5 bg-bg-primary border border-accent-teal/30 rounded-[2px] font-mono text-[10px] text-accent-teal"
                    >
                      {label}
                    </span>
                  )
                })}
              </div>
            ) : (
              <span className="text-[11px] text-text-muted italic block pt-1">
                No cut vertices detected; network is 2-vertex connected.
              </span>
            )}
          </div>

          {/* BFS & DFS Orders if start node was chosen */}
          {analysisResult.bfs_order && (
            <div className="p-3 bg-bg-primary rounded-[2px] border border-border-subtle space-y-1.5 font-mono text-[10px]">
              <div className="text-text-muted uppercase">Breadth-First Search (BFS):</div>
              <div className="text-text-primary break-all">
                {analysisResult.bfs_order
                  .map((id) => nodes.find((n) => n.id === id)?.data.label || id)
                  .join(' &rarr; ')}
              </div>
            </div>
          )}

          {analysisResult.dfs_order && (
            <div className="p-3 bg-bg-primary rounded-[2px] border border-border-subtle space-y-1.5 font-mono text-[10px]">
              <div className="text-text-muted uppercase">Depth-First Search (DFS):</div>
              <div className="text-text-primary break-all">
                {analysisResult.dfs_order
                  .map((id) => nodes.find((n) => n.id === id)?.data.label || id)
                  .join(' &rarr; ')}
              </div>
            </div>
          )}

          {/* Shortest Path if target was chosen */}
          {analysisResult.path !== undefined && (
            <div className="p-3 bg-bg-primary rounded-[2px] border border-border-subtle space-y-1.5 font-mono text-[10px]">
              <div className="text-text-muted uppercase">Shortest Path:</div>
              {analysisResult.path ? (
                <div className="text-accent-teal font-semibold break-all">
                  {analysisResult.path
                    .map((id) => nodes.find((n) => n.id === id)?.data.label || id)
                    .join(' &rarr; ')}
                </div>
              ) : (
                <div className="text-state-failure">No path exists (Disconnected vertices)</div>
              )}
            </div>
          )}
        </div>
      ) : (
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
