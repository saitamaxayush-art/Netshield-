import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { scrollState } from '../motion/engine'

/** 2px signal red progress line, written from the shared ticker. */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let last = -1
    const tick = () => {
      const p = scrollState.progress
      if (Math.abs(p - last) < 0.0005 || !ref.current) return
      last = p
      ref.current.style.transform = `scaleX(${p.toFixed(4)})`
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [])
  return <div ref={ref} className="ns-progress" aria-hidden="true" />
}
