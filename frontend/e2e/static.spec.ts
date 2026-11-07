import fs from 'node:fs'
import path from 'node:path'
import { test, expect, open } from './helpers'
import { PAIRS, ratio } from '../scripts/contrast.mjs'

const root = path.resolve(import.meta.dirname, '..')
const landingFiles = () => {
  const out: string[] = []
  const walk = (d: string) =>
    fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(tsx?|css)$/.test(e.name)) out.push(p)
    })
  walk(path.join(root, 'src/landing'))
  out.push(path.join(root, 'src/pages/LandingPage.tsx'))
  return out
}

test('no em dashes in landing source or rendered copy', async ({ page }) => {
  for (const f of landingFiles()) expect(fs.readFileSync(f, 'utf8').includes('—'), f).toBe(false)
  await open(page)
  expect(await page.evaluate(() => document.body.innerText.includes('—'))).toBe(false)
})

test('no teal, cyan, amber, green or purple in landing styles', () => {
  const banned = /\b(teal|cyan|amber|green|emerald|purple|violet|indigo)\b|#2dd4bf|#14b8a6|#38bdf8|#10b981|#f59e0b|#a78bfa|#34d399|#fbbf24|#818cf8/i
  for (const f of landingFiles()) {
    const hits = fs.readFileSync(f, 'utf8').split('\n').filter((l) => banned.test(l))
    expect(hits, f).toEqual([])
  }
})

test('token contrast pairs meet WCAG AA', () => {
  const need: Record<string, number> = { text: 4.5, large: 3, ui: 3, deco: 0 }
  for (const [bg, fg, use, kind] of PAIRS) {
    if (use.includes('rejected')) continue
    expect(ratio(bg, fg), use).toBeGreaterThanOrEqual(need[kind])
  }
})

test.describe('rendered contrast', () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  test('every rendered text colour meets AA against its section surface', async ({ page }) => {
    await open(page)
    const failures = await page.evaluate(async () => {
      const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number)
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
      }
      const contrast = (a: number[], b: number[]) => {
        const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
        return (x + 0.05) / (y + 0.05)
      }
      const surface = (el: Element): number[] => {
        for (let p: Element | null = el; p; p = p.parentElement) {
          const bg = getComputedStyle(p).backgroundColor
          const v = parse(bg)
          if (v.length >= 3 && (v.length === 3 || v[3] > 0.9)) return v.slice(0, 3)
          // Panel wipe sections paint their surface on a sibling layer.
          if (p.matches('section[data-tone="light"]')) return [243, 245, 247]
        }
        return [23, 24, 27]
      }
      const out: string[] = []
      const seen = new Set<string>()
      document.querySelectorAll<HTMLElement>('.ns-landing *').forEach((el) => {
        const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent!.trim())
        if (!own || el.closest('svg, [aria-hidden="true"], .ns-skip, .ns-menu, [hidden], .ns-tooltip, .ns-toasts')) return
        const cs = getComputedStyle(el)
        if (cs.visibility === 'hidden' || cs.display === 'none') return
        const fg = parse(cs.color).slice(0, 3)
        const bg = surface(el)
        const r = contrast(fg, bg)
        const size = parseFloat(cs.fontSize)
        const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700)
        const need = large ? 3 : 4.5
        let o = 1
        for (let p: HTMLElement | null = el; p; p = p.parentElement) o *= Number(getComputedStyle(p).opacity)
        const disabled = el.closest('button:disabled, [aria-disabled="true"], input:disabled, select:disabled')
        if (r < need && o > 0.9 && !disabled) {
          const key = `${cs.color} on ${bg.join(',')}`
          if (!seen.has(key)) out.push(`${key} = ${r.toFixed(2)} (${el.tagName} "${el.textContent!.trim().slice(0, 24)}")`)
          seen.add(key)
        }
      })
      return out
    })
    expect(failures).toEqual([])
  })
})
