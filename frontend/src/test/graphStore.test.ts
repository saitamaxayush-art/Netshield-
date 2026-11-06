import { beforeEach, describe, expect, it } from 'vitest'
import { HISTORY_LIMIT, useGraphStore } from '../store/graphStore'
import { checkGraph, MAX_ID_LENGTH, MAX_NODES } from '../store/graphRules'
import { preset, PRESET_NAMES } from '../store/presets'
import { graphSignature, toApiGraph, fromApiGraph } from '../types/graph'
import { resetStores } from './fixtures'

const store = () => useGraphStore.getState()

function emptyGraph() {
  store().reset()
  useGraphStore.setState({ past: [], future: [] })
}

function abc() {
  emptyGraph()
  for (const id of ['A', 'B', 'C']) expect(store().addNode({ nodeType: 'router', id }).ok).toBe(true)
}

beforeEach(resetStores)

describe('nodes', () => {
  it('adds with deterministic ids and labels, and selects the new node', () => {
    emptyGraph()
    const a = store().addNode({ nodeType: 'server' })
    const b = store().addNode({ nodeType: 'server' })
    expect([a, b]).toEqual([
      { ok: true, id: 'server-1' },
      { ok: true, id: 'server-2' },
    ])
    expect(store().nodes.map((n) => n.data.label)).toEqual(['Server 1', 'Server 2'])
    expect(store().selectedNodeId).toBe('server-2')
  })

  it('refuses duplicate, empty and over long ids and over long labels', () => {
    abc()
    expect(store().addNode({ nodeType: 'router', id: 'A' })).toEqual({ ok: false, error: "Node id 'A' is already used." })
    expect(store().addNode({ nodeType: 'router', id: '' }).ok).toBe(false)
    expect(store().addNode({ nodeType: 'router', id: 'x'.repeat(MAX_ID_LENGTH + 1) }).ok).toBe(false)
    expect(store().addNode({ nodeType: 'router', label: 'x'.repeat(101) }).ok).toBe(false)
    expect(store().updateNode('A', { label: 'x'.repeat(101) }).ok).toBe(false)
    expect(store().nodes).toHaveLength(3)
  })

  it('refuses more than the node limit', () => {
    emptyGraph()
    for (let i = 0; i < MAX_NODES; i++) store().addNode({ nodeType: 'client' })
    expect(store().addNode({ nodeType: 'client' }).ok).toBe(false)
  })

  it('updates label and type, and refuses unknown ids', () => {
    abc()
    expect(store().updateNode('A', { label: 'Alpha', nodeType: 'firewall' }).ok).toBe(true)
    expect(store().nodes[0].data).toEqual({ label: 'Alpha', nodeType: 'firewall', failed: false })
    expect(store().updateNode('Q', { label: 'x' }).ok).toBe(false)
  })

  it('removing a node removes its incident edges and clears its selection', () => {
    abc()
    store().addEdge({ source: 'A', target: 'B', id: 'ab' })
    store().addEdge({ source: 'B', target: 'C', id: 'bc' })
    store().addEdge({ source: 'A', target: 'C', id: 'ac' })
    store().selectNode('B')
    expect(store().removeNode('B').ok).toBe(true)
    expect(store().nodes.map((n) => n.id)).toEqual(['A', 'C'])
    expect(store().edges.map((e) => e.id)).toEqual(['ac'])
    expect(store().selectedNodeId).toBeNull()
    expect(store().removeNode('B').ok).toBe(false)
  })

  it('removing a node also drops a selected incident edge', () => {
    abc()
    store().addEdge({ source: 'A', target: 'B', id: 'ab' })
    store().selectEdge('ab')
    store().removeNode('A')
    expect(store().selectedEdgeId).toBeNull()
  })
})

describe('edges', () => {
  beforeEach(abc)

  it('adds with a deterministic id', () => {
    expect(store().addEdge({ source: 'A', target: 'B' })).toEqual({ ok: true, id: 'e-A-B-1' })
  })

  it('refuses self loops', () => {
    expect(store().addEdge({ source: 'A', target: 'A' })).toEqual({ ok: false, error: 'A link cannot connect a node to itself (no self loops).' })
  })

  it('refuses a duplicate undirected pair in either direction', () => {
    store().addEdge({ source: 'A', target: 'B' })
    expect(store().addEdge({ source: 'A', target: 'B' }).ok).toBe(false)
    expect(store().addEdge({ source: 'B', target: 'A' })).toEqual({ ok: false, error: "Nodes 'B' and 'A' are already linked." })
    expect(store().edges).toHaveLength(1)
  })

  it('refuses unknown endpoints and duplicate edge ids', () => {
    expect(store().addEdge({ source: 'A', target: 'Q' })).toEqual({ ok: false, error: "Unknown node 'Q'." })
    store().addEdge({ source: 'A', target: 'B', id: 'x' })
    expect(store().addEdge({ source: 'B', target: 'C', id: 'x' })).toEqual({ ok: false, error: "Edge id 'x' is already used." })
  })

  it('validates weight and own failure probability, and null clears them', () => {
    expect(store().addEdge({ source: 'A', target: 'B', id: 'ab', weight: 0 }).ok).toBe(false)
    expect(store().addEdge({ source: 'A', target: 'B', id: 'ab', failureProbability: 1.1 }).ok).toBe(false)
    expect(store().addEdge({ source: 'A', target: 'B', id: 'ab', weight: 2, failureProbability: 0.3 }).ok).toBe(true)
    expect(store().updateEdge('ab', { weight: -1 }).ok).toBe(false)
    expect(store().updateEdge('ab', { weight: Number.NaN }).ok).toBe(false)
    expect(store().edges[0].data).toEqual({ failed: false, weight: 2, failureProbability: 0.3 })
    expect(store().updateEdge('ab', { weight: null, failureProbability: 0.5 }).ok).toBe(true)
    expect(store().edges[0].data).toEqual({ failed: false, failureProbability: 0.5 })
  })

  it('removes edges and removeSelected removes the selection', () => {
    store().addEdge({ source: 'A', target: 'B', id: 'ab' })
    store().selectEdge('ab')
    expect(store().removeSelected().ok).toBe(true)
    expect(store().edges).toEqual([])
    expect(store().removeSelected()).toEqual({ ok: false, error: 'Nothing is selected.' })
    expect(store().removeEdge('ab').ok).toBe(false)
  })
})

describe('failure flags', () => {
  beforeEach(() => {
    abc()
    store().addEdge({ source: 'A', target: 'B', id: 'ab' })
  })

  it('fail then restore returns to the same graph (round trip)', () => {
    const before = toApiGraph(store())
    store().failNode('A')
    store().failEdge('ab')
    const failed = toApiGraph(store())
    expect(failed.nodes.find((n) => n.id === 'A')?.failed).toBe(true)
    expect(failed.edges[0].failed).toBe(true)
    // A failed node does not change its edges' stored flags.
    store().restoreEdge('ab')
    expect(toApiGraph(store()).edges[0].failed).toBe(false)
    store().restoreNode('A')
    expect(toApiGraph(store())).toEqual(before)
  })

  it('failing a node keeps its incident edges stored (they are unavailable, not deleted)', () => {
    store().failNode('A')
    expect(store().edges.map((e) => [e.id, e.data?.failed])).toEqual([['ab', false]])
  })

  it('is idempotent and adds no history for a no op', () => {
    store().failNode('A')
    const depth = store().past.length
    store().failNode('A')
    expect(store().past.length).toBe(depth)
  })

  it('toggles, refuses unknown ids, and clearFailures restores everything', () => {
    expect(store().toggleNodeFailure('B').ok).toBe(true)
    expect(store().toggleEdgeFailure('ab').ok).toBe(true)
    expect(store().failNode('Q').ok).toBe(false)
    expect(store().failEdge('Q').ok).toBe(false)
    store().clearFailures()
    expect(store().nodes.every((n) => !n.data.failed)).toBe(true)
    expect(store().edges.every((e) => !e.data?.failed)).toBe(true)
  })

  it('changes the signature, which ignores positions and labels', () => {
    const base = graphSignature(store())
    store().updateNode('A', { label: 'renamed' })
    store().applyNodeChanges([{ type: 'position', id: 'A', position: { x: 999, y: 1 }, dragging: false }])
    expect(graphSignature(store())).toBe(base)
    store().failNode('A')
    expect(graphSignature(store())).not.toBe(base)
  })
})

describe('undo and redo', () => {
  it('undo and redo every kind of edit', () => {
    abc()
    const steps: Array<() => void> = [
      () => store().addEdge({ source: 'A', target: 'B', id: 'ab' }),
      () => store().failNode('C'),
      () => store().updateEdge('ab', { weight: 3 }),
      () => store().removeNode('A'),
    ]
    const states = [toApiGraph(store())]
    for (const step of steps) {
      step()
      states.push(toApiGraph(store()))
    }
    for (let i = states.length - 2; i >= 0; i--) {
      expect(store().undo()).toBe(true)
      expect(toApiGraph(store())).toEqual(states[i])
    }
    for (let i = 1; i < states.length; i++) {
      expect(store().redo()).toBe(true)
      expect(toApiGraph(store())).toEqual(states[i])
    }
    expect(store().redo()).toBe(false)
  })

  it('a new edit clears redo', () => {
    abc()
    store().undo()
    expect(store().future).toHaveLength(1)
    store().addNode({ nodeType: 'client', id: 'D' })
    expect(store().future).toHaveLength(0)
  })

  it(`keeps at most ${HISTORY_LIMIT} entries`, () => {
    emptyGraph()
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) store().addNode({ nodeType: 'client' })
    expect(store().past).toHaveLength(HISTORY_LIMIT)
    let undone = 0
    while (store().undo()) undone++
    expect(undone).toBe(HISTORY_LIMIT)
    expect(store().nodes).toHaveLength(20)
  })

  it('undo with nothing to undo is refused', () => {
    emptyGraph()
    expect(store().undo()).toBe(false)
  })

  it('a drag is one history entry, recorded when it starts', () => {
    abc()
    const depth = store().past.length
    const move = (x: number, dragging: boolean) => store().applyNodeChanges([{ type: 'position', id: 'A', position: { x, y: 0 }, dragging }])
    const start = store().nodes[0].position
    move(10, true)
    move(20, true)
    move(30, false)
    expect(store().past.length).toBe(depth + 1)
    expect(store().nodes[0].position).toEqual({ x: 30, y: 0 })
    store().undo()
    expect(store().nodes[0].position).toEqual(start)
  })

  it('moveNodes commits final positions as one undo step, and a no op adds none', () => {
    abc()
    const depth = store().past.length
    const start = store().nodes[0].position
    store().moveNodes({ A: { x: 5, y: 6 }, B: { x: 7, y: 8 } })
    expect(store().past.length).toBe(depth + 1)
    store().moveNodes({ A: { x: 5, y: 6 } })
    expect(store().past.length).toBe(depth + 1)
    store().undo()
    expect(store().nodes[0].position).toEqual(start)
  })

  it('undoing Fail random restores the element and takes back the pick, so the same draw repeats', () => {
    const before = toApiGraph(store())
    const first = store().failRandom(3)
    const pick = store().lastRandom
    expect(first.ok).toBe(true)
    expect(pick?.draw).toBe(1)
    store().undo()
    expect(toApiGraph(store())).toEqual(before)
    expect([store().lastRandom, store().randomDraw]).toEqual([null, 0])
    store().redo()
    expect(store().lastRandom).toEqual(pick)
    store().undo()
    store().failRandom(3)
    expect(store().lastRandom).toEqual(pick)
  })

  it('undo drops a selection that no longer exists', () => {
    abc()
    store().selectNode('C')
    store().undo()
    expect(store().selectedNodeId).toBeNull()
  })

  it('React Flow remove changes go through removeNode (incident edges go too)', () => {
    abc()
    store().addEdge({ source: 'A', target: 'B', id: 'ab' })
    store().applyNodeChanges([{ type: 'remove', id: 'A' }])
    expect(store().edges).toEqual([])
  })
})

describe('presets and reset', () => {
  it.each(PRESET_NAMES)('%s is valid, deterministic and labelled as an example', (name) => {
    const graph = preset(name)
    expect(checkGraph(graph)).toBeNull()
    expect(preset(name)).toEqual(graph)
    store().loadPreset(name)
    expect(store().example).toBe(name)
    expect(toApiGraph(store())).toEqual(toApiGraph(graph))
  })

  it('loading a preset can be undone, label included', () => {
    store().loadPreset('ring')
    store().undo()
    expect(store().example).toBe('star')
  })

  it('reset empties the canvas, clears the example label, and can be undone', () => {
    store().reset()
    expect([store().nodes.length, store().edges.length, store().example]).toEqual([0, 0, null])
    store().undo()
    expect(store().nodes.length).toBeGreaterThan(0)
  })

  it('replaceGraph validates and clears history', () => {
    const bad = fromApiGraph({ nodes: [{ id: 'A', label: 'A', type: 'router' }], edges: [{ id: 'x', source: 'A', target: 'A' }] })
    expect(store().replaceGraph(bad).ok).toBe(false)
    const good = fromApiGraph({ nodes: [{ id: 'A', label: 'A', type: 'router' }], edges: [] })
    store().addNode({ nodeType: 'client' })
    expect(store().replaceGraph(good).ok).toBe(true)
    expect([store().past.length, store().nodes.length]).toEqual([0, 1])
  })
})

describe('editor and API graph conversion', () => {
  it('round trips through the API shape', () => {
    const api = toApiGraph(preset('mesh'))
    expect(toApiGraph(fromApiGraph(api))).toEqual(api)
  })

  it('places nodes without positions on a circle, deterministically', () => {
    const g = fromApiGraph({ nodes: [{ id: 'A', label: 'A', type: 'router' }, { id: 'B', label: 'B', type: 'router' }], edges: [] })
    expect(g.nodes.map((n) => n.position)).toEqual([
      { x: 400, y: 40 },
      { x: 400, y: 480 },
    ])
  })
})
