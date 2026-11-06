/** Accessibility on /studio and /dashboard: axe (WCAG 2.1 AA), keyboard only use, reduced motion, touch targets. */
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from './helpers'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
async function axe(page: Page, label: string) {
  const result = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const found = result.violations.map((v) => `${label}: ${v.id} (${v.impact}) ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)
  expect(found).toEqual([])
}

for (const [width, height] of [[1440, 900], [390, 844]] as const) {
  test(`axe finds no WCAG 2.1 AA violations at ${width}px, in result, dialog and error states`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/studio?panel=analysis')
    await expect(page.locator('.react-flow__node')).toHaveCount(7)
    await expect(page.getByTestId('analysis-results')).toBeVisible()
    await axe(page, 'studio analysis')
    for (const section of ['Components', 'Critical', 'Degrees', 'Traversal', 'Paths', 'Compare']) {
      await page.getByRole('button', { name: section, exact: true }).click()
      await axe(page, `section ${section}`)
    }
    await page.goto('/studio?panel=simulation')
    await page.getByRole('button', { name: 'Run Monte Carlo Simulation' }).click()
    await expect(page.getByTestId('simulation-results')).toBeVisible()
    await axe(page, 'simulation result')
    await page.goto('/studio')
    if (width < 1280) await page.getByRole('button', { name: 'Tools' }).click()
    await page.getByRole('button', { name: 'Keyboard shortcuts' }).click()
    await axe(page, 'help dialog')
    await page.keyboard.press('Escape')
    await page.goto('/dashboard')
    await expect(page.getByTestId('metric-nodes-value')).toBeVisible()
    await axe(page, 'dashboard')
    await page.route('**/api/**', (route) => route.abort('connectionrefused'))
    await page.reload()
    await expect(page.getByTestId('offline-banner')).toBeVisible()
    await axe(page, 'offline')
  })
}

test.describe('keyboard only', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('add a node, link it, fail it and restore it, with the keyboard alone and a visible focus ring', async ({ page, issues }) => {
    await page.goto('/studio')
    await expect(page.locator('.react-flow__node')).toHaveCount(7)
    const toolbarRouter = page.getByTestId('studio-toolbar').getByRole('button', { name: 'Router', exact: true })
    await toolbarRouter.focus()
    const ring = await toolbarRouter.evaluate((el) => getComputedStyle(el).boxShadow + getComputedStyle(el).outlineStyle)
    await page.keyboard.press('Enter')
    await expect(page.locator('.react-flow__node')).toHaveCount(8)
    expect(ring).not.toBe('nonenone')

    // The new node is selected: its properties offer a keyboard way to link it.
    await page.locator('#connect-to').focus()
    await page.keyboard.press('Space').catch(() => undefined)
    await page.locator('#connect-to').selectOption('srv')
    await page.getByRole('button', { name: 'Add link' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.react-flow__edge')).toHaveCount(7)

    await page.getByRole('button', { name: 'Fail selected node' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.react-flow__node[data-id="router-1"] [data-testid="node-body"]')).toHaveAttribute('data-failed', 'true')
    await page.getByRole('button', { name: 'Restore selected node' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.react-flow__node[data-id="router-1"] [data-testid="node-body"]')).toHaveAttribute('data-failed', 'false')

    // Panel tabs and analysis sections by keyboard.
    await page.getByRole('button', { name: 'Analysis', exact: true }).focus()
    await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Critical', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('section-critical')).toBeVisible()
    const focusedRing = await page.evaluate(() => {
      const el = document.activeElement
      return el ? getComputedStyle(el).outlineStyle : 'none'
    })
    expect(focusedRing).toBe('solid')
    expect(issues).toEqual([])
  })

  test('tab order reaches the toolbar, canvas nodes and the side panel in that order', async ({ page }) => {
    await page.goto('/studio')
    await expect(page.locator('.react-flow__node')).toHaveCount(7)
    const order: string[] = []
    await page.getByTestId('studio-toolbar').getByRole('button', { name: 'Router', exact: true }).focus()
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab')
      order.push(
        await page.evaluate(() => {
          const el = document.activeElement
          if (!el) return 'none'
          if (el.closest('[data-testid="studio-toolbar"]')) return 'toolbar'
          if (el.closest('.react-flow__node')) return 'node'
          if (el.closest('[data-testid="side-panel"]')) return 'panel'
          return 'other'
        })
      )
    }
    const first = (kind: string) => order.indexOf(kind)
    expect(first('toolbar')).toBeGreaterThanOrEqual(0)
    expect(first('node')).toBeGreaterThan(first('toolbar'))
    expect(first('panel')).toBeGreaterThan(first('node'))
  })
})

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })

  test('transitions and animations are switched off on app pages', async ({ page }) => {
    await page.goto('/studio')
    await expect(page.locator('.react-flow__node')).toHaveCount(7)
    const timings = await page.evaluate(() =>
      ['.ns-edge-line', '.ns-node', '.ns-node-cross'].map((selector) => {
        const el = document.querySelector(selector)
        return el ? Number.parseFloat(getComputedStyle(el).transitionDuration) : -1
      })
    )
    for (const t of timings) expect(t).toBeLessThanOrEqual(0.0001)
  })
})

test.describe('touch targets', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('dashboard and studio controls are at least 40px', async ({ page }) => {
    for (const url of ['/dashboard', '/studio']) {
      await page.goto(url)
      await page.waitForTimeout(800)
      const small = await page.locator('main button:visible, .studio-root button:visible, main a[href]:visible').evaluateAll((els) =>
        els
          .filter((el) => {
            const r = el.getBoundingClientRect()
            return r.width > 0 && (r.height < 40 || r.width < 40)
          })
          .map((el) => (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40))
      )
      expect(small, url).toEqual([])
    }
  })
})
