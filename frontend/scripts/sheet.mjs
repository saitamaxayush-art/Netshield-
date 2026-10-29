// Contact sheet: lay screenshots side by side and capture one image.
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
const [out, scale = '0.5', cols = '0', ...files] = process.argv.slice(2)
const imgs = files.map((f) => `<figure><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"><figcaption>${path.basename(f)}</figcaption></figure>`).join('')
const browser = await chromium.launch({ channel: 'chrome' })
const page = await browser.newPage({ viewport: { width: 400, height: 400 }, deviceScaleFactor: +scale })
await page.setContent(`<style>body{margin:0;display:${+cols ? 'grid' : 'flex'};grid-template-columns:repeat(${cols},max-content);gap:8px;background:#fff;font:12px sans-serif;width:max-content}figure{margin:0}img{display:block}</style>${imgs}`)
await page.screenshot({ path: out, fullPage: true })
await browser.close()
