import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'

const WIDTHS = [360, 390, 414, 768, 820, 1024, 1280, 1440, 1680, 1920]
const MOBILE_LANDSCAPES = [
  { width: 844, height: 390, label: '390-landscape' },
  { width: 896, height: 414, label: '414-landscape' },
]

const ROUTES = [
  { path: '/', name: 'landing' },
  { path: '/dashboard', name: 'dashboard' },
  { path: '/studio', name: 'studio' },
  { path: '/privacy', name: 'privacy' },
  { path: '/terms', name: 'terms' },
  { path: '/404', name: 'not-found' },
]

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'audit-screenshots')
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

async function runAudit() {
  console.log('🚀 Starting Precision Layout & Alignment Audit...')
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  })

  const results = {
    overflows: [],
    defects: [],
    metrics: {},
  }

  const page = await browser.newPage()

  for (const route of ROUTES) {
    console.log(`\n--- Auditing Route: ${route.path} (${route.name}) ---`)
    for (const w of WIDTHS) {
      const h = 900
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 })
      await page.goto(`http://127.0.0.1:5173${route.path}`, { waitUntil: 'networkidle2' })
      // Brief stabilization for fonts/styles
      await new Promise((r) => setTimeout(r, 400))

      const auditData = await page.evaluate((width) => {
        const docWidth = document.documentElement.clientWidth
        const scrollWidth = document.documentElement.scrollWidth
        const bodyScrollWidth = document.body.scrollWidth
        const maxScrollWidth = Math.max(scrollWidth, bodyScrollWidth)
        const hasOverflow = maxScrollWidth > width

        // Find elements causing horizontal overflow
        const overflowingElements = []
        if (hasOverflow) {
          const all = document.querySelectorAll('*')
          all.forEach((el) => {
            const rect = el.getBoundingClientRect()
            if (rect.right > width + 1 || rect.left < -1) {
              overflowingElements.push({
                tag: el.tagName.toLowerCase(),
                className: (el.className || '').toString().slice(0, 80),
                rect: { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) },
              })
            }
          })
        }

        // Check button heights and alignment
        const buttons = Array.from(document.querySelectorAll('button, a[role="button"], a.btn, a[class*="px-"]')).map((b) => {
          const r = b.getBoundingClientRect()
          return {
            text: (b.innerText || '').slice(0, 25).trim(),
            height: Math.round(r.height),
            top: Math.round(r.top),
          }
        })

        // Check container left paddings
        const containers = Array.from(document.querySelectorAll('[class*="max-w-"]')).slice(0, 8).map((c) => {
          const r = c.getBoundingClientRect()
          const cs = window.getComputedStyle(c)
          return {
            left: Math.round(r.left),
            right: Math.round(r.right),
            paddingLeft: cs.paddingLeft,
            paddingRight: cs.paddingRight,
          }
        })

        return {
          docWidth,
          maxScrollWidth,
          hasOverflow,
          overflowingElements: overflowingElements.slice(0, 5),
          buttons: buttons.slice(0, 8),
          containers,
        }
      }, w)

      if (auditData.hasOverflow) {
        console.warn(`⚠️ OVERFLOW at ${route.path} @ ${w}px: scrollWidth=${auditData.maxScrollWidth} > clientWidth=${w}`)
        results.overflows.push({
          route: route.path,
          width: w,
          scrollWidth: auditData.maxScrollWidth,
          elements: auditData.overflowingElements,
        })
      } else {
        process.stdout.write(`✓ ${w}px `)
      }

      // Save screenshot for key widths or mobile
      if ([360, 390, 768, 1280, 1440].includes(w)) {
        const screenshotPath = path.join(SCREENSHOT_DIR, `${route.name}-${w}px.png`)
        await page.screenshot({ path: screenshotPath, fullPage: true })
      }
    }

    // Mobile landscapes
    for (const landscape of MOBILE_LANDSCAPES) {
      await page.setViewport({ width: landscape.width, height: landscape.height })
      await page.goto(`http://127.0.0.1:5173${route.path}`, { waitUntil: 'networkidle2' })
      const hasOverflow = await page.evaluate((w) => {
        return Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > w
      }, landscape.width)

      if (hasOverflow) {
        console.warn(`⚠️ OVERFLOW at ${route.path} @ ${landscape.label}`)
        results.overflows.push({ route: route.path, width: landscape.label, landscape: true })
      }
    }
  }

  await browser.close()
  fs.writeFileSync('audit-results.json', JSON.stringify(results, null, 2))
  console.log('\n\n✅ Audit Run Complete! Results written to audit-results.json and screenshots to audit-screenshots/')
}

runAudit().catch((err) => {
  console.error('Audit failed:', err)
  process.exit(1)
})
