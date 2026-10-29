import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)

/** Motion tokens (DESIGN.md section 4). */
export const EASE = {
  reveal: 'cubic-bezier(0.16, 1, 0.3, 1)',
  wipe: 'cubic-bezier(0.76, 0, 0.24, 1)',
  scrub: 'none',
} as const
export const DUR = { reveal: 1.1, wipe: 1.4, menu: 0.9, ui: 0.18 } as const
export const STAGGER = { line: 0.1 } as const
export const SCRUB = 0.8

// GSAP has no named cubic-bezier ease, so register the two token curves.
function bezier(x1: number, y1: number, x2: number, y2: number) {
  // Newton iteration on the x curve, then evaluate y.
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t
  const sy = (t: number) => ((ay * t + by) * t + cy) * t
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 6; i++) {
      const d = dx(t)
      if (Math.abs(d) < 1e-6) break
      t -= (sx(t) - x) / d
    }
    return sy(Math.min(1, Math.max(0, t)))
  }
}
gsap.registerEase('nsReveal', bezier(0.16, 1, 0.3, 1))
gsap.registerEase('nsWipe', bezier(0.76, 0, 0.24, 1))

/**
 * Shared scroll state. Read by the hero scene, cursor, header and rotating
 * label from the gsap ticker, so scrolling never triggers React renders.
 */
export const scrollState = {
  y: 0,
  velocity: 0,
  direction: 1 as 1 | -1,
  progress: 0,
  limit: 1,
}

/** Pointer state, written by one window listener. */
export const pointerState = { x: 0, y: 0, nx: 0, ny: 0, fine: false, inside: false }

declare global {
  interface Window {
    /** Test hook: simulate a motion engine failure. */
    __NS_FORCE_MOTION_FAILURE?: boolean
    __nsEngine?: { lenis: boolean; refreshes: number; failed: boolean }
    /** Rendered WebGL hero frames (tests check the loop pauses). */
    __nsHeroFrames?: number
  }
}

let lenis: Lenis | null = null
let failed = false
let refreshes = 0

export const reducedMotionQuery = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** True when JS animation may run: no reduced motion and the engine is healthy. */
export function motionEnabled(): boolean {
  if (typeof window === 'undefined') return false
  if (window.__NS_FORCE_MOTION_FAILURE) return false
  return !failed && !reducedMotionQuery()
}

export function getLenis() {
  return lenis
}

/** Debounced, de-duplicated ScrollTrigger refresh. */
let refreshTimer: number | undefined
export function scheduleRefresh(delay = 120) {
  window.clearTimeout(refreshTimer)
  refreshTimer = window.setTimeout(() => {
    refreshes++
    if (window.__nsEngine) window.__nsEngine.refreshes = refreshes
    ScrollTrigger.refresh()
  }, delay)
}

export function headerOffset() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--ns-header-h')
  return parseFloat(raw) || 64
}

/** Scroll to an element or y position, with Lenis when active. */
export function scrollToTarget(target: string | HTMLElement | number, opts: { offset?: number; immediate?: boolean } = {}) {
  const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target
  if (el === null) return
  const offset = opts.offset ?? 0
  const immediate = opts.immediate || reducedMotionQuery()
  if (lenis && !immediate) {
    lenis.scrollTo(el as HTMLElement | number, { offset, duration: 1.2, easing: (t: number) => 1 - Math.pow(1 - t, 4) })
    return
  }
  const y = typeof el === 'number' ? el : el.getBoundingClientRect().top + window.scrollY + offset
  window.scrollTo({ top: y, behavior: immediate ? 'auto' : 'smooth' })
}

/** Stop and resume page scroll (menu overlay). */
export function lockScroll(locked: boolean) {
  const root = document.documentElement
  if (locked) {
    const gap = window.innerWidth - root.clientWidth
    root.style.setProperty('--ns-scrollbar-gap', `${gap}px`)
    root.style.paddingRight = gap ? `${gap}px` : ''
    root.style.overflow = 'hidden'
    lenis?.stop()
  } else {
    root.style.overflow = ''
    root.style.paddingRight = ''
    root.style.removeProperty('--ns-scrollbar-gap')
    lenis?.start()
  }
}

function writeNativeScroll() {
  const limit = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
  const y = window.scrollY
  scrollState.velocity = y - scrollState.y
  if (scrollState.velocity !== 0) scrollState.direction = scrollState.velocity > 0 ? 1 : -1
  scrollState.y = y
  scrollState.limit = limit
  scrollState.progress = Math.min(1, Math.max(0, y / limit))
}

/**
 * Start the landing motion engine. Returns a teardown that restores the
 * document to its original state (used on route change and StrictMode).
 */
export function startEngine(): () => void {
  window.__nsEngine = { lenis: false, refreshes, failed: false }
  const root = document.documentElement
  const hadSmooth = root.classList.contains('scroll-smooth')
  root.classList.remove('scroll-smooth')
  root.style.setProperty('--ns-header-h', '64px')

  const onPointer = (e: PointerEvent) => {
    pointerState.x = e.clientX
    pointerState.y = e.clientY
    pointerState.nx = (e.clientX / window.innerWidth) * 2 - 1
    pointerState.ny = (e.clientY / window.innerHeight) * 2 - 1
    pointerState.fine = e.pointerType === 'mouse' || e.pointerType === 'pen'
    pointerState.inside = true
  }
  window.addEventListener('pointermove', onPointer, { passive: true })

  ScrollTrigger.config({ ignoreMobileResize: true, autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load' })

  // Debounced refresh on width changes only (mobile toolbars change height).
  let lastWidth = window.innerWidth
  const onResize = () => {
    if (window.innerWidth === lastWidth) return
    lastWidth = window.innerWidth
    scheduleRefresh(200)
  }
  window.addEventListener('resize', onResize)

  let tick: ((time: number) => void) | null = null
  const onNativeScroll = () => writeNativeScroll()

  try {
    if (window.__NS_FORCE_MOTION_FAILURE) throw new Error('Forced motion failure (test hook)')
    if (!reducedMotionQuery()) {
      lenis = new Lenis({ lerp: 0.09, smoothWheel: true, syncTouch: false, autoRaf: false, anchors: false })
      lenis.on('scroll', (l: Lenis) => {
        scrollState.y = l.scroll
        scrollState.velocity = l.velocity
        scrollState.direction = l.direction === -1 ? -1 : 1
        scrollState.limit = Math.max(1, l.limit)
        scrollState.progress = l.progress
        ScrollTrigger.update()
      })
      tick = (time: number) => lenis?.raf(time * 1000)
      gsap.ticker.add(tick)
      gsap.ticker.lagSmoothing(0)
      window.__nsEngine.lenis = true
    } else {
      window.addEventListener('scroll', onNativeScroll, { passive: true })
    }
  } catch (err) {
    failed = true
    window.__nsEngine.failed = true
    lenis?.destroy()
    lenis = null
    window.addEventListener('scroll', onNativeScroll, { passive: true })
    console.info('[NetShield] Motion disabled, content shown statically.', (err as Error).message)
  }
  writeNativeScroll()

  // One refresh once fonts are ready (layout final for text).
  let alive = true
  document.fonts?.ready.then(() => alive && scheduleRefresh(60))

  return () => {
    alive = false
    window.removeEventListener('pointermove', onPointer)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('scroll', onNativeScroll)
    if (tick) gsap.ticker.remove(tick)
    lenis?.destroy()
    lenis = null
    failed = false
    window.clearTimeout(refreshTimer)
    lockScroll(false)
    if (hadSmooth) root.classList.add('scroll-smooth')
  }
}
