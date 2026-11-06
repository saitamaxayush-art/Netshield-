import { z } from 'zod'
import type { Analysis, AnalyzeResponseBody } from '../services/api/schemas'
import { resetGraphStore } from '../store/graphStore'
import { useAnalysisStore } from '../store/analysisStore'
import { DEFAULT_SETTINGS, useSettingsStore } from '../store/settingsStore'
import { useStudioView } from '../store/studioViewStore'

/** A complete, typed analysis for unit tests; override the parts a test cares about. */
export function analysis(overrides: Partial<Analysis> = {}): Analysis {
  return {
    summary: {
      nodeCount: 1,
      edgeCount: 0,
      operationalNodeCount: 1,
      operationalEdgeCount: 0,
      failedNodeCount: 0,
      failedEdgeCount: 0,
      unavailableEdgeCount: 0,
      density: 0,
      explanationKey: 'density_definition',
    },
    connectivity: {
      connected: true,
      componentCount: 1,
      reasonKey: 'single_component',
      reason: 'Single component',
      explanationKey: 'connectivity_definition',
    },
    components: { items: [['A']], componentOf: { A: 0 }, explanationKey: 'component_definition' },
    degrees: { byNode: { A: { operational: 0, stored: 0 } }, explanationKey: 'degree_definition' },
    bridges: { edgeIds: [], explanationKey: 'bridge_definition' },
    articulationPoints: { nodeIds: [], explanationKey: 'articulation_point_definition' },
    traversal: null,
    path: null,
    ...overrides,
  }
}

export function analyzeResponse(overrides: Partial<Analysis> = {}): AnalyzeResponseBody {
  return { current: analysis(overrides), healthy: null, meta: { engine: 'networkx', engineVersion: '3.7', apiVersion: '2.0.0' } }
}

// --- Real backend responses (captured by scripts/capture-api-fixtures.mjs) ----------------------

const files = import.meta.glob<unknown>('./fixtures/backend/*.json', { eager: true, import: 'default' })

const Envelope = z.object({
  method: z.enum(['GET', 'POST']),
  path: z.string(),
  request: z.unknown(),
  status: z.number(),
  response: z.unknown(),
})
export type BackendFixture = z.infer<typeof Envelope>

export function backendFixture(name: string): BackendFixture {
  const raw = files[`./fixtures/backend/${name}.json`]
  if (raw === undefined) throw new Error(`No captured fixture '${name}'. Run scripts/capture-api-fixtures.mjs.`)
  return Envelope.parse(raw)
}

export const backendFixtureNames: string[] = Object.keys(files).map((path) => path.replace('./fixtures/backend/', '').replace('.json', ''))

// --- Fetch double -----------------------------------------------------------------------------

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export interface FetchCall {
  url: string
  init: RequestInit | undefined
  body: unknown
}

/**
 * A fetch whose responses the test controls. `respond` may return a Response, throw, or return a
 * promise that settles later. The call's AbortSignal rejects the promise like real fetch does.
 */
export function fakeFetch(respond: (call: FetchCall) => Response | Promise<Response>) {
  const calls: FetchCall[] = []
  const fetchImpl: typeof fetch = (input, init) => {
    const call: FetchCall = { url: String(input), init, body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined }
    calls.push(call)
    return new Promise<Response>((resolve, reject) => {
      const signal = init?.signal
      if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
      Promise.resolve()
        .then(() => respond(call))
        .then(resolve, reject)
    })
  }
  return { fetchImpl, calls }
}

/** A promise with its resolve exposed, for responses that arrive when the test says so. */
export function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

export function resetStores(): void {
  resetGraphStore()
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, adapterMode: 'backend' })
  useAnalysisStore.getState().clearAll()
  useStudioView.getState().resetView()
}

export async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}
