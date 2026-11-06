/**
 * Results of the three computations, one slot each, exactly as the API returned them.
 *
 * - Every run gets a request id; a response whose id is no longer the slot's latest is ignored.
 * - A new run of the same kind cancels the previous one.
 * - `stale` turns true by itself when the graph or the relevant settings change after a result was
 *   computed, so the UI can show "Results out of date".
 * - A failed run clears the slot's result: an older result is never shown next to an error.
 * - Switching between the backend and demo mode clears every result, so the two never mix.
 * Nothing here is persisted.
 */
import { create } from 'zustand'
import { ApiError, type Stamped } from '@/services/api/client'
import { getApi } from '@/services/api/registry'
import type { AnalyzeResponseBody, SweepResponseBody } from '@/services/api/schemas'
import { useGraphStore } from './graphStore'
import { buildAnalyzeRequest, buildSimulateRequest, buildSweepRequest, inputKey, type RequestKind } from './requests'
import { checkSettings, pickSettings, useSettingsStore } from './settingsStore'
import { runBatches, type SimulationRun } from './simulationRuns'
import { checkGraph } from './graphRules'

export type RequestStatus = 'idle' | 'loading' | 'success' | 'error'

export interface Slot<T> {
  status: RequestStatus
  result: Stamped<T> | null
  error: ApiError | null
  /** Id of the latest run of this kind (0 before the first). */
  requestId: number
  /** inputKey of the request that produced `result`. */
  inputKey: string | null
  stale: boolean
  /** When the current run started (ms since the epoch), for elapsed time. */
  startedAt: number | null
  /** Trials done and total while a batched simulation runs; null otherwise. */
  progress: { done: number; total: number } | null
  /** True when the last run was cancelled by the user (any earlier result is kept). */
  cancelled: boolean
}

interface Results {
  analyze: AnalyzeResponseBody
  simulate: SimulationRun
  sweep: SweepResponseBody
}

export interface AnalysisState {
  analyze: Slot<AnalyzeResponseBody>
  simulate: Slot<SimulationRun>
  sweep: Slot<SweepResponseBody>
  run: (kind: RequestKind) => Promise<void>
  cancel: (kind: RequestKind) => void
  /** Empty a slot (for example when the graph becomes empty). Cancels its run. */
  clear: (kind: RequestKind) => void
  clearAll: () => void
}

const emptySlot = <T,>(requestId = 0): Slot<T> => ({
  status: 'idle',
  result: null,
  error: null,
  requestId,
  inputKey: null,
  stale: false,
  startedAt: null,
  progress: null,
  cancelled: false,
})

const controllers = new Map<RequestKind, AbortController>()
let lastRequestId = 0

function currentInputs() {
  const g = useGraphStore.getState()
  return { graph: { nodes: g.nodes, edges: g.edges }, settings: pickSettings(useSettingsStore.getState()) }
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  const message = error instanceof Error ? error.message : String(error)
  return new ApiError('server', 'INTERNAL_ERROR', `Unexpected error: ${message}`)
}

interface Accessor<T> {
  read: (s: AnalysisState) => Slot<T>
  write: (slot: Slot<T>) => Partial<AnalysisState>
  fetch: (signal: AbortSignal, report: (done: number, total: number) => void) => Promise<Stamped<T>>
}

/** Per kind: where its slot lives and how to fetch it. Keeps every update fully typed. */
const ACCESS: { [K in RequestKind]: Accessor<Results[K]> } = {
  analyze: {
    read: (s) => s.analyze,
    write: (analyze) => ({ analyze }),
    fetch: (signal) => {
      const { graph, settings } = currentInputs()
      return activeApi().analyze(buildAnalyzeRequest(graph, settings), { signal, supersede: false })
    },
  },
  simulate: {
    read: (s) => s.simulate,
    write: (simulate) => ({ simulate }),
    fetch: async (signal, report) => {
      const { graph, settings } = currentInputs()
      const api = activeApi()
      // Runs above BATCH_TRIALS trials are split into batches so progress can be shown.
      const run = await runBatches(buildSimulateRequest(graph, settings), { simulate: (body, s) => api.simulate(body, { signal: s, supersede: false }) }, signal, report)
      return { ...run, isDemo: api.isDemo }
    },
  },
  sweep: {
    read: (s) => s.sweep,
    write: (sweep) => ({ sweep }),
    fetch: (signal) => {
      const { graph, settings } = currentInputs()
      return activeApi().reliabilitySweep(buildSweepRequest(graph, settings), { signal, supersede: false })
    },
  },
}

// The store cancels the previous run itself (controllers), so the client is told not to supersede.
const activeApi = () => getApi(useSettingsStore.getState().adapterMode)

const update = <T,>(acc: Accessor<T>, change: Partial<Slot<T>>) =>
  useAnalysisStore.setState((s) => acc.write({ ...acc.read(s), ...change }))

async function runSlot<T>(kind: RequestKind, acc: Accessor<T>): Promise<void> {
  controllers.get(kind)?.abort()
  const controller = new AbortController()
  controllers.set(kind, controller)
  const requestId = ++lastRequestId
  const before = currentInputs()
  const key = inputKey(kind, before.graph, before.settings)
  const isLatest = () => acc.read(useAnalysisStore.getState()).requestId === requestId
  // Every payload is checked against the same rules as the backend before anything is sent.
  const problem = checkGraph(before.graph) ?? checkSettings(before.settings)
  if (problem) {
    update(acc, { status: 'error', result: null, error: new ApiError('validation', 'CLIENT_VALIDATION', `Not sent: ${problem}`), inputKey: null, stale: false, progress: null, cancelled: false })
    if (controllers.get(kind) === controller) controllers.delete(kind)
    return
  }
  update(acc, { status: 'loading', error: null, requestId, startedAt: Date.now(), progress: null, cancelled: false })
  try {
    const result = await acc.fetch(controller.signal, (done, total) => {
      if (isLatest()) update(acc, { progress: { done, total } })
    })
    if (!isLatest()) return
    const now = currentInputs()
    update(acc, { status: 'success', result, error: null, inputKey: key, stale: inputKey(kind, now.graph, now.settings) !== key, progress: null })
  } catch (error) {
    if (!isLatest()) return
    const apiError = toApiError(error)
    if (apiError.isCancelled) {
      // Cancelled on purpose: keep whatever result was there (it carries its own stale flag).
      update(acc, { status: acc.read(useAnalysisStore.getState()).result ? 'success' : 'idle', error: null, progress: null, cancelled: true })
    } else {
      update(acc, { status: 'error', result: null, error: apiError, inputKey: null, stale: false, progress: null })
    }
  } finally {
    if (controllers.get(kind) === controller) controllers.delete(kind)
  }
}

function clearSlot<T>(kind: RequestKind, acc: Accessor<T>): void {
  controllers.get(kind)?.abort()
  controllers.delete(kind)
  // A new request id makes any response still on its way irrelevant.
  useAnalysisStore.setState(acc.write(emptySlot<T>(++lastRequestId)))
}

function refreshSlot<T>(kind: RequestKind, acc: Accessor<T>, inputs: ReturnType<typeof currentInputs>): void {
  const slot = acc.read(useAnalysisStore.getState())
  if (slot.inputKey === null) return
  const stale = inputKey(kind, inputs.graph, inputs.settings) !== slot.inputKey
  if (stale !== slot.stale) update(acc, { stale })
}

export const useAnalysisStore = create<AnalysisState>(() => ({
  analyze: emptySlot(),
  simulate: emptySlot(),
  sweep: emptySlot(),
  run: (kind) => (kind === 'analyze' ? runSlot(kind, ACCESS.analyze) : kind === 'simulate' ? runSlot(kind, ACCESS.simulate) : runSlot(kind, ACCESS.sweep)),
  cancel: (kind) => controllers.get(kind)?.abort(),
  clear: (kind) => (kind === 'analyze' ? clearSlot(kind, ACCESS.analyze) : kind === 'simulate' ? clearSlot(kind, ACCESS.simulate) : clearSlot(kind, ACCESS.sweep)),
  clearAll: () => {
    clearSlot('analyze', ACCESS.analyze)
    clearSlot('simulate', ACCESS.simulate)
    clearSlot('sweep', ACCESS.sweep)
  },
}))

/** Recompute every slot's stale flag against the current graph and settings. */
export function refreshStale(): void {
  const inputs = currentInputs()
  refreshSlot('analyze', ACCESS.analyze, inputs)
  refreshSlot('simulate', ACCESS.simulate, inputs)
  refreshSlot('sweep', ACCESS.sweep, inputs)
}

useGraphStore.subscribe((state, previous) => {
  if (state.nodes !== previous.nodes || state.edges !== previous.edges) refreshStale()
})
useSettingsStore.subscribe((state, previous) => {
  if (state.adapterMode !== previous.adapterMode) useAnalysisStore.getState().clearAll()
  else refreshStale()
})
