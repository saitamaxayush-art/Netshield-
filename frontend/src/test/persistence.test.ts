import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createPersistence,
  LEGACY_KEY,
  migrate,
  parseWorkspace,
  SAVE_DEBOUNCE_MS,
  usePersistenceStatus,
  WORKSPACE_KEY,
  WORKSPACE_VERSION,
  WorkspaceSchema,
} from '../store/persistence'
import { useGraphStore } from '../store/graphStore'
import { useSettingsStore } from '../store/settingsStore'
import { useAnalysisStore } from '../store/analysisStore'
import { toApiGraph } from '../types/graph'
import { preset } from '../store/presets'
import { resetStores } from './fixtures'

/** In memory Storage with switchable failures. */
class MemoryStorage implements Storage {
  data = new Map<string, string>()
  writes = 0
  failWrite: Error | null = null
  failRead = false
  get length() {
    return this.data.size
  }
  clear() {
    this.data.clear()
  }
  getItem(key: string) {
    if (this.failRead) throw new DOMException('denied', 'SecurityError')
    return this.data.get(key) ?? null
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
  setItem(key: string, value: string) {
    if (this.failWrite) throw this.failWrite
    this.writes++
    this.data.set(key, value)
  }
}

const graph = () => useGraphStore.getState()
const settings = () => useSettingsStore.getState()
let storage: MemoryStorage
let stop: (() => void) | null = null

function start(provider: () => Storage | null = () => storage) {
  const p = createPersistence(provider, SAVE_DEBOUNCE_MS)
  stop = p.start()
  return p
}

function savedWorkspace() {
  const text = storage.data.get(WORKSPACE_KEY)
  if (text === undefined) throw new Error('nothing saved')
  return WorkspaceSchema.parse(JSON.parse(text))
}

beforeEach(() => {
  vi.useFakeTimers()
  resetStores()
  storage = new MemoryStorage()
  usePersistenceStatus.setState({ saveError: null, loadProblem: null })
})
afterEach(() => {
  stop?.()
  stop = null
  vi.useRealTimers()
})

describe('saving', () => {
  it('debounces: many edits, one write, after the delay', () => {
    start()
    graph().addNode({ nodeType: 'client' })
    graph().failNode('hub')
    settings().update({ trials: 250 })
    expect(storage.writes).toBe(0)
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS - 1)
    expect(storage.writes).toBe(0)
    vi.advanceTimersByTime(1)
    expect(storage.writes).toBe(1)
  })

  it('writes the versioned shape: version, savedAt, graph, settings, and nothing else', () => {
    start()
    graph().failNode('hub')
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS)
    const saved = savedWorkspace()
    expect(Object.keys(saved).sort()).toEqual(['graph', 'savedAt', 'settings', 'version'])
    expect(saved.version).toBe(WORKSPACE_VERSION)
    expect(saved.graph.nodes.find((n) => n.id === 'hub')?.failed).toBe(true)
    expect('adapterMode' in saved.settings).toBe(false)
  })

  it('never persists analysis results', async () => {
    useSettingsStore.setState({ adapterMode: 'demo' })
    start()
    await useAnalysisStore.getState().run('analyze')
    expect(useAnalysisStore.getState().analyze.result).not.toBeNull()
    graph().failNode('hub')
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS)
    const text = storage.data.get(WORKSPACE_KEY) ?? ''
    for (const word of ['bridges', 'articulation', 'componentOf', 'estimate', 'isDemo']) expect(text).not.toContain(word)
  })

  it('does not save for a selection change or an adapter mode change', () => {
    start()
    graph().selectNode('hub')
    settings().switchToDemoMode()
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS)
    expect(storage.writes).toBe(0)
  })

  it('quota errors are caught and reported, and the app keeps working', () => {
    start()
    storage.failWrite = new DOMException('full', 'QuotaExceededError')
    graph().addNode({ nodeType: 'client' })
    expect(() => vi.advanceTimersByTime(SAVE_DEBOUNCE_MS)).not.toThrow()
    expect(usePersistenceStatus.getState().saveError).toBe('Browser storage is full, so the latest changes were not saved.')
    storage.failWrite = null
    graph().addNode({ nodeType: 'client' })
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS)
    expect(usePersistenceStatus.getState().saveError).toBeNull()
  })

  it('blocked storage (the localStorage getter throws) is caught too', () => {
    start(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    graph().addNode({ nodeType: 'client' })
    expect(() => vi.advanceTimersByTime(SAVE_DEBOUNCE_MS)).not.toThrow()
    expect(usePersistenceStatus.getState().saveError).toContain('not available')
  })
})

describe('loading', () => {
  it('round trips graph, positions, example label and settings', () => {
    const p = start()
    graph().loadPreset('mesh')
    graph().failEdge('e-db-app')
    graph().applyNodeChanges([{ type: 'position', id: 'db', position: { x: 12.5, y: -3 }, dragging: false }])
    settings().update({ edgeFailureProbability: 0.35, seed: 42, mode: 'two-terminal', terminalSource: 'g1', terminalTarget: 'agg', pathTarget: 'db' })
    p.flush()
    const before = { api: toApiGraph(graph()), positions: graph().nodes.map((n) => n.position), example: graph().example }
    stop?.()
    resetStores()
    start()
    expect(toApiGraph(graph())).toEqual(before.api)
    expect(graph().nodes.map((n) => n.position)).toEqual(before.positions)
    expect(graph().example).toBe('mesh')
    expect([settings().edgeFailureProbability, settings().seed, settings().mode, settings().terminalSource, settings().terminalTarget, settings().pathTarget]).toEqual([
      0.35, 42, 'two-terminal', 'g1', 'agg', 'db',
    ])
    expect(graph().past).toEqual([])
  })

  it('nothing saved: keeps the defaults', () => {
    expect(createPersistence(() => storage).load()).toEqual({ status: 'empty' })
    expect(graph().example).toBe('star')
  })

  it.each([
    ['corrupt JSON', '{"version": 2, "graph": ', 'Saved data is not valid JSON.'],
    ['a wrong version', JSON.stringify({ version: 99, graph: {}, settings: {} }), 'Saved data has an unknown version.'],
    ['no version', JSON.stringify({ nodes: [], edges: [] }), 'Saved data has an unknown version.'],
    ['not an object', '42', 'Saved data has an unknown version.'],
  ])('%s is discarded with a reason, and the defaults stay', (_name, text, reason) => {
    storage.data.set(WORKSPACE_KEY, text)
    const result = createPersistence(() => storage).load()
    expect(result).toEqual({ status: 'discarded', reason })
    expect(usePersistenceStatus.getState().loadProblem).toBe(reason)
    expect(toApiGraph(graph())).toEqual(toApiGraph(preset('star')))
  })

  it('the right version with the wrong shape is discarded', () => {
    storage.data.set(WORKSPACE_KEY, JSON.stringify({ version: 2, savedAt: 'x', graph: { nodes: 'no', edges: [], example: null }, settings: {} }))
    const result = createPersistence(() => storage).load()
    expect(result.status).toBe('discarded')
  })

  it('a valid shape that breaks a graph rule (self loop) is discarded, never half applied', () => {
    const p = start()
    p.flush()
    graph().addNode({ nodeType: 'client' })
    p.flush()
    const saved = savedWorkspace()
    const broken = { ...saved, graph: { ...saved.graph, edges: [...saved.graph.edges, { id: 'loop', source: 'hub', target: 'hub', failed: false }] } }
    expect(parseWorkspace(JSON.stringify(broken))).toEqual({
      status: 'discarded',
      reason: "Saved data breaks a rule: Edge 'loop' connects a node to itself.",
    })
  })

  it('settings out of range are discarded', () => {
    const p = start()
    graph().addNode({ nodeType: 'client' })
    p.flush()
    const saved = savedWorkspace()
    expect(parseWorkspace(JSON.stringify({ ...saved, settings: { ...saved.settings, trials: 0 } })).status).toBe('discarded')
  })

  it('a read error is caught and treated as nothing saved', () => {
    storage.failRead = true
    expect(createPersistence(() => storage).load()).toEqual({ status: 'empty' })
  })
})

describe('migration', () => {
  const v1 = {
    version: 1,
    nodes: [
      { id: 'hub', type: 'netshieldNode', position: { x: 1, y: 2 }, data: { label: 'Hub', nodeType: 'router', status: 'failed' } },
      { id: 'L1', type: 'netshieldNode', position: { x: 3, y: 4 }, data: { label: 'Leaf', nodeType: 'client', status: 'healthy' } },
    ],
    edges: [{ id: 'e1', source: 'hub', target: 'L1', type: 'netshieldEdge', data: { status: 'healthy', weight: 4 } }],
    failedNodeIds: ['hub'],
    failedEdgeIds: ['e1'],
    simulationConfig: { trials: 500, failureProb: 0.15, failTarget: 'both' },
  }

  it('converts the version 1 format and rewrites it under the new key', () => {
    storage.data.set(LEGACY_KEY, JSON.stringify(v1))
    start()
    expect(toApiGraph(graph())).toEqual({
      nodes: [
        { id: 'hub', label: 'Hub', type: 'router', failed: true },
        { id: 'L1', label: 'Leaf', type: 'client', failed: false },
      ],
      edges: [{ id: 'e1', source: 'hub', target: 'L1', failed: true, weight: 4 }],
    })
    expect([settings().trials, settings().edgeFailureProbability, settings().nodeFailureProbability]).toEqual([500, 0.15, 0.15])
    expect(storage.data.has(LEGACY_KEY)).toBe(false)
    expect(savedWorkspace().version).toBe(3)
  })

  it('maps failTarget edges and nodes to the matching probability only', () => {
    const edges = migrate({ ...v1, simulationConfig: { trials: 100, failureProb: 0.2, failTarget: 'edges' } })
    const nodes = migrate({ ...v1, simulationConfig: { trials: 100, failureProb: 0.2, failTarget: 'nodes' } })
    const e = WorkspaceSchema.parse(edges).settings
    const n = WorkspaceSchema.parse(nodes).settings
    expect([e.edgeFailureProbability, e.nodeFailureProbability, n.edgeFailureProbability, n.nodeFailureProbability]).toEqual([0.2, 0, 0.1, 0.2])
  })

  it('converts version 2: its two-terminal terminals were the path endpoints', () => {
    const p = start()
    graph().addNode({ nodeType: 'client' })
    p.flush()
    const v3 = savedWorkspace()
    const { terminalSource: _s, terminalTarget: _t, ...v2Settings } = { ...v3.settings, pathSource: 'hub', pathTarget: 'c3' }
    const migrated = WorkspaceSchema.parse(migrate({ ...v3, version: 2, settings: v2Settings }))
    expect([migrated.version, migrated.settings.terminalSource, migrated.settings.terminalTarget]).toEqual([3, 'hub', 'c3'])
    expect(migrate({ version: 2, settings: { trials: 'x' } })).toBeNull()
  })

  it('returns the current version unchanged and null for unknown versions', () => {
    const current = { version: 3 }
    expect(migrate(current)).toBe(current)
    expect(migrate({ version: 4 })).toBeNull()
    expect(migrate({ version: 1, nodes: 'bad' })).toBeNull()
  })
})

describe('clearSavedData', () => {
  it('removes saved data, resets graph and settings, clears results, and does not save again', async () => {
    const p = start()
    graph().reset()
    settings().update({ trials: 50 })
    p.flush()
    storage.data.set(LEGACY_KEY, '{}')
    useSettingsStore.setState({ adapterMode: 'demo' })
    await useAnalysisStore.getState().run('analyze')
    graph().addNode({ nodeType: 'client' })
    p.clearSavedData()
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS * 2)
    expect([storage.data.has(WORKSPACE_KEY), storage.data.has(LEGACY_KEY)]).toEqual([false, false])
    expect(toApiGraph(graph())).toEqual(toApiGraph(preset('star')))
    expect(settings().trials).toBe(1000)
    expect(useAnalysisStore.getState().analyze.result).toBeNull()
  })
})
