/** Phase 7: hardening, resilience and race conditions. Each block names the bug it guards (BUGLOG). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { exportGraphFile, MAX_IMPORT_BYTES, parseGraphFile } from '../features/studio/graphFile'
import { escapeXml, graphSvg } from '../features/studio/canvasImage'
import { nodeNames } from '../features/studio/nodeNames'
import { clampInput } from '../features/studio/clamp'
import { AppErrorFallback, ErrorBoundary, PanelErrorFallback } from '../components/layout/ErrorBoundary'
import { StatusBanners } from '../components/layout/StatusBanners'
import { useAnalysisStore } from '../store/analysisStore'
import { useGraphStore } from '../store/graphStore'
import { useHealthStore } from '../store/healthStore'
import { useSettingsStore } from '../store/settingsStore'
import { preset } from '../store/presets'
import { toApiGraph } from '../types/graph'
import { backendFixture, deferred, fakeFetch, json, resetStores, settle, type FetchCall } from './fixtures'

const graph = () => useGraphStore.getState()
const analysis = () => useAnalysisStore.getState()
const star = backendFixture('analyze-star').response
const triangles = backendFixture('analyze-two-triangles').response
const health = backendFixture('health').response

function serve(respond: (call: FetchCall) => Response | Promise<Response>) {
  const fake = fakeFetch(respond)
  vi.stubGlobal('fetch', fake.fetchImpl)
  return fake.calls
}

beforeEach(() => {
  resetStores()
  useHealthStore.setState({ status: 'unknown', error: null, dismissed: false, checkedAt: null, version: null })
})
afterEach(() => vi.unstubAllGlobals())

describe('graph file import and export', () => {
  const valid = () => exportGraphFile(preset('mesh'), '2026-11-06T00:00:00.000Z')

  it('round trips, and the import is undoable', () => {
    const result = parseGraphFile(valid())
    if (!result.ok) throw new Error(result.errors.join('; '))
    expect(toApiGraph(result.graph)).toEqual(toApiGraph(preset('mesh')))
    const before = toApiGraph(graph())
    expect(graph().importGraph(result.graph).ok).toBe(true)
    expect(graph().example).toBeNull()
    graph().undo()
    expect(toApiGraph(graph())).toEqual(before)
  })

  it('lists what is wrong, with paths', () => {
    const file = JSON.parse(valid())
    file.graph.nodes[0].nodeType = 'mainframe'
    delete file.graph.edges[1].source
    file.graph.nodes[2].extra = 1
    const result = parseGraphFile(JSON.stringify(file))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.some((e) => e.startsWith('graph.nodes[0].nodeType:'))).toBe(true)
    expect(result.errors.some((e) => e.startsWith('graph.edges[1].source:'))).toBe(true)
    expect(result.errors.some((e) => e.startsWith('graph.nodes[2]:') && e.includes('extra'))).toBe(true)
  })

  it('caps the list at 10 problems and says how many more', () => {
    const file = JSON.parse(valid())
    for (const n of file.graph.nodes) n.failed = 'yes'
    for (const e of file.graph.edges) e.failed = 'no'
    const result = parseGraphFile(JSON.stringify(file))
    if (result.ok) throw new Error('expected errors')
    expect(result.errors).toHaveLength(11)
    expect(result.errors[10]).toBe('and 5 more problems')
  })

  it.each([
    ['not JSON', '{nope', /not valid JSON/],
    ['another format', JSON.stringify({ format: 'other', version: 1, graph: { nodes: [], edges: [] } }), /format/],
    ['a future version', JSON.stringify({ format: 'netshield-graph', version: 2, graph: { nodes: [], edges: [] } }), /version/],
  ])('refuses %s', (_name, text, message) => {
    const result = parseGraphFile(text)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.join(' ')).toMatch(message)
  })

  it('applies the editing rules and the limits, and refuses huge coordinates', () => {
    const file = JSON.parse(valid())
    file.graph.edges.push({ id: 'loop', source: 'g1', target: 'g1', failed: false })
    expect(parseGraphFile(JSON.stringify(file))).toEqual({ ok: false, errors: ["Edge 'loop' connects a node to itself."] })
    const far = JSON.parse(valid())
    far.graph.nodes[0].position.x = 1e9
    const farResult = parseGraphFile(JSON.stringify(far))
    expect(farResult.ok).toBe(false)
    if (!farResult.ok) expect(farResult.errors[0]).toContain('within 100000 of the origin')
    const many = { format: 'netshield-graph', version: 1, graph: { nodes: Array.from({ length: 201 }, (_, i) => ({ id: `n${i}` })), edges: [] } }
    expect(parseGraphFile(JSON.stringify(many))).toEqual({ ok: false, errors: ['The file has 201 nodes; the limit is 200.'] })
  })

  it('refuses files over the size limit before parsing', () => {
    const result = parseGraphFile('{}', MAX_IMPORT_BYTES + 1)
    expect(result).toEqual({ ok: false, errors: ['The file is 1024 KB; the limit is 1024 KB.'] })
  })

  it('trims imported labels and refuses blank ones', () => {
    const file = JSON.parse(valid())
    file.graph.nodes[0].label = '   Gateway   '
    const result = parseGraphFile(JSON.stringify(file))
    expect(result.ok && result.graph.nodes[0].data.label).toBe('Gateway')
    file.graph.nodes[0].label = '    '
    expect(parseGraphFile(JSON.stringify(file))).toEqual({ ok: false, errors: ['Label must not be empty.'] })
  })
})

describe('positions stay within reach (BUG-010)', () => {
  it('the store clamps added, moved and nudged positions; saved data with far positions still loads', () => {
    expect(graph().addNode({ nodeType: 'client', id: 'far', position: { x: 5e9, y: -5e9 } }).ok).toBe(true)
    expect(graph().nodes.at(-1)?.position).toEqual({ x: 100000, y: -100000 })
    graph().moveNodes({ hub: { x: -1e12, y: 3 } })
    expect(graph().nodes[0].position).toEqual({ x: -100000, y: 3 })
    graph().applyNodeChanges([{ type: 'position', id: 'srv', position: { x: 2e6, y: 0 }, dragging: false }])
    expect(graph().nodes[1].position.x).toBe(100000)
  })
})

describe('SVG export escapes every label', () => {
  it('escapes XML special characters', () => {
    expect(escapeXml(`<a href="x">&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;')
  })

  it('a label with markup stays text, and the SVG parses', () => {
    useGraphStore.getState().updateNode('hub', { label: '<script>alert("x")</script> & co' })
    useGraphStore.getState().failNode('srv')
    const svg = graphSvg(useGraphStore.getState(), { hub: 0 })
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
    expect(doc.querySelector('parsererror')).toBeNull()
    expect(doc.querySelectorAll('g[data-node-id]')).toHaveLength(7)
    expect(doc.querySelector('g[data-node-id="srv"] rect')?.getAttribute('stroke-dasharray')).toBe('5 4')
  })
})

describe('input hardening', () => {
  it('labels are trimmed, and blank or over long labels are refused (BUG-006)', () => {
    expect(graph().updateNode('hub', { label: '  Core  ' }).ok).toBe(true)
    expect(graph().nodes[0].data.label).toBe('Core')
    expect(graph().updateNode('hub', { label: '   ' })).toEqual({ ok: false, error: 'Label must not be empty.' })
    expect(graph().updateNode('hub', { label: ` ${'x'.repeat(100)} ` }).ok).toBe(true)
    expect(graph().updateNode('hub', { label: 'x'.repeat(101) }).ok).toBe(false)
    expect(graph().addNode({ nodeType: 'client', label: '  Edge  ' }).ok).toBe(true)
    expect(graph().nodes.at(-1)?.data.label).toBe('Edge')
  })

  it('unusual characters are kept as they are', () => {
    const label = 'Ünïcødé 😀 <b>bold</b> "q" ​'
    expect(graph().updateNode('hub', { label }).ok).toBe(true)
    expect(graph().nodes[0].data.label).toBe(label.trim())
  })

  it('duplicate labels are told apart by id in every picker (BUG-007)', () => {
    graph().updateNode('c1', { label: 'Client' })
    graph().updateNode('c2', { label: 'Client' })
    const names = nodeNames(graph().nodes)
    expect([names.get('c1'), names.get('c2'), names.get('hub')]).toEqual(['Client (c1)', 'Client (c2)', 'Core Router'])
  })

  it('clamps numbers into range with a note, rounds integers, and leaves non numbers to validation', () => {
    expect(clampInput(1.5, 0, 1)).toEqual({ value: 1, note: 'Set to 1, the largest allowed value.' })
    expect(clampInput(-2, 0, 1)).toEqual({ value: 0, note: 'Set to 0, the smallest allowed value.' })
    expect(clampInput(0.4, 0, 1)).toEqual({ value: 0.4, note: null })
    expect(clampInput(7.6, 1, 25, true)).toEqual({ value: 8, note: 'Rounded to 8, a whole number.' })
    expect(clampInput(Number.NaN, 0, 1).note).toBeNull()
  })

  it('a payload that breaks a rule is never sent (BUG-008)', async () => {
    const calls = serve(() => json(star))
    useSettingsStore.setState({ edgeFailureProbability: 2 })
    await analysis().run('simulate')
    expect(calls).toHaveLength(0)
    expect([analysis().simulate.error?.code, analysis().simulate.error?.message]).toEqual(['CLIENT_VALIDATION', 'Not sent: Link failure probability must be between 0 and 1.'])
    useSettingsStore.setState({ edgeFailureProbability: 0.1 })
    useGraphStore.setState({ edges: [...graph().edges, { id: 'self', source: 'hub', target: 'hub', type: 'netshieldEdge', data: { failed: false } }] })
    await analysis().run('analyze')
    expect(calls).toHaveLength(0)
    expect(analysis().analyze.error?.message).toContain('connects a node to itself')
  })
})

describe('backend health', () => {
  it('a health check marks the server online or offline; it never switches to demo mode', async () => {
    let up = true
    serve(() => (up ? json(health) : Promise.reject(new TypeError('offline'))))
    await useHealthStore.getState().check()
    expect([useHealthStore.getState().status, useHealthStore.getState().version]).toEqual(['online', '2.0.0'])
    up = false
    await useHealthStore.getState().check()
    expect(useHealthStore.getState().status).toBe('offline')
    expect(useSettingsStore.getState().adapterMode).toBe('backend')
  })

  it('analysis requests update the status too', async () => {
    let up = false
    serve(() => (up ? json(star) : Promise.reject(new TypeError('offline'))))
    await analysis().run('analyze')
    expect(useHealthStore.getState().status).toBe('offline')
    up = true
    await analysis().run('analyze')
    expect(useHealthStore.getState().status).toBe('online')
  })

  it('banner: Retry, Use demo mode, Dismiss leaves a chip that reopens it', async () => {
    serve(() => Promise.reject(new TypeError('offline')))
    render(<StatusBanners />)
    await act(async () => {
      await useHealthStore.getState().check()
    })
    expect(screen.getByTestId('offline-banner')).toHaveTextContent('Cannot reach the analysis server.')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByTestId('offline-banner')).toBeNull()
    fireEvent.click(screen.getByTestId('offline-chip'))
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Use demo mode' }))
    expect(screen.getByTestId('demo-mode-banner')).toBeInTheDocument()
    expect(screen.queryByTestId('offline-banner')).toBeNull()
  })
})

describe('error boundaries', () => {
  const Boom: React.FC<{ fail: boolean }> = ({ fail }) => {
    if (fail) throw new Error('render failed')
    return <p>fine</p>
  }

  it('the panel fallback shows the error, and Try again or a new reset key recovers', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let fail = true
    const ui = (key: string) => (
      <ErrorBoundary resetKey={key} fallback={(error, reset) => <PanelErrorFallback error={error} reset={reset} name="Analysis" />}>
        <Boom fail={fail} />
      </ErrorBoundary>
    )
    const { rerender } = render(ui('a'))
    expect(screen.getByTestId('panel-error')).toHaveTextContent('The Analysis panel failed to display.')
    expect(screen.getByTestId('panel-error')).toHaveTextContent('render failed')
    fail = false
    rerender(ui('a'))
    expect(screen.getByTestId('panel-error')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('fine')).toBeInTheDocument()
    fail = true
    rerender(ui('a'))
    fail = false
    rerender(ui('b'))
    expect(screen.getByText('fine')).toBeInTheDocument()
    quiet.mockRestore()
  })

  it('the app fallback offers reload and home', () => {
    render(<AppErrorFallback error={new Error('x')} />)
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to home page' })).toHaveAttribute('href', '/')
  })
})

describe('races: a stale response never overwrites a newer one', () => {
  it('out of order: the newer response arrives first, the older one later, the newer one stays', async () => {
    const gates = [deferred<void>(), deferred<void>()]
    let n = 0
    // A fetch that ignores aborts, so the stale response really arrives.
    vi.stubGlobal('fetch', () => {
      const i = n++
      return gates[i].promise.then(() => json(i === 0 ? triangles : star))
    })
    const first = analysis().run('analyze')
    graph().failNode('c1')
    const second = analysis().run('analyze')
    gates[1].resolve()
    await second
    expect(analysis().analyze.result?.current.bridges.edgeIds).toEqual(['e1', 'e2', 'e3', 'e4'])
    gates[0].resolve()
    await first
    await settle()
    expect(analysis().analyze.result?.current.bridges.edgeIds).toEqual(['e1', 'e2', 'e3', 'e4'])
    expect(analysis().analyze.status).toBe('success')
  })

  it('switching presets mid request: the old answer is ignored and the result is marked out of date', async () => {
    const gate = deferred<void>()
    serve(() => gate.promise.then(() => json(star)))
    const pending = analysis().run('analyze')
    graph().loadPreset('ring')
    gate.resolve()
    await pending
    expect(analysis().analyze.stale).toBe(true)
  })

  it('undo during a pending request: the result is current again only if the inputs match', async () => {
    const gate = deferred<void>()
    serve(() => gate.promise.then(() => json(star)))
    graph().failNode('c1')
    const pending = analysis().run('analyze')
    graph().undo()
    gate.resolve()
    await pending
    expect(analysis().analyze.stale).toBe(true)
    graph().redo()
    expect(analysis().analyze.stale).toBe(false)
  })

  it('cancel then rerun: only the rerun result is applied', async () => {
    const gates: Array<ReturnType<typeof deferred<void>>> = []
    vi.stubGlobal('fetch', () => {
      const gate = deferred<void>()
      gates.push(gate)
      return gate.promise.then(() => json(gates.length === 1 ? triangles : star))
    })
    const first = analysis().run('analyze')
    analysis().cancel('analyze')
    const second = analysis().run('analyze')
    gates[1].resolve()
    await second
    gates[0].resolve()
    await first
    await settle()
    expect(analysis().analyze.result?.current.bridges.edgeIds).toEqual(['e1', 'e2', 'e3', 'e4'])
    expect(analysis().analyze.cancelled).toBe(false)
  })

  it('changing a node type does not mark the analysis out of date (it does not change any result)', async () => {
    serve(() => json(star))
    await analysis().run('analyze')
    graph().updateNode('hub', { nodeType: 'firewall' })
    expect(analysis().analyze.stale).toBe(false)
  })
})
