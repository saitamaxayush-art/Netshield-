import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { scrollState } from '../motion/engine'

/** 2px signal red progress line, written from the shared ticker. */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let last = -1
    const tick = () => {
      const p = Math.round(scrollState.progress * 1000) / 1000
      if (p === last || !ref.current) return
      last = p
      ref.current.style.transform = `scaleX(${p})`
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [])
  return <div ref={ref} className="ns-progress" aria-hidden="true" />
}
