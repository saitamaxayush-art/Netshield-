import { beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { EdgeView } from '../features/studio/NetShieldCustomEdge'
import { NodeBody } from '../features/studio/NetShieldCustomNode'
import { floatingEnds } from '../features/studio/floatingEdge'
import { connectOrExplain } from '../features/studio/studioActions'
import { StudioToast } from '../features/studio/StudioToast'
import { StudioToolbar } from '../features/studio/StudioToolbar'
import { PropertiesPanel } from '../features/studio/PropertiesPanel'
import { FailureControls } from '../features/studio/FailureControls'
import { Sheet } from '../components/ui/Sheet'
import { useGraphStore } from '../store/graphStore'
import { useToastStore } from '../store/toastStore'
import { resetStores } from './fixtures'

const graph = () => useGraphStore.getState()
beforeEach(() => {
  resetStores()
  useToastStore.getState().dismiss()
})

const body = (over: Partial<Parameters<typeof NodeBody>[0]> = {}) => (
  <NodeBody label="Core" nodeType="router" failed={false} selected={false} componentIndex={null} isArticulationPoint={false} {...over} />
)

describe('node states', () => {
  it.each(['router', 'server', 'client', 'firewall'] as const)('%s shows its label and type', (nodeType) => {
    render(body({ nodeType }))
    expect(screen.getByTestId('node-body')).toHaveAttribute('data-node-type', nodeType)
    expect(screen.getByText('Core')).toBeInTheDocument()
    expect(screen.getByText(nodeType)).toBeInTheDocument()
  })

  it('failed is shown by text, strike through and a dashed outline, not colour alone', () => {
    render(body({ failed: true }))
    const el = screen.getByTestId('node-body')
    expect(el.className).toContain('border-dashed')
    expect(screen.getByText('FAILED')).toBeInTheDocument()
    expect(screen.getByText('Core').className).toContain('line-through')
  })

  it('selected adds a ring', () => {
    render(body({ selected: true }))
    expect(screen.getByTestId('node-body').className).toContain('ring-2')
  })

  it('takes its component label and colour from the analysis index, and only when given one', () => {
    const { rerender } = render(body())
    expect(screen.queryByText('C2')).toBeNull()
    expect(screen.getByTestId('node-body').style.borderLeftColor).toBe('')
    rerender(body({ componentIndex: 2 }))
    expect(screen.getByText('C2')).toBeInTheDocument()
    expect(screen.getByTestId('node-body').style.borderLeftColor).not.toBe('')
    rerender(body({ componentIndex: 2, failed: true }))
    expect(screen.queryByText('C2')).toBeNull()
  })

  it('marks a cut vertex, unless it failed', () => {
    const { rerender } = render(body({ isArticulationPoint: true }))
    expect(screen.getByText('Cut Vertex')).toBeInTheDocument()
    rerender(body({ isArticulationPoint: true, failed: true }))
    expect(screen.queryByText('Cut Vertex')).toBeNull()
  })
})

const edge = (over: Partial<Parameters<typeof EdgeView>[0]> = {}) => (
  <svg>
    <EdgeView id="e" path="M0 0L10 10" midX={5} midY={5} failed={false} selected={false} bridge={false} {...over} />
  </svg>
)

describe('edge states', () => {
  it('normal has no dash and no marker', () => {
    render(edge())
    expect(screen.getByTestId('edge-e')).toHaveAttribute('data-state', 'normal')
    expect(screen.queryByTestId('edge-cross-e')).toBeNull()
  })

  it('failed is dashed with a cross at the midpoint', () => {
    const { container } = render(edge({ failed: true }))
    expect(screen.getByTestId('edge-e')).toHaveAttribute('data-state', 'failed')
    expect(screen.getByTestId('edge-cross-e')).toHaveAttribute('transform', 'translate(5 5)')
    expect(container.querySelector<SVGPathElement>('.ns-edge-line')?.style.strokeDasharray).not.toBe('')
  })

  it('bridge is highlighted, but a failed bridge shows as failed', () => {
    const { rerender } = render(edge({ bridge: true }))
    expect(screen.getByTestId('edge-bridge-e')).toBeInTheDocument()
    rerender(edge({ bridge: true, failed: true }))
    expect(screen.queryByTestId('edge-bridge-e')).toBeNull()
  })

  it('selected is marked', () => {
    render(edge({ selected: true }))
    expect(screen.getByTestId('edge-e')).toHaveAttribute('data-selected', 'true')
  })

  it('ends on the node borders, along the line between centres', () => {
    const a = { x: 0, y: 0, width: 100, height: 50 }
    const b = { x: 300, y: 0, width: 100, height: 50 }
    expect(floatingEnds(a, b)).toEqual({ source: { x: 100, y: 25 }, target: { x: 300, y: 25 } })
  })
})

describe('validation toasts', () => {
  it('a self loop and a duplicate are refused with the reason, and a good link clears the message', () => {
    render(<StudioToast />)
    const connect = (a: string, b: string) => {
      let ok = false
      act(() => {
        ok = connectOrExplain(a, b)
      })
      return ok
    }
    expect(connect('hub', 'hub')).toBe(false)
    expect(screen.getByRole('alert')).toHaveTextContent('no self loops')
    expect(connect('srv', 'hub')).toBe(false)
    expect(screen.getByRole('alert')).toHaveTextContent("Nodes 'srv' and 'hub' are already linked.")
    expect(connect('srv', 'fw')).toBe(true)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

function toolbar(isDesktop = true) {
  return render(
    <ReactFlowProvider>
      <StudioToolbar isDesktop={isDesktop} helpOpen={false} onHelpChange={() => undefined} onOpenDetails={() => undefined} />
    </ReactFlowProvider>
  )
}

describe('toolbar', () => {
  it('adds each node type', () => {
    toolbar()
    const before = graph().nodes.length
    for (const name of ['Router', 'Server', 'Client', 'Firewall']) fireEvent.click(screen.getByRole('button', { name }))
    expect(graph().nodes.slice(before).map((n) => n.data.nodeType)).toEqual(['router', 'server', 'client', 'firewall'])
  })

  it('a preset over a non empty graph asks first; cancel keeps the graph', () => {
    toolbar()
    fireEvent.click(screen.getByRole('button', { name: 'Ring' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Example: ring network')
    expect(graph().example).toBe('star')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(graph().example).toBe('star')
    fireEvent.click(screen.getByRole('button', { name: 'Ring' }))
    fireEvent.click(screen.getByRole('button', { name: 'Load Ring example' }))
    expect(graph().example).toBe('ring')
  })

  it('a preset over an empty graph loads at once', () => {
    graph().reset()
    toolbar()
    fireEvent.click(screen.getByRole('button', { name: 'Mesh' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(graph().example).toBe('mesh')
  })

  it('reset asks first, then empties', () => {
    toolbar()
    fireEvent.click(screen.getByRole('button', { name: 'Reset canvas' }))
    expect(graph().nodes.length).toBeGreaterThan(0)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset canvas' }))
    expect(graph().nodes).toEqual([])
  })

  it('undo, redo and delete enable with state and act', () => {
    toolbar()
    const undo = screen.getByRole('button', { name: 'Undo' })
    const del = screen.getByRole('button', { name: 'Delete selection' })
    expect(undo).toBeDisabled()
    expect(del).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Router' }))
    expect(undo).toBeEnabled()
    expect(del).toBeEnabled()
    fireEvent.click(del)
    expect(graph().selectedNodeId).toBeNull()
    fireEvent.click(undo)
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }))
    expect(graph().nodes.length).toBe(7)
  })

  it('on small screens the tools move into a sheet', () => {
    toolbar(false)
    expect(screen.queryByRole('button', { name: 'Router' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Tools' }))
    expect(within(screen.getByTestId('tools-sheet')).getByRole('button', { name: 'Router' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close Tools' }))
    expect(screen.queryByTestId('tools-sheet')).toBeNull()
  })
})

describe('help dialog and sheet', () => {
  it('help lists the shortcuts', () => {
    render(
      <ReactFlowProvider>
        <StudioToolbar isDesktop helpOpen onHelpChange={() => undefined} onOpenDetails={() => undefined} />
      </ReactFlowProvider>
    )
    expect(screen.getByTestId('shortcut-help')).toHaveTextContent('Nudge the selected node')
  })

  it('a sheet closes on Escape', () => {
    let closed = false
    render(
      <Sheet isOpen title="T" onClose={() => (closed = true)}>
        x
      </Sheet>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(closed).toBe(true)
  })
})

describe('properties panel', () => {
  it('edits a label as one undo step and shows the statuses', () => {
    graph().selectNode('hub')
    render(<PropertiesPanel />)
    const depth = graph().past.length
    const input = screen.getByLabelText('Label')
    fireEvent.change(input, { target: { value: 'Renamed' } })
    fireEvent.blur(input)
    expect(graph().nodes[0].data.label).toBe('Renamed')
    expect(graph().past.length).toBe(depth + 1)
    expect(screen.getByTestId('stored-status')).toHaveTextContent('Healthy')
    render(<FailureControls />)
    fireEvent.click(screen.getByRole('button', { name: 'Fail selected node' }))
    expect(screen.getByTestId('operational-status')).toHaveTextContent('Down')
  })

  it('refuses a failure probability outside 0 to 1 and a weight of 0, with the reason', () => {
    graph().selectEdge('e-hub-srv')
    render(<PropertiesPanel />)
    const p = screen.getByLabelText('Own failure p')
    fireEvent.change(p, { target: { value: '1.5' } })
    fireEvent.blur(p)
    expect(screen.getByTestId('edit-error')).toHaveTextContent('between 0 and 1')
    expect(graph().edges[0].data?.failureProbability).toBeUndefined()
    const w = screen.getByLabelText('Weight')
    fireEvent.change(w, { target: { value: '0' } })
    fireEvent.blur(w)
    expect(screen.getByTestId('edit-error')).toHaveTextContent('greater than 0')
    fireEvent.change(p, { target: { value: '0.25' } })
    fireEvent.blur(p)
    expect(graph().edges[0].data?.failureProbability).toBe(0.25)
  })

  // Same rule as backend/app/graph_ops.py: operational only if its own flag is false AND both endpoints are up.
  it.each(['srv', 'hub'])('an edge with failed=false whose endpoint %s is failed is unavailable, and its stored flag is unchanged', (endpoint) => {
    graph().failNode(endpoint)
    graph().selectEdge('e-hub-srv')
    render(<PropertiesPanel />)
    expect(graph().edges.find((e) => e.id === 'e-hub-srv')?.data?.failed).toBe(false)
    expect(screen.getByTestId('stored-status')).toHaveTextContent('Healthy')
    expect(screen.getByTestId('operational-status')).toHaveTextContent('Unavailable (endpoint failed)')
  })

  it('an edge is up once its endpoint is restored, and down when its own flag is set', () => {
    graph().failNode('srv')
    graph().restoreNode('srv')
    graph().selectEdge('e-hub-srv')
    render(<PropertiesPanel />)
    expect(screen.getByTestId('operational-status')).toHaveTextContent(/^Up$/)
    act(() => {
      graph().failEdge('e-hub-srv')
    })
    expect(screen.getByTestId('stored-status')).toHaveTextContent('Marked failed')
    expect(screen.getByTestId('operational-status')).toHaveTextContent(/^Down$/)
  })
})
