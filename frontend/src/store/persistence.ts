/**
 * Saves the graph and the settings to localStorage as a versioned workspace:
 *   { version: 4, savedAt, graph (with viewport), settings }
 * Analysis results and the adapter mode are never saved.
 *
 * Every storage call is wrapped in try/catch (private windows, blocked storage, quota). Loaded data is
 * parsed with Zod and checked against the editing rules; anything that fails is discarded with a
 * reason, never half applied. Writes are debounced.
 */
import { z } from 'zod'
import { create } from 'zustand'
import { NODE_TYPES, type EditorGraph } from '@/types/graph'
import { useAnalysisStore } from './analysisStore'
import { checkGraph } from './graphRules'
import { resetGraphStore, useGraphStore } from './graphStore'
import { PRESET_NAMES } from './presets'
import { checkSettings, DEFAULT_SETTINGS, pickSettings, useSettingsStore, type Settings } from './settingsStore'

export const WORKSPACE_KEY = 'netshield_workspace'
export const LEGACY_KEY = 'netshield_graph_state_v1'
export const WORKSPACE_VERSION = 4
export const SAVE_DEBOUNCE_MS = 400

const finite = z.number().refine(Number.isFinite, 'must be finite')

const SavedNode = z.strictObject({
  id: z.string().min(1).max(64),
  label: z.string().max(100),
  nodeType: z.enum(NODE_TYPES),
  failed: z.boolean(),
  position: z.strictObject({ x: finite, y: finite }),
})

const SavedEdge = z.strictObject({
  id: z.string().min(1).max(64),
  source: z.string(),
  target: z.string(),
  failed: z.boolean(),
  weight: finite.optional(),
  failureProbability: finite.optional(),
})

const SavedSettings = z.strictObject({
  edgeFailureProbability: finite,
  nodeFailureProbability: finite,
  trials: finite,
  seed: finite.nullable(),
  mode: z.enum(['all-terminal', 'two-terminal']),
  traversalStart: z.string().nullable(),
  pathSource: z.string().nullable(),
  pathTarget: z.string().nullable(),
  terminalSource: z.string().nullable(),
  terminalTarget: z.string().nullable(),
  sweepPMin: finite,
  sweepPMax: finite,
  sweepPoints: finite,
  trialsPerPoint: finite,
})

export const WorkspaceSchema = z.strictObject({
  version: z.literal(WORKSPACE_VERSION),
  savedAt: z.string(),
  graph: z.strictObject({
    nodes: z.array(SavedNode),
    edges: z.array(SavedEdge),
    example: z.enum(PRESET_NAMES).nullable(),
    viewport: z.strictObject({ x: finite, y: finite, zoom: finite }).nullable(),
  }),
  settings: SavedSettings,
})
export type Workspace = z.infer<typeof WorkspaceSchema>

// The settings shape in storage must stay exactly the store's Settings type.
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
const settingsShapeMatches: Equals<z.infer<typeof SavedSettings>, Settings> = true
void settingsShapeMatches

/** Version 1 (before Phase 3), written under LEGACY_KEY. Only the fields migration reads. */
const LegacyV1 = z.object({
  version: z.literal(1).optional(),
  nodes: z.array(
    z.object({
      id: z.string(),
      position: z.object({ x: finite, y: finite }),
      data: z.object({ label: z.string(), nodeType: z.enum(NODE_TYPES) }),
    })
  ),
  edges: z.array(z.object({ id: z.string(), source: z.string(), target: z.string(), data: z.object({ weight: finite.optional() }).optional() })),
  failedNodeIds: z.array(z.string()).optional(),
  failedEdgeIds: z.array(z.string()).optional(),
  simulationConfig: z
    .object({ trials: finite, failureProb: finite, failTarget: z.enum(['nodes', 'edges', 'both']) })
    .optional(),
})

/** Version 2 (Phase 3): the two-terminal terminals were the path endpoints, so it had no terminal fields. */
const WorkspaceV2 = z.object({
  version: z.literal(2),
  settings: SavedSettings.omit({ terminalSource: true, terminalTarget: true }),
})

/**
 * Bring stored data of any known version to the current version, or return null if the version is
 * unknown. Versions 1 to 3 are converted; version 4 is current. Add a case here when the format changes.
 */
export function migrate(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || !('version' in raw)) return null
  if (raw.version === WORKSPACE_VERSION) return raw
  if (raw.version === 2) {
    const v2 = WorkspaceV2.safeParse(raw)
    if (!v2.success) return null
    // Keep what version 2 meant: its terminals were the path endpoints.
    const { pathSource, pathTarget } = v2.data.settings
    return migrate({ ...raw, version: 3, settings: { ...v2.data.settings, terminalSource: pathSource, terminalTarget: pathTarget } })
  }
  if (raw.version === 3) {
    // Version 3 had no saved viewport.
    const v3 = z.object({ graph: z.looseObject({}) }).safeParse(raw)
    if (!v3.success) return null
    return { ...raw, version: WORKSPACE_VERSION, graph: { ...v3.data.graph, viewport: null } }
  }
  if (raw.version === 1) {
    const v1 = LegacyV1.safeParse(raw)
    if (!v1.success) return null
    const failedNodes = new Set(v1.data.failedNodeIds ?? [])
    const failedEdges = new Set(v1.data.failedEdgeIds ?? [])
    const config = v1.data.simulationConfig
    const settings: Settings = { ...DEFAULT_SETTINGS }
    if (config) {
      settings.trials = config.trials
      if (config.failTarget !== 'nodes') settings.edgeFailureProbability = config.failureProb
      if (config.failTarget !== 'edges') settings.nodeFailureProbability = config.failureProb
    }
    const workspace: Workspace = {
      version: WORKSPACE_VERSION,
      savedAt: new Date(0).toISOString(),
      graph: {
        nodes: v1.data.nodes.map((n) => ({ id: n.id, label: n.data.label, nodeType: n.data.nodeType, failed: failedNodes.has(n.id), position: n.position })),
        edges: v1.data.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          failed: failedEdges.has(e.id),
          ...(e.data?.weight !== undefined && e.data.weight > 0 ? { weight: e.data.weight } : {}),
        })),
        example: null,
        viewport: null,
      },
      settings,
    }
    return workspace
  }
  return null
}

export function workspaceGraph(w: Workspace): EditorGraph {
  return {
    nodes: w.graph.nodes.map((n) => ({
      id: n.id,
      type: 'netshieldNode',
      position: n.position,
      data: { label: n.label, nodeType: n.nodeType, failed: n.failed },
    })),
    edges: w.graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'netshieldEdge',
      data: {
        failed: e.failed,
        ...(e.weight !== undefined ? { weight: e.weight } : {}),
        ...(e.failureProbability !== undefined ? { failureProbability: e.failureProbability } : {}),
      },
    })),
  }
}

export type LoadResult = { status: 'loaded'; workspace: Workspace; migrated: boolean } | { status: 'empty' } | { status: 'discarded'; reason: string }

/** Parse one stored string. Never throws. */
export function parseWorkspace(text: string): LoadResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { status: 'discarded', reason: 'Saved data is not valid JSON.' }
  }
  const migrated = migrate(raw)
  if (migrated === null) return { status: 'discarded', reason: 'Saved data has an unknown version.' }
  const parsed = WorkspaceSchema.safeParse(migrated)
  if (!parsed.success) return { status: 'discarded', reason: `Saved data has an unexpected format (${parsed.error.issues[0]?.path.join('.') ?? 'root'}).` }
  const problem = checkGraph(workspaceGraph(parsed.data)) ?? checkSettings(parsed.data.settings)
  if (problem) return { status: 'discarded', reason: `Saved data breaks a rule: ${problem}` }
  return { status: 'loaded', workspace: parsed.data, migrated: migrated !== raw }
}

export type StorageProvider = () => Storage | null

/** window.localStorage, or null where even reading the property throws (blocked storage). */
export const browserStorage: StorageProvider = () => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

interface PersistenceStatus {
  /** Why the last save failed (quota, blocked storage), or null. */
  saveError: string | null
  /** Why saved data was not loaded, or null. */
  loadProblem: string | null
}
export const usePersistenceStatus = create<PersistenceStatus>(() => ({ saveError: null, loadProblem: null }))

export interface Persistence {
  /** Load saved data into the stores (if valid), then save every later change. Returns a stop function. */
  start: () => () => void
  load: () => LoadResult
  /** Write pending changes now. */
  flush: () => void
  /** Remove all saved data and reset the graph and settings to their defaults. */
  clearSavedData: () => void
}

export function createPersistence(storage: StorageProvider = browserStorage, debounceMs = SAVE_DEBOUNCE_MS): Persistence {
  let timer: ReturnType<typeof setTimeout> | null = null
  let suspended = false

  const read = (key: string): string | null => {
    try {
      return storage()?.getItem(key) ?? null
    } catch {
      return null
    }
  }
  const remove = (key: string) => {
    try {
      storage()?.removeItem(key)
    } catch {
      // Nothing to do: the data stays, and the next successful save replaces it.
    }
  }

  const write = () => {
    timer = null
    const g = useGraphStore.getState()
    const workspace: Workspace = {
      version: WORKSPACE_VERSION,
      savedAt: new Date().toISOString(),
      graph: {
        nodes: g.nodes.map((n) => ({ id: n.id, label: n.data.label, nodeType: n.data.nodeType, failed: n.data.failed, position: { x: n.position.x, y: n.position.y } })),
        edges: g.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          failed: e.data?.failed ?? false,
          ...(e.data?.weight !== undefined ? { weight: e.data.weight } : {}),
          ...(e.data?.failureProbability !== undefined ? { failureProbability: e.data.failureProbability } : {}),
        })),
        example: g.example,
        viewport: g.viewport,
      },
      settings: pickSettings(useSettingsStore.getState()),
    }
    try {
      const target = storage()
      if (!target) throw new Error('Browser storage is not available.')
      target.setItem(WORKSPACE_KEY, JSON.stringify(workspace))
      usePersistenceStatus.setState({ saveError: null })
    } catch (error) {
      const quota = error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)
      usePersistenceStatus.setState({
        saveError: quota ? 'Browser storage is full, so the latest changes were not saved.' : 'Browser storage is not available, so changes are not saved.',
      })
    }
  }

  const schedule = () => {
    if (suspended) return
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(write, debounceMs)
  }

  const load = (): LoadResult => {
    const current = read(WORKSPACE_KEY)
    const text = current ?? read(LEGACY_KEY)
    if (text === null) return { status: 'empty' }
    const result = parseWorkspace(text)
    usePersistenceStatus.setState({ loadProblem: result.status === 'discarded' ? result.reason : null })
    if (result.status !== 'loaded') return result
    suspended = true
    try {
      useGraphStore.getState().replaceGraph(workspaceGraph(result.workspace), result.workspace.graph.example)
      useGraphStore.setState({ viewport: result.workspace.graph.viewport })
      useSettingsStore.getState().replaceSettings(result.workspace.settings)
    } finally {
      suspended = false
    }
    return result
  }

  return {
    load,
    start: () => {
      const result = load()
      // Rewrite migrated data under the current key at once.
      if (result.status === 'loaded' && result.migrated) {
        write()
        remove(LEGACY_KEY)
      }
      const stopGraph = useGraphStore.subscribe((s, prev) => {
        if (s.nodes !== prev.nodes || s.edges !== prev.edges || s.example !== prev.example || s.viewport !== prev.viewport) schedule()
      })
      const stopSettings = useSettingsStore.subscribe((s, prev) => {
        if (s.adapterMode === prev.adapterMode) schedule()
      })
      return () => {
        stopGraph()
        stopSettings()
        if (timer !== null) clearTimeout(timer)
        timer = null
      }
    },
    flush: () => {
      if (timer !== null) {
        clearTimeout(timer)
        write()
      }
    },
    clearSavedData: () => {
      if (timer !== null) clearTimeout(timer)
      timer = null
      suspended = true
      try {
        resetGraphStore()
        useSettingsStore.getState().resetSettings()
        useAnalysisStore.getState().clearAll()
      } finally {
        suspended = false
      }
      remove(WORKSPACE_KEY)
      remove(LEGACY_KEY)
      usePersistenceStatus.setState({ saveError: null, loadProblem: null })
    },
  }
}

/** The app's instance, started once in main.tsx. */
export const workspacePersistence = createPersistence()
export const clearSavedData = (): void => workspacePersistence.clearSavedData()
