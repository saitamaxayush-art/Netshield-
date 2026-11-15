/**
 * Guards from the UI sweep: no layout shift while the dashboard loads, metric links visible as links
 * without hover, no horizontal overflow on any route at the four reference widths, the landing menu
 * leaves the page scrollable on every close path, and axe on all three routes.
 */
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from './helpers'

const WIDTHS = [375, 768, 1280, 1920] as const
const ROUTES = ['/', '/studio', '/dashboard'] as const

for (const width of WIDTHS) {
  test(`dashboard at ${width}px: nothing moves while the first results arrive (CLS below 0.01)`, async ({ page, issues }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(() => {
      window.__cls = 0
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) if (!e.hadRecentInput) window.__cls = (window.__cls ?? 0) + e.value
      }).observe({ type: 'layout-shift', buffered: true })
    })
    await page.goto('/dashboard')
    await expect(page.getByTestId('metric-nodes-value')).toBeVisible()
    await page.waitForTimeout(1200)
    // The placeholder used to be shorter than the results, and the source badge row grew when it arrived.
    expect(await page.evaluate(() => window.__cls ?? 0)).toBeLessThan(0.01)
    expect(issues).toEqual([])
  })

  test(`no horizontal overflow on any route at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const route of ROUTES) {
      await page.goto(route)
      await page.waitForTimeout(800)
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(over, `${route} at ${width}px`).toBeLessThanOrEqual(0)
    }
  })
}

test.describe('touch', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true })

  test('dashboard metric cells show their link arrow without hover', async ({ page }) => {
    await page.goto('/dashboard')
    const arrow = page.getByTestId('metric-nodes').locator('svg')
    await expect(arrow).toBeVisible()
    expect(await arrow.evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1)
  })
})

async function landingState(page: Page) {
  return page.evaluate(() => ({ locked: document.documentElement.style.overflow === 'hidden', stopped: document.documentElement.classList.contains('lenis-stopped') }))
}

test('landing menu: closing with the button, Escape or a link always leaves the page scrollable', async ({ page, issues }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => window.__nsEngine?.lenis)).toBe(true)
  const open = async () => {
    await page.mouse.wheel(0, -60)
    await page.waitForTimeout(600)
    await page.getByRole('button', { name: 'Open menu' }).click()
    await expect(page.getByRole('dialog', { name: 'Site menu' })).toBeVisible()
    expect(await landingState(page)).toEqual({ locked: true, stopped: true })
  }
  const scrolls = async () => {
    const y0 = await page.evaluate(() => window.scrollY)
    await page.mouse.move(30, 400)
    await page.mouse.wheel(0, 300)
    await page.waitForTimeout(900)
    return (await page.evaluate(() => window.scrollY)) - y0
  }
  const closers: Array<[string, () => Promise<void>]> = [
    ['button', () => page.getByRole('button', { name: 'Close menu' }).click()],
    ['Escape', () => page.keyboard.press('Escape')],
    ['link', () => page.getByRole('navigation', { name: 'Menu' }).getByRole('link').filter({ hasText: 'Sandbox' }).first().click()],
  ]
  for (const [how, close] of closers) {
    await open()
    await close()
    await expect(page.getByRole('dialog', { name: 'Site menu' })).toHaveCount(0)
    await page.waitForTimeout(1200)
    expect(await landingState(page), how).toEqual({ locked: false, stopped: false })
    expect(await scrolls(), `${how}: page scrolls afterwards`).toBeGreaterThan(200)
  }
  expect(issues).toEqual([])
})

for (const width of [375, 1280] as const) {
  test(`axe: no WCAG 2.1 AA violations on the landing page, studio and dashboard at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    for (const route of ROUTES) {
      await page.goto(route)
      await page.waitForTimeout(1500)
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(result.violations.map((v) => `${route} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
    }
  })
}

/** Readable text and tap targets in the studio and dashboard (the larger type scale). */
async function sizeProblems(page: Page, touch: boolean) {
  return page.evaluate((touch) => {
    const vis = (el: Element) => {
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      // Content of a closed <details> keeps a layout box in Chrome but is not shown; its summary row is.
      const folded = !!el.closest('details:not([open])') && !el.closest('summary')
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && r.bottom > 0 && r.top < innerHeight && !el.closest('.sr-only') && !folded
    }
    const out: string[] = []
    for (const el of document.querySelectorAll('body *')) {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim())
      if (own && vis(el) && Number.parseFloat(getComputedStyle(el).fontSize) < 13) out.push(`text ${Number.parseFloat(getComputedStyle(el).fontSize)}px: ${el.textContent?.trim().slice(0, 24)}`)
    }
    // Labels cut off with an ellipsis in the toolbar, the panel tabs and on canvas cards.
    for (const el of document.querySelectorAll('[data-testid="studio-toolbar"] *, [data-testid="panel-tabs"] *, .react-flow__node *')) {
      const cs = getComputedStyle(el)
      const clamped = cs.webkitLineClamp !== 'none' && cs.webkitLineClamp !== ''
      const cut = (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) || (clamped && el.scrollHeight > el.clientHeight + 1)
      if (vis(el) && el.textContent?.trim() && cut) out.push(`cut off: ${el.textContent.trim().slice(0, 24)}`)
    }
    for (const el of document.querySelectorAll('[data-testid="side-panel"] p, [data-testid="details-sheet"] p')) {
      const px = Number.parseFloat(getComputedStyle(el).fontSize)
      if (vis(el) && px < 14) out.push(`panel paragraph ${px}px`)
    }
    const targets = [...document.querySelectorAll('button, select, input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), summary, [role="switch"], main a[href]')].filter(
      (el) => vis(el) && !el.closest('.react-flow__node, .react-flow__edge, [data-hit]'),
    )
    for (const el of targets) if (el.getBoundingClientRect().height < 43.5) out.push(`control ${Math.round(el.getBoundingClientRect().height)}px: ${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)}`)
    if (touch) {
      const R = targets.map((e) => e.getBoundingClientRect())
      for (let i = 0; i < R.length; i++)
        for (let j = i + 1; j < R.length; j++) {
          if (targets[i].contains(targets[j]) || targets[j].contains(targets[i])) continue
          const a = R[i]
          const b = R[j]
          const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left)
          const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
          const gap = oy > 0 ? -ox : ox > 0 ? -oy : 99
          const label = (e: Element, q: DOMRect) => `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 14)}" @${Math.round(q.top)}-${Math.round(q.bottom)}`
          if (gap < 8) out.push(`targets ${Math.round(gap)}px apart: ${label(targets[i], a)} | ${label(targets[j], b)}`)
        }
    }
    return out
  }, touch)
}

for (const [mode, viewport, touch] of [['phone', { width: 375, height: 812 }, true], ['desktop', { width: 1280, height: 900 }, false]] as const) {
  test.describe(`${mode} sizes`, () => {
    test.use({ viewport, hasTouch: touch, isMobile: touch })

    test(`${mode}: text at least 13px, panel text at least 14px, controls at least 44px${touch ? ', 8px between targets' : ''}`, async ({ page }) => {
      await page.goto('/studio')
      await expect(page.locator('.react-flow__node').first()).toBeVisible()
      expect(await sizeProblems(page, touch), 'studio').toEqual([])
      if (touch) await page.getByRole('button', { name: 'Details and analysis' }).click()
      await page.getByRole('button', { name: 'Analysis', exact: true }).click()
      await expect(page.getByTestId('analysis-results')).toBeVisible()
      expect(await sizeProblems(page, touch), 'analysis').toEqual([])
      await page.getByRole('button', { name: 'Simulator', exact: true }).click()
      await page.getByRole('button', { name: 'Run Monte Carlo Simulation' }).click()
      await expect(page.getByTestId('simulation-results')).toBeVisible()
      expect(await sizeProblems(page, touch), 'simulator').toEqual([])
      await page.goto('/dashboard')
      await expect(page.getByTestId('metric-nodes-value')).toBeVisible()
      expect(await sizeProblems(page, touch), 'dashboard').toEqual([])
    })
  })
}
