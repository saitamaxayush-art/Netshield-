/**
 * A simulation run: one backend request, or several batches of at most BATCH_TRIALS trials.
 *
 * For one request every number is the backend's. For batches, the combined values are counting only:
 * trials, successful trials and histogram bins are summed, the estimate is their ratio, and average
 * components is the trial weighted mean. The Wilson interval and standard error of the combined
 * counts are then computed here from those counts with the same formulas the contract uses (they
 * are statistics of the summed counts, not graph analysis), and the UI labels them as combined.
 * The most critical link cannot be combined from per batch maxima, so it is kept per batch.
 */
import { ApiError } from '@/services/api/client'
import type { SimulateRequestBody, SimulateResponseBody } from '@/services/api/schemas'

export const BATCH_TRIALS = 5000
export const Z_95 = 1.959963984540054

/** Trials per request: [5000, 5000, 2000] for 12000. */
export function planBatches(trials: number, size = BATCH_TRIALS): number[] {
  const out: number[] = []
  for (let left = trials; left > 0; left -= size) out.push(Math.min(size, left))
  return out
}

/** Seed of batch i, derived from the run seed so a run can be repeated exactly. Batch 0 uses the run seed. */
export function batchSeed(runSeed: number, index: number): number {
  return (runSeed + Math.imul(index, 0x9e3779b1)) >>> 0
}

export interface CombinedCounts {
  trials: number
  connectedTrials: number
  estimate: number
  standardError: number
  wilson95: { low: number; high: number }
  averageComponents: number
  componentHistogram: Array<{ components: number; trials: number }>
}

export interface SimulationRun {
  /** The request of the first batch, without the seed (batch seeds are listed per batch). */
  request: Omit<SimulateRequestBody, 'seed' | 'trials'> & { trials: number }
  /** The run seed: the user's, or the one the backend chose for the first batch. */
  seed: number
  batches: SimulateResponseBody[]
  /** True when more than one request was combined (then `combined` holds summed counts). */
  isBatched: boolean
  combined: CombinedCounts
}

function wilson(successes: number, trials: number): { low: number; high: number } {
  const p = successes / trials
  const z2 = Z_95 * Z_95
  const denominator = 1 + z2 / trials
  const centre = (p + z2 / (2 * trials)) / denominator
  const half = (Z_95 / denominator) * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials))
  return { low: successes === 0 ? 0 : Math.max(0, centre - half), high: successes === trials ? 1 : Math.min(1, centre + half) }
}

export function combineBatches(batches: SimulateResponseBody[]): CombinedCounts {
  if (batches.length === 1) {
    const b = batches[0]
    // One request: the backend's own values, untouched.
    return {
      trials: b.trials,
      connectedTrials: b.connectedTrials,
      estimate: b.estimate,
      standardError: b.standardError,
      wilson95: b.wilson95,
      averageComponents: b.averageComponents,
      componentHistogram: b.componentHistogram,
    }
  }
  const trials = batches.reduce((sum, b) => sum + b.trials, 0)
  const connectedTrials = batches.reduce((sum, b) => sum + b.connectedTrials, 0)
  const bins = new Map<number, number>()
  for (const b of batches) for (const bin of b.componentHistogram) bins.set(bin.components, (bins.get(bin.components) ?? 0) + bin.trials)
  const estimate = connectedTrials / trials
  return {
    trials,
    connectedTrials,
    estimate,
    standardError: Math.sqrt((estimate * (1 - estimate)) / trials),
    wilson95: wilson(connectedTrials, trials),
    averageComponents: batches.reduce((sum, b) => sum + b.averageComponents * b.trials, 0) / trials,
    componentHistogram: [...bins.entries()].sort((a, b) => a[0] - b[0]).map(([components, n]) => ({ components, trials: n })),
  }
}

export interface BatchRunner {
  simulate: (body: SimulateRequestBody, signal: AbortSignal) => Promise<SimulateResponseBody>
}

/** Run the batches one after another, reporting progress after each. */
export async function runBatches(
  request: SimulateRequestBody,
  runner: BatchRunner,
  signal: AbortSignal,
  report: (doneTrials: number, totalTrials: number) => void
): Promise<SimulationRun> {
  const total = request.trials ?? 1000
  const sizes = planBatches(total)
  const { seed: userSeed, trials: _trials, ...rest } = request
  const batches: SimulateResponseBody[] = []
  let runSeed = userSeed ?? null
  let done = 0
  report(0, total)
  for (let i = 0; i < sizes.length; i++) {
    const body: SimulateRequestBody = { ...rest, trials: sizes[i] }
    if (runSeed !== null) body.seed = batchSeed(runSeed, i)
    let response: SimulateResponseBody
    try {
      response = await runner.simulate(body, signal)
    } catch (error) {
      // A failed batch fails the run: a partial run is not the run that was asked for, so the batches
      // already done are not shown as a result. The error says exactly what happened.
      if (sizes.length > 1 && error instanceof ApiError && !error.isCancelled) {
        throw new ApiError(
          error.kind,
          error.code,
          `Batch ${i + 1} of ${sizes.length} failed after ${done} of ${total} trials; no partial result is shown. ${error.message}`,
          error.status,
          error.details
        )
      }
      throw error
    }
    // Without a user seed the backend picks one for batch 0; later batches derive from it.
    if (runSeed === null) runSeed = response.seed
    batches.push(response)
    done += sizes[i]
    report(done, total)
  }
  return { request: { ...rest, trials: total }, seed: runSeed ?? 0, batches, isBatched: batches.length > 1, combined: combineBatches(batches) }
}
