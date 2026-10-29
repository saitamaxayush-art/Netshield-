import fs from 'node:fs'
import path from 'node:path'
import { test, expect, open, goToSection, scrollThrough, layoutProblems, alignmentReport, SECTIONS } from './helpers'

const VIEWPORTS = [
  ...[360, 390, 414, 768, 820, 1024, 1280, 1440, 1680, 1920].map((w) => ({ label: `${w}`, width: w, height: w < 768 ? 800 : w < 1280 ? 1000 : 900, touch: w < 1024 })),
  { label: '844x390-landscape', width: 844, height: 390, touch: true },
]
const OUT = path.resolve(import.meta.dirname, '../../audit-screenshots/landing')

for (const vp of VIEWPORTS) {
  test.describe(`audit ${vp.label}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch, isMobile: vp.touch && vp.width < 900 })

    test(`layout, alignment, CLS and console at ${vp.label}`, async ({ page, issues }) => {
      const dir = path.join(OUT, vp.label)
      fs.mkdirSync(dir, { recursive: true })
      await open(page)
      await scrollThrough(page)
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(600)

      const problems: string[] = []
      for (const id of SECTIONS) {
        await goToSection(page, id)
        await page.screenshot({ path: path.join(dir, `${id}.png`) })
        for (const p of await layoutProblems(page, { touch: vp.touch })) problems.push(`[${id}] ${p}`)
      }
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await page.waitForTimeout(1000)
      await page.screenshot({ path: path.join(dir, `footer.png`) })
      for (const p of await layoutProblems(page, { touch: vp.touch })) problems.push(`[footer] ${p}`)

      const align = await alignmentReport(page)
      fs.writeFileSync(path.join(OUT, `alignment-${vp.label}.json`), JSON.stringify(align, null, 2))
      problems.push(...align.problems)

      const fonts = await page.evaluate(() =>
        ['500 20px "NS Display"', 'italic 500 20px "NS Display"', '400 16px "NS Sans"', '500 12px "NS Mono"'].filter((f) => !document.fonts.check(f))
      )
      expect(fonts, 'fonts not loaded').toEqual([])
      const cls = await page.evaluate(() => (window as unknown as { __cls: number; __shifts: unknown[] }).__cls)
      const shifts = await page.evaluate(() => (window as unknown as { __shifts: unknown[] }).__shifts)
      expect(cls, `CLS ${cls} ${JSON.stringify(shifts).slice(0, 600)}`).toBeLessThan(0.02)
      expect(problems).toEqual([])
      expect(issues).toEqual([])
    })
  })
}
