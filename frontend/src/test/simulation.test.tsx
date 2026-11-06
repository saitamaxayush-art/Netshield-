import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { ApiError } from '../services/api/client'
import { AnalyzeResponseSchema, SimulateResponseSchema, SweepResponseSchema, type SimulateRequestBody, type SimulateResponseBody } from '../services/api/schemas'
import { BATCH_TRIALS, batchSeed, combineBatches, planBatches, runBatches, type SimulationRun } from '../store/simulationRuns'
import { useAnalysisStore } from '../store/analysisStore'
import { useSettingsStore } from '../store/settingsStore'
import { SimulationPanel } from '../features/studio/SimulationPanel'
import { CompareChart, HistogramChart, SweepChart, TrialsChart } from '../features/analytics/charts'
import { toCsv, toJson } from '../features/studio/simulationExport'
import { SIMULATE_CASES } from './fixtures/apiCases'
import { backendFixture, resetStores } from './fixtures'

const backendSim = SimulateResponseSchema.parse(backendFixture('simulate-all-terminal').response)
const backendSweep = { ...SweepResponseSchema.parse(backendFixture('sweep').response), isDemo: false }
const backendAnalysis = AnalyzeResponseSchema.parse(backendFixture('analyze-ring-failures').response)

/** A backend shaped response for one batch with chosen counts (only the counted fields matter here). */
const batch = (trials: number, connectedTrials: number, seed: number, histogram: Array<[number, number]>, averageComponents: number): SimulateResponseBody => ({
  ...backendSim,
  trials,
  connectedTrials,
  seed,
  estimate: connectedTrials / trials,
  componentHistogram: histogram.map(([components, n]) => ({ components, trials: n })),
  averageComponents,
})

const singleRun = (): SimulationRun & { isDemo: boolean } => ({
  request: { ...SIMULATE_CASES['simulate-all-terminal'], trials: backendSim.trials },
  seed: backendSim.seed,
  batches: [backendSim],
  isBatched: false,
  combined: combineBatches([backendSim]),
  isDemo: false,
})

describe('batching', () => {
  it('plans batches of at most 5000 trials', () => {
    expect(planBatches(1000)).toEqual([1000])
    expect(planBatches(5000)).toEqual([5000])
    expect(planBatches(12000)).toEqual([5000, 5000, 2000])
    expect(planBatches(20000)).toEqual([5000, 5000, 5000, 5000])
    expect(BATCH_TRIALS).toBe(5000)
  })

  it('derives distinct, repeatable seeds, the first equal to the run seed', () => {
    expect(batchSeed(42, 0)).toBe(42)
    const seeds = [0, 1, 2, 3].map((i) => batchSeed(42, i))
    expect(new Set(seeds).size).toBe(4)
    expect(seeds).toEqual([0, 1, 2, 3].map((i) => batchSeed(42, i)))
    for (const s of seeds) expect(s).toBeLessThanOrEqual(2 ** 32 - 1)
  })

  it('one batch keeps the backend values untouched', () => {
    expect(combineBatches([backendSim])).toEqual({
      trials: backendSim.trials,
      connectedTrials: backendSim.connectedTrials,
      estimate: backendSim.estimate,
      standardError: backendSim.standardError,
      wilson95: backendSim.wilson95,
      averageComponents: backendSim.averageComponents,
      componentHistogram: backendSim.componentHistogram,
    })
  })

  it('aggregates batches by summing counts', () => {
    const c = combineBatches([batch(5000, 4000, 1, [[1, 4000], [2, 1000]], 1.2), batch(2000, 1000, 2, [[1, 1000], [3, 1000]], 2)])
    expect([c.trials, c.connectedTrials, c.estimate]).toEqual([7000, 5000, 5000 / 7000])
    expect(c.componentHistogram).toEqual([
      { components: 1, trials: 5000 },
      { components: 2, trials: 1000 },
      { components: 3, trials: 1000 },
    ])
    expect(c.averageComponents).toBeCloseTo((1.2 * 5000 + 2 * 2000) / 7000, 12)
    expect(c.standardError).toBeCloseTo(Math.sqrt(((5 / 7) * (2 / 7)) / 7000), 12)
    expect(c.wilson95.low).toBeLessThan(c.estimate)
    expect(c.wilson95.high).toBeGreaterThan(c.estimate)
  })

  it('the combined interval equals the backend interval for the same counts', () => {
    // The backend's own Wilson interval for 2000 trials, rebuilt from two halves with the same totals.
    const half = Math.floor(backendSim.connectedTrials / 2)
    const c = combineBatches([batch(1000, half, 1, [[1, half]], 1), batch(1000, backendSim.connectedTrials - half, 2, [[1, 1]], 1)])
    expect(c.wilson95.low).toBeCloseTo(backendSim.wilson95.low, 12)
    expect(c.wilson95.high).toBeCloseTo(backendSim.wilson95.high, 12)
    expect(c.standardError).toBeCloseTo(backendSim.standardError, 12)
  })

  it('runBatches sends derived seeds, reports progress, and uses the backend seed when none was given', async () => {
    const sent: SimulateRequestBody[] = []
    const runner = {
      simulate: async (body: SimulateRequestBody) => {
        sent.push(body)
        const trials = body.trials ?? 0
        return batch(trials, trials - 1, body.seed ?? 777, [[1, trials]], 1)
      },
    }
    const progress: Array<[number, number]> = []
    const request: SimulateRequestBody = { ...SIMULATE_CASES['simulate-all-terminal'], trials: 12000, seed: 9 }
    const run = await runBatches(request, runner, new AbortController().signal, (d, t) => progress.push([d, t]))
    expect(sent.map((b) => [b.trials, b.seed])).toEqual([
      [5000, batchSeed(9, 0)],
      [5000, batchSeed(9, 1)],
      [2000, batchSeed(9, 2)],
    ])
    expect(progress).toEqual([
      [0, 12000],
      [5000, 12000],
      [10000, 12000],
      [12000, 12000],
    ])
    expect([run.seed, run.isBatched, run.combined.trials, run.combined.connectedTrials]).toEqual([9, true, 12000, 11997])

    sent.length = 0
    const { seed: _s, ...noSeed } = request
    const auto = await runBatches(noSeed, runner, new AbortController().signal, () => undefined)
    expect(sent.map((b) => b.seed)).toEqual([undefined, batchSeed(777, 1), batchSeed(777, 2)])
    expect(auto.seed).toBe(777)
  })

  it('an abort stops the remaining batches', async () => {
    const controller = new AbortController()
    let calls = 0
    const runner = {
      simulate: async (body: SimulateRequestBody, signal: AbortSignal) => {
        calls++
        controller.abort()
        if (signal.aborted) throw new ApiError('cancelled', 'CANCELLED', 'cancelled')
        return batch(body.trials ?? 0, 0, 1, [], 1)
      },
    }
    await expect(runBatches({ ...SIMULATE_CASES['simulate-all-terminal'], trials: 20000 }, runner, controller.signal, () => undefined)).rejects.toBeInstanceOf(ApiError)
    expect(calls).toBe(1)
  })
})

function setSim(update: Partial<ReturnType<typeof useAnalysisStore.getState>['simulate']>) {
  act(() => {
    useAnalysisStore.setState((s) => ({ simulate: { ...s.simulate, ...update } }))
  })
}

beforeEach(() => {
  resetStores()
  vi.useRealTimers()
})

describe('simulation panel states', () => {
  it('idle: controls, no result and no chart', () => {
    render(<SimulationPanel />)
    expect(screen.getByRole('button', { name: 'Run Monte Carlo Simulation' })).toBeEnabled()
    expect(screen.queryByTestId('simulation-results')).toBeNull()
    expect(screen.queryByTestId('chart-trials')).toBeNull()
    expect(screen.queryByTestId('chart-sweep')).toBeNull()
    expect(screen.queryByTestId('simulation-export')).toBeNull()
  })

  it('running a single request: indeterminate progress with elapsed time and Cancel', () => {
    setSim({ status: 'loading', startedAt: Date.now(), progress: { done: 0, total: 1000 } })
    render(<SimulationPanel />)
    expect(screen.getByTestId('simulation-progress')).toHaveAttribute('data-batched', 'false')
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow')
    expect(screen.getByTestId('simulation-progress-text')).toHaveTextContent(/Running on the backend, \d+\.\d s/)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('running in batches: a real progress bar', () => {
    setSim({ status: 'loading', startedAt: Date.now(), progress: { done: 10000, total: 20000 } })
    render(<SimulationPanel />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '10000')
    expect(screen.getByTestId('simulation-progress-text')).toHaveTextContent('10000 of 20000 trials')
  })

  it('success: estimate, interval, SE, counts, seed, assumptions, charts and export', () => {
    setSim({ status: 'success', result: singleRun() })
    render(<SimulationPanel />)
    expect(screen.getByTestId('simulation-reliability')).toHaveTextContent(`${(backendSim.estimate * 100).toFixed(1)}%`)
    expect(screen.getByTestId('simulation-connected')).toHaveTextContent(`${backendSim.connectedTrials} / ${backendSim.trials}`)
    expect(screen.getByTestId('simulation-seed')).toHaveTextContent(String(backendSim.seed))
    expect(within(screen.getByTestId('simulation-assumptions')).getAllByRole('listitem').length).toBe(backendSim.assumptions.length + 1)
    expect(screen.getByText(/Estimate: reliability/)).toBeInTheDocument()
    expect(screen.getByTestId('chart-trials')).toBeInTheDocument()
    expect(screen.getByTestId('chart-histogram')).toBeInTheDocument()
    expect(screen.queryByTestId('simulation-combined')).toBeNull()
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeInTheDocument()
  })

  it('batched success says the values were combined', () => {
    const batches = [batch(5000, 4000, 1, [[1, 5000]], 1), batch(5000, 4100, 2, [[1, 5000]], 1)]
    setSim({ status: 'success', result: { ...singleRun(), batches, isBatched: true, combined: combineBatches(batches) } })
    render(<SimulationPanel />)
    expect(screen.getByTestId('simulation-combined')).toHaveTextContent('Combined from 2 backend requests')
    expect(screen.getByTestId('simulation-connected')).toHaveTextContent('8100 / 10000')
    expect(screen.getByTestId('simulation-critical-edge')).toHaveTextContent('per batch')
  })

  it('error: message, Retry, a timeout hint, and no result', () => {
    setSim({ status: 'error', result: null, error: new ApiError('timeout', 'CLIENT_TIMEOUT', 'No response from /api/simulate within 15000 ms.') })
    render(<SimulationPanel />)
    expect(screen.getByTestId('simulation-error')).toHaveTextContent('Request timed out')
    expect(screen.getByTestId('simulation-error-hint')).toHaveTextContent('Try fewer trials')
    expect(within(screen.getByTestId('simulation-error')).getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.queryByTestId('simulation-results')).toBeNull()
  })

  it('cancelled: says so and keeps the previous result', () => {
    setSim({ status: 'success', result: singleRun(), cancelled: true })
    render(<SimulationPanel />)
    expect(screen.getByTestId('simulation-cancelled')).toHaveTextContent('The previous result is still shown.')
    expect(screen.getByTestId('simulation-results')).toBeInTheDocument()
  })

  it('stale: Results out of date', () => {
    setSim({ status: 'success', result: singleRun(), stale: true })
    render(<SimulationPanel />)
    expect(screen.getByTestId('simulation-stale')).toHaveTextContent('Results out of date')
  })

  it('a large trial count warns about batches', () => {
    render(<SimulationPanel />)
    fireEvent.change(screen.getByLabelText('Trials:'), { target: { value: '20000' } })
    expect(screen.getByTestId('trials-warning')).toHaveTextContent('4 batches')
  })

  it('probabilities are validated: number input refuses 1.5, slider and input stay in step', () => {
    render(<SimulationPanel />)
    const input = screen.getByLabelText('Link failure probability (p):', { selector: '#edge-p' })
    fireEvent.change(input, { target: { value: '0.35' } })
    expect(useSettingsStore.getState().edgeFailureProbability).toBe(0.35)
    const text = document.querySelector<HTMLInputElement>('#edge-p-value')
    expect(text?.value).toBe('0.35')
    if (!text) throw new Error('missing input')
    fireEvent.change(text, { target: { value: '1.5' } })
    fireEvent.blur(text)
    expect(screen.getByTestId('setting-error')).toHaveTextContent('between 0 and 1')
    expect(useSettingsStore.getState().edgeFailureProbability).toBe(0.35)
  })

  it('Randomise sets a seed and Reset restores defaults and clears results', () => {
    setSim({ status: 'success', result: singleRun() })
    render(<SimulationPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Randomise seed' }))
    expect(useSettingsStore.getState().seed).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reset simulation' }))
    expect(useSettingsStore.getState().seed).toBeNull()
    expect(useAnalysisStore.getState().simulate.result).toBeNull()
  })
})

describe('charts', () => {
  it('each chart has a text description and a data table toggle with the real values', () => {
    render(
      <>
        <SweepChart result={backendSweep} />
        <TrialsChart run={singleRun()} />
        <HistogramChart run={singleRun()} />
        {backendAnalysis.healthy && <CompareChart current={backendAnalysis.current} healthy={backendAnalysis.healthy} />}
      </>
    )
    for (const id of ['chart-sweep', 'chart-trials', 'chart-histogram', 'chart-compare']) {
      const card = screen.getByTestId(id)
      expect(within(card).getByTestId(`${id}-description`).textContent?.length).toBeGreaterThan(20)
      fireEvent.click(within(card).getByRole('button', { name: 'View data table' }))
      expect(within(card).getByTestId(`${id}-table`)).toBeInTheDocument()
    }
    expect(within(screen.getByTestId('chart-sweep-table')).getAllByRole('row')).toHaveLength(backendSweep.points.length + 1)
    expect(screen.getByTestId('chart-trials-table')).toHaveTextContent(String(backendSim.connectedTrials))
  })
})

describe('export', () => {
  it('JSON and CSV carry request, seeds, results and assumptions to repeat a run', () => {
    const input = { run: singleRun(), sweep: backendSweep, exportedAt: '2026-11-06T00:00:00.000Z' }
    const json: unknown = JSON.parse(toJson(input))
    expect(json).toMatchObject({ simulation: { runSeed: backendSim.seed, batchSeeds: [backendSim.seed], request: { edgeFailureProbability: 0.2 }, result: { connectedTrials: backendSim.connectedTrials } }, sweep: { result: { seed: backendSweep.seed } } })
    const csv = toCsv(input)
    expect(csv).toContain(`run seed,${backendSim.seed}`)
    expect(csv).toContain(`successful trials,${backendSim.connectedTrials}`)
    expect(csv).toContain(backendSim.assumptions[1].includes(',') ? `"${backendSim.assumptions[1]}"` : backendSim.assumptions[1])
    expect(csv).toContain(`trials per point,${backendSweep.trialsPerPoint}`)
  })
})
