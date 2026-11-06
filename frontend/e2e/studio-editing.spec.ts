/**
 * Network Studio editing against the real stores and backend, at desktop and phone widths.
 * The `issues` fixture fails on any console error.
 */
import { devices, type Locator, type Page } from '@playwright/test'
import { expect, test } from './helpers'

const nodes = (page: Page) => page.locator('.react-flow__node')
const edges = (page: Page) => page.locator('.react-flow__edge')
const handle = (page: Page, id: string, side: string) => page.locator(`.react-flow__node[data-id="${id}"] .react-flow__handle[data-handleid="${side}"]`)
const toolbar = (page: Page) => page.getByTestId('studio-toolbar')
const saved = (page: Page) => page.evaluate(() => localStorage.getItem('netshield_workspace') ?? '')

async function centre(l: Locator) {
  const b = await l.boundingBox()
  if (!b) throw new Error('not visible')
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

async function dragHandle(page: Page, from: Locator, to: Locator) {
  const a = await centre(from)
  const b = await centre(to)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 })
  await page.mouse.move(b.x, b.y, { steps: 4 })
  await page.mouse.up()
}

for (const mode of ['desktop', 'phone'] as const) {
  test.describe(`${mode} editing`, () => {
    const phone = mode === 'phone'
    test.use(phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, userAgent: devices['iPhone 13'].userAgent } : { viewport: { width: 1440, height: 900 } })

    /** Run a tool that lives in the toolbar on desktop and in the Tools sheet on a phone. */
    async function tool(page: Page, name: string) {
      if (phone) await toolbar(page).getByRole('button', { name: 'Tools' }).tap()
      const scope = phone ? page.getByTestId('tools-sheet') : toolbar(page)
      const button = scope.getByRole('button', { name, exact: true })
      if (phone) await button.tap()
      else await button.click()
    }
    const press = async (l: Locator) => (phone ? l.tap() : l.click())
    async function connect(page: Page, a: string, aSide: string, b: string, bSide: string) {
      if (phone) {
        await handle(page, a, aSide).tap()
        await handle(page, b, bSide).tap()
      } else await dragHandle(page, handle(page, a, aSide), handle(page, b, bSide))
    }
    const fit = async (page: Page) => {
      await press(toolbar(page).getByRole('button', { name: 'Fit view' }))
      await page.waitForTimeout(150)
    }

    test('add, connect, validate, delete, undo, reload', async ({ page, issues }) => {
      await page.goto('/studio')
      await expect(nodes(page)).toHaveCount(7)

      await tool(page, 'Reset canvas')
      await press(page.getByRole('dialog').last().getByRole('button', { name: 'Reset canvas' }))
      if (phone) await expect(page.getByTestId('tools-sheet')).toHaveCount(0)
      await expect(nodes(page)).toHaveCount(0)
      await expect(page.getByTestId('empty-canvas')).toBeVisible()

      await press(page.getByRole('button', { name: 'Add node' }))
      await expect(page.getByTestId('empty-canvas')).toHaveCount(0)
      await tool(page, 'Server')
      await tool(page, 'Client')
      await expect(nodes(page)).toHaveCount(3)
      await fit(page)
      await expect(handle(page, 'router-1', 'top')).toHaveCount(1)
      await expect(page.locator('.react-flow__node[data-id="router-1"] .react-flow__handle')).toHaveCount(4)

      await connect(page, 'router-1', 'right', 'server-1', 'left')
      await expect(edges(page)).toHaveCount(1)
      await connect(page, 'server-1', 'right', 'client-1', 'left')
      await expect(edges(page)).toHaveCount(2)

      // Refused with a reason, no console error.
      await connect(page, 'router-1', 'right', 'router-1', 'top')
      await expect(page.getByTestId('studio-toast')).toContainText('no self loops')
      await connect(page, 'server-1', 'left', 'router-1', 'right')
      await expect(page.getByTestId('studio-toast')).toContainText('already linked')
      await expect(edges(page)).toHaveCount(2)
      await press(page.getByRole('button', { name: 'Dismiss message' }))

      // Delete a node with its links, then undo and redo.
      await press(nodes(page).filter({ hasText: 'Server 1' }).locator('[data-testid="node-body"]'))
      if (phone) await press(toolbar(page).getByRole('button', { name: 'Delete selection' }))
      else await page.keyboard.press('Delete')
      await expect(nodes(page)).toHaveCount(2)
      await expect(edges(page)).toHaveCount(0)
      await press(toolbar(page).getByRole('button', { name: 'Undo' }))
      await expect(nodes(page)).toHaveCount(3)
      await expect(edges(page)).toHaveCount(2)
      await press(toolbar(page).getByRole('button', { name: 'Redo' }))
      await expect(nodes(page)).toHaveCount(2)
      await press(toolbar(page).getByRole('button', { name: 'Undo' }))
      await expect(nodes(page)).toHaveCount(3)

      // Reload restores graph, positions and viewport.
      await expect.poll(() => saved(page)).toContain('"id":"server-1"')
      await page.waitForTimeout(800)
      const viewport = await page.locator('.react-flow__viewport').getAttribute('style')
      const transform = (s: string | null) => /transform:[^;]+/.exec(s ?? '')?.[0]
      await page.reload()
      await expect(nodes(page)).toHaveCount(3)
      await expect(edges(page)).toHaveCount(2)
      expect(transform(await page.locator('.react-flow__viewport').getAttribute('style'))).toBe(transform(viewport))
      expect(issues).toEqual([])
    })

    test('each preset asks first, is labelled Example, and analysis follows', async ({ page, issues }) => {
      await page.goto('/studio')
      for (const [name, label, n, m] of [
        ['Ring', 'Example: ring network', 6, 6],
        ['Mesh', 'Example: partial mesh', 6, 9],
        ['Star', 'Example: star network', 7, 6],
      ] as const) {
        await tool(page, name)
        const dialog = page.getByRole('dialog').last()
        await expect(dialog).toContainText('Replace the current graph?')
        await press(dialog.getByRole('button', { name: `Load ${name} example` }))
        await expect(page.getByTestId('example-label')).toHaveText(label)
        await expect(nodes(page)).toHaveCount(n)
        await expect(edges(page)).toHaveCount(m)
      }
      expect(issues).toEqual([])
    })

    test('clear saved data removes the user graph', async ({ page, issues }) => {
      await page.goto('/studio')
      await tool(page, 'Firewall')
      await expect.poll(() => saved(page)).toContain('firewall-1')
      await tool(page, 'Clear saved data')
      await press(page.getByRole('dialog').last().getByRole('button', { name: 'Clear saved data' }))
      await expect(nodes(page)).toHaveCount(7)
      await page.waitForTimeout(700)
      expect(await saved(page)).not.toContain('firewall-1')
      expect(issues).toEqual([])
    })
  })
}

test.describe('phone specifics', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('toolbar and sheet controls are at least 40px; details open in a sheet', async ({ page }) => {
    await page.goto('/studio')
    await expect(nodes(page)).toHaveCount(7)
    const small = async (scope: Locator) =>
      scope.locator('button:visible').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 40 || e.getBoundingClientRect().width < 40).map((e) => e.getAttribute('aria-label') ?? e.textContent))
    expect(await small(toolbar(page))).toEqual([])
    await toolbar(page).getByRole('button', { name: 'Tools' }).tap()
    expect(await small(page.getByTestId('tools-sheet'))).toEqual([])
    await page.getByRole('button', { name: 'Close Tools' }).tap()
    await toolbar(page).getByRole('button', { name: 'Details and analysis' }).tap()
    const details = page.getByTestId('details-sheet')
    await expect(details.getByRole('button', { name: 'Analysis', exact: true })).toBeVisible()
    expect(await small(details)).toEqual([])
  })
})

test.describe('desktop specifics', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('keyboard: tab focus, Enter toggles, arrows nudge, ? opens help, Ctrl Z undoes', async ({ page, issues }) => {
    await page.goto('/studio')
    const node = page.locator('.react-flow__node[data-id="hub"]')
    await expect(node).toHaveAttribute('aria-label', 'router Core Router')
    await expect(node).toHaveAttribute('tabindex', '0')
    await node.focus()
    await page.keyboard.press('Enter')
    await expect(node.getByTestId('node-body')).toHaveAttribute('data-selected', 'true')
    await page.keyboard.press('Enter')
    await expect(node.getByTestId('node-body')).toHaveAttribute('data-selected', 'false')
    await page.keyboard.press('Enter')
    const before = await node.boundingBox()
    await page.keyboard.press('ArrowRight')
    await expect.poll(async () => (await node.boundingBox())?.x).toBeGreaterThan(before?.x ?? 0)
    await page.keyboard.press('Control+z')
    await expect.poll(async () => (await node.boundingBox())?.x).toBe(before?.x)
    await page.keyboard.press('Control+Shift+Z')
    await expect.poll(async () => (await node.boundingBox())?.x).toBeGreaterThan(before?.x ?? 0)

    await page.keyboard.press('?')
    await expect(page.getByTestId('shortcut-help')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('shortcut-help')).toHaveCount(0)
    expect(issues).toEqual([])
  })

  test('drag from the palette places a node at the drop point', async ({ page }) => {
    await page.goto('/studio')
    await expect(nodes(page)).toHaveCount(7)
    const canvas = page.getByTestId('studio-canvas')
    await toolbar(page).getByRole('button', { name: 'Server', exact: true }).dragTo(canvas, { targetPosition: { x: 80, y: 60 } })
    await expect(nodes(page)).toHaveCount(8)
    const box = await page.locator('.react-flow__node[data-id="server-1"]').boundingBox()
    const area = await canvas.boundingBox()
    expect(Math.abs((box?.x ?? 0) + (box?.width ?? 0) / 2 - ((area?.x ?? 0) + 80))).toBeLessThan(10)
  })

  test('failed states show on the canvas: dashed node, crossed link, analysis colours', async ({ page }) => {
    await page.goto('/studio')
    const srv = page.locator('.react-flow__node[data-id="srv"]')
    await expect(srv.getByTestId('node-body')).toHaveAttribute('data-component', '0')
    await expect(page.getByTestId('edge-bridge-e-hub-srv')).toBeVisible()
    await srv.click()
    await page.getByRole('button', { name: 'Fail Selected Node' }).click()
    await expect(srv.getByTestId('node-body')).toHaveAttribute('data-failed', 'true')
    await page.locator('.react-flow__edge[data-id="e-hub-c1"]').click({ force: true })
    await page.getByRole('button', { name: 'Fail selected edge' }).click()
    await expect(page.getByTestId('edge-cross-e-hub-c1')).toBeVisible()
  })

  test('toolbar and panel headers line up', async ({ page }) => {
    await page.goto('/studio')
    const a = await toolbar(page).boundingBox()
    const b = await page.getByTestId('panel-tabs').boundingBox()
    expect([a?.y, a?.height]).toEqual([b?.y, b?.height])
  })

  test('200 nodes and 600 edges: a drag stays responsive and commits once, at the end', async ({ page }) => {
    const nodeList = Array.from({ length: 200 }, (_, i) => ({ id: `n${i}`, label: `N${i}`, nodeType: 'router', failed: false, position: { x: (i % 20) * 190, y: Math.floor(i / 20) * 110 } }))
    const edgeList: unknown[] = []
    for (let i = 0; i < 200; i++) for (const d of [1, 2, 3]) edgeList.push({ id: `e${i}-${d}`, source: `n${i}`, target: `n${(i + d) % 200}`, failed: false })
    const workspace = {
      version: 3,
      savedAt: '2026-01-01T00:00:00.000Z',
      graph: { nodes: nodeList, edges: edgeList, example: null },
      settings: { edgeFailureProbability: 0.1, nodeFailureProbability: 0, trials: 100, seed: null, mode: 'all-terminal', traversalStart: null, pathSource: null, pathTarget: null, terminalSource: null, terminalTarget: null, sweepPMin: 0, sweepPMax: 1, sweepPoints: 3, trialsPerPoint: 10 },
    }
    await page.addInitScript((v) => localStorage.setItem('netshield_workspace', v), JSON.stringify(workspace))
    await page.goto('/studio')
    await expect(nodes(page)).toHaveCount(200)
    await expect(edges(page)).toHaveCount(600)
    await page.waitForTimeout(1500)
    const node = page.locator('.react-flow__node[data-id="n50"]')
    const c = await centre(node)
    await page.evaluate(() => {
      const w = window as unknown as { gaps: number[] }
      w.gaps = []
      let last = performance.now()
      const tick = () => {
        const now = performance.now()
        w.gaps.push(now - last)
        last = now
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
      localStorage.setItem('probe', localStorage.getItem('netshield_workspace') ?? '')
    })
    await page.mouse.move(c.x, c.y)
    await page.mouse.down()
    for (let i = 1; i <= 30; i++) await page.mouse.move(c.x + i * 3, c.y + i * 2)
    await page.waitForTimeout(600)
    // Longer than the 400 ms save debounce, mid drag: nothing was written.
    expect(await saved(page)).toBe(await page.evaluate(() => localStorage.getItem('probe')))
    await page.mouse.up()
    await expect.poll(() => saved(page)).not.toBe(await page.evaluate(() => localStorage.getItem('probe')))
    const gaps = await page.evaluate(() => (window as unknown as { gaps: number[] }).gaps)
    const sorted = [...gaps].sort((a, b) => a - b)
    const p95 = sorted[Math.floor(sorted.length * 0.95)]
    console.log(`200/600 drag: frames=${gaps.length} p95=${p95.toFixed(1)}ms max=${sorted[sorted.length - 1].toFixed(1)}ms`)
    expect(p95).toBeLessThan(100)
  })
})

test('no horizontal page scroll from 360 to 1920', async ({ page }) => {
  for (const width of [360, 390, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/studio')
    await expect(nodes(page)).toHaveCount(7)
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    expect(over, `width ${width}`).toBeLessThanOrEqual(0)
  }
})

test('Clear saved data is reachable from the Privacy page', async ({ page }) => {
  await page.goto('/studio')
  await page.setViewportSize({ width: 1440, height: 900 })
  await toolbar(page).getByRole('button', { name: 'Firewall' }).click()
  await expect.poll(() => saved(page)).toContain('firewall-1')
  await page.goto('/privacy')
  await page.getByRole('button', { name: /clear/i }).first().click()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('netshield_workspace'))).toBeNull()
})
