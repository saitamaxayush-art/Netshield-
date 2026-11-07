/**
 * Studio against the REAL FastAPI backend (started by playwright.config.ts on its own port).
 *
 * Success tests capture the actual HTTP response from the backend and assert that every value the
 * panel displays equals that response (plus hand verified values for known graphs). Failure tests
 * make the request fail (HTTP error, wrong shape, network) and assert a visible error with Retry and
 * no result. Together they fail if any result is ever shown that did not come from the backend.
 */
import { expect, test, type Page, type Request, type Response } from '@playwright/test'
import { E2E_API_PORT } from '../playwright.config'

test.use({ viewport: { width: 1440, height: 900 } })

type NodeType = 'router' | 'server' | 'client' | 'firewall'

/** Seed a version 2 workspace (the Phase 3 format) before the app loads; the app migrates it to version 3. */
async function seedGraph(
  page: Page,
  nodes: Array<{ id: string; label: string; type: NodeType }>,
  edges: Array<{ id: string; source: string; target: string }>,
  failedNodeIds: string[] = []
) {
  const workspace = {
    version: 2,
    savedAt: '2026-01-01T00:00:00.000Z',
    graph: {
      nodes: nodes.map((n, i) => ({
        id: n.id,
        label: n.label,
        nodeType: n.type,
        failed: failedNodeIds.includes(n.id),
        position: { x: 100 + 90 * i, y: 100 + 40 * (i % 3) },
      })),
      edges: edges.map((e) => ({ ...e, failed: false })),
      example: null,
    },
    settings: {
      edgeFailureProbability: 0.15,
      nodeFailureProbability: 0,
      trials: 500,
      seed: null,
      mode: 'all-terminal',
      traversalStart: null,
      pathSource: null,
      pathTarget: null,
      sweepPMin: 0,
      sweepPMax: 1,
      sweepPoints: 11,
      trialsPerPoint: 200,
    },
  }
  await page.addInitScript((value) => {
    // Only on the first load of the page, so a reload in a test keeps what the app saved.
    if (sessionStorage.getItem('seeded') === null) {
      localStorage.setItem('netshield_workspace', value)
      sessionStorage.setItem('seeded', '1')
    }
  }, JSON.stringify(workspace))
}

function sixLeafStar() {
  const leaves = [1, 2, 3, 4, 5, 6].map((i) => ({ id: `L${i}`, label: `Leaf ${i}`, type: 'client' as const }))
  return {
    nodes: [{ id: 'hub', label: 'Hub', type: 'router' as const }, ...leaves],
    edges: leaves.map((l, i) => ({ id: `e${i + 1}`, source: 'hub', target: l.id })),
  }
}

const isPost = (path: string) => (r: Response) => r.url().endsWith(path) && r.request().method() === 'POST'

async function openTab(page: Page, name: 'Analysis' | 'Simulator') {
  // The page analyzes by itself 300 ms after load. Let that run settle, so it cannot land in the
  // middle of what a test does next.
  const isAnalyze = (r: Request) => r.url().endsWith('/api/analyze')
  const settled = Promise.race([page.waitForEvent('requestfinished', isAnalyze), page.waitForEvent('requestfailed', isAnalyze)])
  await page.goto('/studio')
  await settled
  await page.getByRole('button', { name, exact: true }).click()
}

async function runAnalysis(page: Page) {
  const [response] = await Promise.all([
    page.waitForResponse(isPost('/api/analyze')),
    page.getByRole('button', { name: 'Compute Graph Metrics' }).click(),
  ])
  expect(response.status()).toBe(200)
  return response
}

/** Every displayed analysis value equals the backend's response body. */
async function expectPanelShows(page: Page, body: AnalyzeBody) {
  const c = body.current
  await page.getByRole('button', { name: 'Overview', exact: true }).click()
  await expect(page.getByTestId('analysis-source')).toHaveText('FastAPI NetworkX')
  await expect(page.getByTestId('analysis-source')).toHaveAttribute('data-source', 'backend')
  await expect(page.getByTestId('analysis-engine')).toHaveText(`NetworkX ${body.meta.engineVersion}, API ${body.meta.apiVersion}`)
  await expect(page.getByTestId('analysis-connected')).toHaveText(c.connectivity.connected ? 'Connected' : 'Not connected')
  await expect(page.getByTestId('analysis-reason')).toHaveText(c.connectivity.reason)
  await expect(page.getByTestId('analysis-component-count')).toHaveText(String(c.connectivity.componentCount))
  await expect(page.getByTestId('analysis-density')).toHaveText(c.summary.density.toFixed(4))
  await page.getByRole('button', { name: 'Critical', exact: true }).click()
  await expect(page.getByTestId('section-critical')).toBeVisible()
  const shownBridges = await page.locator('[data-testid="analysis-bridges"] li').evaluateAll((els) => els.map((e) => e.getAttribute('data-edge-id')))
  expect(shownBridges).toEqual(c.bridges.edgeIds)
  const shownCut = await page.locator('[data-testid="analysis-articulation"] li').evaluateAll((els) => els.map((e) => e.getAttribute('data-node-id')))
  expect(shownCut).toEqual(c.articulationPoints.nodeIds)
  await expect(page.getByTestId('analysis-error')).toHaveCount(0)
}

interface AnalyzeBody {
  current: {
    summary: { density: number }
    connectivity: { connected: boolean; componentCount: number; reason: string }
    bridges: { edgeIds: string[] }
    articulationPoints: { nodeIds: string[] }
    traversal: { bfs: Array<{ nodeId: string; layer: number }>; dfs: string[] } | null
    path: { nodeIds: string[] | null; hops: number | null } | null
  }
  meta: { engine: string; engineVersion: string; apiVersion: string }
}

// --- Analysis: real backend ----------------------------------------------------------------------

test('analysis of the built-in Star example comes from the real backend', async ({ page, request }) => {
  const health = await request.get(`http://127.0.0.1:${E2E_API_PORT}/api/health`)
  expect((await health.json()).status).toBe('ok')

  await openTab(page, 'Analysis')
  const response = await runAnalysis(page)
  const body = (await response.json()) as AnalyzeBody
  expect(body.meta.engine).toBe('networkx')

  // Hand verified: in a true star every link is a bridge and the hub is the only cut vertex.
  expect(body.current.bridges.edgeIds).toEqual(['e-hub-c1', 'e-hub-c2', 'e-hub-c3', 'e-hub-c4', 'e-hub-fw', 'e-hub-srv'])
  expect(body.current.articulationPoints.nodeIds).toEqual(['hub'])
  expect(body.current.connectivity.reason).toBe('Single component')
  await expectPanelShows(page, body)

  // The request used the contract shape (per element failed flags), not the legacy one.
  const sent = response.request().postDataJSON() as Record<string, unknown>
  expect(Object.keys(sent).sort()).toEqual(['compareHealthy', 'edges', 'nodes'])
  await expect(page.getByTestId('demo-mode-banner')).toHaveCount(0)
  await expect(page.getByTestId('example-label')).toHaveText('Example: star network')
})

test('6-leaf star: 6 bridges and the hub; failing the hub gives 6 components', async ({ page }) => {
  const star = sixLeafStar()
  await seedGraph(page, star.nodes, star.edges)
  await openTab(page, 'Analysis')
  const healthy = (await (await runAnalysis(page)).json()) as AnalyzeBody
  expect(healthy.current.bridges.edgeIds).toEqual(['e1', 'e2', 'e3', 'e4', 'e5', 'e6'])
  expect(healthy.current.articulationPoints.nodeIds).toEqual(['hub'])
  await expectPanelShows(page, healthy)
})

test('6-leaf star with the hub failed is 6 isolated components', async ({ page }) => {
  const star = sixLeafStar()
  await seedGraph(page, star.nodes, star.edges, ['hub'])
  await openTab(page, 'Analysis')
  const response = await runAnalysis(page)
  const sent = response.request().postDataJSON() as { nodes: Array<{ id: string; failed: boolean }> }
  expect(sent.nodes.find((n) => n.id === 'hub')?.failed).toBe(true)
  const body = (await response.json()) as AnalyzeBody
  expect(body.current.connectivity.reason).toBe('6 components')
  expect(body.current.bridges.edgeIds).toEqual([])
  await expectPanelShows(page, body)
  await expect(page.getByTestId('analysis-bridges-none')).toBeVisible()
})

test('traversal and shortest path shown are the backend values', async ({ page }) => {
  const star = sixLeafStar()
  await seedGraph(page, star.nodes, star.edges)
  await openTab(page, 'Analysis')
  await page.getByRole('button', { name: 'Traversal', exact: true }).click()
  await page.locator('#traversal-start').selectOption('L1')
  await page.getByRole('button', { name: 'Paths', exact: true }).click()
  await page.locator('#path-source').selectOption('L1')
  await page.locator('#path-target').selectOption('L4')
  const body = (await (await runAnalysis(page)).json()) as AnalyzeBody
  const label = (id: string) => (id === 'hub' ? 'Hub' : `Leaf ${id.slice(1)}`)
  expect(body.current.path?.nodeIds).toEqual(['L1', 'hub', 'L4'])
  await expect(page.getByTestId('analysis-path')).toContainText(`${['L1', 'hub', 'L4'].map(label).join(' → ')} (2 hops)`)
  await page.getByRole('button', { name: 'Traversal', exact: true }).click()
  await expect(page.getByTestId('analysis-bfs')).toHaveText(
    body.current.traversal!.bfs.map((s) => `${label(s.nodeId)} (${s.layer})`).join(' → ')
  )
  await expect(page.getByTestId('analysis-dfs')).toHaveText(body.current.traversal!.dfs.map(label).join(' → '))
})

// --- Analysis: every failure is visible, never a substitute result ------------------------------

const failures: Array<{ name: string; fulfil: Parameters<Page['route']>[1]; message: RegExp }> = [
  {
    name: 'HTTP 500 with an error body',
    fulfil: (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error.' } }) }),
    message: /Unexpected server error\. \(INTERNAL_ERROR\)/,
  },
  {
    name: 'HTTP 200 with the wrong shape',
    fulfil: (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ is_connected: true, num_components: 1, bridges: [] }) }),
    message: /did not match the expected format/,
  },
  {
    name: 'network failure',
    fulfil: (route) => route.abort('connectionrefused'),
    message: /Could not reach the NetShield backend/,
  },
]

for (const failure of failures) {
  test(`analysis ${failure.name}: visible error with Retry, no result, then Retry uses the backend`, async ({ page }) => {
    await openTab(page, 'Analysis')
    // A successful result first, so the test also proves a failure clears it.
    await runAnalysis(page)
    await expect(page.getByTestId('analysis-results')).toBeVisible()

    await page.route('**/api/analyze', failure.fulfil)
    await page.getByRole('button', { name: 'Compute Graph Metrics' }).click()
    const error = page.getByTestId('analysis-error')
    await expect(error).toBeVisible()
    await expect(error).toContainText(failure.message)
    await expect(page.getByTestId('analysis-results')).toHaveCount(0)
    await expect(page.getByTestId('analysis-source')).toHaveCount(0)

    await page.unroute('**/api/analyze')
    const [retried] = await Promise.all([
      page.waitForResponse(isPost('/api/analyze')),
      error.getByRole('button', { name: 'Retry' }).click(),
    ])
    expect(retried.status()).toBe(200)
    await expectPanelShows(page, (await retried.json()) as AnalyzeBody)
  })
}

// --- Analysis: automatic re-analysis and the explicit demo mode ---------------------------------

test('failing a node re-analyzes automatically on the backend, and the canvas follows', async ({ page }) => {
  const star = sixLeafStar()
  await seedGraph(page, star.nodes, star.edges)
  // Wait from before the navigation: the automatic analysis can finish before goto returns.
  const [firstResponse] = await Promise.all([page.waitForResponse(isPost('/api/analyze')), page.goto('/studio')])
  const first = (await firstResponse.json()) as AnalyzeBody
  expect(first.current.connectivity.componentCount).toBe(1)
  await expect(page.locator('.react-flow__node', { hasText: 'Hub' })).toContainText('Cut Vertex')

  await page.locator('.react-flow__node', { hasText: 'Hub' }).click()
  const [after] = await Promise.all([
    page.waitForResponse(isPost('/api/analyze')),
    page.getByRole('button', { name: 'Fail Selected Node' }).click(),
  ])
  const sent = after.request().postDataJSON() as { nodes: Array<{ id: string; failed: boolean }> }
  expect(sent.nodes.find((n) => n.id === 'hub')?.failed).toBe(true)
  const body = (await after.json()) as AnalyzeBody
  expect(body.current.connectivity.componentCount).toBe(6)
  await page.getByRole('button', { name: 'Analysis', exact: true }).click()
  await expectPanelShows(page, body)
  await expect(page.getByTestId('analysis-stale')).toHaveCount(0)
})

test('a backend outage stays an error until the user switches to demo mode, which is labelled everywhere', async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort('connectionrefused'))
  await openTab(page, 'Analysis')
  const error = page.getByTestId('analysis-error')
  await expect(error).toContainText(/Could not reach the NetShield backend/)
  await expect(page.getByTestId('demo-mode-banner')).toHaveCount(0)

  await error.getByRole('button', { name: 'Switch to demo mode' }).click()
  await expect(page.getByTestId('demo-mode-banner')).toBeVisible()
  await expect(page.getByTestId('analysis-source')).toHaveText('Demo result')
  await expect(page.getByTestId('analysis-source')).toHaveAttribute('data-source', 'demo')
  await expect(page.getByTestId('analysis-engine')).toContainText('Demo adapter netshield-demo-1')

  await page.getByRole('button', { name: 'Simulator', exact: true }).click()
  await page.getByRole('button', { name: 'Run Monte Carlo Simulation' }).click()
  await expect(page.getByTestId('simulation-source')).toHaveText('Demo result')

  await page.getByRole('button', { name: 'Exit demo mode' }).click()
  await expect(page.getByTestId('demo-mode-banner')).toHaveCount(0)
  await expect(page.getByTestId('simulation-source')).toHaveCount(0)
})

test('the graph and settings survive a reload; results do not', async ({ page }) => {
  const star = sixLeafStar()
  await seedGraph(page, star.nodes, star.edges)
  // Wait from before the navigation: the automatic analysis can finish before goto returns.
  await Promise.all([page.waitForResponse(isPost('/api/analyze')), page.goto('/studio')])
  await page.locator('.react-flow__node', { hasText: 'Leaf 3' }).click()
  await page.getByRole('button', { name: 'Fail Selected Node' }).click()
  // The save is debounced (400 ms).
  await expect.poll(() => page.evaluate(() => localStorage.getItem('netshield_workspace') ?? '')).toContain('"id":"L3","label":"Leaf 3","nodeType":"client","failed":true')
  const saved = await page.evaluate(() => localStorage.getItem('netshield_workspace') ?? '')
  expect(saved).not.toContain('bridges')
  const [response] = await Promise.all([page.waitForResponse(isPost('/api/analyze')), page.reload()])
  const sent = response.request().postDataJSON() as { nodes: Array<{ id: string; failed: boolean }> }
  expect(sent.nodes.find((n) => n.id === 'L3')?.failed).toBe(true)
})

test('corrupt saved data is discarded with a visible notice, and the example loads', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('netshield_workspace', '{"version": 2, "graph": '))
  await page.goto('/studio')
  await expect(page.getByTestId('persistence-notice')).toContainText('Saved data was not loaded')
  await expect(page.getByTestId('persistence-notice')).toContainText('Saved data is not valid JSON.')
  await expect(page.getByTestId('example-label')).toHaveText('Example: star network')
})

// --- Simulation and sweep: real backend and failures --------------------------------------------

interface SimulateBody {
  estimate: number
  connectedTrials: number
  trials: number
  standardError: number
  wilson95: { low: number; high: number }
  seed: number
  meta: { engine: string }
}

test('simulation result shown is the real backend response', async ({ page }) => {
  await openTab(page, 'Simulator')
  const [response] = await Promise.all([
    page.waitForResponse(isPost('/api/simulate')),
    page.getByRole('button', { name: 'Run Monte Carlo Simulation' }).click(),
  ])
  expect(response.status()).toBe(200)
  const body = (await response.json()) as SimulateBody
  expect(body.trials).toBe(1000)
  expect(body.meta.engine).toBe('networkx')
  const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`
  await expect(page.getByTestId('simulation-source')).toHaveText('FastAPI Backend')
  await expect(page.getByTestId('simulation-source')).toHaveAttribute('data-source', 'backend')
  await expect(page.getByTestId('simulation-reliability')).toHaveText(pct(body.estimate))
  await expect(page.getByTestId('simulation-connected')).toHaveText(`${body.connectedTrials} / ${body.trials}`)
  await expect(page.getByTestId('simulation-se')).toHaveText(`±${pct(body.standardError, 2)}`)
  await expect(page.getByTestId('simulation-ci')).toHaveText(`[${pct(body.wilson95.low)}, ${pct(body.wilson95.high)}]`)
  await expect(page.getByTestId('simulation-seed')).toHaveText(String(body.seed))
  await expect(page.getByText('Demo result')).toHaveCount(0)

  // Changing a setting marks the result out of date instead of hiding or recomputing it.
  await page.locator('#edge-p').fill('0.5')
  await expect(page.getByTestId('simulation-stale')).toBeVisible()
})

test('sweep result shown is the real backend response', async ({ page }) => {
  await openTab(page, 'Simulator')
  const [response] = await Promise.all([
    page.waitForResponse(isPost('/api/reliability-sweep')),
    page.getByRole('button', { name: /Run Reliability Sweep/ }).click(),
  ])
  expect(response.status()).toBe(200)
  const body = (await response.json()) as { points: Array<{ p: number; estimate: number }> }
  expect(body.points).toHaveLength(11)
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`
  const first = body.points[0]
  const last = body.points[body.points.length - 1]
  const summary = page.getByTestId('sweep-summary')
  await expect(summary).toHaveAttribute('data-source', 'backend')
  await expect(summary).toHaveText(
    `11 points from the FastAPI backend: R = ${pct(first.estimate)} at p = ${pct(first.p)} to R = ${pct(last.estimate)} at p = ${pct(last.p)}`
  )
})

for (const failure of failures) {
  test(`simulation and sweep ${failure.name}: visible errors with Retry, no result`, async ({ page }) => {
    await openTab(page, 'Simulator')
    await page.route('**/api/simulate', failure.fulfil)
    await page.route('**/api/reliability-sweep', failure.fulfil)

    await page.getByRole('button', { name: 'Run Monte Carlo Simulation' }).click()
    await expect(page.getByTestId('simulation-error')).toContainText(failure.message)
    await expect(page.getByTestId('simulation-source')).toHaveCount(0)
    await expect(page.getByTestId('simulation-reliability')).toHaveCount(0)

    await page.getByRole('button', { name: /Run Reliability Sweep/ }).click()
    await expect(page.getByTestId('sweep-error')).toContainText(failure.message)
    await expect(page.getByTestId('sweep-summary')).toHaveCount(0)

    await page.unroute('**/api/simulate')
    await page.unroute('**/api/reliability-sweep')
    const [sim] = await Promise.all([
      page.waitForResponse(isPost('/api/simulate')),
      page.getByTestId('simulation-error').getByRole('button', { name: 'Retry' }).click(),
    ])
    expect(sim.status()).toBe(200)
    await expect(page.getByTestId('simulation-source')).toHaveAttribute('data-source', 'backend')
    const [sweep] = await Promise.all([
      page.waitForResponse(isPost('/api/reliability-sweep')),
      page.getByTestId('sweep-error').getByRole('button', { name: 'Retry' }).click(),
    ])
    expect(sweep.status()).toBe(200)
    await expect(page.getByTestId('sweep-summary')).toHaveAttribute('data-source', 'backend')
  })
}
