/**
 * Landing section 02 (Sandbox) must never trap the page scroll. The old graph box carried
 * data-lenis-prevent, so wheel and trackpad input over it bypassed Lenis and scrolled natively while
 * Lenis kept animating towards its own target: steps were lost at the edge and scrolling up over the
 * graph covered about two thirds of the distance.
 */
import type { Page } from '@playwright/test'
import { devices } from '@playwright/test'
import { expect, test } from './helpers'

const graph = (page: Page) => page.locator('[data-testid="sandbox"] svg.ns-graph')

/** Arrive the way a visitor does: wheel down from the hero until the Sandbox graph is on screen. */
async function wheelToSandbox(page: Page) {
  await page.goto('/')
  await expect(graph(page)).toBeAttached()
  await expect.poll(() => page.evaluate(() => window.__nsEngine?.lenis)).toBe(true)
  await page.mouse.move(30, 450)
  for (let i = 0; i < 40; i++) {
    const box = await graph(page).boundingBox()
    if (box && box.y < 450) break
    await page.mouse.wheel(0, 120)
    await page.waitForTimeout(120)
  }
  await page.waitForTimeout(900)
}

async function pointAtGraph(page: Page) {
  const box = await graph(page).boundingBox()
  if (!box) throw new Error('graph not visible')
  // An empty spot of the canvas near its centre line (left edge, away from nodes).
  await page.mouse.move(box.x + 6, Math.min(Math.max(box.y + box.height / 2, 80), 840))
}

test.describe('desktop wheel and trackpad over the Sandbox graph', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('every wheel event over the graph is taken by the smooth scroller, and the page moves', async ({ page, issues }) => {
    await wheelToSandbox(page)
    await page.evaluate(() => {
      const w = window as Window & { __wheel?: { total: number; smooth: number } }
      w.__wheel = { total: 0, smooth: 0 }
      // Registered after Lenis, so it sees whether Lenis handled (prevented) the event.
      window.addEventListener('wheel', (e) => {
        if (!(e.target instanceof Element) || !e.target.closest('[data-testid="sandbox"]')) return
        w.__wheel!.total++
        if (e.defaultPrevented) w.__wheel!.smooth++
      })
    })
    await pointAtGraph(page)
    const before = await page.evaluate(() => window.scrollY)
    for (let i = 0; i < 4; i++) {
      await pointAtGraph(page)
      await page.mouse.wheel(0, 100)
      await page.waitForTimeout(250)
    }
    await page.waitForTimeout(700)
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 300)
    const counts = await page.evaluate(() => (window as Window & { __wheel?: { total: number; smooth: number } }).__wheel)
    expect(counts?.total).toBeGreaterThan(0)
    expect(counts?.smooth, 'wheel events over the graph handled by Lenis').toBe(counts?.total)
    expect(issues).toEqual([])
  })

  test('trackpad style scrolling up over the graph covers the whole distance', async ({ page }) => {
    await wheelToSandbox(page)
    // Wheel over empty space (smooth scrolled), then move onto the graph while that scroll is still
    // easing out: the moment the old split between Lenis and native scrolling lost input.
    await page.mouse.move(30, 450)
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, 100)
      await page.waitForTimeout(300)
    }
    await pointAtGraph(page)
    const before = await page.evaluate(() => window.scrollY)
    for (let i = 0; i < 40; i++) {
      await page.mouse.wheel(0, -12)
      await page.waitForTimeout(16)
    }
    await page.waitForTimeout(1000)
    const moved = before - (await page.evaluate(() => window.scrollY))
    // Asked for 480px. The old behaviour lost about a third of it (317px).
    expect(moved).toBeGreaterThan(480 * 0.85)
  })
})

for (const name of ['Pixel 7', 'iPhone 14'] as const) {
  test.describe(`${name} touch`, () => {
    const { defaultBrowserType: _engine, ...device } = devices[name]
    test.use(device)

    test('a vertical swipe starting on the Sandbox graph scrolls the page, and nodes can still be dragged', async ({ page, context, issues }) => {
      await page.goto('/')
      await expect(graph(page)).toBeAttached()
      const bring = async () => {
        await page.evaluate(() => {
          const r = document.querySelector('[data-testid="sandbox"] svg.ns-graph')!.getBoundingClientRect()
          window.scrollBy(0, r.top - 120)
        })
        await page.waitForTimeout(800)
      }
      await bring()
      const cdp = await context.newCDPSession(page)
      const box = await graph(page).boundingBox()
      if (!box) throw new Error('graph not visible')
      const before = await page.evaluate(() => window.scrollY)
      await cdp.send('Input.synthesizeScrollGesture', { x: Math.round(box.x + 6), y: Math.round(box.y + box.height - 6), yDistance: -250, gestureSourceType: 'touch', speed: 800 })
      await page.waitForTimeout(600)
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 100)

      await bring()
      const node = page.locator('[data-testid="sandbox"] [data-hit="node"]').nth(1)
      const id = await node.getAttribute('data-id')
      const nb = await node.boundingBox()
      if (!nb || !id) throw new Error('node not visible')
      const [sx, sy] = [nb.x + nb.width / 2, nb.y + nb.height / 2]
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] })
      for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + i * 4, y: sy + i * 3 }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await page.waitForTimeout(300)
      const moved = await page.locator(`[data-testid="sandbox"] [data-hit="node"][data-id="${id}"]`).boundingBox()
      expect(Math.round((moved?.x ?? 0) - nb.x)).toBe(40)
      expect(issues).toEqual([])
    })
  })
}
