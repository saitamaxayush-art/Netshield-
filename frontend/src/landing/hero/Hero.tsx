import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowDown, ArrowUpRight } from 'lucide-react'
import { LContainer, LGrid, Cell, Eyebrow } from '../components/Layout'
import { ScriptCaps } from '../components/SplitLines'
import { LButtonLink, Magnetic } from '../components/Button'
import { RotatingLabel } from '../components/RotatingLabel'
import { DUR, headerOffset, motionEnabled, reducedMotionQuery, scrollToTarget } from '../motion/engine'
import { buildHeroModel, HERO_SEED } from './heroModel'
import { HeroSvg } from './HeroSvg'

const HeroScene = lazy(() => import('./HeroScene'))

type Renderer = 'svg' | 'webgl'

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

function lowPower() {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  return Boolean(nav.connection?.saveData) || (nav.hardwareConcurrency ?? 8) <= 2 || (nav.deviceMemory ?? 8) <= 2
}

/** Pick the renderer once: query override, then reduced motion, WebGL support and power. */
function initialRenderer(): Renderer {
  const q = new URLSearchParams(window.location.search).get('hero')
  if (q === 'svg') return 'svg'
  if (q === 'webgl') return hasWebGL() ? 'webgl' : 'svg'
  if (reducedMotionQuery() || window.__NS_FORCE_MOTION_FAILURE) return 'svg'
  if (!hasWebGL() || lowPower()) return 'svg'
  return 'webgl'
}

export function Hero() {
  const mobile = typeof window !== 'undefined' && window.innerWidth < 768
  const model = useMemo(() => buildHeroModel(mobile ? 40 : 64), [mobile])
  const [renderer, setRenderer] = useState<Renderer>(() => initialRenderer())
  const [glReady, setGlReady] = useState(false)
  // The SVG frame paints first; the WebGL scene (three.js chunk) loads once the browser is idle.
  const [glWanted, setGlWanted] = useState(false)
  useEffect(() => {
    if (renderer !== 'webgl') return
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }
    let idle = 0
    const start = () => {
      idle = w.requestIdleCallback ? w.requestIdleCallback(() => setGlWanted(true), { timeout: 2000 }) : window.setTimeout(() => setGlWanted(true), 600)
    }
    if (document.readyState === 'complete') start()
    else window.addEventListener('load', start, { once: true })
    return () => {
      window.removeEventListener('load', start)
      if (w.cancelIdleCallback) w.cancelIdleCallback(idle)
      else window.clearTimeout(idle)
    }
  }, [renderer])
  const [hovered, setHovered] = useState<string | null>(null)
  const hoveredRef = useRef<string | null>(null)
  const screen = useRef(new Map<string, [number, number]>())
  const visible = useRef(true)
  const section = useRef<HTMLElement>(null)
  const scene = useRef<HTMLDivElement>(null)
  const tip = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = section.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => (visible.current = e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const placeTip = useCallback(() => {
    const id = hoveredRef.current
    const t = tip.current
    if (!t) return
    const p = id ? screen.current.get(id) : null
    if (!p) return
    t.style.transform = `translate3d(${Math.round(p[0] + 14)}px, ${Math.round(p[1] - 34)}px, 0)`
  }, [])

  const setHover = useCallback(
    (id: string | null) => {
      if (hoveredRef.current === id) return
      hoveredRef.current = id
      setHovered(id)
      if (scene.current) {
        if (id) scene.current.dataset.cursor = `Node ${id.slice(1)}`
        else delete scene.current.dataset.cursor
      }
      requestAnimationFrame(placeTip)
    },
    [placeTip]
  )

  // Picking: nearest projected node to the pointer (20px fine, 28px touch).
  useEffect(() => {
    const el = section.current
    if (!el) return
    const nearest = (x: number, y: number, radius: number) => {
      let best: string | null = null
      let bestD = radius * radius
      for (const [id, p] of screen.current) {
        const d = (p[0] - x) ** 2 + (p[1] - y) ** 2
        if (d < bestD) {
          bestD = d
          best = id
        }
      }
      return best
    }
    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      return [e.clientX - r.left, e.clientY - r.top] as const
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      if ((e.target as Element).closest('a, button')) return setHover(null)
      const [x, y] = local(e)
      setHover(nearest(x, y, 20))
    }
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || (e.target as Element).closest('a, button')) return
      const [x, y] = local(e)
      const id = nearest(x, y, 28)
      setHover(id && id !== hoveredRef.current ? id : null)
    }
    const leave = () => setHover(null)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointerleave', leave)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointerleave', leave)
    }
  }, [setHover])

  const onSvgLayout = useCallback(
    (positions: Map<string, [number, number]>) => {
      if (renderer === 'svg' || !glReady) screen.current = positions
      placeTip()
    },
    [renderer, glReady, placeTip]
  )

  const downgrade = useCallback(() => {
    setGlReady(false)
    setRenderer('svg')
  }, [])

  // Supporting copy and CTAs follow the headline.
  useGSAP(
    () => {
      if (!motionEnabled()) return
      gsap.fromTo(
        '.ns-hero-follow',
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: DUR.reveal, ease: 'nsReveal', stagger: 0.1, delay: 0.55, clearProps: 'transform,opacity' }
      )
    },
    { scope: section }
  )

  const degree = hovered ? model.degree[hovered] : 0
  return (
    <section ref={section} id="top" data-chapter="top" data-tone="dark" aria-labelledby="hero-title" className="ns-hero ns-surface-dark">
      <div ref={scene} className="ns-hero__scene" data-renderer={renderer === 'webgl' && glReady ? 'webgl' : 'svg'}>
        <div style={{ position: 'absolute', inset: 0, opacity: renderer === 'webgl' && glReady ? 0 : 1, transition: 'opacity 600ms ease' }}>
          <HeroSvg model={model} hovered={hovered} onLayout={onSvgLayout} />
        </div>
        {renderer === 'webgl' && glWanted && (
          <div style={{ position: 'absolute', inset: 0, opacity: glReady ? 1 : 0, transition: 'opacity 900ms ease' }} data-lenis-prevent="">
            <Suspense fallback={null}>
              <HeroScene
                model={model}
                hovered={hovered}
                visible={visible}
                screen={screen}
                dprCap={mobile ? 1.25 : 1.75}
                onFirstFrame={() => setGlReady(true)}
                onFrame={placeTip}
                onDowngrade={downgrade}
              />
            </Suspense>
          </div>
        )}
        <div className="ns-hero__vignette" />
        <div
          ref={tip}
          className="ns-tooltip"
          role="status"
          style={{ left: 0, top: 0, opacity: hovered ? 1 : 0, transition: 'opacity 160ms ease' }}
        >
          {hovered ? `Node ${hovered.slice(1)}, degree ${degree}` : ''}
        </div>
      </div>

      <LContainer>
        <LGrid style={{ alignItems: 'end', rowGap: 'var(--sp-8)' }}>
          <Cell d="1 / 9" t="1 / 8" m="1 / -1" className="ns-stack" data-align="start" style={{ ['--stack' as string]: 'var(--sp-5)' }}>
            <Eyebrow className="ns-hero-follow">Graph theoretic reliability lab</Eyebrow>
            <ScriptCaps as="h1" id="hero-title" size="mega" accent="Understand" text="how networks fail." emphasis="fail." start="load" delay={0.1} />
            <p className="ns-lead" style={{ maxWidth: '52ch' }}>
              Build a network, simulate component failures, and discover which connections keep it together. NetShield turns graph theory into an
              interactive reliability lab.
            </p>
            <div className="ns-btn-pair ns-hero-follow" style={{ ['--stack' as string]: 'var(--sp-7)' }}>
              <Magnetic>
                <LButtonLink to="/studio" variant="primary" size="lg" icon={<ArrowUpRight aria-hidden="true" />}>
                  Open Simulator
                </LButtonLink>
              </Magnetic>
              <LButtonLink
                to="#method"
                variant="outline"
                size="lg"
                cursor="Read"
                onClick={(e) => {
                  e.preventDefault()
                  scrollToTarget('#method', { offset: -headerOffset() + 1 })
                }}
              >
                Explore the Method
              </LButtonLink>
            </div>
          </Cell>
          <Cell d="10 / 13" t="1 / -1" m="1 / -1" className="ns-hero-aside ns-hero-follow">
            <p className="ns-micro ns-hero-caption" style={{ margin: 0 }}>
              Example network, seed {HERO_SEED}, {model.graph.nodes.length} nodes, {model.graph.edges.length} links. Hover or tap a node.
            </p>
            <a
              href="#sandbox"
              className="ns-scroll-cue"
              aria-label="Scroll to explore the network"
              data-cursor="Scroll"
              onClick={(e) => {
                e.preventDefault()
                scrollToTarget('#sandbox', { offset: -headerOffset() + 1 })
              }}
            >
              <RotatingLabel text="Scroll to explore the network">
                <ArrowDown size={20} strokeWidth={1.5} aria-hidden="true" />
              </RotatingLabel>
            </a>
          </Cell>
        </LGrid>
      </LContainer>
    </section>
  )
}
