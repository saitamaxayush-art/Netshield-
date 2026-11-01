/**
 * Analysis and simulation settings. Values are validated on set; an invalid value is refused with a
 * reason and leaves the setting unchanged. `adapterMode` is never persisted: it starts from
 * VITE_USE_DEMO_ADAPTER on every load and changes only through the explicit demo mode actions.
 */
import { create } from 'zustand'
import { apiModeFromEnv, type AdapterMode } from '@/services/api/registry'
import type { SimulationMode } from '@/services/api/schemas'
import { checkProbability, fail, ok, type EditResult } from './graphRules'

export const MAX_TRIALS = 20_000
export const MAX_SWEEP_POINTS = 25
export const MAX_SEED = 2 ** 32 - 1

export interface Settings {
  edgeFailureProbability: number
  nodeFailureProbability: number
  trials: number
  /** null: let the backend pick a seed (it reports the seed it used). */
  seed: number | null
  mode: SimulationMode
  /** Start node for BFS and DFS. */
  traversalStart: string | null
  /** Shortest path endpoints. */
  pathSource: string | null
  pathTarget: string | null
  /** The two terminals for two-terminal simulation and sweeps (independent of the path endpoints). */
  terminalSource: string | null
  terminalTarget: string | null
  sweepPMin: number
  sweepPMax: number
  sweepPoints: number
  trialsPerPoint: number
}

export type PersistedSettings = Settings

export const DEFAULT_SETTINGS: Settings = {
  edgeFailureProbability: 0.1,
  nodeFailureProbability: 0,
  trials: 1000,
  seed: null,
  mode: 'all-terminal',
  traversalStart: null,
  pathSource: null,
  pathTarget: null,
  terminalSource: null,
  terminalTarget: null,
  sweepPMin: 0,
  sweepPMax: 1,
  sweepPoints: 11,
  trialsPerPoint: 500,
}

export function checkSettings(s: Settings): string | null {
  const count = (v: number, name: string, max: number) =>
    Number.isInteger(v) && v >= 1 && v <= max ? null : `${name} must be a whole number from 1 to ${max}.`
  return (
    checkProbability(s.edgeFailureProbability, 'Link failure probability') ??
    checkProbability(s.nodeFailureProbability, 'Node failure probability') ??
    count(s.trials, 'Trials', MAX_TRIALS) ??
    count(s.trialsPerPoint, 'Trials per point', MAX_TRIALS) ??
    count(s.sweepPoints, 'Sweep points', MAX_SWEEP_POINTS) ??
    checkProbability(s.sweepPMin, 'Sweep start') ??
    checkProbability(s.sweepPMax, 'Sweep end') ??
    (s.sweepPMin > s.sweepPMax ? 'Sweep start must not be greater than sweep end.' : null) ??
    (s.seed !== null && !(Number.isInteger(s.seed) && s.seed >= 0 && s.seed <= MAX_SEED)
      ? `Seed must be a whole number from 0 to ${MAX_SEED}.`
      : null)
  )
}

export interface SettingsState extends Settings {
  adapterMode: AdapterMode
  /** Validated update of one or more settings: all applied, or none. */
  update: (patch: Partial<Settings>) => EditResult
  replaceSettings: (settings: Settings) => EditResult
  /** Explicit user actions only. The app shows a persistent banner while in demo mode. */
  switchToDemoMode: () => void
  exitDemoMode: () => void
  resetSettings: () => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  adapterMode: apiModeFromEnv(import.meta.env.VITE_USE_DEMO_ADAPTER),

  update: (patch) => {
    const next: Settings = { ...pickSettings(get()), ...patch }
    const problem = checkSettings(next)
    if (problem) return fail(problem)
    set(patch)
    return ok()
  },

  replaceSettings: (settings) => {
    const problem = checkSettings(settings)
    if (problem) return fail(problem)
    set(settings)
    return ok()
  },

  switchToDemoMode: () => set({ adapterMode: 'demo' }),
  exitDemoMode: () => set({ adapterMode: 'backend' }),
  resetSettings: () => set({ ...DEFAULT_SETTINGS }),
}))

export function pickSettings(s: Settings): Settings {
  return {
    edgeFailureProbability: s.edgeFailureProbability,
    nodeFailureProbability: s.nodeFailureProbability,
    trials: s.trials,
    seed: s.seed,
    mode: s.mode,
    traversalStart: s.traversalStart,
    pathSource: s.pathSource,
    pathTarget: s.pathTarget,
    terminalSource: s.terminalSource,
    terminalTarget: s.terminalTarget,
    sweepPMin: s.sweepPMin,
    sweepPMax: s.sweepPMax,
    sweepPoints: s.sweepPoints,
    trialsPerPoint: s.trialsPerPoint,
  }
}
