import React from 'react'
import { useGraphStore } from '@/store/graphStore'
import { useAnalysisStore } from '@/store/analysisStore'
import { useSettingsStore } from '@/store/settingsStore'
import { ANALYSIS_SECTIONS, useStudioView, type AnalysisSection } from '@/store/studioViewStore'
import { Button } from '@/components/ui/Button'
import { ApiErrorBox, SourceBadge, StaleNotice } from './ResultStatus'
import { AnalysisSkeleton, ComponentsSection, CompareSection, CriticalSection, DegreesSection, OverviewSection, PathsSection, TraversalSection } from './analysis/sections'
import { ChevronRight, Network, HelpCircle, RefreshCw } from 'lucide-react'
import { nodeNames } from './nodeNames'

const SECTION_NAMES: Record<AnalysisSection, string> = {
  overview: 'Overview',
  components: 'Components',
  critical: 'Critical',
  degrees: 'Degrees',
  traversal: 'Traversal',
  paths: 'Paths',
  compare: 'Compare',
}

export const AnalysisPanel: React.FC = () => {
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const slot = useAnalysisStore((s) => s.analyze)
  const run = useAnalysisStore((s) => s.run)
  const section = useStudioView((s) => s.section)
  const setSection = useStudioView((s) => s.setSection)

  const result = slot.result
  const current = result?.current ?? null
  const isLoading = slot.status === 'loading'
  const names = nodeNames(nodes)
  const labelOf = (id: string) => names.get(id) ?? id
  const linkName = (edgeId: string) => {
    const edge = edges.find((e) => e.id === edgeId)
    return edge ? `${labelOf(edge.source)} ↔ ${labelOf(edge.target)}` : edgeId
  }
  const retry = () => void run('analyze')
  const travStart = useSettingsStore((s) => s.traversalStart)

  /** One line per section, so a collapsed section still says what is in it. */
  const summary = (s: AnalysisSection): string => {
    if (!current || !result) return ''
    switch (s) {
      case 'overview':
        return current.connectivity.connected ? 'Connected' : 'Not connected'
      case 'components': {
        const n = current.components.items.length
        return `${n} ${n === 1 ? 'component' : 'components'}`
      }
      case 'critical':
        return `${current.bridges.edgeIds.length} bridges, ${current.articulationPoints.nodeIds.length} cut vertices`
      case 'degrees': {
        const degrees = Object.values(current.degrees.byNode).map((d) => d.operational)
        return degrees.length === 0 ? 'No nodes' : `Highest ${Math.max(...degrees)}`
      }
      case 'traversal':
        if (!current.traversal) return 'Pick a start node'
        return current.traversal.error ? 'Not available' : `From ${labelOf(travStart ?? '')}`
      case 'paths':
        if (!current.path) return 'Pick two nodes'
        return current.path.found ? `${current.path.hops} hops` : 'No path'
      case 'compare': {
        const h = result.healthy
        if (!h) return 'Not available'
        const changed = [
          h.connectivity.componentCount !== current.connectivity.componentCount,
          h.summary.operationalNodeCount !== current.summary.operationalNodeCount,
          h.summary.operationalEdgeCount !== current.summary.operationalEdgeCount,
        ].filter(Boolean).length
        return changed === 0 ? 'No failures' : 'Changed by failures'
      }
    }
  }

  return (
    <div className="p-5 space-y-5 text-xs text-text-primary">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-accent-teal" />
            <span className="font-semibold uppercase tracking-wider text-[11px] font-mono">Graph Analysis</span>
          </div>
          {/* Analysis runs by itself after every change; this re-runs it on request, so it is not the main action. */}
          <Button variant="ghost" size="sm" leftIcon={<RefreshCw className="w-3.5 h-3.5" />} isLoading={isLoading} disabled={nodes.length === 0} onClick={retry}>
            Compute Graph Metrics
          </Button>
        </div>
        {current && result && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono text-text-secondary">
            <SourceBadge isDemo={result.isDemo} testId="analysis-source" backendLabel="FastAPI NetworkX" />
            {slot.finishedAt !== null && slot.startedAt !== null && (
              <span data-testid="analysis-computed-at" data-finished-at={slot.finishedAt}>
                Computed {result.isDemo ? 'in the browser (demo)' : 'by the backend'} at {new Date(slot.finishedAt).toLocaleTimeString()} ({Math.max(0, slot.finishedAt - slot.startedAt)} ms)
              </span>
            )}
            <span className="text-text-muted" data-testid="analysis-engine">
              {result.isDemo ? 'Demo adapter' : 'NetworkX'} {result.meta.engineVersion}, API {result.meta.apiVersion}
            </span>
          </div>
        )}
      </div>

      {slot.error && <ApiErrorBox title="Analysis Request Failed" error={slot.error} testId="analysis-error" onRetry={retry} />}
      {current && slot.stale && <StaleNotice testId="analysis-stale" onRefresh={retry} isLoading={isLoading} />}

      {current && result ? (
        // One section open at a time; the others stay folded to a single line with their headline.
        <div data-testid="analysis-results" aria-label="Analysis sections" role="group" className="border-b border-border-subtle">
          {ANALYSIS_SECTIONS.map((s) => {
            const open = section === s
            return (
              <div key={s} className="border-t border-border-subtle">
                <h3>
                  <button
                    type="button"
                    id={`section-button-${s}`}
                    aria-expanded={open}
                    aria-controls={`section-panel-${s}`}
                    aria-describedby={`section-summary-${s}`}
                    onClick={() => setSection(s)}
                    className={`w-full min-h-10 flex items-center gap-2 text-left cursor-pointer rounded-[2px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-teal ${
                      open ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform motion-reduce:transition-none ${open ? 'rotate-90 text-accent-teal' : ''}`} aria-hidden="true" />
                    <span className={`text-xs ${open ? 'font-semibold' : ''}`}>{SECTION_NAMES[s]}</span>
                    <span id={`section-summary-${s}`} aria-hidden="true" className="ml-auto text-[11px] font-mono text-text-muted truncate">
                      {summary(s)}
                    </span>
                  </button>
                </h3>
                {open && (
                  <div id={`section-panel-${s}`} role="region" aria-labelledby={`section-button-${s}`} className="pb-5 pt-1">
                    {s === 'overview' && <OverviewSection current={current} />}
                    {s === 'components' && <ComponentsSection current={current} labelOf={labelOf} />}
                    {s === 'critical' && <CriticalSection current={current} labelOf={labelOf} linkName={linkName} />}
                    {s === 'degrees' && <DegreesSection current={current} labelOf={labelOf} />}
                    {s === 'traversal' && <TraversalSection current={current} labelOf={labelOf} />}
                    {s === 'paths' && <PathsSection current={current} labelOf={labelOf} />}
                    {s === 'compare' && <CompareSection result={result} />}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        !slot.error &&
        (isLoading ? (
          <AnalysisSkeleton />
        ) : (
          <div className="text-center py-8 text-text-muted space-y-2" data-testid="analysis-empty">
            <HelpCircle className="w-6 h-6 mx-auto stroke-1" />
            <p className="text-[11px]">{nodes.length === 0 ? 'Add nodes to the canvas to analyze the network.' : 'Analysis runs automatically after each change.'}</p>
          </div>
        ))
      )}
    </div>
  )
}
