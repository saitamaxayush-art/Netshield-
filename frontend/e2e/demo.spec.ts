/**
 * The demonstration network (Campus example) through every panel against the real backend, the way it
 * is presented: load it, read each analysis section, walk a traversal, compare the fewest hops and
 * weighted paths, fail its single point of failure, simulate, sweep, and open the dashboard. Bridges and
 * articulation points are checked against e2e/reference.ts, an independent naive implementation.
 */
import type { Response } from '@playwright/test'
import { expect, test } from './helpers'
import { reference } from './reference'
import { preset } from '../src/store/presets'

const isAnalyze = (r: Response) => r.url().endsWith('/api/analyze') && r.request().method() === 'POST'

test('Campus: every panel gives a readable, non empty result on the demonstration network', async ({ page, issues }) => {
  const campus = preset('campus')
  const expected = reference({
    nodes: campus.nodes.map((n) => ({ id: n.id, failed: false })),
    edges: campus.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, failed: false })),
  })
  // Chosen so that every section has something to show.
  expect(expected).toMatchObject({ components: 1, connected: true })
  expect([expected.bridges.length, expected.articulation.length]).toEqual([5, 5])

  await Promise.all([page.waitForResponse(isAnalyze), page.goto('/studio')])
  const tab = (name: string) => page.getByRole('button', { name, exact: true }).click()
  await page.getByTestId('studio-toolbar').getByRole('button', { name: 'Campus', exact: true }).click()
  await Promise.all([page.waitForResponse(isAnalyze), page.getByRole('dialog').last().getByRole('button', { name: 'Load Campus example' }).click()])
  await expect(page.getByTestId('example-label')).toHaveText('Example: campus network')
  await expect(page.locator('.react-flow__node')).toHaveCount(10)
  await expect(page.locator('.react-flow__edge')).toHaveCount(12)

  await tab('Analysis')
  await expect(page.getByTestId('analysis-source')).toHaveText('FastAPI NetworkX')
  await expect(page.getByTestId('analysis-connected')).toHaveText('Connected')
  await expect(page.getByTestId('analysis-density')).toHaveText(expected.density.toFixed(4))
  await tab('Components')
  await expect(page.getByTestId('analysis-components')).toContainText('C0 (10 nodes)')
  await tab('Critical')
  const ids = (sel: string, attr: string) => page.locator(`${sel} li`).evaluateAll((els, a) => els.map((e) => e.getAttribute(a) ?? '').sort(), attr)
  expect(await ids('[data-testid="analysis-bridges"]', 'data-edge-id')).toEqual(expected.bridges)
  expect(await ids('[data-testid="analysis-articulation"]', 'data-node-id')).toEqual(expected.articulation)
  await expect(page.getByTestId('analysis-bridges')).toContainText('Core B ↔ Library Switch')
  await tab('Degrees')
  await expect(page.getByTestId('analysis-degrees').locator('tbody tr')).toHaveCount(10)
  await expect(page.getByTestId('analysis-degrees').locator('tbody tr').first()).toContainText('4')

  await tab('Traversal')
  await Promise.all([page.waitForResponse(isAnalyze), page.locator('#traversal-start').selectOption('gw')])
  await expect(page.getByTestId('analysis-bfs')).toContainText('Internet Gateway (0) → Edge Router (1)')
  await expect(page.getByTestId('analysis-dfs')).toContainText('Internet Gateway')

  await tab('Paths')
  await page.locator('#path-source').selectOption('gw')
  await Promise.all([page.waitForResponse(isAnalyze), page.locator('#path-target').selectOption('lib-pc')])
  await expect(page.getByTestId('analysis-path')).toContainText('Internet Gateway → Edge Router → Core B → Library Switch → Library PC (4 hops)')
  await Promise.all([page.waitForResponse(isAnalyze), page.getByTestId('path-use-weights').check()])
  await expect(page.getByTestId('analysis-path')).toContainText('Internet Gateway → Edge Router → Core A → Core B → Library Switch → Library PC (5 hops, total weight 5)')

  // Fail the single point of failure behind the gateway: Compare shows the change.
  await page.locator('.react-flow__node[data-id="edge"] [data-testid="node-body"]').click()
  await tab('Properties')
  await Promise.all([page.waitForResponse(isAnalyze), page.getByRole('button', { name: 'Fail selected node' }).click()])
  await tab('Analysis')
  await tab('Compare')
  const compare = page.getByTestId('analysis-compare')
  await expect(compare.locator('tr', { hasText: 'Components' })).toContainText('1')
  await expect(compare.locator('tr', { hasText: 'Components' })).toContainText('2')
  await page.locator('.react-flow__node[data-id="edge"] [data-testid="node-body"]').click()
  await tab('Properties')
  await Promise.all([page.waitForResponse(isAnalyze), page.getByRole('button', { name: 'Restore selected node' }).click()])

  await tab('Simulator')
  await page.locator('#seed').fill('2026')
  await page.locator('#seed').press('Enter')
  await page.getByRole('button', { name: 'Run Monte Carlo Simulation' }).click()
  await expect(page.getByTestId('simulation-reliability')).toHaveText(/^\d+\.\d%$/)
  // The critical link is named after its endpoints, not only its id.
  await expect(page.getByTestId('simulation-critical-edge')).toHaveText(/^.+ ↔ .+ \(e-[a-z-]+\), pivotal in \d+\.\d% of trials$/)
  await page.getByRole('button', { name: 'Run Reliability Sweep' }).click()
  for (const id of ['chart-trials', 'chart-histogram', 'chart-sweep', 'chart-compare']) await expect(page.getByTestId(id).locator('.recharts-wrapper')).toHaveCount(1)

  await page.getByRole('link', { name: 'Dashboard' }).first().click()
  await expect(page.getByTestId('metric-nodes-value')).toHaveText('10')
  await expect(page.getByTestId('metric-bridges-value')).toHaveText('5')
  await expect(page.getByTestId('metric-articulation-value')).toHaveText('5')
  expect(issues).toEqual([])
})
