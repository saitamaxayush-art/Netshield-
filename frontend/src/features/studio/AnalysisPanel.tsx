import React from 'react'
import { useGraphStore } from '@/store/graphStore'
import { useAnalysisStore } from '@/store/analysisStore'
import { ANALYSIS_SECTIONS, useStudioView, type AnalysisSection } from '@/store/studioViewStore'
import { Button } from '@/components/ui/Button'
import { ApiErrorBox, SourceBadge, StaleNotice } from './ResultStatus'
import { AnalysisSkeleton, ComponentsSection, CompareSection, CriticalSection, DegreesSection, OverviewSection, PathsSection, TraversalSection } from './analysis/sections'
import { Play, Network, HelpCircle } from 'lucide-react'

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
  const labelOf = (id: string) => nodes.find((n) => n.id === id)?.data.label ?? id
  const linkName = (edgeId: string) => {
    const edge = edges.find((e) => e.id === edgeId)
    return edge ? `${labelOf(edge.source)} ↔ ${labelOf(edge.target)}` : edgeId
  }
  const retry = () => void run('analyze')

  return (
    <div className="p-5 space-y-4 text-xs text-text-primary">
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-accent-teal" />
          <span className="font-semibold uppercase tracking-wider text-[11px] font-mono">Graph Analysis</span>
        </div>
        {result && <SourceBadge isDemo={result.isDemo} testId="analysis-source" backendLabel="FastAPI NetworkX" />}
      </div>

      <Button variant="primary" size="sm" className="w-full" leftIcon={<Play className="w-3.5 h-3.5 fill-current" />} isLoading={isLoading} disabled={nodes.length === 0} onClick={retry}>
        Compute Graph Metrics
      </Button>

      {slot.error && <ApiErrorBox title="Analysis Request Failed" error={slot.error} testId="analysis-error" onRetry={retry} />}
      {current && slot.stale && <StaleNotice testId="analysis-stale" onRefresh={retry} isLoading={isLoading} />}

      {current && result ? (
        <div className="space-y-4" data-testid="analysis-results">
          <div className="text-[10px] font-mono text-text-muted" data-testid="analysis-engine">
            {result.isDemo ? 'Demo adapter' : 'NetworkX'} {result.meta.engineVersion}, API {result.meta.apiVersion}
          </div>
          <div role="group" aria-label="Analysis sections" className="grid grid-cols-4 gap-1">
            {ANALYSIS_SECTIONS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={section === s}
                onClick={() => setSection(s)}
                className={`h-8 px-0.5 rounded-[2px] border font-mono text-[10px] truncate cursor-pointer ${
                  section === s ? 'border-accent-teal text-accent-teal bg-accent-dim' : 'border-border-subtle text-text-muted hover:text-text-primary'
                }`}
              >
                {SECTION_NAMES[s]}
              </button>
            ))}
          </div>
          {section === 'overview' && <OverviewSection current={current} />}
          {section === 'components' && <ComponentsSection current={current} labelOf={labelOf} />}
          {section === 'critical' && <CriticalSection current={current} labelOf={labelOf} linkName={linkName} />}
          {section === 'degrees' && <DegreesSection current={current} labelOf={labelOf} />}
          {section === 'traversal' && <TraversalSection current={current} labelOf={labelOf} />}
          {section === 'paths' && <PathsSection current={current} labelOf={labelOf} />}
          {section === 'compare' && <CompareSection result={result} />}
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
