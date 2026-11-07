/**
 * Reliability simulation on a cycle graph against the REAL backend (no mocks). For the cycle C_n with
 * independent link failures, the network stays connected exactly when at most one link fails:
 *   R(p) = (1 - p)^n + n p (1 - p)^(n - 1)
 */
import type { Page, Response } from '@playwright/test'
import { expect, test } from './helpers'

const N = 6
const P = 0.2
const exact = (p: number) => (1 - p) ** N + N * p * (1 - p) ** (N - 1)

interface Sim {
  trials: number
  connectedTrials: number
  estimate: number
  standardError: number
  wilson95: { low: number; high: number }
  seed: number
  elapsedMs: number
  meta: { engine: string }
}
const isSimulate = (r: Response) => r.url().endsWith('/api/simulate') && r.request().method() === 'POST'
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`

async function seedCycle(page: Page) {
  const ids = Array.from({ length: N }, (_, i) => `v${i + 1}`)
  const workspace = {
    version: 5,
    savedAt: '2026-01-01T00:00:00.000Z',
    graph: {
      nodes: ids.map((id, i) => ({ id, label: id.toUpperCase(), nodeType: 'router', failed: false, position: { x: Math.round(300 * Math.cos((2 * Math.PI * i) / N)), y: Math.round(220 * Math.sin((2 * Math.PI * i) / N)) } })),
      edges: ids.map((id, i) => ({ id: `e${i + 1}`, source: id, target: ids[(i + 1) % N], failed: false })),
      example: null,
      viewport: null,
    },
    settings: {
      edgeFailureProbability: 0.1, nodeFailureProbability: 0, trials: 1000, seed: null, mode: 'all-terminal', traversalStart: null,
      pathSource: null, pathTarget: null, useWeights: false, terminalSource: null, terminalTarget: null, sweepPMin: 0, sweepPMax: 1, sweepPoints: 11, trialsPerPoint: 500,
    },
  }
  await page.addInitScript((v) => {
    if (sessionStorage.getItem('seeded') === null) {
      localStorage.setItem('netshield_workspace', v)
      sessionStorage.setItem('seeded', '1')
    }
  }, JSON.stringify(workspace))
}

async function setNumber(page: Page, selector: string, value: string) {
  await page.locator(selector).fill(value)
  await page.locator(selector).press('Enter')
}

/** Click Run and collect every simulate response of the run (one per batch). */
async function runAndCollect(page: Page, batches: number): Promise<Sim[]> {
  const bodies: Sim[] = []
  const done = new Promise<void>((resolve) => {
    const onResponse = async (r: Response) => {
      if (!isSimulate(r)) return
      expect(r.status()).toBe(200)
      bodies.push((await r.json()) as Sim)
      if (bodies.length === batches) {
        page.off('response', onResponse)
        resolve()
      }
    }
    page.on('response', onResponse)
  })
  await page.getByRole('button', { name: 'Run Monte Carlo Simulation' }).click()
  await done
  await expect(page.getByTestId('simulation-results')).toBeVisible()
  return bodies
}

const shown = async (page: Page) => ({
  estimate: await page.getByTestId('simulation-reliability').textContent(),
  connected: await page.getByTestId('simulation-connected').textContent(),
  se: await page.getByTestId('simulation-se').textContent(),
  ci: await page.getByTestId('simulation-ci').textContent(),
  seed: await page.getByTestId('simulation-seed').textContent(),
})
const withoutElapsed = (s: Sim) => ({ ...s, elapsedMs: 0 })

test.use({ viewport: { width: 1440, height: 900 } })

test.beforeEach(async ({ page }) => {
  await seedCycle(page)
  await page.goto('/studio')
  await expect(page.locator('.react-flow__node')).toHaveCount(N)
  await page.getByRole('button', { name: 'Simulator', exact: true }).click()
  await setNumber(page, '#edge-p-value', String(P))
  await expect(page.locator('#edge-p')).toHaveValue(String(P))
})

test(`one request: C${N} at p = ${P} is within 4 standard errors of the closed form, and a rerun with the same seed is identical`, async ({ page, issues }) => {
  await page.locator('#trials').selectOption('5000')
  await setNumber(page, '#seed', '1234')
  const [first] = await runAndCollect(page, 1)
  expect(first.meta.engine).toBe('networkx')
  expect([first.trials, first.seed]).toEqual([5000, 1234])

  const R = exact(P)
  const se = Math.sqrt((R * (1 - R)) / first.trials)
  console.log(`C${N}, p=${P}: exact R=${R.toFixed(6)} backend estimate=${first.estimate} (${first.connectedTrials}/${first.trials}) |diff|=${Math.abs(first.estimate - R).toFixed(6)} 4SE=${(4 * se).toFixed(6)}`)
  expect(Math.abs(first.estimate - R)).toBeLessThan(4 * se)

  // Every displayed value is the backend's.
  const ui = await shown(page)
  expect(ui).toEqual({
    estimate: pct(first.estimate),
    connected: `${first.connectedTrials} / ${first.trials}`,
    se: `±${pct(first.standardError, 2)}`,
    ci: `[${pct(first.wilson95.low)}, ${pct(first.wilson95.high)}]`,
    seed: '1234',
  })
  await expect(page.getByTestId('simulation-source')).toHaveAttribute('data-source', 'backend')
  await expect(page.getByTestId('simulation-assumptions')).toContainText('fails independently with probability 0.2')
  await expect(page.getByTestId('chart-trials')).toBeVisible()
  await expect(page.getByTestId('chart-histogram')).toBeVisible()
  await page.getByTestId('chart-histogram').getByRole('button', { name: 'View data table' }).click()
  await expect(page.getByTestId('chart-histogram-table')).toBeVisible()

  const [second] = await runAndCollect(page, 1)
  expect(withoutElapsed(second)).toEqual(withoutElapsed(first))
  expect(await shown(page)).toEqual(ui)
  expect(issues).toEqual([])
})

test('20000 trials run as 4 batches with derived seeds and a real progress bar, close to the closed form, and repeat exactly', async ({ page, issues }) => {
  await page.locator('#trials').selectOption('20000')
  await expect(page.getByTestId('trials-warning')).toContainText('4 batches')
  await setNumber(page, '#seed', '99')
  const progressSeen = page.waitForSelector('[role="progressbar"][aria-valuenow]')
  const batches = await runAndCollect(page, 4)
  await progressSeen
  expect(batches.map((b) => b.trials)).toEqual([5000, 5000, 5000, 5000])
  expect(batches[0].seed).toBe(99)
  expect(new Set(batches.map((b) => b.seed)).size).toBe(4)

  const trials = batches.reduce((s, b) => s + b.trials, 0)
  const connected = batches.reduce((s, b) => s + b.connectedTrials, 0)
  const R = exact(P)
  const se = Math.sqrt((R * (1 - R)) / trials)
  console.log(`C${N}, p=${P}, batched: exact R=${R.toFixed(6)} combined=${(connected / trials).toFixed(6)} (${connected}/${trials}) seeds=${batches.map((b) => b.seed).join(',')} 4SE=${(4 * se).toFixed(6)}`)
  expect(Math.abs(connected / trials - R)).toBeLessThan(4 * se)
  await expect(page.getByTestId('simulation-connected')).toHaveText(`${connected} / ${trials}`)
  await expect(page.getByTestId('simulation-reliability')).toHaveText(pct(connected / trials))
  await expect(page.getByTestId('simulation-combined')).toContainText('Combined from 4 backend requests')
  const ui = await shown(page)

  const again = await runAndCollect(page, 4)
  expect(again.map(withoutElapsed)).toEqual(batches.map(withoutElapsed))
  expect(await shown(page)).toEqual(ui)
  expect(issues).toEqual([])
})

test('sweep on the cycle follows the closed form at every point; comparison chart and export are present', async ({ page, issues }) => {
  await setNumber(page, '#sweep-min', '0')
  await setNumber(page, '#sweep-max', '0.5')
  await setNumber(page, '#sweep-points', '6')
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/reliability-sweep')),
    page.getByRole('button', { name: 'Run Reliability Sweep' }).click(),
  ])
  const body = (await response.json()) as { trialsPerPoint: number; points: Array<{ p: number; estimate: number }> }
  for (const pt of body.points) {
    const R = exact(pt.p)
    expect(Math.abs(pt.estimate - R)).toBeLessThanOrEqual(4 * Math.sqrt((R * (1 - R)) / body.trialsPerPoint) + 1e-12)
  }
  await expect(page.getByTestId('chart-sweep')).toBeVisible()
  await expect(page.locator('[data-testid="chart-sweep"] .recharts-area')).toHaveCount(1)
  await expect(page.getByTestId('chart-compare')).toBeVisible()
  await page.getByTestId('chart-sweep').getByRole('button', { name: 'View data table' }).click()
  await expect(page.locator('[data-testid="chart-sweep-table"] tbody tr')).toHaveCount(6)

  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download JSON' }).click()])
  expect(file.suggestedFilename()).toMatch(/^netshield-simulation-.*\.json$/)
  expect(issues).toEqual([])
})

test('cancel stops a running batched simulation and says so', async ({ page }) => {
  // Deterministic: the first batch's real response is held until Cancel has been clicked.
  let release: () => void = () => undefined
  const held = new Promise<void>((resolve) => (release = resolve))
  let requests = 0
  await page.route('**/api/simulate', async (route) => {
    requests++
    const response = await route.fetch()
    await held
    // The client aborted this request, so fulfilling it may fail; that is expected.
    await route.fulfill({ response }).catch(() => undefined)
  })
  await page.locator('#trials').selectOption('20000')
  await page.getByRole('button', { name: 'Run Monte Carlo Simulation' }).click()
  await expect(page.getByTestId('simulation-progress')).toBeVisible()
  await expect.poll(() => requests).toBe(1)
  await page.getByRole('button', { name: 'Cancel' }).click()
  release()
  await expect(page.getByTestId('simulation-cancelled')).toHaveText('Run cancelled. No result.')
  await expect(page.getByTestId('simulation-results')).toHaveCount(0)
  await expect(page.getByTestId('simulation-error')).toHaveCount(0)
  // No later batch was sent after the cancel.
  await page.waitForTimeout(500)
  expect(requests).toBe(1)
})

test('a failed batch fails the run with a clear message and keeps no partial result', async ({ page }) => {
  let requests = 0
  await page.route('**/api/simulate', (route) => {
    requests++
    // Batches 1 and 2 are real backend answers; batch 3 gets the backend's own time budget error.
    if (requests === 3)
      return route.fulfill({ status: 504, contentType: 'application/json', body: JSON.stringify({ error: { code: 'TIMEOUT', message: 'Simulation exceeded the time budget.' } }) })
    return route.continue()
  })
  await page.locator('#trials').selectOption('20000')
  await page.getByRole('button', { name: 'Run Monte Carlo Simulation' }).click()
  const error = page.getByTestId('simulation-error')
  await expect(error).toContainText('Batch 3 of 4 failed after 10000 of 20000 trials; no partial result is shown.')
  await expect(error).toContainText('The server ran out of time')
  await expect(page.getByTestId('simulation-error-hint')).toContainText('Try fewer trials')
  await expect(page.getByTestId('simulation-results')).toHaveCount(0)
  expect(requests).toBe(3)
})

test('the dashboard shows the latest simulation and a Run simulation shortcut', async ({ page, issues }) => {
  await setNumber(page, '#seed', '5')
  const [sim] = await runAndCollect(page, 1)
  await page.getByRole('link', { name: 'Dashboard' }).first().click()
  await expect(page.getByTestId('metric-simulation-value')).toHaveText(pct(sim.estimate))
  await expect(page.getByTestId('metric-simulation')).toContainText(`seed ${sim.seed}`)
  await page.getByTestId('dashboard-run-simulation').click()
  await expect(page).toHaveURL(/panel=simulation/)
  await expect(page.getByRole('button', { name: 'Run Monte Carlo Simulation' })).toBeVisible()
  expect(issues).toEqual([])
})
