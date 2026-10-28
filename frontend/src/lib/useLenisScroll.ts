import { useEffect, useRef } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { usePrefersReducedMotion } from './useReducedMotion'

gsap.registerPlugin(ScrollTrigger)

// Shared mutable store for components like React Three Fiber to avoid React state re-renders
export const scrollStore = {
  progress: 0,
  velocity: 0,
  scroll: 0,
}

/**
 * Hook providing inertial smooth scrolling unified with GSAP ScrollTrigger ticker.
 * Strictly respects prefers-reduced-motion and touch device ergonomics.
 */
export function useLenisScroll(enabled: boolean = true) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    if (!enabled || prefersReducedMotion || typeof window === 'undefined') {
      return
    }

    const lenis = new Lenis({
      lerp: 0.09,
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.0,
      syncTouch: false,
    })

    lenisRef.current = lenis

    // Update ScrollTrigger and shared mutable store on Lenis scroll
    lenis.on('scroll', (e: { progress?: number; velocity?: number; scroll?: number }) => {
      ScrollTrigger.update()
      scrollStore.progress = e.progress ?? 0
      scrollStore.velocity = e.velocity ?? 0
      scrollStore.scroll = e.scroll ?? 0
    })

    // Drive Lenis from GSAP's unified ticker for single requestAnimationFrame loop
    const tickerCallback = (time: number) => {
      lenis.raf(time * 1000)
    }

    gsap.ticker.add(tickerCallback)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(tickerCallback)
      lenis.destroy()
      lenisRef.current = null
      ScrollTrigger.getAll().forEach((t) => t.kill())
    }
  }, [enabled, prefersReducedMotion])

  return lenisRef
}
