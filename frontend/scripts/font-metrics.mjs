// Derives metric-matched fallback overrides (size-adjust, ascent, descent)
// by measuring the vendored fonts against local fallbacks in Chrome.
import { chromium } from '@playwright/test'
import fs from 'node:fs'
const dir = new URL('../public/landing-fonts/', import.meta.url)
const b64 = (f) => fs.readFileSync(new URL(f, dir)).toString('base64')
const fonts = [
  { name: 'Display', file: 'cormorant-garamond-latin-500-normal.woff2', weight: 500, fallback: 'Georgia', sample: 'HOW NETWORKS FAIL. MODEL MEASURE THREE CLASSIC LAYOUTS ESTIMATE RELIABILITY' },
  { name: 'Sans', file: 'inter-latin-wght-normal.woff2', weight: 400, fallback: 'Arial', sample: 'Build a network, simulate component failures, and discover which connections keep it together.' },
  { name: 'Mono', file: 'jetbrains-mono-latin-400-normal.woff2', weight: 400, fallback: 'Menlo', sample: '0123456789 COMPONENTS BRIDGES p = 0.10' },
]
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage()
await page.setContent('<canvas id=c></canvas>')
for (const f of fonts) {
  const r = await page.evaluate(async ({ f, data }) => {
    const face = new FontFace('Probe' + f.name, `url(data:font/woff2;base64,${data})`, { weight: String(f.weight) })
    await face.load()
    document.fonts.add(face)
    const ctx = document.getElementById('c').getContext('2d')
    ctx.font = `${f.weight} 100px Probe${f.name}`
    const real = ctx.measureText(f.sample)
    ctx.font = `${f.weight} 100px ${f.fallback}`
    const fb = ctx.measureText(f.sample)
    return { realW: real.width, fbW: fb.width, asc: real.fontBoundingBoxAscent, desc: real.fontBoundingBoxDescent }
  }, { f, data: b64(f.file) })
  const size = r.realW / r.fbW
  console.log(`${f.name}: size-adjust ${(size * 100).toFixed(1)}%  ascent-override ${(r.asc / size).toFixed(1)}%  descent-override ${(r.desc / size).toFixed(1)}%`)
}
await browser.close()
