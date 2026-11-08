import { test, expect, open, goToSection } from './helpers'
import { analyzeNetwork, bfsLayers, buildActiveGraph, createReliabilityRun, dfsTraversal, findShortestPath } from '../src/lib/graphAlgorithms'
import { createMulberry32, generateHeroGraph, generateLatticeGraph, generatePreset, generateReliabilityExample } from '../src/lib/seededGraphGenerator'

const readout = (scope: import('@playwright/test').Locator) =>
  scope.locator('.ns-readout > div').evaluateAll((cells) =>
    Object.fromEntries(cells.map((c) => [c.querySelector('dt')!.textContent!.trim(), (c.querySelector('dd [data-value]') as HTMLElement | null)?.dataset.value ?? c.querySelector('dd')!.textContent!.trim()]))
  )
const pad2 = (n: number) => String(n).padStart(2, '0')

test.describe('sandbox', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('mouse: fail a bridge, a node, drag, reset; readout matches the shared analysis', async ({ page, issues }) => {
    await open(page)
    await goToSection(page, 'sandbox')
    const box = page.getByTestId('sandbox')
    const mesh = generatePreset('mesh', 7)
    const base = analyzeNetwork(mesh.nodes, mesh.edges)
    expect(await readout(box)).toMatchObject({ Components: pad2(base.components.length), Bridges: pad2(base.bridgeEdgeIds.size), 'Articulation pts': pad2(base.articulationPoints.size), Status: 'Connected' })

    // Fail the bridge edge (the pendant link).
    const bridgeId = [...base.bridgeEdgeIds][0]
    await box.locator(`[data-hit="edge"][data-id="${bridgeId}"]`).click()
    const a1 = analyzeNetwork(mesh.nodes, mesh.edges, new Set(), new Set([bridgeId]))
    await expect.poll(() => readout(box)).toMatchObject({ Components: pad2(a1.components.length), Bridges: pad2(a1.bridgeEdgeIds.size), Status: 'Disconnected' })
    await expect(box.locator(`[data-hit="edge"][data-id="${bridgeId}"]`)).toHaveAttribute('aria-pressed', 'true')
    await expect(box.locator(`[data-hit="edge"][data-id="${bridgeId}"] .ns-e-failed`)).toHaveAttribute('stroke-dasharray', '5 6')

    // Fail node E as well.
    await box.locator('[data-hit="node"][data-id="E"]').click()
    const a2 = analyzeNetwork(mesh.nodes, mesh.edges, new Set(['E']), new Set([bridgeId]))
    await expect.poll(() => readout(box)).toMatchObject({ Components: pad2(a2.components.length), Bridges: pad2(a2.bridgeEdgeIds.size), 'Articulation pts': pad2(a2.articulationPoints.size) })
    await expect(box.locator('[data-hit="node"][data-id="E"] .ns-cross')).toHaveCount(1)
    await expect(page.locator('#sandbox [aria-live="polite"]')).toContainText('Node E failed')

    // Drag node A: moves, does not toggle failure.
    const a = box.locator('[data-hit="node"][data-id="A"] circle[r="20"]')
    const before = await a.boundingBox()
    await page.mouse.move(before!.x + 20, before!.y + 20)
    await page.mouse.down()
    await page.mouse.move(before!.x + 80, before!.y + 60, { steps: 8 })
    await page.mouse.up()
    const after = await a.boundingBox()
    expect(after!.x - before!.x).toBeGreaterThan(40)
    await expect(box.locator('[data-hit="node"][data-id="A"]')).toHaveAttribute('aria-pressed', 'false')

    await box.getByRole('button', { name: 'Reset' }).click()
    await expect.poll(() => readout(box)).toMatchObject({ Components: '01', Status: 'Connected' })

    // Presets.
    for (const kind of ['star', 'ring'] as const) {
      const g = generatePreset(kind, 7)
      const an = analyzeNetwork(g.nodes, g.edges)
      await box.getByRole('radio', { name: g.name }).click()
      await expect.poll(() => readout(box)).toMatchObject({ Bridges: pad2(an.bridgeEdgeIds.size), 'Articulation pts': pad2(an.articulationPoints.size) })
    }
    expect(issues).toEqual([])
  })

  test('keyboard: arrows move selection, Enter fails, Space restores', async ({ page, issues }) => {
    await open(page)
    await goToSection(page, 'sandbox')
    const box = page.getByTestId('sandbox')
    await box.locator('[data-hit][tabindex="0"]').first().focus()
    const first = await page.evaluate(() => (document.activeElement as HTMLElement).dataset.id)
    await page.keyboard.press('ArrowRight')
    const second = await page.evaluate(() => (document.activeElement as HTMLElement).dataset.id)
    expect(second).not.toBe(first)
    await page.keyboard.press('Enter')
    await expect(page.locator(`[data-hit][data-id="${second}"]`)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('#sandbox [aria-live="polite"]')).toContainText('failed')
    await page.keyboard.press(' ')
    await expect(page.locator(`[data-hit][data-id="${second}"]`)).toHaveAttribute('aria-pressed', 'false')
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
    expect(issues).toEqual([])
  })
})

test.describe('touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('tap fails a link and a node; tap again restores', async ({ page, issues }) => {
    await open(page)
    await goToSection(page, 'sandbox')
    const box = page.getByTestId('sandbox')
    await box.scrollIntoViewIfNeeded()
    const mesh = generatePreset('mesh', 7)
    const bridgeId = [...analyzeNetwork(mesh.nodes, mesh.edges).bridgeEdgeIds][0]
    await box.locator(`[data-hit="edge"][data-id="${bridgeId}"] line`).first().tap()
    await expect.poll(() => readout(box)).toMatchObject({ Components: '02' })
    await box.locator('[data-hit="node"][data-id="B"] circle[r="20"]').tap()
    await expect(box.locator('[data-hit="node"][data-id="B"]')).toHaveAttribute('aria-pressed', 'true')
    await box.locator('[data-hit="node"][data-id="B"] circle[r="20"]').tap()
    await expect(box.locator('[data-hit="node"][data-id="B"]')).toHaveAttribute('aria-pressed', 'false')
    expect(issues).toEqual([])
  })

  test('how it works is stacked on mobile and driven by buttons', async ({ page, issues }) => {
    await open(page)
    await goToSection(page, 'how')
    expect(await page.locator('.pin-spacer').count()).toBe(0)
    const story = page.locator('#how')
    await story.getByRole('button', { name: 'Next step' }).tap()
    await story.getByRole('button', { name: 'Next step' }).tap()
    await expect(story.locator('[aria-live="polite"]')).toContainText('Step 3 of 3')
    const g = generateLatticeGraph(5, 5, 3, 0.86, 0.28)
    const r = await readout(story)
    // Step 3 shows one failed node and one failed link chosen by the shared analysis.
    expect(Number(r['Nodes up'])).toBe(g.nodes.length - 1)
    expect(Number(r['Components'])).toBeGreaterThan(1)
    expect(issues).toEqual([])
  })
})

test.describe('widgets', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('topologies: words select graphs; properties match the shared utilities', async ({ page, issues }) => {
    await open(page)
    await goToSection(page, 'topologies')
    const panel = page.locator('#topology-panel')
    for (const [i, kind] of (['star', 'ring', 'mesh'] as const).entries()) {
      const g = generatePreset(kind, 7)
      const a = analyzeNetwork(g.nodes, g.edges)
      if (i > 0) await page.keyboard.press('ArrowDown')
      else await page.getByRole('tab', { name: /Star/ }).focus()
      await expect(page.getByRole('tab', { name: new RegExp(g.name) })).toHaveAttribute('aria-selected', 'true')
      await expect.poll(() => readout(panel)).toEqual({ Nodes: pad2(g.nodes.length), Edges: pad2(g.edges.length), Density: a.density.toFixed(2), Bridges: pad2(a.bridgeEdgeIds.size) })
    }
    // Mouse: click the word showing on the row below Mesh (the drum wraps to Star).
    await page.evaluate(() => document.querySelector('.ns-words')!.scrollIntoView({ block: 'center', behavior: 'instant' }))
    // Let the 800ms drum travel finish so the rows sit at rest.
    await page.waitForTimeout(1200)
    const wb = (await page.locator('.ns-words').boundingBox())!
    await page.mouse.click(wb.x + 80, wb.y + (wb.height * 5) / 6)
    await expect(page.getByRole('tab', { name: /Star/ })).toHaveAttribute('aria-selected', 'true')
    await page.waitForTimeout(1200)
    await page.mouse.click(wb.x + 80, wb.y + wb.height / 6)
    await expect(page.getByRole('tab', { name: /Mesh/ })).toHaveAttribute('aria-selected', 'true')
    expect(issues).toEqual([])
  })

  test('estimator: 5000 trials match a seeded run, UI stays responsive, cancel works', async ({ page, issues }) => {
    await open(page)
    await goToSection(page, 'reliability', 400)
    const est = page.getByTestId('estimator')
    const g = generateReliabilityExample()
    // The first run starts on view (run id 1, seed 2025, 1000 trials, p 0.10).
    await expect(page.getByRole('button', { name: 'Run trials' })).toBeEnabled({ timeout: 15000 })
    const auto = createReliabilityRun(g.nodes, g.edges, 0.1, createMulberry32(2025)).step(1000)
    await expect(est.getByTestId('estimate')).toHaveText(auto.estimate.toFixed(3))
    // The live estimate reaches its final value with the last progress batch, a moment before the run
    // reports done and unlocks the slider; arrow keys sent before that land on a disabled input.
    await expect(page.locator('#pfail')).toBeEnabled()

    // Keyboard: slider to 0.20 with arrow keys.
    await page.locator('#pfail').focus()
    for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight')
    await expect(page.locator('output[for="pfail"]')).toHaveText('p = 0.20')
    await page.getByRole('radio', { name: '5000' }).click()

    await page.evaluate(() => (window.__longtasks.length = 0))
    await page.getByRole('button', { name: 'Run trials' }).click()
    await expect(page.getByRole('button', { name: 'Running' })).toBeDisabled()
    // Main thread stays free while the worker runs: measure input to frame latency mid run.
    const latency = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const t0 = performance.now()
          requestAnimationFrame(() => resolve(performance.now() - t0))
        })
    )
    expect(latency).toBeLessThan(50)
    await expect(page.getByRole('button', { name: 'Run trials' })).toBeEnabled({ timeout: 20000 })
    const expected = createReliabilityRun(g.nodes, g.edges, 0.2, createMulberry32(2026)).step(5000)
    await expect(est.getByTestId('estimate')).toHaveText(expected.estimate.toFixed(3))
    await expect(est.getByTestId('trial-count').locator('[data-value]')).toHaveAttribute('data-value', '5000')
    const longtasks = await page.evaluate(() => window.__longtasks)
    expect(longtasks.filter((d) => d > 50), `long tasks ${longtasks.join(', ')}`).toEqual([])

    // Sweep finished with all 11 real runs.
    await expect(est.getByText('11 of 11 runs')).toBeVisible({ timeout: 15000 })

    // Cancel mid run.
    await page.getByRole('button', { name: 'Run trials' }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.locator('#reliability [aria-live="polite"]')).toHaveText('Run cancelled.')
    await expect(page.getByRole('button', { name: 'Run trials' })).toBeEnabled()
    expect(issues).toEqual([])
  })

  test('explorer: BFS layers and path, DFS order match the shared utilities', async ({ page, issues }) => {
    await open(page)
    await goToSection(page, 'paths')
    const g = generateLatticeGraph(11, 5, 3, 0.84, 0.2)
    const active = buildActiveGraph(g.nodes, g.edges, new Set(), new Set())
    const status = page.getByTestId('explorer-status')
    const src = g.nodes[0].id
    const dst = g.nodes[g.nodes.length - 1].id
    const { layer } = bfsLayers(active, src)
    const depth = Math.max(...layer.values())
    for (let i = 0; i <= depth + 1; i++) await page.getByTestId('step').click()
    const path = findShortestPath(active, src, dst)!
    await expect(status).toHaveText(`Shortest path ${src} to ${dst}: ${path.length - 1} hops, ${path.join(', ')}.`)
    // Badges show BFS layers.
    const badges = await page.locator('[data-testid="explorer"] [data-hit="node"]').evaluateAll((gs) => Object.fromEntries(gs.map((n) => [(n as HTMLElement).dataset.id, n.querySelector('.ns-g-badge')?.textContent ?? null])))
    for (const [id, l] of layer) expect(badges[id]).toBe(String(l))

    // DFS via keyboard on the radio group, then play to the end.
    await page.getByRole('radio', { name: 'Depth first' }).focus()
    await page.keyboard.press('Enter')
    await page.getByRole('radio', { name: '2x' }).click()
    await page.getByTestId('play').click()
    const order = dfsTraversal(active, src)
    await expect(status).toContainText(`DFS tree path ${src} to ${dst}`, { timeout: 15000 })
    const dfsBadges = await page.locator('[data-testid="explorer"] [data-hit="node"]').evaluateAll((gs) => Object.fromEntries(gs.map((n) => [(n as HTMLElement).dataset.id, n.querySelector('.ns-g-badge')?.textContent ?? null])))
    order.forEach((id, i) => expect(dfsBadges[id]).toBe(String(i + 1)))

    // Pick new endpoints by clicking nodes.
    await page.locator('[data-testid="explorer"] [data-hit="node"][data-id="C"] circle[r="20"]').click()
    await page.locator('[data-testid="explorer"] [data-hit="node"][data-id="K"] circle[r="20"]').click()
    await expect(status).toHaveText('Ready. Depth first search from C to K.')
    expect(issues).toEqual([])
  })

  test('method pages: buttons, tabs and arrow keys', async ({ page, issues }) => {
    await open(page)
    await goToSection(page, 'method')
    const m = page.locator('#method')
    await m.getByRole('button', { name: 'Next page' }).click()
    await expect(m.getByRole('tabpanel')).toContainText('Failures and trials')
    await m.getByRole('tab', { name: '02' }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(m.getByRole('tabpanel')).toContainText('Estimate and uncertainty')
    await expect(m.getByRole('button', { name: 'Next page' })).toBeDisabled()
    expect(issues).toEqual([])
  })

  test('how it works: pinned on desktop; step buttons scroll to their state', async ({ page, issues }) => {
    await open(page)
    await goToSection(page, 'how')
    expect(await page.locator('.pin-spacer').count()).toBe(1)
    await page.locator('#how').getByRole('button', { name: '03, Measure connectivity' }).click()
    await expect(page.locator('#how [aria-live="polite"]')).toHaveText('Step 3 of 3: Measure connectivity.', { timeout: 5000 })
    await page.locator('#how').getByRole('button', { name: 'Previous step' }).click()
    await expect(page.locator('#how [aria-live="polite"]')).toHaveText('Step 2 of 3: Introduce failures.', { timeout: 5000 })
    expect(issues).toEqual([])
  })

  test('hero: hovering a node shows its computed degree', async ({ page, issues }) => {
    await open(page, '/?hero=svg')
    const hero = generateHeroGraph(1729, 64)
    const a = analyzeNetwork(hero.nodes.map((n) => ({ id: n.id, label: n.id })), hero.edges)
    const rect = (await page.locator('#top').boundingBox())!
    let found = ''
    // Sweep the right half of the hero until the tooltip appears.
    for (let y = rect.y + 120; y < rect.y + rect.height - 100 && !found; y += 6) {
      for (let x = rect.x + rect.width * 0.55; x < rect.x + rect.width - 40 && !found; x += 6) {
        await page.mouse.move(x, y)
        const t = await page.locator('.ns-hero__scene .ns-tooltip').textContent()
        if (t) found = t
      }
    }
    expect(found).toMatch(/^Node \d+, degree \d+$/)
    const [, n, d] = found.match(/^Node (\d+), degree (\d+)$/)!
    expect(Number(d)).toBe(a.degrees[`h${n}`])
    expect(issues).toEqual([])
  })

  test('menu overlay: focus trap, Escape, focus restore, no layout shift', async ({ page, issues }) => {
    await open(page)
    await goToSection(page, 'topologies')
    const w0 = await page.evaluate(() => document.querySelector('.ns-landing')!.getBoundingClientRect().width)
    const trigger = page.getByRole('button', { name: 'Open menu' })
    await page.mouse.wheel(0, -200)
    await page.waitForTimeout(900)
    const y0 = await page.evaluate(() => window.scrollY)
    await trigger.click()
    const dialog = page.getByRole('dialog', { name: 'Site menu' })
    await expect(dialog).toBeVisible()
    await page.waitForTimeout(400)
    expect(await page.evaluate(() => document.querySelector('.ns-menu')!.contains(document.activeElement))).toBe(true)
    for (let i = 0; i < 16; i++) await page.keyboard.press('Tab')
    expect(await page.evaluate(() => document.querySelector('.ns-menu')!.contains(document.activeElement))).toBe(true)
    expect(await page.evaluate(() => document.querySelector('.ns-landing')!.getBoundingClientRect().width)).toBe(w0)
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - y0)).toBeLessThanOrEqual(2)
    expect(issues).toEqual([])
  })
})
