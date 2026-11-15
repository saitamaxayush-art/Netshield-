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

type MetricProps = { label: string; value: React.ReactNode; detail?: string; to: string; testId: string; size?: 'headline' | 'secondary' }
const cellClass = (size: MetricProps['size']) => `group block ${size === 'headline' ? 'min-h-[112px] py-5' : 'min-h-[76px] py-4'} pr-4 space-y-1.5 rounded-[2px]`

/** The inside of a metric cell. Shared with the loading placeholder, so both are exactly the same height. */
const MetricBody: React.FC<Omit<MetricProps, 'to'> & { placeholder?: boolean }> = ({ label, value, detail, testId, size = 'headline', placeholder }) => {
  const ghost = placeholder ? ' text-transparent bg-bg-surface-elevated rounded-[2px]' : ''
  return (
    <>
      <div className="flex items-center gap-1.5 text-2xs font-mono uppercase text-text-muted group-hover:text-text-secondary">
        <span className={ghost}>{label}</span>
        {/* Always shown, so touch screens also see that the cell is a link. */}
        <ArrowRight className={`w-3 h-3 shrink-0 text-text-muted group-hover:text-accent-teal${placeholder ? ' invisible' : ''}`} aria-hidden="true" />
      </div>
      <div className={`${size === 'headline' ? 'text-2xl' : 'text-lg'} font-mono font-semibold tabular-nums text-text-primary group-hover:text-accent-teal`} data-testid={placeholder ? undefined : `metric-${testId}-value`}>
        <span className={ghost}>{value}</span>
      </div>
      {detail && (
        <div className="text-2xs font-mono text-text-muted">
          <span className={ghost}>{detail}</span>
        </div>
      )}
    </>
  )
}

/** One cell of the metrics strip: no box of its own, the strip's dividers separate cells. */
const Metric: React.FC<MetricProps> = (props) => (
  <Link to={props.to} data-testid={`metric-${props.testId}`} className={`${cellClass(props.size)} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal`}>
    <MetricBody {...props} />
  </Link>
)

/** Same cells and texts as the first results (no simulation yet), drawn as blocks: nothing moves when results arrive. */
const PLACEHOLDER_ROWS: ReadonlyArray<ReadonlyArray<Omit<MetricProps, 'to'>>> = [
  [
    { label: 'Connectivity', value: 'Connected', detail: 'Single component', testId: 'p1' },
    { label: 'Nodes', value: '00', detail: '0 failed', testId: 'p2' },
    { label: 'Links', value: '00', detail: '0 unavailable', testId: 'p3' },
    { label: 'Latest simulation', value: 'None yet', detail: 'Run one in the studio', testId: 'p4' },
  ],
  [
    { label: 'Components', value: '0', testId: 'p5', size: 'secondary' },
    { label: 'Bridges', value: '0', testId: 'p6', size: 'secondary' },
    { label: 'Articulation points', value: '0', testId: 'p7', size: 'secondary' },
    { label: 'Density', value: '0.0000', testId: 'p8', size: 'secondary' },
  ],
]

const ROW = 'grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 py-1'

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
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
            <div>
              {/* Height reserved: the source badge arrives with the first result and must not push the page down. */}
              <div className="flex flex-wrap items-center gap-2 mb-2 min-h-[22px]">
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
            {/* One action: the studio itself is in the top navigation. */}
            {nodes.length > 0 && (
              <Link to="/studio?panel=simulation" data-testid="dashboard-run-simulation">
                <Button variant="primary" size="md" leftIcon={<Activity className="w-4 h-4" />}>
                  Run simulation
                </Button>
              </Link>
            )}
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
                <div data-testid="dashboard-loading" aria-hidden="true" className="divide-y divide-border-subtle border-y border-border-subtle animate-pulse motion-reduce:animate-none">
                  {PLACEHOLDER_ROWS.map((row, r) => (
                    <div key={r} className={ROW}>
                      {row.map((cell) => (
                        <div key={cell.testId} className={cellClass(cell.size)}>
                          <MetricBody {...cell} placeholder />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {current && (
                <div className="divide-y divide-border-subtle border-y border-border-subtle" data-tour="metrics">
                  <div className={ROW}>
                  <Metric label="Connectivity" value={current.connectivity.connected ? 'Connected' : 'Not connected'} detail={current.connectivity.reason} to={panel('overview')} testId="connectivity" />
                  <Metric label="Nodes" value={current.summary.nodeCount} detail={`${current.summary.failedNodeCount} failed`} to={panel('overview')} testId="nodes" />
                  <Metric label="Links" value={current.summary.edgeCount} detail={`${current.summary.unavailableEdgeCount} unavailable`} to={panel('overview')} testId="edges" />
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
                  <div className={ROW}>
                    <Metric size="secondary" label="Components" value={current.connectivity.componentCount} to={panel('components')} testId="components" />
                    <Metric size="secondary" label="Bridges" value={current.bridges.edgeIds.length} to={panel('critical')} testId="bridges" />
                    <Metric size="secondary" label="Articulation points" value={current.articulationPoints.nodeIds.length} to={panel('critical')} testId="articulation" />
                    <Metric size="secondary" label="Density" value={current.summary.density.toFixed(4)} to={panel('overview')} testId="density" />
                  </div>
                </div>
              )}
              <section className="pt-2 space-y-3">
                <h2 className="text-2xs font-mono uppercase tracking-wider text-text-muted">Graph map</h2>
                <GraphMiniMap graph={{ nodes, edges }} componentOf={fresh?.components.componentOf ?? null} />
                <p className="text-2xs text-text-muted">Read only. Colours are the components from the latest analysis. Failed nodes and unavailable links are dashed.</p>
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
