import { test, expect, open } from './helpers'

test.use({ viewport: { width: 1440, height: 900 } })

for (const route of ['/dashboard', '/studio', '/privacy', '/terms']) {
  test(`${route} keeps the app theme and works without landing motion`, async ({ page, issues }) => {
    await open(page, route)
    const state = await page.evaluate(() => ({
      route: document.documentElement.dataset.route ?? null,
      lenis: document.documentElement.classList.contains('lenis'),
      landing: document.querySelectorAll('.ns-landing').length,
      bg: getComputedStyle(document.body).backgroundColor,
      main: (document.querySelector('main, #root > div')?.textContent ?? '').trim().length,
    }))
    expect(state).toMatchObject({ route: null, lenis: false, landing: 0, bg: 'rgb(19, 21, 31)' })
    expect(state.main).toBeGreaterThan(50)
    expect(issues).toEqual([])
  })
}

test('landing to studio: no flash of a third theme, landing engine torn down', async ({ page, issues }) => {
  await open(page)
  await page.evaluate(() => {
    const w = window
    w.__bgs = []
    const sample = () => {
      const el = document.elementFromPoint(innerWidth / 2, innerHeight - 4) as HTMLElement | null
      let bg = 'rgba(0, 0, 0, 0)'
      for (let p: HTMLElement | null = el; p && bg === 'rgba(0, 0, 0, 0)'; p = p.parentElement) bg = getComputedStyle(p).backgroundColor
      if (bg === 'rgba(0, 0, 0, 0)') bg = getComputedStyle(document.body).backgroundColor
      w.__bgs.push(bg)
      if (w.__bgs.length < 90) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  await page.locator('.ns-header').getByRole('link', { name: 'Open Simulator' }).click()
  await page.waitForURL('**/studio')
  await page.waitForTimeout(1600)
  const bgs = [...new Set(await page.evaluate(() => window.__bgs))]
  // Only the landing charcoal, its silver sections and the app navy may appear.
  for (const bg of bgs) expect(['rgb(23, 24, 27)', 'rgb(243, 245, 247)', 'rgb(19, 21, 31)', 'rgb(18, 19, 21)', 'rgb(24, 27, 40)']).toContain(bg)
  expect(await page.evaluate(() => [document.documentElement.dataset.route ?? null, document.documentElement.classList.contains('lenis')])).toEqual([null, false])
  // Back to the landing: engine restarts cleanly.
  await page.goBack()
  await page.waitForSelector('.ns-landing')
  await page.waitForTimeout(800)
  expect(await page.evaluate(() => document.documentElement.dataset.route)).toBe('landing')
  expect(issues).toEqual([])
})
