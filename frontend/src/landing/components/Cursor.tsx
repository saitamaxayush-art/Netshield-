import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { motionEnabled, pointerState } from '../motion/engine'

const INTERACTIVE = 'a, button, [role="button"], [role="tab"], input, select, label, [data-cursor]'

/**
 * Custom square cursor for fine pointers. Follows the pointer exactly (no
 * lag), scales over interactive elements and shows the nearest data-cursor
 * label. pointer-events: none, so it never traps input. Disabled on touch
 * and under reduced motion; the native cursor stays visible either way.
 */
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null)
  const label = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !motionEnabled() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    let x = -100
    let y = -100
    let dirty = false
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') {
        el.dataset.visible = 'false'
        return
      }
      x = e.clientX
      y = e.clientY
      dirty = true
      el.dataset.visible = 'true'
    }
    const over = (e: PointerEvent) => {
      const t = e.target as Element | null
      const hit = t?.closest?.(INTERACTIVE) as HTMLElement | null
      const text = (t?.closest?.('[data-cursor]') as HTMLElement | null)?.dataset.cursor
      el.dataset.active = hit && !(hit as HTMLButtonElement).disabled ? 'true' : 'false'
      if (text && label.current) {
        label.current.textContent = text
        el.setAttribute('data-label', '')
      } else {
        el.removeAttribute('data-label')
      }
    }
    const down = () => (el.dataset.pressed = 'true')
    const up = () => (el.dataset.pressed = 'false')
    const leave = () => (el.dataset.visible = 'false')
    // Position is applied on the shared ticker, one write per frame.
    const tick = () => {
      if (!dirty) return
      dirty = false
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`
    }
    x = pointerState.x
    y = pointerState.y
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerover', over, { passive: true })
    window.addEventListener('pointerdown', down, { passive: true })
    window.addEventListener('pointerup', up, { passive: true })
    document.documentElement.addEventListener('pointerleave', leave)
    gsap.ticker.add(tick)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerover', over)
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerup', up)
      document.documentElement.removeEventListener('pointerleave', leave)
      gsap.ticker.remove(tick)
    }
  }, [])
  return (
    <div ref={ref} className="ns-cursor" aria-hidden="true">
      <span className="ns-cursor__box" />
      <span ref={label} className="ns-cursor__label" />
    </div>
  )
}
