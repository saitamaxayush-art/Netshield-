/** Route level code splitting: the landing page and its 3D scene are never loaded on app routes. */
import { expect, test } from './helpers'

test.use({ viewport: { width: 1440, height: 900 } })

for (const route of ['/dashboard', '/studio', '/privacy']) {
  test(`${route} loads no landing or 3D code`, async ({ page }) => {
    const scripts: string[] = []
    page.on('request', (r) => {
      if (r.resourceType() === 'script') scripts.push(new URL(r.url()).pathname)
    })
    await page.goto(route)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    expect(scripts.length).toBeGreaterThan(0)
    expect(scripts.filter((s) => /LandingPage|HeroScene|three/i.test(s))).toEqual([])
    const css = await page.evaluate(() => [...document.styleSheets].map((s) => s.href ?? '').filter((h) => /LandingPage/.test(h)))
    expect(css).toEqual([])
    console.log(`${route}: ${scripts.length} scripts: ${scripts.map((s) => s.replace('/assets/', '')).join(', ')}`)
  })
}

test('the landing page does load its own chunks (control)', async ({ page }) => {
  const scripts: string[] = []
  page.on('request', (r) => {
    if (r.resourceType() === 'script') scripts.push(new URL(r.url()).pathname)
  })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  expect(scripts.some((s) => /LandingPage/.test(s))).toBe(true)
})
