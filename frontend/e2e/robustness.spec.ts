/**
 * Robustness against the real backend: offline banner and recovery, explicit demo mode, import errors,
 * out of order responses, limits, and edge cases. Mocking is used only to take the server away or to
 * hold a response back; every value asserted as a result comes from the real backend.
 */
import { readFileSync } from 'node:fs'
import type { Page, Response, Route } from '@playwright/test'
import { expect, test } from './helpers'
import { E2E_API_PORT } from '../playwright.config'

test.use({ viewport: { width: 1440, height: 900 } })

const isAnalyze = (r: Response) => r.url().endsWith('/api/analyze') && r.request().method() === 'POST'
const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`)
const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click()

type SeedNode = { id: string; label?: string; failed?: boolean; x?: number; y?: number }
type SeedEdge = { id: string; source: string; target: string; failed?: boolean }
async function seed(page: Page, nodes: SeedNode[], edges: SeedEdge[]) {
  const workspace = {
    version: 5,
    savedAt: '2026-01-01T00:00:00.000Z',
    graph: {
      nodes: nodes.map((n, i) => ({ id: n.id, label: n.label ?? n.id.toUpperCase(), nodeType: 'router', failed: n.failed ?? false, position: { x: n.x ?? 220 * i, y: n.y ?? 0 } })),
      edges: edges.map((e) => ({ ...e, failed: e.failed ?? false })),
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

async function overview(page: Page) {
  await tab(page, 'Analysis')
  await tab(page, 'Overview')
  return {
    connected: await page.getByTestId('analysis-connected').textContent(),
    reason: await page.getByTestId('analysis-reason').textContent(),
    components: await page.getByTestId('analysis-component-count').textContent(),
  }
}

// --- Offline server and demo mode ------------------------------------------------------------

test('backend offline: persistent banner, Retry, Dismiss and reopen, explicit demo mode, recovery', async ({ page }) => {
  await page.route('**/api/**', (route) => route.abort('connectionrefused'))
  await page.goto('/studio')
  const banner = page.getByTestId('offline-banner')
  await expect(banner).toContainText('Cannot reach the analysis server.')
  await tab(page, 'Analysis')
  await expect(page.getByTestId('analysis-error')).toContainText('Backend unreachable')
  await expect(page.getByTestId('analysis-results')).toHaveCount(0)
  await expect(page.getByTestId('analysis-tab-error')).toBeVisible()

  // Retry while still down keeps the banner.
  await banner.getByRole('button', { name: 'Retry' }).click()
  await expect(banner).toBeVisible()

  // Dismissed, but recoverable.
  await banner.getByRole('button', { name: 'Dismiss' }).click()
  await expect(banner).toHaveCount(0)
  await page.getByTestId('offline-chip').click()
  await expect(banner).toBeVisible()

  // The same banner on another page.
  await page.getByRole('link', { name: 'Dashboard' }).first().click()
  await expect(page.getByTestId('offline-banner')).toBeVisible()
  await expect(page.getByTestId('dashboard-analysis-error')).toBeVisible()

  // Demo mode only on the explicit action, labelled everywhere.
  await page.getByTestId('offline-banner').getByRole('button', { name: 'Use demo mode' }).click()
  await expect(page.getByTestId('demo-mode-banner')).toBeVisible()
  await expect(page.getByTestId('offline-banner')).toHaveCount(0)
  await expect(page.getByTestId('dashboard-source')).toHaveText('Demo result')
  await page.getByRole('link', { name: 'Studio' }).first().click()
  await tab(page, 'Analysis')
  await expect(page.getByTestId('analysis-source')).toHaveText('Demo result')
  await tab(page, 'Simulator')
  await page.getByRole('button', { name: 'Run Monte Carlo Simulation' }).click()
  await expect(page.getByTestId('simulation-source')).toHaveText('Demo result')
  await expect(page.getByTestId('simulation-assumptions')).toContainText('demo adapter')

  // Back to the backend, still offline: the banner returns. Then the server comes back.
  await page.getByRole('button', { name: 'Exit demo mode' }).click()
  await expect(page.getByTestId('offline-banner')).toBeVisible()
  await page.unroute('**/api/**')
  const [response] = await Promise.all([page.waitForResponse(isAnalyze), page.getByTestId('offline-banner').getByRole('button', { name: 'Retry' }).click()])
  expect(response.status()).toBe(200)
  await expect(page.getByTestId('offline-banner')).toHaveCount(0)
  await tab(page, 'Analysis')
  await expect(page.getByTestId('analysis-source')).toHaveText('FastAPI NetworkX')
})

test('health is checked on load and again when the window regains focus', async ({ page }) => {
  let healthCalls = 0
  let down = true
  await page.route('**/api/health', (route) => {
    healthCalls++
    return down ? route.abort('connectionrefused') : route.continue()
  })
  await page.goto('/dashboard')
  await expect(page.getByTestId('offline-banner')).toBeVisible()
  expect(healthCalls).toBeGreaterThan(0)
  down = false
  // Focus checks are spaced at least 5 s apart.
  await page.waitForTimeout(5200)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByTestId('offline-banner')).toHaveCount(0)
})

// --- Out of order responses ------------------------------------------------------------------

test('a slow, older analysis response never overwrites a newer one', async ({ page, issues }) => {
  await page.goto('/studio')
  await expect(node(page, 'hub')).toBeVisible()
  await tab(page, 'Analysis')
  await expect(page.getByTestId('analysis-results')).toBeVisible()

  // Hold the next analysis back (it is the real backend's answer, just delayed), then edit again.
  let release: () => void = () => undefined
  const held = new Promise<void>((r) => (release = r))
  let calls = 0
  await page.route('**/api/analyze', async (route: Route) => {
    calls++
    if (calls === 1) {
      const response = await route.fetch()
      await held
      // The client has already cancelled this request; fulfilling it may fail, which is the point.
      await route.fulfill({ response }).catch(() => undefined)
    } else await route.continue()
  })
  await tab(page, 'Properties')
  await node(page, 'hub').click()
  await page.getByRole('button', { name: 'Fail selected node' }).click()
  await page.waitForTimeout(450)
  const [newest] = await Promise.all([page.waitForResponse(isAnalyze), page.getByRole('button', { name: 'Restore selected node' }).click()])
  const body = (await newest.json()) as { current: { connectivity: { componentCount: number } } }
  expect(body.current.connectivity.componentCount).toBe(1)
  release()
  await page.waitForTimeout(500)
  const shown = await overview(page)
  expect(shown).toEqual({ connected: 'Connected', reason: 'Single component', components: '1' })
  await expect(page.getByTestId('analysis-stale')).toHaveCount(0)
  expect(issues.filter((i) => !i.includes('requestfailed'))).toEqual([])
})

test('rapid edits during analysis end with the result for the final graph', async ({ page }) => {
  await page.goto('/studio')
  await expect(node(page, 'hub')).toBeVisible()
  for (const id of ['c1', 'c2', 'c3', 'c4', 'srv']) {
    await node(page, id).click()
    await page.getByRole('button', { name: 'Fail selected node' }).click()
  }
  const [last] = await Promise.all([page.waitForResponse(isAnalyze), node(page, 'fw').click().then(() => page.getByRole('button', { name: 'Fail selected node' }).click())])
  const sent = last.request().postDataJSON() as { nodes: Array<{ id: string; failed: boolean }> }
  expect(sent.nodes.filter((n) => n.failed).map((n) => n.id).sort()).toEqual(['c1', 'c2', 'c3', 'c4', 'fw', 'srv'])
  await expect.poll(async () => (await overview(page)).components).toBe('1')
  await expect(page.getByTestId('analysis-reason')).toHaveText('Single component')
  await expect(page.getByTestId('analysis-stale')).toHaveCount(0)
})

// --- Import and export -----------------------------------------------------------------------

async function openData(page: Page) {
  await page.getByTestId('studio-toolbar').getByRole('button', { name: 'Import or export' }).click()
  return page.getByTestId('graph-data-dialog')
}

test('import: errors are listed, big files refused, a valid file is previewed, replaced and undoable', async ({ page, issues }) => {
  await page.goto('/studio')
  await expect(node(page, 'hub')).toBeVisible()
  let dialog = await openData(page)
  const file = dialog.getByTestId('import-file')

  await file.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{ not json') })
  await expect(dialog.getByTestId('import-errors')).toContainText('The file is not valid JSON')

  const wrong = { format: 'netshield-graph', version: 1, graph: { nodes: [{ id: 'a', label: 'A', nodeType: 'mainframe', failed: false, position: { x: 0, y: 0 } }], edges: [{ id: 'e', source: 'a' }] } }
  await file.setInputFiles({ name: 'wrong.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(wrong)) })
  const errors = dialog.getByTestId('import-errors')
  await expect(errors).toContainText('graph.nodes[0].nodeType')
  await expect(errors).toContainText('graph.edges[0].target')
  await expect(errors).toContainText('graph.edges[0].failed')

  await file.setInputFiles({ name: 'huge.json', mimeType: 'application/json', buffer: Buffer.alloc(1024 * 1024 + 10, 32) })
  await expect(dialog.getByTestId('import-errors')).toContainText('the limit is 1024 KB')

  const good = {
    format: 'netshield-graph',
    version: 1,
    graph: {
      nodes: ['p', 'q', 'r'].map((id, i) => ({ id, label: `Node ${id}`, nodeType: 'server', failed: false, position: { x: i * 250, y: 0 } })),
      edges: [{ id: 'pq', source: 'p', target: 'q', failed: false }],
    },
  }
  await file.setInputFiles({ name: 'good.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(good)) })
  const previewBox = dialog.getByTestId('import-preview')
  await expect(previewBox).toContainText('good.json: 3 nodes and 1 links.')
  await expect(previewBox).toContainText('replaces the current graph (7 nodes, 6 links)')
  // Nothing replaced yet.
  await expect(page.locator('.react-flow__node')).toHaveCount(7)
  // Match the analysis of the imported graph itself: the star's own first analysis can still be in flight.
  const isImported = (r: Response) => isAnalyze(r) && (r.request().postDataJSON() as { nodes: unknown[] }).nodes.length === 3
  const [response] = await Promise.all([page.waitForResponse(isImported), previewBox.getByRole('button', { name: 'Replace graph' }).click()])
  const analysed = (await response.json()) as { current: { connectivity: { componentCount: number } } }
  expect(analysed.current.connectivity.componentCount).toBe(2)
  await expect(page.locator('.react-flow__node')).toHaveCount(3)
  await page.getByTestId('studio-toolbar').getByRole('button', { name: 'Undo' }).click()
  await expect(page.locator('.react-flow__node')).toHaveCount(7)

  // Export round trip: JSON, and SVG with escaped labels; PNG downloads.
  await node(page, 'hub').click()
  await page.locator('#node-label').fill('<b>Hub & "Core"</b>')
  await page.locator('#node-label').press('Enter')
  dialog = await openData(page)
  const [json] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'JSON', exact: true }).click()])
  const exported = JSON.parse(readFileSync(await json.path(), 'utf8')) as { format: string; graph: { nodes: unknown[] } }
  expect([exported.format, exported.graph.nodes.length]).toEqual(['netshield-graph', 7])
  const [svg] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'SVG', exact: true }).click()])
  const svgText = readFileSync(await svg.path(), 'utf8')
  expect(svgText).toContain('&lt;b&gt;Hub &amp; &quot;Core&quot;&lt;/b&gt;')
  expect(svgText).not.toContain('<b>')
  const [png] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'PNG', exact: true }).click()])
  expect(readFileSync(await png.path()).subarray(1, 4).toString()).toBe('PNG')
  expect(issues).toEqual([])
})

// --- Limits ----------------------------------------------------------------------------------

test('limits: the 201st node is refused with a message; the backend 413 and LIMIT_EXCEEDED are clear', async ({ page, request }) => {
  await seed(page, Array.from({ length: 200 }, (_, i) => ({ id: `n${i}`, x: (i % 20) * 200, y: Math.floor(i / 20) * 110 })), [])
  await page.goto('/studio')
  await expect(page.locator('.react-flow__node')).toHaveCount(200)
  await page.getByTestId('studio-toolbar').getByRole('button', { name: 'Router', exact: true }).click()
  await expect(page.getByTestId('studio-toast')).toHaveText(/A network can have at most 200 nodes\./)
  await expect(page.locator('.react-flow__node')).toHaveCount(200)

  const big = await request.post(`http://127.0.0.1:${E2E_API_PORT}/api/analyze`, { headers: { 'Content-Type': 'application/json' }, data: Buffer.from(`{"nodes":[${' '.repeat(1024 * 1024)}],"edges":[]}`) })
  expect(big.status()).toBe(413)
  expect(((await big.json()) as { error: { code: string } }).error.code).toBe('PAYLOAD_TOO_LARGE')

  const tooMany = await request.post(`http://127.0.0.1:${E2E_API_PORT}/api/analyze`, { data: { nodes: Array.from({ length: 201 }, (_, i) => ({ id: `n${i}`, label: 'x', type: 'router' })), edges: [] } })
  const limitBody = await tooMany.json()
  expect(limitBody.error.code).toBe('LIMIT_EXCEEDED')
  await page.route('**/api/analyze', (route) => route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify(limitBody) }))
  await tab(page, 'Analysis')
  await page.getByRole('button', { name: 'Compute Graph Metrics' }).click()
  await expect(page.getByTestId('analysis-error')).toContainText('Network too large for the server')
  await expect(page.getByTestId('analysis-error')).toContainText('Too many nodes: 201 given, maximum is 200')
})

// --- Edge cases (real backend values) --------------------------------------------------------

test('edge cases: empty graph, single node, two nodes with no link', async ({ page, issues }) => {
  await seed(page, [], [])
  await page.goto('/studio')
  await expect(page.getByTestId('empty-canvas')).toBeVisible()
  await tab(page, 'Analysis')
  await expect(page.getByTestId('analysis-empty')).toContainText('Add nodes')
  await expect(page.getByRole('button', { name: 'Compute Graph Metrics' })).toBeDisabled()
  await tab(page, 'Simulator')
  await expect(page.getByRole('button', { name: 'Run Monte Carlo Simulation' })).toBeDisabled()

  await tab(page, 'Properties')
  const [one] = await Promise.all([page.waitForResponse(isAnalyze), page.getByRole('button', { name: 'Add node' }).click()])
  expect(((await one.json()) as { current: { connectivity: { reason: string } } }).current.connectivity.reason).toBe('Single component')
  expect(await overview(page)).toEqual({ connected: 'Connected', reason: 'Single component', components: '1' })
  await tab(page, 'Properties')
  await page.getByTestId('studio-toolbar').getByRole('button', { name: 'Server', exact: true }).click()
  await expect.poll(async () => (await overview(page)).components).toBe('2')
  await expect(page.getByTestId('analysis-connected')).toHaveText('Not connected')
  await expect(page.getByTestId('analysis-reason')).toHaveText('2 components')
  expect(issues).toEqual([])
})

test('edge cases: all nodes failed, all links failed', async ({ page }) => {
  await seed(page, [{ id: 'a', failed: true }, { id: 'b', failed: true }, { id: 'c', failed: true }], [{ id: 'ab', source: 'a', target: 'b' }, { id: 'bc', source: 'b', target: 'c' }])
  await page.goto('/studio')
  await expect(node(page, 'a')).toBeVisible()
  const allNodes = await overview(page)
  expect(allNodes.components).toBe('0')
  await expect(page.getByTestId('all-failed-note')).toContainText('Every node is marked failed')
  await expect(page.getByTestId('edge-ab')).toHaveAttribute('data-state', 'unavailable')
  await tab(page, 'Properties')
  await page.getByRole('button', { name: 'Fail random' }).click()
  await expect(page.getByTestId('random-error')).toHaveText('Nothing is left to fail: no node or link is operational.')

  await page.getByRole('button', { name: 'Clear all failures' }).click()
  for (const id of ['ab', 'bc']) {
    await page.locator(`.react-flow__edge[data-id="${id}"]`).click({ force: true })
    await page.getByRole('button', { name: 'Fail selected edge' }).click()
  }
  await expect.poll(async () => (await overview(page)).components).toBe('3')
  await expect(page.getByTestId('analysis-reason')).toHaveText('3 components')
})

test('edge cases: deleting a node used as path source, traversal start and terminal sends no stale ids', async ({ page, issues }) => {
  await page.goto('/studio')
  await expect(node(page, 'hub')).toBeVisible()
  await tab(page, 'Analysis')
  await tab(page, 'Paths')
  await page.locator('#path-source').selectOption('c1')
  await page.locator('#path-target').selectOption('c2')
  await tab(page, 'Traversal')
  await page.locator('#traversal-start').selectOption('c1')
  await expect(page.getByTestId('analysis-bfs')).toContainText('Client 1 (0)')
  await tab(page, 'Properties')
  await node(page, 'c1').click()
  const [response] = await Promise.all([page.waitForResponse(isAnalyze), page.keyboard.press('Delete')])
  const sent = response.request().postDataJSON() as Record<string, unknown>
  expect(response.status()).toBe(200)
  expect(['startNodeId', 'pathSource', 'pathTarget'].filter((k) => k in sent)).toEqual([])
  await tab(page, 'Analysis')
  await tab(page, 'Traversal')
  await expect(page.getByText(/Choose a start node/)).toBeVisible()
  expect(issues).toEqual([])
})

test('edge cases: unusual, very long and duplicate labels; huge coordinates', async ({ page, issues }) => {
  const long = 'L'.repeat(100)
  await seed(page, [{ id: 'a', label: 'Same' }, { id: 'b', label: 'Same' }, { id: 'c', label: '<img src=x onerror=alert(1)> 😀 Ünï' }, { id: 'd', label: long, x: 99000, y: -99000 }], [{ id: 'ab', source: 'a', target: 'b' }])
  page.on('dialog', () => {
    throw new Error('a label opened a dialog')
  })
  await page.goto('/studio')
  await expect(page.locator('.react-flow__node')).toHaveCount(4)
  await expect(node(page, 'c')).toContainText('<img src=x onerror=alert(1)> 😀 Ünï')
  await tab(page, 'Analysis')
  await tab(page, 'Paths')
  await expect(page.locator('#path-source option')).toContainText(['(Select source)', 'Same (a)', 'Same (b)'])
  await tab(page, 'Properties')
  // A node at (99000, -99000) is reachable after fitting the view.
  await page.getByTestId('studio-toolbar').getByRole('button', { name: 'Fit view' }).click()
  await expect(node(page, 'd')).toBeInViewport()
  // At that zoom it is tiny, so select it from the keyboard.
  await node(page, 'd').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#node-label')).toHaveValue(long)
  await page.locator('#node-label').fill(`${long}EXTRA`)
  await expect(page.locator('#node-label')).toHaveValue(long)
  expect(issues).toEqual([])
})

test('edge cases: browser back and forward, window resize, reload in the middle of a simulation', async ({ page, issues }) => {
  await page.goto('/studio')
  await expect(node(page, 'hub')).toBeVisible()
  await page.getByRole('link', { name: 'Dashboard' }).first().click()
  await expect(page.getByTestId('metric-nodes-value')).toHaveText('7')
  await page.goBack()
  await expect(page.locator('.react-flow__node')).toHaveCount(7)
  await page.goForward()
  await expect(page.getByTestId('metric-nodes-value')).toHaveText('7')
  await page.goBack()

  for (const width of [390, 1024, 1440]) {
    await page.setViewportSize({ width, height: 800 })
    await expect(page.locator('.react-flow__node')).toHaveCount(7)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0)
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await tab(page, 'Simulator')
  await page.locator('#trials').selectOption('20000')
  await page.getByRole('button', { name: 'Run Monte Carlo Simulation' }).click()
  await expect(page.getByTestId('simulation-progress')).toBeVisible()
  await page.reload()
  await expect(page.locator('.react-flow__node')).toHaveCount(7)
  await tab(page, 'Simulator')
  await expect(page.getByTestId('simulation-results')).toHaveCount(0)
  await expect(page.getByTestId('simulation-error')).toHaveCount(0)
  await expect(page.locator('#trials')).toHaveValue('20000')
  expect(issues.filter((i) => !i.includes('requestfailed'))).toEqual([])
})

test('malformed JSON and unknown paths get the contract error shape from the real backend', async ({ request }) => {
  const base = `http://127.0.0.1:${E2E_API_PORT}`
  const malformed = await request.post(`${base}/api/analyze`, { headers: { 'Content-Type': 'application/json' }, data: Buffer.from('{"nodes": [') })
  expect(malformed.status()).toBe(422)
  expect(await malformed.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR', message: expect.stringMatching(/^Request body is not valid JSON/) } })
  const missing = await request.get(`${base}/api/does-not-exist`)
  expect([missing.status(), (await missing.json()).error.code]).toEqual([404, 'NOT_FOUND'])
  const health = await request.get(`${base}/api/health`)
  expect((await health.json()).version).toBe('2.0.0')
  expect(health.headers()['x-request-id']).toBeTruthy()
})

test('the privacy page states the real data flow and keeps Clear saved data (BUG-014)', async ({ page }) => {
  await page.goto('/privacy')
  const main = page.locator('main')
  await expect(main).toContainText('netshield_workspace')
  await expect(page.getByTestId('privacy-backend')).toContainText('send the whole current graph, including node labels')
  await expect(page.getByTestId('privacy-logging')).toContainText('never contains graph contents')
  await expect(page.getByTestId('privacy-logging')).toContainText('client IP address')
  await expect(page.getByTestId('privacy-logging')).toContainText('Developer review required')
  // The old page claimed a silent browser fallback; demo mode is only by explicit choice.
  await expect(main).not.toContainText('all computations execute locally')
  await expect(main).toContainText('Demo mode starts only when you choose')
  await page.getByRole('button', { name: 'Clear Saved Data' }).click()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('netshield_workspace'))).toBeNull()
})

for (const [width, height] of [[1440, 900], [390, 844]] as const) {
  test(`no console errors or warnings on any app route at ${width}px`, async ({ page, issues }) => {
    await page.setViewportSize({ width, height })
    for (const route of ['/dashboard', '/studio', '/studio?panel=analysis', '/studio?panel=simulation', '/privacy', '/terms', '/no-such-page']) {
      await page.goto(route)
      await page.waitForTimeout(700)
    }
    expect(issues).toEqual([])
  })
}
