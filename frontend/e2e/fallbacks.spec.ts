import { test, expect, open, goToSection, scrollThrough, layoutProblems, SECTIONS } from './helpers'
import { chromium } from '@playwright/test'

const allTextVisible = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const out: string[] = []
    document.querySelectorAll<HTMLElement>('.ns-landing h1, .ns-landing h2, .ns-landing h3, .ns-landing p, .ns-landing dd').forEach((el) => {
      if (!el.textContent?.trim() || el.closest('[aria-hidden="true"], .ns-skip, [hidden]')) return
      let o = 1
      for (let p: HTMLElement | null = el; p; p = p.parentElement) o *= Number(getComputedStyle(p).opacity)
      const inline = el.querySelectorAll('[style*="translate"]').length
      if (o < 0.99) out.push(`${el.tagName} "${el.textContent.trim().slice(0, 30)}" opacity ${o}`)
      if (el.closest('.ns-line') && getComputedStyle(el.closest('.ns-line')!).transform !== 'none') out.push(`line transformed: ${el.textContent.slice(0, 30)}`)
      void inline
    })
    return out
  })

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  test('no Lenis, no pinning, static SVG hero, everything visible and stacked', async ({ page, issues }) => {
    await open(page)
    const engine = await page.evaluate(() => window.__nsEngine)
    expect(engine?.lenis).toBe(false)
    expect(await page.locator('.pin-spacer').count()).toBe(0)
    expect(await page.locator('.ns-line').count()).toBe(0)
    await expect(page.locator('.ns-hero__scene')).toHaveAttribute('data-renderer', 'svg')
    expect(await page.locator('canvas').count()).toBe(0)
    expect(await page.locator('.ns-cursor[data-visible="true"]').count()).toBe(0)
    for (const id of SECTIONS) {
      await goToSection(page, id, 300)
      expect(await allTextVisible(page)).toEqual([])
      expect(await layoutProblems(page, { touch: false })).toEqual([])
    }
    // Story buttons still drive state without pinning.
    await goToSection(page, 'how', 300)
    await page.locator('#how').getByRole('button', { name: 'Next step' }).click()
    await expect(page.locator('#how [aria-live="polite"]')).toHaveText('Step 2 of 3: Introduce failures.')
    expect(issues).toEqual([])
  })
})

test.describe('motion failure', () => {
  test.use({ viewport: { width: 1280, height: 800 } })
  test('if the animation engine fails, all content is shown statically', async ({ page, issues }) => {
    await page.addInitScript(() => (window.__NS_FORCE_MOTION_FAILURE = true))
    await open(page)
    expect((await page.evaluate(() => window.__nsEngine))?.failed).toBe(true)
    await scrollThrough(page, 0.9, 60)
    for (const id of SECTIONS) {
      await goToSection(page, id, 200)
      expect(await allTextVisible(page)).toEqual([])
    }
    // The engine logs one console.info line (not a warning or error).
    expect(issues).toEqual([])
  })
})

test.describe('mobile emulation', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 })
  test('lighter hero scene, no custom cursor, no magnetic transforms', async ({ page, issues }) => {
    await open(page)
    const caption = await page.locator('.ns-hero-caption').textContent()
    expect(caption).toContain('40 nodes')
    expect(await page.locator('.ns-cursor[data-visible="true"]').count()).toBe(0)
    await page.getByRole('link', { name: 'Open Simulator' }).nth(1).tap({ trial: true })
    expect(issues).toEqual([])
  })
})

test('WebGL disabled renders the same seeded graph as SVG and keeps interactions', async () => {
  const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-webgl', '--disable-3d-apis'] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const issues: string[] = []
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && issues.push(m.text()))
  page.on('pageerror', (e) => issues.push(e.message))
  await page.goto('http://localhost:4317/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await expect(page.locator('.ns-hero__scene')).toHaveAttribute('data-renderer', 'svg')
  expect(await page.locator('.ns-hero__scene svg line').count()).toBeGreaterThan(100)
  expect(await page.locator('.ns-hero__scene svg rect').count()).toBe(64)
  await goToSection(page, 'sandbox')
  await page.locator('[data-testid="sandbox"] [data-hit="node"][data-id="E"] circle[r="20"]').click()
  await expect(page.locator('[data-testid="sandbox"] [data-hit="node"][data-id="E"]')).toHaveAttribute('aria-pressed', 'true')
  expect(issues).toEqual([])
  await browser.close()
})

test.describe('low power', () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  test('two cores or save data falls back to the SVG hero', async ({ page, issues }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }))
    await open(page)
    await expect(page.locator('.ns-hero__scene')).toHaveAttribute('data-renderer', 'svg')
    expect(issues).toEqual([])
  })
})
