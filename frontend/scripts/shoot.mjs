// Quick visual pass: full-page section screenshots at one viewport.
import { chromium } from '@playwright/test'
const [w = '1440', h = '900', out = '.', extra = ''] = process.argv.slice(2)
const browser = await chromium.launch({ channel: 'chrome', args: extra === 'nogl' ? ['--disable-webgl', '--disable-3d-apis'] : [] })
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, reducedMotion: extra === 'reduce' ? 'reduce' : 'no-preference', hasTouch: +w < 768, isMobile: +w < 768 })
const page = await ctx.newPage()
const logs = []
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`))
page.on('requestfailed', (r) => logs.push(`requestfailed: ${r.url()}`))
await page.goto(`${process.env.BASE ?? 'http://localhost:4317'}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const ids = ['top', 'sandbox', 'how', 'topologies', 'reliability', 'paths', 'method', 'start']
for (const id of ids) {
  await page.evaluate((id) => {
    const el = document.getElementById(id)
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - (id === 'top' ? 0 : 63))
  }, id)
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `${out}/${w}-${id}.png` })
}
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
await page.waitForTimeout(1200)
await page.screenshot({ path: `${out}/${w}-footer.png` })
const info = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, renderer: document.querySelector('.ns-hero__scene')?.dataset.renderer, engine: window.__nsEngine }))
console.log(JSON.stringify(info), '\n' + logs.join('\n'))
await browser.close()
