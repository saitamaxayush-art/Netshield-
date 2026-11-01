/**
 * Studio against the REAL FastAPI backend (started by playwright.config.ts on its own port).
 *
 * Success tests capture the actual HTTP response from the backend and assert that every value the
 * panel displays equals that response (plus hand verified values for known graphs). Failure tests
 * make the request fail (HTTP error, wrong shape, network) and assert a visible error with Retry and
 * no result. Together they fail if any result is ever shown that did not come from the backend.
 */
import { expect, test, type Page, type Response } from '@playwright/test'
import { E2E_API_PORT } from '../playwright.config'

test.use({ viewport: { width: 1440, height: 900 } })

type NodeType = 'router' | 'server' | 'client' | 'firewall'

/** Seed the studio's persisted workspace (the format graphStore saves) before the app loads. */
async function seedGraph(
  page: Page,
  nodes: Array<{ id: string; label: string; type: NodeType }>,
  edges: Array<{ id: string; source: string; target: string }>,
  failedNodeIds: string[] = []
) {
  const state = {
    nodes: nodes.map((n, i) => ({
      id: n.id,
      type: 'netshieldNode',
      position: { x: 100 + 90 * i, y: 100 + 40 * (i % 3) },
      data: { label: n.label, nodeType: n.type, status: failedNodeIds.includes(n.id) ? 'failed' : 'healthy' },
    })),
    edges: edges.map((e) => ({ ...e, type: 'netshieldEdge', data: { status: 'healthy' } })),
    failedNodeIds,
    failedEdgeIds: [],
    simulationConfig: { trials: 500, failureProb: 0.15, failTarget: 'edges' },
    version: 1,
  }
  await page.addInitScript((value) => localStorage.setItem('netshield_graph_state_v1', value), JSON.stringify(state))
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
  await page.goto('/studio')
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
  await expect(page.getByTestId('analysis-source')).toHaveText('FastAPI NetworkX')
  await expect(page.getByTestId('analysis-source')).toHaveAttribute('data-source', 'backend')
  await expect(page.getByTestId('analysis-engine')).toHaveText(`NetworkX ${body.meta.engineVersion}, API ${body.meta.apiVersion}`)
  await expect(page.getByTestId('analysis-connected')).toHaveText(c.connectivity.connected ? 'Fully Connected' : 'Disconnected')
  await expect(page.getByTestId('analysis-reason')).toHaveText(c.connectivity.reason)
  await expect(page.getByTestId('analysis-component-count')).toHaveText(String(c.connectivity.componentCount))
  await expect(page.getByTestId('analysis-density')).toHaveText(c.summary.density.toFixed(4))
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

  // Hand verified: hub_1 joins srv_1, fw_1, cli_3 (bridges) and the triangle hub_1, cli_1, cli_2.
  expect(body.current.bridges.edgeIds).toEqual(['e_hub_cli3', 'e_hub_fw', 'e_hub_srv'])
  expect(body.current.articulationPoints.nodeIds).toEqual(['hub_1'])
  expect(body.current.connectivity.reason).toBe('Single component')
  await expectPanelShows(page, body)

  // The request used the contract shape (per element failed flags), not the legacy one.
  const sent = response.request().postDataJSON() as Record<string, unknown>
  expect(Object.keys(sent).sort()).toEqual(['edges', 'nodes'])
  await expect(page.getByTestId('demo-mode-banner')).toHaveCount(0)
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
  await page.locator('select', { has: page.locator('option', { hasText: '(Select start)' }) }).selectOption('L1')
  await page.locator('select', { has: page.locator('option', { hasText: '(Select target)' }) }).selectOption('L4')
  const body = (await (await runAnalysis(page)).json()) as AnalyzeBody
  const label = (id: string) => (id === 'hub' ? 'Hub' : `Leaf ${id.slice(1)}`)
  expect(body.current.path?.nodeIds).toEqual(['L1', 'hub', 'L4'])
  await expect(page.getByTestId('analysis-bfs')).toHaveText(
    body.current.traversal!.bfs.map((s) => `${label(s.nodeId)} (${s.layer})`).join(' → ')
  )
  await expect(page.getByTestId('analysis-dfs')).toHaveText(body.current.traversal!.dfs.map(label).join(' → '))
  await expect(page.getByTestId('analysis-path')).toContainText(`${['L1', 'hub', 'L4'].map(label).join(' → ')} (2 hops)`)
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

// --- Simulation and sweep (legacy endpoints): real backend and failures ---------------------------

test('simulation result shown is the real backend response', async ({ page }) => {
  await openTab(page, 'Simulator')
  const [response] = await Promise.all([
    page.waitForResponse(isPost('/api/simulate')),
    page.getByRole('button', { name: 'Run Monte Carlo Simulation' }).click(),
  ])
  expect(response.status()).toBe(200)
  const body = (await response.json()) as {
    estimated_reliability: number
    connected_trials: number
    trials: number
    standard_error: number
    confidence_interval_95: [number, number]
  }
  expect(body.trials).toBe(500)
  await expect(page.getByTestId('simulation-source')).toHaveText('FastAPI Backend')
  await expect(page.getByTestId('simulation-source')).toHaveAttribute('data-source', 'backend')
  await expect(page.getByTestId('simulation-reliability')).toHaveText(`${(body.estimated_reliability * 100).toFixed(1)}%`)
  await expect(page.getByTestId('simulation-connected')).toHaveText(`${body.connected_trials} / ${body.trials}`)
  await expect(page.getByTestId('simulation-se')).toHaveText(`±${(body.standard_error * 100).toFixed(2)}%`)
  const [lo, hi] = body.confidence_interval_95
  await expect(page.getByTestId('simulation-ci')).toHaveText(`[${(lo * 100).toFixed(1)}%, ${(hi * 100).toFixed(1)}%]`)
  await expect(page.getByText('Demo result')).toHaveCount(0)
})

test('sweep result shown is the real backend response', async ({ page }) => {
  await openTab(page, 'Simulator')
  const [response] = await Promise.all([
    page.waitForResponse(isPost('/api/reliability-sweep')),
    page.getByRole('button', { name: /Run Reliability Sweep/ }).click(),
  ])
  expect(response.status()).toBe(200)
  const body = (await response.json()) as { points: Array<{ prob: number; reliability: number }> }
  expect(body.points).toHaveLength(11)
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`
  const first = body.points[0]
  const last = body.points[body.points.length - 1]
  const summary = page.getByTestId('sweep-summary')
  await expect(summary).toHaveAttribute('data-source', 'backend')
  await expect(summary).toHaveText(
    `11 points from the FastAPI backend: R = ${pct(first.reliability)} at p = ${pct(first.prob)} to R = ${pct(last.reliability)} at p = ${pct(last.prob)}`
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
