import { test as base, expect, type Page } from '@playwright/test'

export const SECTIONS = ['top', 'sandbox', 'how', 'topologies', 'reliability', 'paths', 'method', 'start'] as const

/** Console errors and warnings, page errors and failed requests, collected per test. */
export const test = base.extend<{ issues: string[] }>({
  issues: async ({ page }, provide) => {
    const issues: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') issues.push(`console.${m.type()}: ${m.text()}`)
    })
    page.on('pageerror', (e) => issues.push(`pageerror: ${e.message}`))
    page.on('requestfailed', (r) => issues.push(`requestfailed: ${r.url()} ${r.failure()?.errorText ?? ''}`))
    page.on('response', (r) => {
      if (r.status() >= 400) issues.push(`http ${r.status()}: ${r.url()}`)
    })
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number; __shifts: unknown[]; __longtasks: number[] }
      w.__cls = 0
      w.__shifts = []
      w.__longtasks = []
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: Array<{ node?: Node }> }>) {
          if (e.hadRecentInput) continue
          w.__cls += e.value
          w.__shifts.push({ value: e.value, nodes: (e.sources ?? []).map((s) => (s.node as Element | undefined)?.outerHTML?.slice(0, 120)) })
        }
      }).observe({ type: 'layout-shift', buffered: true })
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) w.__longtasks.push(e.duration)
      }).observe({ type: 'longtask', buffered: true })
    })
    await provide(issues)
  },
})
export { expect }

export async function open(page: Page, path = '/') {
  await page.goto(path, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
}

/** Jump to a section the way an anchor would, then let scrubs and reveals settle. */
export async function goToSection(page: Page, id: string, settle = 1400) {
  await page.evaluate((id) => {
    const el = document.getElementById(id)!
    const y = el.getBoundingClientRect().top + window.scrollY - (id === 'top' ? 0 : 63)
    window.scrollTo(0, y)
  }, id)
  await page.waitForTimeout(settle)
}

/** Scroll the whole page in viewport sized steps so every reveal fires. */
export async function scrollThrough(page: Page, stepFraction = 0.7, pause = 160) {
  await page.evaluate(
    async ({ stepFraction, pause }) => {
      const step = Math.round(window.innerHeight * stepFraction)
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y)
        await new Promise((r) => setTimeout(r, pause))
      }
      window.scrollTo(0, document.documentElement.scrollHeight)
      await new Promise((r) => setTimeout(r, pause))
    },
    { stepFraction, pause }
  )
}

/** Layout checks for whatever is currently in the viewport. Returns a list of problems. */
export async function layoutProblems(page: Page, opts: { touch: boolean }) {
  return page.evaluate(({ touch }) => {
    const problems: string[] = []
    const vw = document.documentElement.clientWidth
    const vh = window.innerHeight
    const desc = (el: Element) => {
      const id = el.id ? `#${el.id}` : ''
      const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''
      const text = (el.textContent ?? '').trim().slice(0, 32)
      return `${el.tagName.toLowerCase()}${id}${cls} "${text}"`
    }
    const inView = (r: DOMRect) => r.bottom > 0 && r.top < vh && r.width > 0 && r.height > 0
    const visible = (el: Element) => {
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') return false
      if (el.closest('[aria-hidden="true"]') && !el.closest('svg')) return false
      return true
    }
    const clipped = (el: Element) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const cs = getComputedStyle(p)
        if (/(hidden|clip)/.test(cs.overflowX)) {
          const r = p.getBoundingClientRect()
          if (r.left >= -1 && r.right <= vw + 1) return true
        }
      }
      return false
    }

    if (document.documentElement.scrollWidth !== vw) problems.push(`horizontal overflow: scrollWidth ${document.documentElement.scrollWidth} vs ${vw}`)

    const all = Array.from(document.querySelectorAll<HTMLElement>('.ns-landing *'))
    for (const el of all) {
      if (el instanceof SVGElement && !(el instanceof SVGSVGElement)) continue
      const r = el.getBoundingClientRect()
      if (!inView(r) || !visible(el)) continue
      if ((r.right > vw + 1 || r.left < -1) && !clipped(el) && !el.closest('.ns-skip')) problems.push(`wider than viewport: ${desc(el)} [${Math.round(r.left)}, ${Math.round(r.right)}]`)
    }

    // Text measured with Range rects: it must stay inside its block horizontally
    // and inside every clipping ancestor (line masks included).
    const intentional = '.ns-words, .ns-track-mask, .ns-roll, .ns-hero__scene, .ns-skip, svg, [style*="clip: rect"], [hidden]'
    const walker = document.createTreeWalker(document.querySelector('.ns-landing')!, NodeFilter.SHOW_TEXT)
    const range = document.createRange()
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!(node.textContent ?? '').trim()) continue
      const parent = node.parentElement!
      if (parent.closest(intentional) || !visible(parent)) continue
      range.selectNodeContents(node)
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && inView(r))
      if (!rects.length) continue
      let block: HTMLElement | null = parent
      while (block && getComputedStyle(block).display.startsWith('inline')) block = block.parentElement
      const br = block?.getBoundingClientRect()
      for (const r of rects) {
        if (br && (r.left < br.left - 1 || r.right > br.right + 1)) {
          problems.push(`text overflows block: ${desc(block!)} [${r.left.toFixed(0)}, ${r.right.toFixed(0)}] vs [${br.left.toFixed(0)}, ${br.right.toFixed(0)}]`)
          break
        }
        let clippedBy: Element | null = null
        for (let p: HTMLElement | null = parent; p && !clippedBy; p = p.parentElement) {
          const cs = getComputedStyle(p)
          if (!/(hidden|clip)/.test(cs.overflowX + cs.overflowY)) continue
          const pr = p.getBoundingClientRect()
          if (r.top < pr.top - 1 || r.bottom > pr.bottom + 1 || r.left < pr.left - 1 || r.right > pr.right + 1) clippedBy = p
        }
        if (clippedBy) {
          problems.push(`text clipped: "${(node.textContent ?? '').trim().slice(0, 30)}" by ${desc(clippedBy)}`)
          break
        }
      }
    }

    const clippedOut = (el: Element) => {
      const r = el.getBoundingClientRect()
      for (let p = el.parentElement; p; p = p.parentElement) {
        const cs = getComputedStyle(p)
        if (!/(hidden|clip)/.test(cs.overflowX + cs.overflowY)) continue
        const pr = p.getBoundingClientRect()
        if (r.bottom <= pr.top + 1 || r.top >= pr.bottom - 1 || r.right <= pr.left + 1 || r.left >= pr.right - 1) return true
      }
      return false
    }
    // Overlapping interactive elements.
    const controls = Array.from(document.querySelectorAll<HTMLElement>('.ns-landing a, .ns-landing button, .ns-landing input, .ns-landing select')).filter((el) => {
      const r = el.getBoundingClientRect()
      return inView(r) && visible(el) && !el.closest('.ns-skip') && getComputedStyle(el).opacity !== '0'
    })
    for (let i = 0; i < controls.length; i++) {
      for (let j = i + 1; j < controls.length; j++) {
        const a = controls[i]
        const b = controls[j]
        if (a.contains(b) || b.contains(a)) continue
        // Page content scrolls under the fixed header by design; compare header controls only with each other.
        if (Boolean(a.closest('.ns-header')) !== Boolean(b.closest('.ns-header'))) continue
        // Rows outside a clipping viewport (word drum) are not visible.
        if (clippedOut(a) || clippedOut(b)) continue
        const ra = a.getBoundingClientRect()
        const rb = b.getBoundingClientRect()
        const ix = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left)
        const iy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top)
        if (ix > 1 && iy > 1) problems.push(`overlapping controls: ${desc(a)} and ${desc(b)}`)
      }
    }

    if (touch) {
      for (const el of controls) {
        if (el.closest('.ns-header') && el.matches('.ns-navlink')) continue
        const r = el.getBoundingClientRect()
        if (r.height < 39.5) problems.push(`touch target under 40px: ${desc(el)} (${r.height.toFixed(1)}px)`)
      }
      document.querySelectorAll('[data-hit="node"]').forEach((g) => {
        const r = g.getBoundingClientRect()
        if (inView(r) && (r.width < 39.5 || r.height < 39.5)) problems.push(`node target under 40px: ${desc(g)}`)
      })
    }
    return problems
  }, opts)
}

/** Grid snapping and container edge measurements for the whole page. */
export async function alignmentReport(page: Page) {
  return page.evaluate(() => {
    const rows: Array<{ section: string; cell: string; text: string; left: number; right: number; colStart: number; colEnd: number; ok: boolean }> = []
    const problems: string[] = []
    const edges = new Set<string>()
    document.querySelectorAll<HTMLElement>('[data-container]').forEach((c) => {
      const r = c.getBoundingClientRect()
      const cs = getComputedStyle(c)
      edges.add(`${Math.round(r.left + parseFloat(cs.paddingLeft))}|${Math.round(r.right - parseFloat(cs.paddingRight))}`)
    })
    document.querySelectorAll<HTMLElement>('[data-grid]').forEach((grid) => {
      const cs = getComputedStyle(grid)
      const cols = cs.gridTemplateColumns.split(' ').map(parseFloat)
      const gap = parseFloat(cs.columnGap) || 0
      const g = grid.getBoundingClientRect()
      const starts: number[] = []
      const ends: number[] = []
      let x = g.left + parseFloat(cs.paddingLeft)
      cols.forEach((w) => {
        starts.push(x)
        ends.push(x + w)
        x += w + gap
      })
      const section = grid.closest('section, footer, header')?.id || grid.closest('footer')?.tagName.toLowerCase() || 'unknown'
      Array.from(grid.children).forEach((cell) => {
        const r = cell.getBoundingClientRect()
        if (r.width === 0) return
        const near = (v: number, arr: number[]) => arr.reduce((best, a, i) => (Math.abs(a - v) < Math.abs(arr[best] - v) ? i : best), 0)
        const si = near(r.left, starts)
        const ei = near(r.right, ends)
        const ok = Math.abs(starts[si] - r.left) <= 1 && Math.abs(ends[ei] - r.right) <= 1
        const text = (cell.querySelector('h1, h2, h3, p')?.textContent ?? '').trim().slice(0, 40)
        rows.push({ section, cell: (cell as HTMLElement).dataset.cell ?? '', text, left: Math.round(r.left * 10) / 10, right: Math.round(r.right * 10) / 10, colStart: si + 1, colEnd: ei + 1, ok })
        if (!ok) problems.push(`off grid: ${section} "${text}" left ${r.left.toFixed(1)} right ${r.right.toFixed(1)}`)
      })
    })
    if (edges.size !== 1) problems.push(`container edges differ: ${[...edges].join(', ')}`)
    document.querySelectorAll<HTMLElement>('[data-align="start"]').forEach((el) => {
      const c = el.closest<HTMLElement>('[data-container]')!
      const cl = c.getBoundingClientRect().left + parseFloat(getComputedStyle(c).paddingLeft)
      const l = el.getBoundingClientRect().left
      if (Math.abs(l - cl) > 1) problems.push(`left edge off container: ${el.closest('section')?.id} ${l.toFixed(1)} vs ${cl.toFixed(1)}`)
    })
    // CTA pairs: equal height and shared top and bottom.
    document.querySelectorAll('.ns-btn-pair').forEach((pair) => {
      const btns = Array.from(pair.querySelectorAll<HTMLElement>('.ns-btn'))
      const rs = btns.map((b) => b.getBoundingClientRect())
      for (const r of rs) {
        if (Math.abs(r.height - rs[0].height) > 0.5) problems.push(`CTA pair heights differ in ${pair.closest('section')?.id}`)
        if (Math.abs(r.top - rs[0].top) > 0.5 && rs.length > 1 && Math.abs(r.left - rs[0].left) > 1) problems.push(`CTA pair tops differ in ${pair.closest('section')?.id}`)
      }
    })
    return { rows, problems, edges: [...edges] }
  })
}
