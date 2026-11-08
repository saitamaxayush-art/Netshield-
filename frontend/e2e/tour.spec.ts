/** The guided tour with Netbot: first visit start, every step on the live UI, skip, replay, keyboard, reduced motion. */
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from './helpers'
import { TOUR_STEPS } from '../src/features/tour/steps'

// A first time visitor: nothing in storage, so the tour starts by itself.
test.use({ storageState: { cookies: [], origins: [] } })

const bubble = (page: Page) => page.getByTestId('tour-bubble')
const total = TOUR_STEPS.length

/** The spotlight surrounds the step's own live element (the first visible candidate). */
async function expectSpotlightOnTarget(page: Page, targets: string[]) {
  await expect
    .poll(
      () =>
        page.evaluate((targets) => {
          const spot = document.querySelector('[data-testid="tour-spotlight"]')?.getBoundingClientRect()
          let el: DOMRect | null = null
          for (const s of targets) {
            for (const e of document.querySelectorAll(s)) {
              const r = e.getBoundingClientRect()
              if (!el && r.width > 0 && r.height > 0) el = r
            }
          }
          if (!spot || !el) return 'missing'
          const inside = spot.left <= el.left + 1 && spot.top <= el.top + 1 && spot.right >= el.right - 1 && spot.bottom >= el.bottom - 1
          const tight = spot.width - el.width <= 20 && spot.height - el.height <= 20
          return inside && tight ? 'ok' : `spot ${Math.round(spot.left)},${Math.round(spot.top)} ${Math.round(spot.width)}x${Math.round(spot.height)} el ${Math.round(el.left)},${Math.round(el.top)} ${Math.round(el.width)}x${Math.round(el.height)}`
        }, targets),
      { timeout: 5000 }
    )
    .toBe('ok')
}

/** Every part of the mascot (arms, eye, mouth) stays on its body: a wrong transform origin swings parts far outside it. */
async function expectMascotIntact(page: Page, step: string) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const svg = document.querySelector('[data-testid="tour-mascot"]')
          if (!svg) return 'missing'
          const box = svg.getBoundingClientRect()
          const slack = box.width * 0.15
          for (const part of svg.querySelectorAll('rect, circle')) {
            const r = part.getBoundingClientRect()
            if (r.left < box.left - slack || r.right > box.right + slack || r.top < box.top - slack || r.bottom > box.bottom + slack)
              return `part at ${Math.round(r.left)},${Math.round(r.top)} outside mascot ${Math.round(box.left)},${Math.round(box.top)} ${Math.round(box.width)}x${Math.round(box.height)}`
          }
          return 'ok'
        }),
      { timeout: 3000, message: `${step} mascot intact` }
    )
    .toBe('ok')
}

for (const [mode, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]] as const) {
  test(`${mode}: the tour starts on a first visit and walks through every section on the live UI`, async ({ page, issues }) => {
    await page.setViewportSize(viewport)
    await page.goto('/studio')
    await expect(bubble(page)).toBeVisible()
    for (let i = 0; i < total; i++) {
      const step = TOUR_STEPS[i]
      await expect(page.getByTestId('tour')).toHaveAttribute('data-step', step.id)
      await expect(page.getByTestId('tour-progress')).toHaveText(`Step ${i + 1} of ${total}`)
      await expect(bubble(page)).toContainText(step.title)
      await expect(bubble(page)).toContainText(step.text)
      await expect(page.getByTestId('tour-announcer')).toContainText(step.text)
      await expect(page.getByTestId('tour-mascot')).toHaveAttribute('data-pose', step.pose)
      await expectMascotIntact(page, step.id)
      await expect(page).toHaveURL(new RegExp(`${step.route}`))
      if (step.targets.length > 0) await expectSpotlightOnTarget(page, step.targets)
      else await expect(page.getByTestId('tour-spotlight')).toHaveCount(0)
      // The bubble stays fully on screen.
      const box = await bubble(page).boundingBox()
      expect(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, `${step.id} bubble on screen`).toBe(true)
      await page.getByRole('button', { name: i === total - 1 ? 'Finish' : 'Next' }).click()
    }
    await expect(page.getByTestId('tour')).toHaveCount(0)
    // Seen: it does not start again.
    await page.goto('/studio')
    await page.waitForTimeout(1200)
    await expect(page.getByTestId('tour')).toHaveCount(0)
    expect(issues).toEqual([])
  })
}

/** Netbot is on screen for real: rendered, opaque, inside the viewport, and nothing else on top of it. */
async function expectMascotOnScreen(page: Page) {
  await expect(page.getByTestId('tour-mascot')).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() => {
        const svg = document.querySelector('[data-testid="tour-mascot"]')
        if (!svg) return 'missing'
        const b = svg.getBoundingClientRect()
        if (b.width < 40 || b.height < 40) return `too small ${b.width}x${b.height}`
        if (b.left < 0 || b.top < 0 || b.right > innerWidth || b.bottom > innerHeight) return 'off screen'
        for (let el: Element | null = svg; el; el = el.parentElement) {
          const s = getComputedStyle(el)
          if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.99) return `hidden by ${el.tagName} ${s.display} ${s.visibility} ${s.opacity}`
        }
        const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)
        return top && svg.contains(top) ? 'ok' : `covered by ${top?.tagName ?? 'nothing'}`
      })
    )
    .toBe('ok')
}

// Fresh storage, whichever app page the visitor opens first (the welcome step lives in the studio).
for (const route of ['/studio', '/dashboard'] as const) {
  test(`first visit with empty storage, straight to ${route}: Netbot appears without any click`, async ({ page, issues }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(route)
    expect(await page.evaluate(() => localStorage.getItem('netshield_tour_seen'))).toBeNull()
    await expect(page.getByTestId('tour')).toHaveAttribute('data-step', 'welcome')
    await expect(page).toHaveURL(/\/studio/)
    await expectMascotOnScreen(page)
    await expect(bubble(page)).toContainText(TOUR_STEPS[0].title)
    await testInfo.attach(`first visit ${route}`, { body: await page.screenshot(), contentType: 'image/png' })
    expect(issues).toEqual([])
  })
}

test.describe('returning visitor', () => {
  // The tour was dismissed earlier in this browser: it must not start by itself, but stay one click away.
  test.use({ storageState: { cookies: [], origins: [{ origin: 'http://localhost:4317', localStorage: [{ name: 'netshield_tour_seen', value: '1' }] }] } })

  for (const [mode, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]] as const) {
    test(`${mode}: no automatic tour, and the studio's visible Guided tour button brings Netbot back`, async ({ page, issues }) => {
      await page.setViewportSize(viewport)
      await page.goto('/studio')
      await page.waitForTimeout(1200)
      await expect(page.getByTestId('tour')).toHaveCount(0)
      if (mode === 'phone') {
        await page.getByTestId('studio-toolbar').getByRole('button', { name: 'Tools' }).click()
        await page.getByTestId('tools-sheet').getByRole('button', { name: 'Guided tour' }).click()
      } else {
        await page.getByTestId('studio-toolbar').getByRole('button', { name: 'Guided tour' }).click()
      }
      await expect(page.getByTestId('tour')).toHaveAttribute('data-step', 'welcome')
      await expectMascotOnScreen(page)
      expect(issues).toEqual([])
    })
  }
})

test('skip ends the tour for good; it can be replayed from the help dialog and the dashboard', async ({ page, issues }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/studio')
  await expect(bubble(page)).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Skip tutorial' }).click()
  await expect(page.getByTestId('tour')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('netshield_tour_seen'))).toBe('1')
  await page.reload()
  await page.waitForTimeout(1200)
  await expect(page.getByTestId('tour')).toHaveCount(0)

  // Replay: help dialog.
  await page.getByTestId('studio-toolbar').getByRole('button', { name: 'Keyboard shortcuts' }).click()
  await page.getByRole('button', { name: 'Start guided tour' }).click()
  await expect(page.getByTestId('tour-progress')).toHaveText(`Step 1 of ${total}`)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('tour')).toHaveCount(0)

  // Replay: dashboard.
  await page.getByRole('link', { name: 'Dashboard' }).first().click()
  await page.getByRole('button', { name: 'Guided tour' }).click()
  await expect(page.getByTestId('tour')).toHaveAttribute('data-step', 'welcome')
  await expect(page).toHaveURL(/\/studio/)
  expect(issues).toEqual([])
})

test('keyboard only: Enter moves on, focus stays in the tour, arrows step, Escape skips', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/studio')
  await expect(bubble(page)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('tour-progress')).toHaveText(`Step 2 of ${total}`)
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab')
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="tour-bubble"]')), `tab ${i}`).toBe(true)
  }
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('tour-progress')).toHaveText(`Step 3 of ${total}`)
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByTestId('tour-progress')).toHaveText(`Step 2 of ${total}`)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('tour')).toHaveCount(0)
})

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('no spotlight animation, a still mascot, and the text still appears', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/studio')
    await expect(bubble(page)).toBeVisible()
    await expect(page.getByTestId('tour')).toHaveAttribute('data-reduced-motion', 'true')
    await expect(page.getByTestId('tour-mascot')).toHaveAttribute('data-animated', 'false')
    await page.getByRole('button', { name: 'Next' }).click()
    // The spotlight jumps to the canvas at once.
    await page.waitForTimeout(50)
    await expectSpotlightOnTarget(page, TOUR_STEPS[1].targets)
    await expect(bubble(page)).toContainText(TOUR_STEPS[1].text)
  })
})

test('the open tour has no WCAG 2.1 AA violations', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/studio')
  await expect(bubble(page)).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.waitForTimeout(600)
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([])
})
