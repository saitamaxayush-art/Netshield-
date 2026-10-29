// Full page scroll profile at 1440x900: frame intervals, long tasks,
// ScrollTrigger refreshes and DOM mutations while scrolling.
import { chromium } from '@playwright/test'
const base = process.env.BASE ?? 'http://localhost:4317'
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.addInitScript(() => {
  window.__lt = []
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(e.duration))).observe({ type: 'longtask', buffered: true })
})
await page.goto(base + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
// Warm up: visit every section once so lazy work (estimator auto run, sweep) has happened.
await page.evaluate(async () => {
  for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)) }
  window.scrollTo(0, 0)
})
// Let the estimator's on-view run and the sweep finish so they do not count as scroll work.
await page.evaluate(() => document.getElementById('reliability').scrollIntoView())
await page.getByText('11 of 11 runs').waitFor({ timeout: 30000 })
await page.getByRole('button', { name: 'Run trials' }).waitFor()
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(2000)
await page.evaluate(() => {
  window.__lt.length = 0
  window.__frames = []
  window.__mut = 0
  window.__refresh0 = window.__nsEngine.refreshes
  const mo = new MutationObserver((list) => {
    for (const m of list) if (m.type === 'childList' || (m.type === 'characterData')) window.__mut++
  })
  mo.observe(document.querySelector('.ns-landing'), { subtree: true, childList: true, characterData: true })
  window.__mo = mo
  let last = performance.now()
  const loop = (t) => { window.__frames.push(t - last); last = t; if (!window.__stop) requestAnimationFrame(loop) }
  requestAnimationFrame(loop)
})
const total = await page.evaluate(() => document.documentElement.scrollHeight)
const t0 = Date.now()
for (let y = 0; y < total; y += 100) {
  await page.mouse.wheel(0, 100)
  await page.waitForTimeout(16)
}
await page.waitForTimeout(1500)
const r = await page.evaluate(() => {
  window.__stop = true
  window.__mo.disconnect()
  const f = window.__frames.slice(5).sort((a, b) => a - b)
  const avg = f.reduce((s, v) => s + v, 0) / f.length
  const pct = (p) => f[Math.min(f.length - 1, Math.floor(f.length * p))]
  return {
    frames: f.length,
    avgFrameMs: +avg.toFixed(2),
    fps: +(1000 / avg).toFixed(1),
    p95FrameMs: +pct(0.95).toFixed(2),
    p99FrameMs: +pct(0.99).toFixed(2),
    framesOver33ms: f.filter((v) => v > 33.4).length,
    longTasks: window.__lt.map((v) => Math.round(v)),
    scrollTriggerRefreshes: window.__nsEngine.refreshes - window.__refresh0,
    domMutationsDuringScroll: window.__mut,
    renderer: document.querySelector('.ns-hero__scene').dataset.renderer,
  }
})
console.log(JSON.stringify({ ...r, scrollSeconds: (Date.now() - t0) / 1000 }, null, 2))
await browser.close()
