/**
 * Re-run POST /api/analyze 300 ms after the graph, its failures or the traversal and path settings
 * stop changing. Stale requests are cancelled by the analysis store. Does nothing for an empty graph
 * except clear the old result. Moving or renaming nodes does not trigger a run (see inputKey).
 */
import { useEffect } from 'react'
import { useAnalysisStore } from '@/store/analysisStore'
import { useGraphStore } from '@/store/graphStore'
import { inputKey } from '@/store/requests'
import { pickSettings, useSettingsStore } from '@/store/settingsStore'
import { AUTO_ANALYZE_DELAY_MS, createAutoAnalyzer } from './autoAnalyzer'

export function useAutoAnalyze(delayMs = AUTO_ANALYZE_DELAY_MS): void {
  useEffect(() => {
    const analysis = useAnalysisStore.getState()
    const auto = createAutoAnalyzer(() => void analysis.run('analyze'), () => analysis.clear('analyze'), delayMs)
    const check = () => {
      const g = useGraphStore.getState()
      const s = useSettingsStore.getState()
      const graph = { nodes: g.nodes, edges: g.edges }
      // The adapter mode is part of the key: switching modes clears results, so analyze again.
      auto.notify(`${s.adapterMode}|${inputKey('analyze', graph, pickSettings(s))}`, g.nodes.length > 0)
    }
    check()
    const stopGraph = useGraphStore.subscribe((s, prev) => {
      if (s.nodes !== prev.nodes || s.edges !== prev.edges) check()
    })
    const stopSettings = useSettingsStore.subscribe(check)
    return () => {
      stopGraph()
      stopSettings()
      auto.dispose()
      useAnalysisStore.getState().cancel('analyze')
    }
  }, [delayMs])
}
