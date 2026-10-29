import { test, expect, open, goToSection, layoutProblems } from './helpers'

test.use({ viewport: { width: 1440, height: 900 } })

/** Every reveal finished, nothing left hidden in the viewport. */
async function hiddenText(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const out: string[] = []
    document.querySelectorAll<HTMLElement>('.ns-landing h1, .ns-landing h2, .ns-landing h3, .ns-landing p, .ns-line').forEach((el) => {
      const r = el.getBoundingClientRect()
      if (r.bottom < 0 || r.top > innerHeight || !el.textContent?.trim() || el.closest('[aria-hidden="true"], .ns-skip, [hidden]')) return
      let o = 1
      for (let p: HTMLElement | null = el; p; p = p.parentElement) o *= Number(getComputedStyle(p).opacity)
      const t = getComputedStyle(el).transform
      const ty = t && t !== 'none' ? new DOMMatrix(t).m42 : 0
      if (o < 0.99 || Math.abs(ty) > r.height * 0.5) out.push(`${el.tagName} "${el.textContent.trim().slice(0, 30)}" opacity ${o.toFixed(2)} ty ${ty.toFixed(1)}`)
    })
    return out
  })
}

test('pin start and end of how it works do not jump', async ({ page, issues }) => {
  await open(page)
  const st = await page.evaluate(() => {
    const el = document.getElementById('how')!
    return { top: el.getBoundingClientRect().top + window.scrollY, spacer: el.parentElement!.getBoundingClientRect().height, h: el.getBoundingClientRect().height }
  })
  const probe = () => page.evaluate(() => document.querySelector('#how h2')!.getBoundingClientRect().top)
  // Native scroll steps of 20px across the pin start and the pin end.
  for (const start of [st.top - 200, st.top + st.spacer - st.h - 200]) {
    await page.evaluate((y) => window.scrollTo(0, y), start)
    await page.waitForTimeout(300)
    let prev = await probe()
    for (let y = start + 20; y <= start + 400; y += 20) {
      await page.evaluate((y) => window.scrollTo(0, y), y)
      await page.waitForTimeout(60)
      const cur = await probe()
      const moved = prev - cur
      // Either pinned (0) or travelling with the page (20); anything else is a jump.
      expect(Math.min(Math.abs(moved), Math.abs(moved - 20)), `jump at ${y}: moved ${moved}`).toBeLessThanOrEqual(1.5)
      prev = cur
    }
  }
  expect(issues).toEqual([])
})

test('slow wheel, fast flick and reverse scroll leave nothing hidden or clipped', async ({ page, issues }) => {
  await open(page)
  for (let i = 0; i < 40; i++) {
    await page.mouse.wheel(0, 60)
    await page.waitForTimeout(40)
  }
  await page.waitForTimeout(1200)
  expect(await hiddenText(page)).toEqual([])
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 900)
  await page.waitForTimeout(1800)
  expect(await hiddenText(page)).toEqual([])
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -700)
  await page.waitForTimeout(1800)
  expect(await hiddenText(page)).toEqual([])
  expect(await layoutProblems(page, { touch: false })).toEqual([])
  expect(issues).toEqual([])
})

test('keyboard scrolling: arrows, space, page keys, home and end', async ({ page, issues }) => {
  await open(page)
  await page.locator('body').click({ position: { x: 5, y: 300 } })
  const y = () => page.evaluate(() => window.scrollY)
  await page.keyboard.press('PageDown')
  await page.waitForTimeout(900)
  const a = await y()
  expect(a).toBeGreaterThan(300)
  await page.keyboard.press('Space')
  await page.waitForTimeout(900)
  expect(await y()).toBeGreaterThan(a + 300)
  await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(500)
  await page.keyboard.press('End')
  await page.waitForTimeout(1800)
  expect(await y()).toBeGreaterThan((await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)) - 4)
  expect(await hiddenText(page)).toEqual([])
  await page.keyboard.press('Home')
  await page.waitForTimeout(1800)
  expect(await y()).toBeLessThan(4)
  await page.keyboard.press('PageDown')
  await page.waitForTimeout(400)
  await page.keyboard.press('PageUp')
  await page.waitForTimeout(1200)
  expect(await y()).toBeLessThan(4)
  expect(issues).toEqual([])
})

test('anchor links land at the section with the header offset', async ({ page, issues }) => {
  await open(page)
  for (const name of ['Sandbox', 'Reliability', 'Method']) {
    await page.locator('.ns-navlinks').getByRole('link', { name }).click()
    await page.waitForTimeout(1800)
    const top = await page.evaluate((id) => document.getElementById(id)!.getBoundingClientRect().top, name.toLowerCase())
    expect(Math.abs(top - 63), `${name} top ${top}`).toBeLessThanOrEqual(2)
    await expect(page.locator('.ns-navlinks').getByRole('link', { name })).toHaveAttribute('aria-current', 'true')
  }
  // Hero secondary CTA goes to the method.
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(600)
  await page.getByRole('link', { name: 'Explore the Method' }).click()
  await page.waitForTimeout(1800)
  expect(Math.abs((await page.evaluate(() => document.getElementById('method')!.getBoundingClientRect().top)) - 63)).toBeLessThanOrEqual(2)
  expect(issues).toEqual([])
})

test('header keeps its height, hides on scroll down and returns on scroll up', async ({ page, issues }) => {
  await open(page)
  const header = page.locator('.ns-header')
  const h0 = (await header.boundingBox())!.height
  for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 120)
  await page.waitForTimeout(800)
  await expect(header).toHaveAttribute('data-hidden', 'true')
  expect((await header.boundingBox())!.height).toBe(h0)
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -120)
  await page.waitForTimeout(800)
  await expect(header).toHaveAttribute('data-hidden', 'false')
  await expect(header).toHaveAttribute('data-solid', 'true')
  expect((await header.boundingBox())!.height).toBe(h0)
  expect(issues).toEqual([])
})

test('resize during animation keeps layout intact with bounded refreshes', async ({ page, issues }) => {
  await open(page)
  await goToSection(page, 'how', 200)
  await page.mouse.wheel(0, 600)
  await page.setViewportSize({ width: 1100, height: 800 })
  await page.waitForTimeout(150)
  await page.setViewportSize({ width: 820, height: 1000 })
  await page.waitForTimeout(150)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.waitForTimeout(1500)
  const refreshes = await page.evaluate(() => window.__nsEngine!.refreshes)
  expect(refreshes).toBeLessThanOrEqual(4)
  for (const id of ['how', 'topologies', 'reliability']) {
    await goToSection(page, id)
    expect(await layoutProblems(page, { touch: false })).toEqual([])
    expect(await hiddenText(page)).toEqual([])
  }
  expect(issues).toEqual([])
})

test('hidden tab pauses the hero render loop and resumes on return', async ({ page, issues }) => {
  await open(page, '/?hero=webgl')
  await page.waitForFunction(() => (window.__nsHeroFrames ?? 0) > 10)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(100)
  const f0 = await page.evaluate(() => window.__nsHeroFrames!)
  await page.waitForTimeout(600)
  expect(await page.evaluate(() => window.__nsHeroFrames!)).toBe(f0)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(600)
  expect(await page.evaluate(() => window.__nsHeroFrames!)).toBeGreaterThan(f0)
  // Offscreen also pauses.
  await goToSection(page, 'reliability', 600)
  const f1 = await page.evaluate(() => window.__nsHeroFrames!)
  await page.waitForTimeout(600)
  expect(await page.evaluate(() => window.__nsHeroFrames!)).toBe(f1)
  expect(issues).toEqual([])
})

test('fail safe completes reveals that never received a trigger', async ({ page, issues }) => {
  await open(page)
  // Jump straight to the bottom without intermediate scroll events.
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
  await page.waitForTimeout(2200)
  expect(await hiddenText(page)).toEqual([])
  await goToSection(page, 'paths', 1800)
  expect(await hiddenText(page)).toEqual([])
  expect(issues).toEqual([])
})
