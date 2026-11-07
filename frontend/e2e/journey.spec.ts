/**
 * The full user journey against the real backend, at desktop and phone widths, in every configured
 * browser. Expected analysis values come from e2e/reference.ts, an independent naive implementation.
 */
import { readFileSync } from 'node:fs'
import type { Locator, Page, Response } from '@playwright/test'
import { expect, test } from './helpers'
import { reference, type RefGraph } from './reference'

const isAnalyze = (r: Response) => r.url().endsWith('/api/analyze') && r.request().method() === 'POST'

// The Mesh example as the studio defines it (src/store/presets.ts).
const MESH: RefGraph = {
  nodes: ['g1', 'core', 'g2', 'db', 'app', 'agg'].map((id) => ({ id, failed: false })),
  edges: [
    ['e-g1-core', 'g1', 'core'],
    ['e-core-g2', 'core', 'g2'],
    ['e-g1-db', 'g1', 'db'],
    ['e-core-db', 'core', 'db'],
    ['e-core-app', 'core', 'app'],
    ['e-g2-app', 'g2', 'app'],
    ['e-db-app', 'db', 'app'],
    ['e-db-agg', 'db', 'agg'],
    ['e-app-agg', 'app', 'agg'],
  ].map(([id, source, target]) => ({ id, source, target, failed: false })),
}

for (const mode of ['desktop', 'phone'] as const) {
  test.describe(`${mode} journey`, () => {
    const phone = mode === 'phone'
    test.use(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : { viewport: { width: 1440, height: 900 } })

    const press = (l: Locator) => (phone ? l.tap() : l.click())
    const toolbar = (page: Page) => page.getByTestId('studio-toolbar')
    async function tool(page: Page, name: string) {
      if (phone) await press(toolbar(page).getByRole('button', { name: 'Tools' }))
      await press((phone ? page.getByTestId('tools-sheet') : toolbar(page)).getByRole('button', { name, exact: true }))
    }
    /** On a phone the panels live in a sheet; open it at a tab. */
    async function panel(page: Page, name: 'Properties' | 'Analysis' | 'Simulator') {
      if (phone && (await page.getByTestId('details-sheet').count()) === 0) await press(toolbar(page).getByRole('button', { name: 'Details and analysis' }))
      await press(page.getByRole('button', { name, exact: true }))
    }
    async function closePanel(page: Page) {
      if (phone && (await page.getByTestId('details-sheet').count()) > 0) await press(page.getByRole('button', { name: 'Close Details and analysis' }))
    }
    async function select(page: Page, kind: 'node' | 'edge', id: string) {
      await closePanel(page)
      const target = kind === 'node' ? page.locator(`.react-flow__node[data-id="${id}"] [data-testid="node-body"]`) : page.locator(`.react-flow__edge[data-id="${id}"]`)
      // Edges are thin SVG paths: click their interaction stroke even if a label overlaps.
      if (kind === 'edge') await target.click({ force: true })
      else await press(target)
    }
    async function expectAnalysisMatches(page: Page, graph: RefGraph) {
      const expected = reference(graph)
      await panel(page, 'Analysis')
      await press(page.getByRole('button', { name: 'Overview', exact: true }))
      await expect(page.getByTestId('analysis-stale')).toHaveCount(0)
      await expect(page.getByTestId('analysis-component-count')).toHaveText(String(expected.components))
      await expect(page.getByTestId('analysis-connected')).toHaveText(expected.connected ? 'Connected' : 'Not connected')
      await expect(page.getByTestId('analysis-density')).toHaveText(expected.density.toFixed(4))
      await press(page.getByRole('button', { name: 'Critical', exact: true }))
      const bridges = await page.locator('[data-testid="analysis-bridges"] li').evaluateAll((els) => els.map((e) => e.getAttribute('data-edge-id') ?? ''))
      const cut = await page.locator('[data-testid="analysis-articulation"] li').evaluateAll((els) => els.map((e) => e.getAttribute('data-node-id') ?? ''))
      expect([...bridges].sort()).toEqual(expected.bridges)
      expect([...cut].sort()).toEqual(expected.articulation)
      return expected
    }

    test('landing, Mesh, analysis, failures, simulation, charts, CSV, reload, clear saved data', async ({ page, issues, browserName }) => {
      // Landing to studio without a theme flash: only the landing and app backgrounds may show.
      await page.goto('/')
      await page.evaluate(() => {
        window.__bgs = []
        const sample = () => {
          window.__bgs.push(getComputedStyle(document.body).backgroundColor)
          if (window.__bgs.length < 60) requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
      })
      await page.locator('.ns-header').getByRole('link', { name: 'Open Simulator' }).first().click()
      await page.waitForURL('**/studio')
      await expect(page.locator('.react-flow__node')).toHaveCount(7)
      for (const bg of new Set(await page.evaluate(() => window.__bgs))) expect(['rgb(23, 24, 27)', 'rgb(19, 21, 31)', 'rgb(243, 245, 247)', 'rgb(18, 19, 21)']).toContain(bg)

      // Load Mesh (it asks first: the canvas is not empty).
      await tool(page, 'Mesh')
      const [loaded] = await Promise.all([page.waitForResponse(isAnalyze), press(page.getByRole('dialog').last().getByRole('button', { name: 'Load Mesh example' }))])
      expect(loaded.status()).toBe(200)
      await expect(page.getByTestId('example-label')).toHaveText('Example: partial mesh')
      await expect(page.locator('.react-flow__node')).toHaveCount(6)

      // Run analysis explicitly too, and compare with the reference.
      const graph: RefGraph = structuredClone(MESH)
      await panel(page, 'Analysis')
      await Promise.all([page.waitForResponse(isAnalyze), press(page.getByRole('button', { name: 'Compute Graph Metrics' }))])
      const healthy = await expectAnalysisMatches(page, graph)
      expect(healthy).toMatchObject({ components: 1, connected: true, bridges: [], articulation: [] })

      // Fail two nodes and a link; each change is analyzed by the backend and must match the reference.
      for (const [kind, id] of [['node', 'core'], ['node', 'agg'], ['edge', 'e-g1-db']] as const) {
        await select(page, kind, id)
        await panel(page, 'Properties')
        await Promise.all([page.waitForResponse(isAnalyze), press(page.getByRole('button', { name: `Fail selected ${kind}` }))])
        if (kind === 'node') graph.nodes.forEach((n) => n.id === id && (n.failed = true))
        else graph.edges.forEach((e) => e.id === id && (e.failed = true))
        await expectAnalysisMatches(page, graph)
      }
      const failed = reference(graph)
      // Hand checked: with core and agg down and g1-db cut, g1 is isolated and db-app-g2 is a path.
      expect(failed).toMatchObject({ components: 2, connected: false, bridges: ['e-db-app', 'e-g2-app'], articulation: ['app'] })

      // Simulation and every chart, each with its data table.
      await panel(page, 'Simulator')
      await page.locator('#seed').fill('2026')
      await page.locator('#seed').press('Enter')
      await press(page.getByRole('button', { name: 'Run Monte Carlo Simulation' }))
      await expect(page.getByTestId('simulation-results')).toBeVisible()
      await expect(page.getByTestId('simulation-seed')).toHaveText('2026')
      await press(page.getByRole('button', { name: 'Run Reliability Sweep' }))
      await expect(page.getByTestId('chart-sweep')).toBeVisible()
      for (const id of ['chart-trials', 'chart-histogram', 'chart-sweep', 'chart-compare']) {
        const chart = page.getByTestId(id)
        await chart.scrollIntoViewIfNeeded()
        await expect(chart.locator('.recharts-wrapper').first()).toBeVisible()
        await press(chart.getByRole('button', { name: 'View data table' }))
        await expect(page.getByTestId(`${id}-table`)).toBeVisible()
      }

      // CSV export with the seed and the backend's assumptions.
      const [csv] = await Promise.all([page.waitForEvent('download'), press(page.getByRole('button', { name: 'Download CSV' }))])
      const text = readFileSync(await csv.path(), 'utf8')
      expect(text).toContain('run seed,2026')
      expect(text).toContain('assumption')
      expect(text).toContain('sweep')

      // Reload: graph, failures and example label persist; results do not; analysis matches again.
      await page.waitForTimeout(500)
      await page.reload()
      await expect(page.locator('.react-flow__node')).toHaveCount(6)
      await expect(page.locator('.react-flow__node[data-id="core"] [data-testid="node-body"]')).toHaveAttribute('data-failed', 'true')
      await expect(page.getByTestId('example-label')).toHaveText('Example: partial mesh')
      await panel(page, 'Simulator')
      await expect(page.getByTestId('simulation-results')).toHaveCount(0)
      await expectAnalysisMatches(page, graph)

      // Clear saved data: back to the star example, and the user's graph is gone from storage.
      await closePanel(page)
      await tool(page, 'Import or export')
      await press(page.getByTestId('graph-data-dialog').getByRole('button', { name: 'Clear saved data' }))
      await press(page.getByRole('dialog').last().getByRole('button', { name: 'Clear saved data' }))
      await expect(page.locator('.react-flow__node')).toHaveCount(7)
      await expect(page.getByTestId('example-label')).toHaveText('Example: star network')
      await page.waitForTimeout(700)
      expect(await page.evaluate(() => localStorage.getItem('netshield_workspace') ?? '')).not.toContain('"core"')
      // Known WebKit only limitation (FINAL_REPORT.md, PROJECT_AUDIT.md 9.6): WebKit does not match the
      // landing page's font preloads to the font requests and warns about each of the four. Nothing else is allowed.
      const preloadWarning = /^console\.warning: The resource http:\/\/localhost:4317\/landing-fonts\/[a-z0-9-]+\.woff2 was preloaded using link preload but not used/
      expect(issues.filter((i) => !(browserName === 'webkit' && preloadWarning.test(i)))).toEqual([])
    })

    test('Privacy and Terms from the footer and directly, and the 404 page', async ({ page, issues }) => {
      await page.goto('/dashboard')
      const footer = page.locator('footer')
      await press(footer.getByRole('link', { name: 'Privacy Policy' }))
      await expect(page).toHaveURL(/\/privacy$/)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Privacy Policy')
      await press(page.locator('footer').getByRole('link', { name: 'Terms of Use' }))
      await expect(page).toHaveURL(/\/terms$/)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      for (const path of ['/privacy', '/terms']) {
        await page.goto(path)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      }
      const missing = await page.goto('/this/page/does/not/exist')
      expect(missing?.status()).toBe(200)
      await expect(page.locator('main')).toContainText('404')
      await press(page.getByRole('link', { name: /studio|dashboard|home/i }).first())
      await expect(page).not.toHaveURL(/does\/not\/exist/)
      expect(issues).toEqual([])
    })
  })
}
