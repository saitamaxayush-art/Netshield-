/** Screen reader announcements for analysis and simulation results and failures. Always mounted. */
import React from 'react'
import { useAnalysisStore } from '@/store/analysisStore'

export const AnalysisAnnouncer: React.FC = () => {
  const analyze = useAnalysisStore((s) => s.analyze)
  const simulate = useAnalysisStore((s) => s.simulate)
  let analysisText = ''
  if (analyze.error) analysisText = `Analysis failed: ${analyze.error.message}`
  else if (analyze.status === 'success' && analyze.result) {
    const { connectivity, summary } = analyze.result.current
    analysisText = `Analysis updated: ${connectivity.connected ? 'connected' : 'not connected'}, ${connectivity.reason}. ${summary.failedNodeCount} failed nodes, ${summary.failedEdgeCount} failed links.`
  }
  let simulationText = ''
  if (simulate.error) simulationText = `Simulation failed: ${simulate.error.message}`
  else if (simulate.status === 'success' && simulate.result) simulationText = `Simulation finished: estimated reliability ${(simulate.result.combined.estimate * 100).toFixed(1)} percent.`
  return (
    <div className="sr-only">
      <div role="status" aria-live="polite" data-testid="analysis-announcer">
        {analysisText}
      </div>
      <div role="status" aria-live="polite" data-testid="simulation-announcer">
        {simulationText}
      </div>
    </div>
  )
}
