/**
 * Layout at ten widths on every app route: no horizontal overflow, no clipped or off screen text, panel
 * edges aligned, consistent page padding. Screenshots go to audit-screenshots/layout/ for review.
 */
import type { Page } from '@playwright/test'
import { expect, test } from './helpers'

const WIDTHS = [360, 390, 414, 768, 820, 1024, 1280, 1440, 1680, 1920]
const ROUTES = [
  ['dashboard', '/dashboard'],
  ['studio', '/studio'],
  ['privacy', '/privacy'],
  ['terms', '/terms'],
  ['404', '/no-such-page'],
] as const

/** Text that is cut off without an intended ellipsis, or that runs past the right edge of the viewport. */
async function layoutProblems(page: Page) {
  return page.evaluate(() => {
    const out: string[] = []
    const viewport = document.documentElement.clientWidth
    const overflow = document.documentElement.scrollWidth - viewport
    if (overflow > 0) out.push(`page scrolls sideways by ${overflow}px`)
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      if (el.closest('.react-flow__renderer, .recharts-wrapper, svg, .sr-only, [aria-hidden="true"]')) continue
      const own = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '')
      if (!own) continue
      const style = getComputedStyle(el)
      if (style.visibility === 'hidden' || style.display === 'none') continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const label = `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 40)}"`
      if (r.right > viewport + 1 && r.left < viewport) out.push(`${label} runs past the right edge (${Math.round(r.right)} > ${viewport})`)
      const clips = ['hidden', 'clip'].includes(style.overflowX)
      const ellipsis = style.textOverflow === 'ellipsis'
      if (clips && !ellipsis && el.scrollWidth > el.clientWidth + 1) out.push(`${label} is clipped (${el.scrollWidth} > ${el.clientWidth})`)
    }
    return out
  })
}

const rect = async (page: Page, testId: string) => {
  const box = await page.getByTestId(testId).boundingBox()
  if (!box) throw new Error(`${testId} not visible`)
  return box
}

for (const [name, path] of ROUTES) {
  test(`${name}: layout at ${WIDTHS.length} widths`, async ({ page, issues, browserName }) => {
    test.setTimeout(120_000)
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(path)
      if (name === 'studio') await expect(page.locator('.react-flow__node')).toHaveCount(7)
      if (name === 'dashboard') await expect(page.getByTestId('metric-nodes-value')).toBeVisible()
      // Wait for the page itself, not a fixed delay: on a reload the lazy route can take about 800 ms to replace the loader.
      if (name !== 'studio') await expect(page.locator('h1').first()).toBeVisible()
      await page.waitForTimeout(400)
      expect(await layoutProblems(page), `${name} at ${width}px`).toEqual([])

      if (name === 'studio') {
        const toolbar = await rect(page, 'studio-toolbar')
        const canvas = await rect(page, 'studio-canvas')
        expect(Math.round(toolbar.x), `${width}px toolbar starts at the left edge`).toBe(0)
        expect(Math.round(canvas.x)).toBe(0)
        expect(Math.round(canvas.width)).toBe(Math.round(toolbar.width))
        // The graph is framed for this canvas, even though the previous width saved its own view (BUG-016).
        const nodes = await page.locator('.react-flow__node').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()))
        const span = {
          w: Math.max(...nodes.map((r) => r.right)) - Math.min(...nodes.map((r) => r.left)),
          h: Math.max(...nodes.map((r) => r.bottom)) - Math.min(...nodes.map((r) => r.top)),
        }
        expect(Math.max(span.w / canvas.width, span.h / canvas.height), `${width}px graph fills the canvas`).toBeGreaterThan(0.4)
        for (const r of nodes) {
          expect(r.left).toBeGreaterThanOrEqual(canvas.x - 1)
          expect(r.right).toBeLessThanOrEqual(canvas.x + canvas.width + 1)
        }
        if (width >= 1280) {
          const panel = await rect(page, 'side-panel')
          const tabs = await rect(page, 'panel-tabs')
          expect(Math.round(panel.x + panel.width), `${width}px panel reaches the right edge`).toBe(width)
          expect(Math.round(toolbar.x + toolbar.width), `${width}px toolbar meets the panel`).toBe(Math.round(panel.x))
          expect([Math.round(tabs.y), Math.round(tabs.height)], `${width}px tab row lines up with the toolbar`).toEqual([Math.round(toolbar.y), Math.round(toolbar.height)])
        } else {
          expect(Math.round(toolbar.width), `${width}px toolbar spans the screen`).toBe(width)
        }
      } else {
        // Page padding: the heading, and every metric card on the dashboard, start at the same left edge.
        const left = await page.evaluate(() => {
          const h1 = document.querySelector('main h1, h1')
          return h1 ? Math.round(h1.getBoundingClientRect().left) : -1
        })
        expect(left, `${name} at ${width}px heading inset`).toBeGreaterThanOrEqual(16)
        if (name === 'dashboard') {
          const cards = await page.locator('[data-testid^="metric-"][href]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) })))
          expect(Math.min(...cards.map((c) => c.x)), `${width}px first card aligns with the heading`).toBe(left)
          const rows = new Map<number, typeof cards>()
          for (const c of cards) rows.set(c.y, [...(rows.get(c.y) ?? []), c])
          for (const row of rows.values()) {
            expect(new Set(row.map((c) => c.w)).size, `${width}px equal card widths in a row`).toBe(1)
            expect(new Set(row.map((c) => c.h)).size, `${width}px equal card heights in a row`).toBe(1)
          }
        }
      }
      await page.screenshot({ path: `audit-screenshots/layout/${browserName}/${name}-${width}.png` })
    }
    expect(issues).toEqual([])
  })
}
