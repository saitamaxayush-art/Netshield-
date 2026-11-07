import React from 'react'
import { Link } from 'react-router-dom'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Container } from '@/components/layout/Container'
import { useGraphStore } from '@/store/graphStore'
import { useAnalysisStore } from '@/store/analysisStore'
import { PRESET_TITLES } from '@/store/presets'
import { useAutoAnalyze } from '@/hooks/useAutoAnalyze'
import { ApiErrorBox, SourceBadge, StaleNotice } from '@/features/studio/ResultStatus'
import { AnalysisAnnouncer } from '@/features/studio/AnalysisAnnouncer'
import { GraphMiniMap } from '@/features/dashboard/GraphMiniMap'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Activity, ArrowRight, FolderOpen, Network } from 'lucide-react'
import '@/store/bootstrap'

const Metric: React.FC<{ label: string; value: React.ReactNode; detail?: string; to: string; testId: string }> = ({ label, value, detail, to, testId }) => (
  <Link
    to={to}
    data-testid={`metric-${testId}`}
    className="block min-h-[124px] p-5 bg-bg-surface border border-border-subtle hover:border-border-strong rounded-[3px] space-y-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal"
  >
    <div className="flex items-center justify-between text-[11px] font-mono uppercase text-text-muted">
      <span>{label}</span>
      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
    </div>
    <div className="text-2xl font-mono font-semibold text-text-primary" data-testid={`metric-${testId}-value`}>
      {value}
    </div>
    {detail && <div className="text-[11px] font-mono text-text-muted">{detail}</div>}
  </Link>
)

const panel = (section: string) => `/studio?panel=analysis&section=${section}`

/**
 * Every number here comes from the analysis of the current workspace graph (the backend, or a labelled
 * demo result in demo mode), or from the latest simulation. Nothing is computed on this page.
 */
export const DashboardPage: React.FC = () => {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const example = useGraphStore((s) => s.example)
  const loadPreset = useGraphStore((s) => s.loadPreset)
  const analysis = useAnalysisStore((s) => s.analyze)
  const simulate = useAnalysisStore((s) => s.simulate)
  const run = useAnalysisStore((s) => s.run)
  useAutoAnalyze()

  const result = analysis.result
  const current = result?.current ?? null
  const sim = simulate.result
  const fresh = current && !analysis.stale ? current : null

  return (
    <div className="app-page min-h-screen flex flex-col bg-bg-primary text-text-primary">
      <Navbar />
      <AnalysisAnnouncer />
      <main className="flex-1">
        <Container size="wide" className="pt-28 pb-16 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-border-subtle">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {result && <SourceBadge isDemo={result.isDemo} testId="dashboard-source" backendLabel="FastAPI NetworkX" />}
                {example && nodes.length > 0 && (
                  <Badge variant="warning" size="sm" data-testid="dashboard-example">
                    {PRESET_TITLES[example]}
                  </Badge>
                )}
              </div>
              <h1 className="headline-sub text-text-primary">Network Reliability Dashboard</h1>
              <p className="text-xs sm:text-sm text-text-secondary mt-1">Results for your current workspace graph.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {nodes.length > 0 && (
                <Link to="/studio?panel=simulation" data-testid="dashboard-run-simulation">
                  <Button variant="secondary" size="md" leftIcon={<Activity className="w-4 h-4" />}>
                    Run simulation
                  </Button>
                </Link>
              )}
              <Link to="/studio">
                <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Open Studio
                </Button>
              </Link>
            </div>
          </div>

          {nodes.length === 0 ? (
            <div data-testid="dashboard-empty" className="p-12 text-center bg-bg-surface border border-border-subtle rounded-[4px] space-y-4 max-w-xl mx-auto my-12">
              <Network className="w-10 h-10 mx-auto text-text-muted stroke-1" />
              <h2 className="text-base font-semibold text-text-primary">No graph yet</h2>
              <p className="text-xs text-text-secondary leading-relaxed">Build a network in the studio, or load a labelled example. Results appear here once there is a graph to analyze.</p>
              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <Link to="/studio">
                  <Button variant="primary" size="sm">
                    Open Studio
                  </Button>
                </Link>
                <Button variant="secondary" size="sm" leftIcon={<FolderOpen className="w-3.5 h-3.5" />} onClick={() => loadPreset('star')}>
                  Load Example
                </Button>
              </div>
            </div>
          ) : (
            <>
              {analysis.error && <ApiErrorBox title="Analysis Request Failed" error={analysis.error} testId="dashboard-analysis-error" onRetry={() => void run('analyze')} />}
              {current && analysis.stale && <StaleNotice testId="dashboard-stale" onRefresh={() => void run('analyze')} isLoading={analysis.status === 'loading'} />}
              {!current && !analysis.error && (
                // Same grid and card height as the results, so nothing moves when they arrive (BUG-017).
                <div data-testid="dashboard-loading" aria-hidden="true" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse motion-reduce:animate-none">
                  {Array.from({ length: 8 }, (_, i) => (
                    <div key={i} className="min-h-[124px] bg-bg-surface border border-border-subtle rounded-[3px]" />
                  ))}
                </div>
              )}
              {current && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Metric label="Nodes" value={current.summary.nodeCount} detail={`${current.summary.failedNodeCount} failed`} to={panel('overview')} testId="nodes" />
                  <Metric label="Links" value={current.summary.edgeCount} detail={`${current.summary.unavailableEdgeCount} unavailable`} to={panel('overview')} testId="edges" />
                  <Metric label="Components" value={current.connectivity.componentCount} to={panel('components')} testId="components" />
                  <Metric label="Connectivity" value={current.connectivity.connected ? 'Connected' : 'Not connected'} detail={current.connectivity.reason} to={panel('overview')} testId="connectivity" />
                  <Metric label="Bridges" value={current.bridges.edgeIds.length} to={panel('critical')} testId="bridges" />
                  <Metric label="Articulation points" value={current.articulationPoints.nodeIds.length} to={panel('critical')} testId="articulation" />
                  <Metric label="Density" value={current.summary.density.toFixed(4)} to={panel('overview')} testId="density" />
                  {sim ? (
                    <Metric
                      label={`Latest simulation${sim.isDemo ? ' (Demo result)' : ''}`}
                      value={`${(sim.combined.estimate * 100).toFixed(1)}%`}
                      detail={`Estimate from ${sim.combined.trials} trials at p = ${sim.request.edgeFailureProbability}, seed ${sim.seed}, 95% Wilson [${(sim.combined.wilson95.low * 100).toFixed(1)}%, ${(sim.combined.wilson95.high * 100).toFixed(1)}%]${simulate.stale ? '. Results out of date' : ''}`}
                      to="/studio?panel=simulation"
                      testId="simulation"
                    />
                  ) : (
                    <Metric label="Latest simulation" value="None yet" detail="Run one in the studio" to="/studio?panel=simulation" testId="simulation" />
                  )}
                </div>
              )}
              <section className="p-5 bg-bg-surface border border-border-subtle rounded-[4px] space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">Graph map</h2>
                <GraphMiniMap graph={{ nodes, edges }} componentOf={fresh?.components.componentOf ?? null} />
                <p className="text-[11px] text-text-muted">Read only. Colours are the components from the latest analysis. Failed nodes and unavailable links are dashed.</p>
              </section>
            </>
          )}
        </Container>
      </main>
      <Footer />
    </div>
  )
}

export default DashboardPage
