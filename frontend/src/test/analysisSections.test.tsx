/** Each analysis section against real captured backend responses, including disconnected and empty ones. */
import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AnalysisPanel } from '../features/studio/AnalysisPanel'
import { AnalysisAnnouncer } from '../features/studio/AnalysisAnnouncer'
import { FailureControls } from '../features/studio/FailureControls'
import { EXPLANATIONS } from '../features/studio/explanations'
import { CompareSection, ComponentsSection, CriticalSection, DegreesSection, OverviewSection, PathsSection, TraversalSection } from '../features/studio/analysis/sections'
import { GraphMiniMap } from '../features/dashboard/GraphMiniMap'
import { DashboardPage } from '../pages/DashboardPage'
import { EdgeView } from '../features/studio/NetShieldCustomEdge'
import { NodeBody } from '../features/studio/NetShieldCustomNode'
import { ApiError } from '../services/api/client'
import { AnalyzeResponseSchema } from '../services/api/schemas'
import { useAnalysisStore } from '../store/analysisStore'
import { useGraphStore } from '../store/graphStore'
import { preset } from '../store/presets'
import { operationalElements, pickRandomOperational } from '../store/randomFailure'
import { deriveHighlight, useStudioView, type View } from '../store/studioViewStore'
import { backendFixture, resetStores } from './fixtures'

const response = (name: string) => AnalyzeResponseSchema.parse(backendFixture(name).response)
const labelOf = (id: string) => `Label ${id}`
const stamped = (name: string) => ({ ...response(name), isDemo: false })

function setSlot(update: Partial<ReturnType<typeof useAnalysisStore.getState>['analyze']>) {
  act(() => {
    useAnalysisStore.setState((s) => ({ analyze: { ...s.analyze, ...update } }))
  })
}

beforeEach(resetStores)

describe('overview', () => {
  it('connected graph: backend reason, counts, density, explanation', () => {
    render(<OverviewSection current={response('analyze-star').current} />)
    expect(screen.getByTestId('analysis-connected')).toHaveTextContent(/^Connected$/)
    expect(screen.getByTestId('analysis-reason')).toHaveTextContent('Single component')
    expect(screen.getByTestId('analysis-node-count')).toHaveTextContent('5')
    expect(screen.getByTestId('analysis-density')).toHaveTextContent('0.4000')
    expect(screen.getByTestId('explain-connectivity_definition')).toBeInTheDocument()
  })

  it('disconnected graph says not connected, with the backend reason', () => {
    const { current } = response('analyze-ring-failures')
    render(<OverviewSection current={current} />)
    expect(screen.getByTestId('analysis-connected')).toHaveTextContent('Not connected')
    expect(screen.getByTestId('analysis-reason')).toHaveTextContent(current.connectivity.reason)
  })

  it('empty graph', () => {
    render(<OverviewSection current={response('analyze-empty').current} />)
    expect(screen.getByTestId('analysis-reason')).toHaveTextContent('Empty network')
    expect(screen.getByTestId('analysis-component-count')).toHaveTextContent('0')
  })
})

describe('components', () => {
  it('lists members, and clicking toggles the focus used for the canvas highlight', () => {
    const { current } = response('analyze-ring-failures')
    render(<ComponentsSection current={current} labelOf={labelOf} />)
    const items = within(screen.getByTestId('analysis-components')).getAllByRole('button')
    expect(items).toHaveLength(current.components.items.length)
    fireEvent.click(items[0])
    expect(useStudioView.getState().focusComponent).toBe(0)
    fireEvent.click(items[0])
    expect(useStudioView.getState().focusComponent).toBeNull()
  })

  it('empty state', () => {
    render(<ComponentsSection current={response('analyze-empty').current} labelOf={labelOf} />)
    expect(screen.getByTestId('components-none')).toBeInTheDocument()
  })
})

describe('critical elements', () => {
  it('clicking a bridge selects the link and focuses it; a cut vertex likewise', () => {
    const { current } = response('analyze-star')
    render(<CriticalSection current={current} labelOf={labelOf} linkName={(id) => `Link ${id}`} />)
    fireEvent.click(screen.getByRole('button', { name: 'Link e1' }))
    expect(useGraphStore.getState().selectedEdgeId).toBe('e1')
    expect(useStudioView.getState().focusCritical).toEqual({ kind: 'bridge', id: 'e1' })
    fireEvent.click(screen.getByRole('button', { name: 'Label hub' }))
    expect(useGraphStore.getState().selectedNodeId).toBe('hub')
    expect(screen.getByText(EXPLANATIONS.bridge_definition)).toBeInTheDocument()
    expect(screen.getByText(EXPLANATIONS.articulation_point_definition)).toBeInTheDocument()
  })

  it('says so when there are none', () => {
    render(<CriticalSection current={response('analyze-empty').current} labelOf={labelOf} linkName={(id) => id} />)
    expect(screen.getByTestId('analysis-bridges-none')).toBeInTheDocument()
    expect(screen.getByTestId('analysis-articulation-none')).toBeInTheDocument()
  })
})

describe('degrees', () => {
  it('shows backend degrees and sorts', () => {
    render(<DegreesSection current={response('analyze-star').current} labelOf={labelOf} />)
    const ids = () => within(screen.getByTestId('analysis-degrees')).getAllByRole('row').slice(1).map((r) => r.getAttribute('data-node-id'))
    expect(ids()[0]).toBe('hub')
    fireEvent.click(screen.getByRole('button', { name: /^Operational/ }))
    expect(ids().at(-1)).toBe('hub')
    fireEvent.click(screen.getByRole('button', { name: /^Node/ }))
    expect(ids()).toEqual(['L1', 'L2', 'L3', 'L4', 'hub'].sort((a, b) => labelOf(a).localeCompare(labelOf(b))))
    expect(screen.getByRole('columnheader', { name: /^Node/ })).toHaveAttribute('aria-sort', 'ascending')
  })
})

describe('traversal', () => {
  it('asks for a start node when there is no traversal', () => {
    render(<TraversalSection current={response('analyze-empty').current} labelOf={labelOf} />)
    expect(screen.getByText(/Choose a start node/)).toBeInTheDocument()
  })

  it('shows the BFS layers and the DFS order', () => {
    render(<TraversalSection current={response('analyze-star').current} labelOf={labelOf} />)
    expect(screen.getByTestId('analysis-bfs')).toHaveTextContent('Label L1 (0) → Label hub (1) → Label L2 (2)')
    expect(screen.getByTestId('analysis-dfs')).toHaveTextContent('Label L1 → Label hub')
  })

  it('shows the backend error for a failed start node', () => {
    render(<TraversalSection current={response('analyze-ring-failures').current} labelOf={labelOf} />)
    expect(screen.getByTestId('traversal-error')).toHaveTextContent("Start node 'r4' is failed")
  })
})

describe('paths', () => {
  it('asks for endpoints; shows a found path; explains a missing one', () => {
    const { rerender } = render(<PathsSection current={response('analyze-empty').current} labelOf={labelOf} />)
    expect(screen.getByText(/Choose a source and a target/)).toBeInTheDocument()
    rerender(<PathsSection current={response('analyze-star').current} labelOf={labelOf} />)
    expect(screen.getByTestId('analysis-path')).toHaveTextContent('Label L1 → Label hub → Label L4 (2 hops)')
    rerender(<PathsSection current={response('analyze-weighted').current} labelOf={labelOf} />)
    expect(screen.getByTestId('analysis-path')).toHaveTextContent('total weight 1')
    expect(screen.getByTestId('explain-shortest_path_weighted')).toBeInTheDocument()
  })

  it('offers weights only when every link has one', () => {
    const { rerender } = render(<PathsSection current={response('analyze-star').current} labelOf={labelOf} />)
    expect(screen.queryByTestId('path-use-weights')).toBeNull()
    act(() => {
      for (const e of useGraphStore.getState().edges) useGraphStore.getState().updateEdge(e.id, { weight: 2 })
    })
    rerender(<PathsSection current={response('analyze-star').current} labelOf={labelOf} />)
    expect(screen.getByTestId('path-use-weights')).toBeInTheDocument()
  })
})

describe('before and after', () => {
  it('compares healthy and current, and marks what changed', () => {
    render(<CompareSection result={response('analyze-ring-failures')} />)
    const row = screen.getByTestId('analysis-compare').querySelector('[data-measure="Connected"]')
    expect(row).toHaveAttribute('data-changed', 'true')
    expect(row).toHaveTextContent('YesNo (changed)')
  })

  it('explains a result without a comparison', () => {
    render(<CompareSection result={response('analyze-two-triangles')} />)
    expect(screen.getByText(/No healthy comparison/)).toBeInTheDocument()
  })
})

describe('panel states', () => {
  it('loading shows a skeleton', () => {
    setSlot({ status: 'loading', result: null })
    render(<AnalysisPanel />)
    expect(screen.getByTestId('analysis-skeleton')).toBeInTheDocument()
  })

  it('error shows the message and Retry, and no result', () => {
    setSlot({ status: 'error', error: new ApiError('network', 'NETWORK_ERROR', 'Could not reach the NetShield backend'), result: null })
    render(<AnalysisPanel />)
    expect(screen.getByTestId('analysis-error')).toHaveTextContent('Could not reach the NetShield backend')
    expect(within(screen.getByTestId('analysis-error')).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.queryByTestId('analysis-results')).toBeNull()
  })

  it('out of date keeps the result and says so', () => {
    setSlot({ status: 'success', result: stamped('analyze-star'), stale: true })
    render(<AnalysisPanel />)
    expect(screen.getByTestId('analysis-stale')).toHaveTextContent('Results out of date')
    expect(screen.getByTestId('analysis-results')).toBeInTheDocument()
  })

  it('section buttons switch sections', () => {
    setSlot({ status: 'success', result: stamped('analyze-star') })
    render(<AnalysisPanel />)
    for (const [name, id] of [['Components', 'section-components'], ['Critical', 'section-critical'], ['Degrees', 'section-degrees'], ['Traversal', 'section-traversal'], ['Paths', 'section-paths'], ['Compare', 'section-compare'], ['Overview', 'section-overview']]) {
      fireEvent.click(screen.getByRole('button', { name }))
      expect(screen.getByTestId(id)).toBeInTheDocument()
    }
  })

  it('announces results and failures to screen readers', () => {
    setSlot({ status: 'success', result: stamped('analyze-ring-failures') })
    render(<AnalysisAnnouncer />)
    expect(screen.getByTestId('analysis-announcer')).toHaveTextContent('not connected')
    setSlot({ status: 'error', result: null, error: new ApiError('server', 'INTERNAL_ERROR', 'boom') })
    expect(screen.getByTestId('analysis-announcer')).toHaveTextContent('Analysis failed: boom')
  })
})

describe('canvas highlight is derived from view and result', () => {
  const view = (over: Partial<View>): View => ({ panelTab: 'analysis', section: 'overview', focusComponent: null, focusCritical: null, traversalOrder: 'bfs', traversalStep: null, playing: false, ...over })
  const { current } = response('analyze-star')

  it('nothing without a fresh result or outside the analysis panel', () => {
    expect(deriveHighlight(view({ section: 'paths' }), null).nodes).toEqual({})
    expect(deriveHighlight(view({ section: 'paths', panelTab: 'properties' }), current).nodes).toEqual({})
  })

  it('path nodes and links, with step badges', () => {
    const h = deriveHighlight(view({ section: 'paths' }), current)
    expect(h.nodes).toEqual({ L1: 'Path 1', hub: 'Path 2', L4: 'Path 3' })
    expect(Object.keys(h.edges).sort()).toEqual(['e1', 'e4'])
  })

  it('traversal badges follow the step and carry layers', () => {
    expect(deriveHighlight(view({ section: 'traversal', traversalStep: 1 }), current).nodes).toEqual({ L1: 'BFS 1, layer 0', hub: 'BFS 2, layer 1' })
    expect(Object.keys(deriveHighlight(view({ section: 'traversal', traversalOrder: 'dfs' }), current).nodes)).toEqual(current.traversal?.dfs)
  })

  it('component and critical focus', () => {
    expect(Object.keys(deriveHighlight(view({ section: 'components', focusComponent: 0 }), current).nodes)).toHaveLength(5)
    expect(deriveHighlight(view({ section: 'critical', focusCritical: { kind: 'bridge', id: 'e2' } }), current).edges).toEqual({ e2: true })
  })

  it('stepping stays inside the traversal', () => {
    setSlot({ status: 'success', result: stamped('analyze-star') })
    const v = useStudioView.getState()
    v.stepTraversal(-1)
    expect(useStudioView.getState().traversalStep).toBe(4)
    v.stepTraversal(1)
    expect(useStudioView.getState().traversalStep).toBe(4)
  })
})

describe('failure visuals and controls', () => {
  it('an unavailable link is dashed and faded, without the failed cross', () => {
    const { container } = render(
      <svg>
        <EdgeView id="e" path="M0 0L1 1" midX={0} midY={0} failed={false} selected={false} bridge unavailable />
      </svg>
    )
    expect(screen.getByTestId('edge-e')).toHaveAttribute('data-state', 'unavailable')
    expect(screen.queryByTestId('edge-cross-e')).toBeNull()
    expect(screen.queryByTestId('edge-bridge-e')).toBeNull()
    const line = container.querySelector<SVGPathElement>('.ns-edge-line')
    expect(line?.style.opacity).toBe('0.7')
    expect(line?.style.strokeDasharray).not.toBe('')
  })

  it('the node cross follows the failed flag, and a badge shows when highlighted', () => {
    const base = { label: 'A', nodeType: 'router', selected: false, componentIndex: null, isArticulationPoint: false } as const
    const { rerender } = render(<NodeBody {...base} failed={false} highlighted badge="Path 2" />)
    expect(screen.getByTestId('node-cross').getAttribute('class')).toContain('opacity-0')
    expect(screen.getByTestId('node-badge')).toHaveTextContent('Path 2')
    rerender(<NodeBody {...base} failed />)
    expect(screen.getByTestId('node-cross').getAttribute('class')).toContain('opacity-40')
    expect(screen.queryByTestId('node-badge')).toBeNull()
  })

  it('fail and restore follow the selection and the state', () => {
    render(<FailureControls />)
    expect(screen.getByRole('button', { name: 'Fail selected' })).toBeDisabled()
    act(() => useGraphStore.getState().selectNode('srv'))
    fireEvent.click(screen.getByRole('button', { name: 'Fail selected node' }))
    expect(useGraphStore.getState().nodes.find((n) => n.id === 'srv')?.data.failed).toBe(true)
    expect(screen.getByRole('button', { name: 'Fail selected node' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Restore selected node' }))
    act(() => useGraphStore.getState().selectEdge('e-hub-fw'))
    fireEvent.click(screen.getByRole('button', { name: 'Fail selected edge' }))
    expect(useGraphStore.getState().edges.find((e) => e.id === 'e-hub-fw')?.data?.failed).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Clear all failures' }))
    expect(useGraphStore.getState().edges.some((e) => e.data?.failed)).toBe(false)
  })

  it('fail random is seeded, shown, and refuses bad seeds and an all failed graph', () => {
    render(<FailureControls />)
    fireEvent.click(screen.getByRole('button', { name: 'Fail random' }))
    const first = useGraphStore.getState().lastRandom
    expect(first).toMatchObject({ seed: 1, draw: 1 })
    expect(first && operationalElements(preset('star')).some((c) => c.id === first.id)).toBe(true)
    expect(screen.getByTestId('random-result')).toHaveTextContent(`${first?.id} (seed 1, draw 1)`)
    expect(pickRandomOperational(preset('star'), 1, 1)).toEqual({ kind: first?.kind, id: first?.id })
    expect(pickRandomOperational(preset('star'), 1, 1)).toEqual(pickRandomOperational(preset('star'), 1, 1))
    fireEvent.change(screen.getByLabelText('Seed'), { target: { value: '-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fail random' }))
    expect(screen.getByTestId('random-error')).toHaveTextContent('whole number')
    act(() => {
      for (const n of useGraphStore.getState().nodes) useGraphStore.getState().failNode(n.id)
    })
    expect(useGraphStore.getState().failRandom(1)).toEqual({ ok: false, error: 'Nothing is left to fail: no node or link is operational.' })
  })

  it('fail random never picks a link whose endpoint failed', () => {
    useGraphStore.getState().failNode('hub')
    expect(operationalElements(useGraphStore.getState()).filter((c) => c.kind === 'edge')).toEqual([])
  })
})

describe('dashboard', () => {
  const page = () =>
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    )

  it('empty state offers Open Studio and Load Example', () => {
    act(() => useGraphStore.getState().reset())
    page()
    expect(screen.getByTestId('dashboard-empty')).toHaveTextContent('No graph yet')
    expect(screen.getAllByRole('button', { name: 'Open Studio' }).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Load Example' }))
    expect(useGraphStore.getState().example).toBe('star')
    expect(screen.getByTestId('dashboard-example')).toHaveTextContent('Example: star network')
  })

  it('shows no number until there is a result, then the result values, each linking to its panel', () => {
    page()
    expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument()
    expect(screen.queryByTestId('metric-components')).toBeNull()
    setSlot({ status: 'success', result: stamped('analyze-ring-failures') })
    const { current } = response('analyze-ring-failures')
    expect(screen.getByTestId('metric-components-value')).toHaveTextContent(String(current.connectivity.componentCount))
    expect(screen.getByTestId('metric-connectivity-value')).toHaveTextContent('Not connected')
    expect(screen.getByTestId('metric-bridges')).toHaveAttribute('href', '/studio?panel=analysis&section=critical')
    expect(screen.getByTestId('metric-simulation-value')).toHaveTextContent('None yet')
  })

  it('error shows Retry and no numbers', () => {
    page()
    setSlot({ status: 'error', result: null, error: new ApiError('network', 'NETWORK_ERROR', 'down') })
    expect(screen.getByTestId('dashboard-analysis-error')).toBeInTheDocument()
    expect(screen.queryByTestId('metric-nodes')).toBeNull()
  })

  it('the mini map colours nodes from the component map only', () => {
    const graph = preset('ring')
    const { rerender, container } = render(<GraphMiniMap graph={graph} componentOf={null} />)
    expect(container.querySelector('[data-node-id="r1"]')).not.toHaveAttribute('data-component')
    rerender(<GraphMiniMap graph={graph} componentOf={{ r1: 2 }} />)
    expect(container.querySelector('[data-node-id="r1"]')).toHaveAttribute('data-component', '2')
    expect(container.querySelectorAll('circle')).toHaveLength(6)
    expect(container.querySelectorAll('line')).toHaveLength(6)
  })
})
