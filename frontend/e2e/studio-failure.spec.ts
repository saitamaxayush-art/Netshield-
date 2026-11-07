/**
 * Failure simulation against the REAL FastAPI backend started by playwright.config.ts. No request is
 * mocked here: every asserted number is also read from the response the backend actually sent.
 */
import type { Page, Response } from '@playwright/test'
import { expect, test } from './helpers'

test.use({ viewport: { width: 1440, height: 900 } })

interface Body {
  current: { connectivity: { connected: boolean; componentCount: number; reason: string }; summary: { density: number; nodeCount: number; edgeCount: number }; bridges: { edgeIds: string[] }; articulationPoints: { nodeIds: string[] }; path: { nodeIds: string[] | null; metric: string; length: number | null } | null }
  meta: { engine: string }
}
const isAnalyze = (r: Response) => r.url().endsWith('/api/analyze') && r.request().method() === 'POST'
const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click()

async function loadPreset(page: Page, name: 'Star' | 'Ring' | 'Mesh') {
  await page.getByTestId('studio-toolbar').getByRole('button', { name, exact: true }).click()
  const [response] = await Promise.all([page.waitForResponse(isAnalyze), page.getByRole('dialog').last().getByRole('button', { name: `Load ${name} example` }).click()])
  return (await response.json()) as Body
}

/** Do something that changes the graph and return the backend's next analysis. */
async function analysisAfter(page: Page, action: () => Promise<void>) {
  const [response] = await Promise.all([page.waitForResponse(isAnalyze), action()])
  expect(response.status()).toBe(200)
  const body = (await response.json()) as Body
  expect(body.meta.engine).toBe('networkx')
  return body
}

async function expectOverview(page: Page, body: Body, connected: string, components: number) {
  await tab(page, 'Analysis')
  await tab(page, 'Overview')
  expect(body.current.connectivity.componentCount).toBe(components)
  await expect(page.getByTestId('analysis-stale')).toHaveCount(0)
  await expect(page.getByTestId('analysis-component-count')).toHaveText(String(components))
  await expect(page.getByTestId('analysis-connected')).toHaveText(connected)
  await expect(page.getByTestId('analysis-reason')).toHaveText(body.current.connectivity.reason)
  await expect(page.getByTestId('analysis-source')).toHaveAttribute('data-source', 'backend')
  await expect(page.getByTestId('analysis-announcer')).toContainText(connected.toLowerCase())
}

/** Open the studio and let its own first analysis finish, so later waits catch only the response they cause. */
async function openStudio(page: Page) {
  await Promise.all([page.waitForResponse(isAnalyze), page.goto('/studio')])
}

const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`)
const edge = (page: Page, id: string) => page.getByTestId(`edge-${id}`)

test('Star: failing the hub gives 6 components and not connected; restoring reconnects', async ({ page, issues }) => {
  await openStudio(page)
  await expect(node(page, 'hub')).toBeVisible()
  // Star is the default graph, so load it from another preset to exercise the load.
  await loadPreset(page, 'Ring')
  const star = await loadPreset(page, 'Star')
  expect(star.current.connectivity.connected).toBe(true)
  expect(star.current.bridges.edgeIds).toHaveLength(6)

  await node(page, 'hub').click()
  const failed = await analysisAfter(page, () => page.getByRole('button', { name: 'Fail selected node' }).click())

  // Incident links are unavailable on the canvas while their own stored status stays healthy.
  await expect(edge(page, 'e-hub-srv')).toHaveAttribute('data-state', 'unavailable')
  await expect(page.getByTestId('failure-rule-note')).toContainText('Their own stored status does not change')
  await expect(node(page, 'hub').getByTestId('node-body')).toHaveAttribute('data-failed', 'true')
  await page.locator('.react-flow__edge[data-id="e-hub-srv"]').click({ force: true })
  await expect(page.getByTestId('stored-status')).toHaveText('Healthy')
  await expect(page.getByTestId('operational-status')).toHaveText('Unavailable (endpoint failed)')

  expect(failed.current.connectivity.reason).toBe('6 components')
  await expectOverview(page, failed, 'Not connected', 6)
  await tab(page, 'Compare')
  await expect(page.locator('[data-testid="analysis-compare"] [data-measure="Components"]')).toContainText('16 (changed)')

  await tab(page, 'Properties')
  await node(page, 'hub').click()
  const restored = await analysisAfter(page, () => page.getByRole('button', { name: 'Restore selected node' }).click())
  expect(restored.current.connectivity.connected).toBe(true)
  await expect(edge(page, 'e-hub-srv')).toHaveAttribute('data-state', 'bridge')
  await expect(page.getByTestId('failure-rule-note')).toHaveCount(0)
  await expectOverview(page, restored, 'Connected', 1)
  expect(issues).toEqual([])
})

test('Ring: failing one link keeps it connected, failing two disconnects it', async ({ page, issues }) => {
  await openStudio(page)
  await expect(node(page, 'hub')).toBeVisible()
  await loadPreset(page, 'Ring')

  await page.locator('.react-flow__edge[data-id="e-r1-r2"]').click({ force: true })
  const one = await analysisAfter(page, () => page.getByRole('button', { name: 'Fail selected edge' }).click())
  await expect(page.getByTestId('edge-cross-e-r1-r2')).toBeVisible()
  expect(one.current.connectivity.connected).toBe(true)
  expect(one.current.bridges.edgeIds).toHaveLength(5)

  await page.locator('.react-flow__edge[data-id="e-r4-r5"]').click({ force: true })
  const two = await analysisAfter(page, () => page.getByRole('button', { name: 'Fail selected edge' }).click())
  await expectOverview(page, two, 'Not connected', 2)

  // The canvas recolours from the backend's component map.
  await expect(node(page, 'r2').getByTestId('node-body')).toHaveAttribute('data-component', /^[01]$/)
  const a = await node(page, 'r2').getByTestId('node-body').getAttribute('data-component')
  const b = await node(page, 'r5').getByTestId('node-body').getAttribute('data-component')
  expect(a).not.toBe(b)

  // Components: clicking one highlights its members on the canvas.
  await tab(page, 'Components')
  await page.locator('[data-component-index="0"]').click()
  await expect(page.locator('[data-testid="node-body"][data-highlighted="true"]')).toHaveCount(3)

  await tab(page, 'Properties')
  const healed = await analysisAfter(page, () => page.getByRole('button', { name: 'Clear all failures' }).click())
  expect(healed.current.connectivity.connected).toBe(true)
  expect(issues).toEqual([])
})

test('path and traversal visuals appear on the canvas, from backend values', async ({ page, issues }) => {
  await openStudio(page)
  await expect(node(page, 'hub')).toBeVisible()
  await loadPreset(page, 'Ring')
  await tab(page, 'Analysis')

  await tab(page, 'Paths')
  await page.locator('#path-source').selectOption('r1')
  await analysisAfter(page, () => page.locator('#path-target').selectOption('r3').then(() => undefined))
  await expect(page.getByTestId('analysis-path')).toContainText('(2 hops)')
  await expect(node(page, 'r2').getByTestId('node-badge')).toHaveText('Path 2')
  await expect(edge(page, 'e-r1-r2')).toHaveAttribute('data-highlighted', 'true')
  await expect(edge(page, 'e-r2-r3')).toHaveAttribute('data-highlighted', 'true')
  await expect(edge(page, 'e-r4-r5')).toHaveAttribute('data-highlighted', 'false')

  await tab(page, 'Traversal')
  await analysisAfter(page, () => page.locator('#traversal-start').selectOption('r1').then(() => undefined))
  await expect(page.getByTestId('analysis-bfs')).toContainText('(0)')
  await expect(node(page, 'r1').getByTestId('node-badge')).toHaveText('BFS 1, layer 0')
  await expect(page.locator('[data-testid="node-badge"]')).toHaveCount(6)

  // Step, then play through to the end.
  await page.getByRole('button', { name: 'Next step' }).click()
  await expect(page.getByTestId('traversal-step')).toHaveText('Step 1 of 6')
  await expect(page.locator('[data-testid="node-badge"]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Next step' }).click()
  await expect(page.locator('[data-testid="node-badge"]')).toHaveCount(2)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByTestId('traversal-step')).toHaveText('Step 6 of 6')
  await expect(page.locator('[data-testid="node-badge"]')).toHaveCount(6)
  await page.getByRole('button', { name: 'DFS', exact: true }).click()
  await expect(node(page, 'r1').getByTestId('node-badge')).toHaveText('DFS 1')

  // Critical: click selects and highlights without leaving the analysis.
  await tab(page, 'Critical')
  await expect(page.getByTestId('analysis-bridges-none')).toBeVisible()
  await tab(page, 'Properties')
  await expect(page.locator('[data-testid="node-badge"]')).toHaveCount(0)
  expect(issues).toEqual([])
})

test('fail random is seeded and shown, and goes through the backend', async ({ page, issues }) => {
  await openStudio(page)
  await expect(node(page, 'hub')).toBeVisible()
  await page.locator('#random-seed').fill('7')
  const body = await analysisAfter(page, () => page.getByRole('button', { name: 'Fail random' }).click())
  const result = page.getByTestId('random-result')
  await expect(result).toContainText('(seed 7, draw 1)')
  const id = await result.getAttribute('data-id')
  const kind = await result.getAttribute('data-kind')
  if (kind === 'node') await expect(node(page, id ?? '').getByTestId('node-body')).toHaveAttribute('data-failed', 'true')
  else await expect(edge(page, id ?? '')).toHaveAttribute('data-state', 'failed')
  expect(body.current.summary.nodeCount).toBe(7)
  expect(issues).toEqual([])
})

test('dashboard values match the studio and the backend, and metrics link to their panels', async ({ page, issues }) => {
  await openStudio(page)
  await expect(node(page, 'hub')).toBeVisible()
  await node(page, 'hub').click()
  const body = await analysisAfter(page, () => page.getByRole('button', { name: 'Fail selected node' }).click())
  await tab(page, 'Analysis')
  await tab(page, 'Overview')
  const studio = {
    components: await page.getByTestId('analysis-component-count').textContent(),
    density: await page.getByTestId('analysis-density').textContent(),
    nodes: await page.getByTestId('analysis-node-count').textContent(),
    edges: await page.getByTestId('analysis-edge-count').textContent(),
  }
  await tab(page, 'Simulator')
  const [simResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/simulate')),
    page.getByRole('button', { name: 'Run Monte Carlo Simulation' }).click(),
  ])
  const sim = (await simResponse.json()) as { estimate: number }
  await expect(page.getByTestId('simulation-source')).toBeVisible()

  await page.getByRole('link', { name: 'Dashboard' }).first().click()
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByTestId('metric-components-value')).toHaveText(studio.components ?? '')
  await expect(page.getByTestId('metric-density-value')).toHaveText(studio.density ?? '')
  await expect(page.getByTestId('metric-nodes-value')).toHaveText(studio.nodes ?? '')
  await expect(page.getByTestId('metric-edges-value')).toHaveText(studio.edges ?? '')
  await expect(page.getByTestId('metric-components-value')).toHaveText(String(body.current.connectivity.componentCount))
  await expect(page.getByTestId('metric-connectivity-value')).toHaveText('Not connected')
  await expect(page.getByTestId('metric-bridges-value')).toHaveText(String(body.current.bridges.edgeIds.length))
  await expect(page.getByTestId('metric-articulation-value')).toHaveText(String(body.current.articulationPoints.nodeIds.length))
  await expect(page.getByTestId('metric-simulation-value')).toHaveText(`${(sim.estimate * 100).toFixed(1)}%`)
  await expect(page.getByTestId('dashboard-example')).toHaveText('Example: star network')
  await expect(page.locator('[data-testid="graph-minimap"] circle')).toHaveCount(7)
  await expect(page.locator('[data-testid="graph-minimap"] [data-node-id="srv"]')).toHaveAttribute('data-component', /\d/)

  await page.getByTestId('metric-bridges').click()
  await expect(page).toHaveURL(/section=critical/)
  await expect(page.getByTestId('section-critical')).toBeVisible()
  expect(issues).toEqual([])
})

test('weighted shortest path: offered when every link has a weight, sent to and answered by the backend', async ({ page, issues }) => {
  // Ring r1..r6 with one expensive link (r3-r4). By hops r1 to r4 is r1 r2 r3 r4; by weight it is r1 r6 r5 r4.
  const ids = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6']
  const workspace = {
    version: 5,
    savedAt: '2026-01-01T00:00:00.000Z',
    graph: {
      nodes: ids.map((id, i) => ({ id, label: id.toUpperCase(), nodeType: 'router', failed: false, position: { x: 300 * Math.cos(i), y: 300 * Math.sin(i) } })),
      edges: ids.map((id, i) => {
        const next = ids[(i + 1) % ids.length]
        return { id: `e-${id}-${next}`, source: id, target: next, failed: false, weight: id === 'r3' ? 10 : 1 }
      }),
      example: null,
      viewport: null,
    },
    settings: {
      edgeFailureProbability: 0.1, nodeFailureProbability: 0, trials: 100, seed: null, mode: 'all-terminal', traversalStart: null,
      pathSource: null, pathTarget: null, useWeights: false, terminalSource: null, terminalTarget: null, sweepPMin: 0, sweepPMax: 1, sweepPoints: 3, trialsPerPoint: 10,
    },
  }
  await page.addInitScript((v) => {
    if (sessionStorage.getItem('seeded') === null) {
      localStorage.setItem('netshield_workspace', v)
      sessionStorage.setItem('seeded', '1')
    }
  }, JSON.stringify(workspace))
  await openStudio(page)
  await expect(node(page, 'r1')).toBeVisible()
  await tab(page, 'Analysis')
  await tab(page, 'Paths')
  await page.locator('#path-source').selectOption('r1')
  const hops = await analysisAfter(page, () => page.locator('#path-target').selectOption('r4').then(() => undefined))
  const hopsPath = hops.current.path
  expect([hopsPath?.metric, hopsPath?.nodeIds]).toEqual(['hops', ['r1', 'r2', 'r3', 'r4']])
  await expect(page.getByTestId('analysis-path')).toContainText('R1 → R2 → R3 → R4 (3 hops)')

  const [response] = await Promise.all([page.waitForResponse(isAnalyze), page.getByTestId('path-use-weights').check()])
  expect((response.request().postDataJSON() as { useWeights?: boolean }).useWeights).toBe(true)
  const weighted = ((await response.json()) as Body).current.path
  expect([weighted?.metric, weighted?.nodeIds, weighted?.length]).toEqual(['weight', ['r1', 'r6', 'r5', 'r4'], 3])
  await expect(page.getByTestId('analysis-path')).toContainText('R1 → R6 → R5 → R4 (3 hops, total weight 3)')
  await expect(page.getByTestId('explain-shortest_path_weighted')).toBeVisible()
  for (const id of ['e-r6-r1', 'e-r5-r6', 'e-r4-r5']) await expect(edge(page, id)).toHaveAttribute('data-highlighted', 'true')
  await expect(edge(page, 'e-r1-r2')).toHaveAttribute('data-highlighted', 'false')

  // Removing one weight withdraws the option.
  await tab(page, 'Properties')
  await page.locator('.react-flow__edge[data-id="e-r1-r2"]').click({ force: true })
  await page.getByLabel('Weight').fill('')
  await page.getByLabel('Weight').blur()
  await tab(page, 'Analysis')
  await expect(page.getByTestId('path-use-weights')).toHaveCount(0)
  expect(issues).toEqual([])
})

test('Critical section: clicking a bridge or a cut vertex selects and highlights it on the canvas', async ({ page, issues }) => {
  await openStudio(page)
  await expect(node(page, 'hub')).toBeVisible()
  await tab(page, 'Analysis')
  await tab(page, 'Critical')
  await expect(page.locator('[data-testid="analysis-bridges"] li')).toHaveCount(6)

  await page.getByRole('button', { name: 'Core Router ↔ Client 1', exact: true }).click()
  await expect(edge(page, 'e-hub-c1')).toHaveAttribute('data-highlighted', 'true')
  await expect(edge(page, 'e-hub-c1')).toHaveAttribute('data-selected', 'true')
  await expect(page.getByRole('button', { name: 'Core Router ↔ Client 1', exact: true })).toHaveAttribute('aria-pressed', 'true')
  // The panel stays on the analysis while the canvas shows the selection.
  await expect(page.getByTestId('section-critical')).toBeVisible()

  await page.locator('[data-testid="analysis-articulation"]').getByRole('button', { name: 'Core Router', exact: true }).click()
  await expect(node(page, 'hub').getByTestId('node-body')).toHaveAttribute('data-highlighted', 'true')
  await expect(node(page, 'hub').getByTestId('node-body')).toHaveAttribute('data-selected', 'true')
  await expect(edge(page, 'e-hub-c1')).toHaveAttribute('data-highlighted', 'false')
  await expect(page.getByTestId('section-critical')).toBeVisible()
  expect(issues).toEqual([])
})
