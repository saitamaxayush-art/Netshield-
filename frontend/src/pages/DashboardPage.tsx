import React from 'react'
import { Link } from 'react-router-dom'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Container } from '@/components/layout/Container'
import { useGraphStore } from '@/store/graphStore'
import { useAnalysisStore } from '@/store/analysisStore'
import { useAutoAnalyze } from '@/hooks/useAutoAnalyze'
import { ApiErrorBox, SourceBadge, StaleNotice } from '@/features/studio/ResultStatus'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Network,
  Activity,
  Layers,
  ArrowRight,
  GitCommit,
  Share2,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react'
import '@/store/bootstrap'

/**
 * Every number on this page comes from the backend's analysis of the current workspace graph (or a
 * labelled demo result in demo mode). Nothing is computed here.
 */
export const DashboardPage: React.FC = () => {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const loadPreset = useGraphStore((s) => s.loadPreset)
  const analysis = useAnalysisStore((s) => s.analyze)
  const simulate = useAnalysisStore((s) => s.simulate)
  const run = useAnalysisStore((s) => s.run)
  useAutoAnalyze()

  const result = analysis.result
  const current = result?.current ?? null
  const simulationResult = simulate.result
  const labelOf = (id: string) => nodes.find((n) => n.id === id)?.data.label ?? id
  const edgeById = new Map(edges.map((e) => [e.id, e]))

  const isEmpty = nodes.length === 0

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary text-text-primary">
      <Navbar />

      <main className="flex-1">
        <Container size="wide" className="pt-28 pb-16 space-y-8">
          {/* Dashboard Title Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-border-subtle">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="accent">Topological Overview</Badge>
              <span className="text-xs text-text-muted font-mono">Active Session</span>
            </div>
            <h1 className="headline-sub text-text-primary">Network Reliability Dashboard</h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-1">
              Topological metrics derived from your current workspace graph.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/studio">
              <Button
                variant="primary"
                size="md"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Open Studio
              </Button>
            </Link>
          </div>
        </div>

        {/* Empty State when no nodes exist */}
        {isEmpty ? (
          <div className="p-12 text-center bg-bg-surface border border-border-subtle rounded-[4px] space-y-4 max-w-xl mx-auto my-12">
            <Network className="w-10 h-10 mx-auto text-text-muted stroke-1" />
            <h2 className="text-base font-semibold text-text-primary">
              No Graph Topology In Workspace
            </h2>
            <p className="text-xs text-text-secondary leading-relaxed">
              Your canvas is currently empty. Open the Studio to construct custom router and server
              topologies, or load a preconfigured example graph to inspect discrete math connectivity.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<FolderOpen className="w-3.5 h-3.5" />}
                onClick={() => loadPreset('star')}
              >
                Load Star Example
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<FolderOpen className="w-3.5 h-3.5" />}
                onClick={() => loadPreset('ring')}
              >
                Load Ring Example
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<FolderOpen className="w-3.5 h-3.5" />}
                onClick={() => loadPreset('mesh')}
              >
                Load Mesh Example
              </Button>
            </div>
          </div>
        ) : (
          <>
            {analysis.error && (
              <ApiErrorBox title="Analysis Request Failed" error={analysis.error} testId="dashboard-analysis-error" onRetry={() => void run('analyze')} />
            )}
            {current && analysis.stale && (
              <StaleNotice testId="dashboard-stale" onRefresh={() => void run('analyze')} isLoading={analysis.status === 'loading'} />
            )}
            {!current && !analysis.error && (
              <div className="p-6 text-center bg-bg-surface border border-border-subtle rounded-[4px] text-xs text-text-muted font-mono" data-testid="dashboard-loading">
                Analyzing the workspace graph on the backend...
              </div>
            )}

            {current && result && (
            <>
            <div className="flex items-center gap-2 text-[11px] font-mono text-text-muted">
              <SourceBadge isDemo={result.isDemo} testId="dashboard-source" backendLabel="FastAPI NetworkX" />
              <span>
                {result.isDemo ? 'Demo adapter' : 'NetworkX'} {result.meta.engineVersion}, API {result.meta.apiVersion}
              </span>
            </div>

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-bg-surface border border-border-subtle rounded-[3px] space-y-2">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-[11px] font-mono uppercase">Vertices |V|</span>
                  <Layers className="w-4 h-4 text-accent-teal" />
                </div>
                <div className="text-2xl font-mono font-semibold text-text-primary" data-testid="dashboard-node-count">
                  {current.summary.nodeCount}
                </div>
                <div className="text-[11px] text-text-muted flex justify-between font-mono">
                  <span>Active: {current.summary.operationalNodeCount}</span>
                  <span className={current.summary.failedNodeCount > 0 ? 'text-state-failure' : ''}>
                    Failed: {current.summary.failedNodeCount}
                  </span>
                </div>
              </div>

              <div className="p-5 bg-bg-surface border border-border-subtle rounded-[3px] space-y-2">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-[11px] font-mono uppercase">Edges |E|</span>
                  <Network className="w-4 h-4 text-accent-cyan" />
                </div>
                <div className="text-2xl font-mono font-semibold text-text-primary" data-testid="dashboard-edge-count">
                  {current.summary.edgeCount}
                </div>
                <div className="text-[11px] text-text-muted flex justify-between font-mono">
                  <span>Active: {current.summary.operationalEdgeCount}</span>
                  <span className={current.summary.unavailableEdgeCount > 0 ? 'text-state-failure' : ''}>
                    Unavailable: {current.summary.unavailableEdgeCount}
                  </span>
                </div>
              </div>

              <div className="p-5 bg-bg-surface border border-border-subtle rounded-[3px] space-y-2">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-[11px] font-mono uppercase">Components (k)</span>
                  <Badge variant={current.connectivity.connected ? 'success' : 'failure'} size="sm">
                    {current.connectivity.connected ? 'Connected' : 'Fragmented'}
                  </Badge>
                </div>
                <div className="text-2xl font-mono font-semibold text-text-primary" data-testid="dashboard-component-count">
                  {current.connectivity.componentCount}
                </div>
                <div className="text-[11px] text-text-muted font-mono flex items-center gap-1.5">
                  {current.connectivity.connected ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-state-success" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-state-failure" />
                  )}
                  <span>
                    {current.connectivity.reason}
                    {result.healthy ? `; with no failures: ${result.healthy.connectivity.reason}` : ''}
                  </span>
                </div>
              </div>

              <div className="p-5 bg-bg-surface border border-border-subtle rounded-[3px] space-y-2">
                <div className="flex items-center justify-between text-text-muted">
                  <span className="text-[11px] font-mono uppercase">Vulnerabilities</span>
                  <Activity className="w-4 h-4 text-state-warning" />
                </div>
                <div className="text-2xl font-mono font-semibold text-accent-teal">
                  {current.bridges.edgeIds.length + current.articulationPoints.nodeIds.length}
                </div>
                <div className="text-[11px] text-text-muted font-mono flex justify-between">
                  <span>Bridges: {current.bridges.edgeIds.length}</span>
                  <span>Cut Vertices: {current.articulationPoints.nodeIds.length}</span>
                </div>
              </div>
            </div>

            {/* In-depth Graph Details */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 p-6 bg-bg-surface border border-border-subtle rounded-[4px] space-y-6">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary mb-1">
                    Graph Critical Vulnerabilities
                  </h2>
                  <p className="text-xs text-text-secondary">
                    Links and vertices whose loss splits the operational network.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-bg-primary rounded-[2px] border border-border-subtle space-y-3">
                    <div className="flex items-center gap-2 font-semibold text-xs text-text-primary">
                      <GitCommit className="w-3.5 h-3.5 text-accent-teal" />
                      <span>Bridges ({current.bridges.edgeIds.length})</span>
                    </div>
                    {current.bridges.edgeIds.length > 0 ? (
                      <ul className="space-y-1.5 font-mono text-[11px]" data-testid="dashboard-bridges">
                        {current.bridges.edgeIds.map((edgeId) => {
                          const edge = edgeById.get(edgeId)
                          return (
                            <li key={edgeId} data-edge-id={edgeId} className="p-1.5 bg-bg-surface border border-border-subtle rounded-[2px] text-accent-teal">
                              {edge ? `${labelOf(edge.source)} \u2194 ${labelOf(edge.target)}` : edgeId}
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <p className="text-xs text-text-muted italic">No bridge links in the operational graph.</p>
                    )}
                  </div>

                  <div className="p-4 bg-bg-primary rounded-[2px] border border-border-subtle space-y-3">
                    <div className="flex items-center gap-2 font-semibold text-xs text-text-primary">
                      <Share2 className="w-3.5 h-3.5 text-accent-teal" />
                      <span>Articulation Points ({current.articulationPoints.nodeIds.length})</span>
                    </div>
                    {current.articulationPoints.nodeIds.length > 0 ? (
                      <ul className="space-y-1.5 font-mono text-[11px]" data-testid="dashboard-articulation">
                        {current.articulationPoints.nodeIds.map((nodeId) => (
                          <li key={nodeId} data-node-id={nodeId} className="p-1.5 bg-bg-surface border border-border-subtle rounded-[2px] text-accent-teal">
                            {labelOf(nodeId)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-text-muted italic">No articulation cut vertices.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-border-subtle">
                  <div className="text-xs font-semibold uppercase tracking-wider text-text-primary">
                    Partition Breakdown ({current.components.items.length} Component{current.components.items.length !== 1 ? 's' : ''})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {current.components.items.map((comp, idx) => (
                      <div key={comp[0]} className="p-3 bg-bg-primary rounded-[2px] border border-border-subtle space-y-1.5">
                        <div className="text-xs font-mono font-semibold text-accent-teal">
                          Component {idx + 1} ({comp.length} vertices)
                        </div>
                        <div className="text-[10px] text-text-secondary font-mono truncate">{comp.map(labelOf).join(', ')}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Latest Simulation Result Card */}
              <div className="lg:col-span-4 p-6 bg-bg-surface border border-border-subtle rounded-[4px] space-y-5">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary mb-1">
                    Monte Carlo Reliability
                  </h2>
                  <p className="text-xs text-text-secondary">
                    Statistical reliability estimate from trial failure simulations.
                  </p>
                </div>

                {simulationResult && simulate.stale && (
                  <p className="text-[11px] text-state-warning font-mono" data-testid="dashboard-simulation-stale">
                    Results out of date: the network or settings changed since this simulation.
                  </p>
                )}
                {simulationResult ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-bg-primary rounded-[2px] border border-border-subtle text-center space-y-1">
                      <div className="text-[11px] font-mono text-text-muted uppercase">
                        Estimated Network Reliability{simulationResult.isDemo ? ' (Demo result)' : ''}
                      </div>
                      <div className="text-3xl font-mono font-semibold text-accent-teal">
                        {(simulationResult.estimate * 100).toFixed(1)}%
                      </div>
                      <div className="text-[10px] font-mono text-text-muted">
                        95% Wilson interval: [{(simulationResult.wilson95.low * 100).toFixed(1)}%,{' '}
                        {(simulationResult.wilson95.high * 100).toFixed(1)}%]
                      </div>
                    </div>

                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex justify-between py-1 border-b border-border-subtle">
                        <span className="text-text-muted">Sample Trials:</span>
                        <span>{simulationResult.trials}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border-subtle">
                        <span className="text-text-muted">Successful Runs:</span>
                        <span>{simulationResult.connectedTrials}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border-subtle">
                        <span className="text-text-muted">Link failure p:</span>
                        <span>{(simulationResult.edgeFailureProbability * 100).toFixed(0)}%</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-text-muted">Standard Error:</span>
                        <span>&plusmn;{(simulationResult.standardError * 100).toFixed(2)}%</span>
                      </div>
                    </div>

                    <Link to="/studio" className="block pt-2">
                      <Button variant="outline" size="sm" className="w-full">
                        Run New Simulation
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="p-6 text-center bg-bg-primary rounded-[2px] border border-border-subtle space-y-3">
                    <Activity className="w-8 h-8 mx-auto text-text-muted stroke-1" />
                    <p className="text-xs text-text-secondary leading-relaxed">
                      No simulation has been run in this session yet.
                    </p>
                    <Link to="/studio">
                      <Button variant="primary" size="sm">
                        Simulate in Studio
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
            </>
            )}
          </>
        )}
        </Container>
      </main>

      <Footer />
    </div>
  )
}

export default DashboardPage
