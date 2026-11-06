/**
 * What the studio is showing (panel, analysis section, focused result, traversal step), and the canvas
 * highlight derived from it and the latest analysis. Highlights and animation are always derived
 * from store state. Nothing here is saved, and an out of date result highlights nothing.
 */
import { create } from 'zustand'
import type { Analysis } from '@/services/api/schemas'
import { useAnalysisStore } from './analysisStore'

export type PanelTab = 'properties' | 'analysis' | 'simulation'
export const ANALYSIS_SECTIONS = ['overview', 'components', 'critical', 'degrees', 'traversal', 'paths', 'compare'] as const
export type AnalysisSection = (typeof ANALYSIS_SECTIONS)[number]
export type TraversalOrder = 'bfs' | 'dfs'
export type CriticalFocus = { kind: 'bridge' | 'articulation'; id: string }

export const TRAVERSAL_STEP_MS = 700

export interface View {
  panelTab: PanelTab
  section: AnalysisSection
  focusComponent: number | null
  focusCritical: CriticalFocus | null
  traversalOrder: TraversalOrder
  /** Index of the last visited node, or null to show the whole order. */
  traversalStep: number | null
  playing: boolean
}

export interface Highlight {
  /** Node id to the badge shown on it ('' for none). */
  nodes: Record<string, string>
  edges: Record<string, true>
}

const NOTHING: Highlight = { nodes: {}, edges: {} }

export function traversalLength(current: Analysis | null, order: TraversalOrder): number {
  return order === 'bfs' ? (current?.traversal?.bfs.length ?? 0) : (current?.traversal?.dfs.length ?? 0)
}

export function deriveHighlight(view: View, current: Analysis | null): Highlight {
  if (!current || view.panelTab !== 'analysis') return NOTHING
  if (view.section === 'components') {
    const members = view.focusComponent === null ? undefined : current.components.items[view.focusComponent]
    return members ? { nodes: Object.fromEntries(members.map((id) => [id, ''])), edges: {} } : NOTHING
  }
  if (view.section === 'critical' && view.focusCritical) {
    const { kind, id } = view.focusCritical
    return kind === 'bridge' ? { nodes: {}, edges: { [id]: true } } : { nodes: { [id]: '' }, edges: {} }
  }
  if (view.section === 'traversal' && current.traversal && !current.traversal.error) {
    const { bfs, dfs } = current.traversal
    const shown = (index: number) => view.traversalStep === null || index <= view.traversalStep
    const entries =
      view.traversalOrder === 'bfs'
        ? bfs.filter((_, i) => shown(i)).map((s, i) => [s.nodeId, `BFS ${i + 1}, layer ${s.layer}`])
        : dfs.filter((_, i) => shown(i)).map((id, i) => [id, `DFS ${i + 1}`])
    return { nodes: Object.fromEntries(entries), edges: {} }
  }
  if (view.section === 'paths' && current.path?.found && current.path.nodeIds && current.path.edgeIds) {
    return {
      nodes: Object.fromEntries(current.path.nodeIds.map((id, i) => [id, `Path ${i + 1}`])),
      edges: Object.fromEntries(current.path.edgeIds.map((id) => [id, true as const])),
    }
  }
  return NOTHING
}

const INITIAL: View = {
  panelTab: 'properties',
  section: 'overview',
  focusComponent: null,
  focusCritical: null,
  traversalOrder: 'bfs',
  traversalStep: null,
  playing: false,
}

const freshResult = (): Analysis | null => {
  const slot = useAnalysisStore.getState().analyze
  return slot.result && !slot.stale ? slot.result.current : null
}

let timer: ReturnType<typeof setInterval> | null = null
const stopTimer = () => {
  if (timer !== null) clearInterval(timer)
  timer = null
}

export interface StudioViewState extends View {
  setPanelTab: (tab: PanelTab) => void
  setSection: (section: AnalysisSection) => void
  focusOnComponent: (index: number | null) => void
  focusOnCritical: (focus: CriticalFocus | null) => void
  setTraversalOrder: (order: TraversalOrder) => void
  /** Move the traversal by one step, from the start if it was showing the whole order. */
  stepTraversal: (delta: 1 | -1) => void
  playTraversal: () => void
  stopTraversal: () => void
  resetTraversal: () => void
  resetView: () => void
}

export const useStudioView = create<StudioViewState>((set, get) => ({
  ...INITIAL,
  setPanelTab: (panelTab) => set({ panelTab }),
  setSection: (section) => {
    get().stopTraversal()
    set({ section })
  },
  focusOnComponent: (focusComponent) => set({ focusComponent }),
  focusOnCritical: (focusCritical) => set({ focusCritical }),
  setTraversalOrder: (traversalOrder) => {
    get().stopTraversal()
    set({ traversalOrder, traversalStep: null })
  },
  stepTraversal: (delta) => {
    const { traversalStep, traversalOrder } = get()
    const last = traversalLength(freshResult(), traversalOrder) - 1
    if (last < 0) return
    const next = traversalStep === null ? (delta === 1 ? 0 : last) : traversalStep + delta
    set({ traversalStep: Math.max(0, Math.min(last, next)) })
  },
  playTraversal: () => {
    stopTimer()
    set({ traversalStep: 0, playing: true })
    timer = setInterval(() => {
      const { traversalStep, traversalOrder } = get()
      const last = traversalLength(freshResult(), traversalOrder) - 1
      if (traversalStep === null || traversalStep >= last) get().stopTraversal()
      else set({ traversalStep: traversalStep + 1 })
    }, TRAVERSAL_STEP_MS)
  },
  stopTraversal: () => {
    stopTimer()
    set({ playing: false })
  },
  resetTraversal: () => {
    stopTimer()
    set({ playing: false, traversalStep: null })
  },
  resetView: () => {
    stopTimer()
    set(INITIAL)
  },
}))

export const useHighlight = create<Highlight>(() => NOTHING)

function refresh() {
  useHighlight.setState(deriveHighlight(useStudioView.getState(), freshResult()), true)
}
useStudioView.subscribe(refresh)
useAnalysisStore.subscribe((state, previous) => {
  if (state.analyze === previous.analyze) return
  // A changed result can change the traversal, so a step or a focus from the old one no longer applies.
  if (state.analyze.result !== previous.analyze.result) {
    const v = useStudioView.getState()
    if (v.traversalStep !== null || v.playing) v.resetTraversal()
    if (v.focusComponent !== null) v.focusOnComponent(null)
  }
  refresh()
})
