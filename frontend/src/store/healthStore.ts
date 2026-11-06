/**
 * Whether the analysis server is reachable. Checked on app load and when the window regains focus,
 * and updated by every analysis request (a network failure marks it offline, a backend answer marks
 * it online). It never switches to demo mode: that stays an explicit user action.
 */
import { create } from 'zustand'
import type { ApiError } from '@/services/api/client'
import { httpApi } from '@/services/api/registry'
import { useAnalysisStore, type AnalysisState } from './analysisStore'

export type HealthStatus = 'unknown' | 'checking' | 'online' | 'offline'

/** Focus checks closer together than this are skipped. */
export const FOCUS_CHECK_INTERVAL_MS = 5000

interface HealthState {
  status: HealthStatus
  error: ApiError | null
  version: string | null
  checkedAt: number | null
  /** The banner was dismissed; a compact chip stays so it can be reopened. Reset when the server comes back. */
  dismissed: boolean
  check: () => Promise<void>
  dismiss: () => void
  reopen: () => void
  markOffline: (error: ApiError) => void
  markOnline: () => void
}

let inFlight: Promise<void> | null = null

export const useHealthStore = create<HealthState>((set, get) => ({
  status: 'unknown',
  error: null,
  version: null,
  checkedAt: null,
  dismissed: false,
  check: () => {
    if (inFlight) return inFlight
    set({ status: get().status === 'offline' ? 'offline' : 'checking' })
    inFlight = httpApi
      .health()
      .then((body) => set({ status: 'online', error: null, version: body.version, checkedAt: Date.now(), dismissed: false }))
      .catch((error: ApiError) => set({ status: 'offline', error, checkedAt: Date.now() }))
      .finally(() => {
        inFlight = null
      })
    return inFlight
  },
  dismiss: () => set({ dismissed: true }),
  reopen: () => set({ dismissed: false }),
  markOffline: (error) => {
    if (get().status !== 'offline') set({ status: 'offline', error, dismissed: false })
  },
  markOnline: () => {
    if (get().status !== 'online') set({ status: 'online', error: null, dismissed: false })
  },
}))

/** Requests to the real backend tell us whether it is reachable. Demo results say nothing about it. */
function follow(slot: AnalysisState['analyze'] | AnalysisState['simulate'] | AnalysisState['sweep']) {
  if (slot.error && (slot.error.isNetworkError || slot.error.isTimeout)) useHealthStore.getState().markOffline(slot.error)
  else if (slot.status === 'success' && slot.result && !slot.result.isDemo) useHealthStore.getState().markOnline()
}
useAnalysisStore.subscribe((s, prev) => {
  if (s.analyze !== prev.analyze) follow(s.analyze)
  if (s.simulate !== prev.simulate) follow(s.simulate)
  if (s.sweep !== prev.sweep) follow(s.sweep)
})
