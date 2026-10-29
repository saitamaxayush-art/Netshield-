import React, { useEffect, useRef, useState } from 'react'

/**
 * Huge uppercase words on a cyclic drum inside a masked viewport with edge
 * fade. The selection always sits on the middle row with its neighbours
 * receding above and below; changing it travels the drum, wrapping
 * seamlessly. Exposed as a tablist: arrows, Home and End move the selection.
 */
export function BigWordList({
  words,
  selected,
  onSelect,
  controls,
  label,
  fontSize = 'clamp(4rem, 2rem + 8vw, 9.5rem)',
}: {
  words: string[]
  selected: number
  onSelect: (i: number) => void
  controls: string
  label: string
  fontSize?: string
}) {
  const n = words.length
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  // Unbounded drum position; selected = pos mod n. Renders three copies.
  const [pos, setPos] = useState(selected)
  const [animate, setAnimate] = useState(true)
  const mod = (v: number) => ((v % n) + n) % n
  const [prevSelected, setPrevSelected] = useState(selected)
  if (prevSelected !== selected) {
    setPrevSelected(selected)
    if (mod(pos) !== selected) {
      // Travel the short way round.
      let d = selected - mod(pos)
      if (d > n / 2) d -= n
      if (d < -n / 2) d += n
      setAnimate(true)
      setPos(pos + d)
    }
  }

  useEffect(() => {
    if (pos >= 0 && pos < n) return
    // After travelling into a neighbouring copy, jump back to the middle copy without animating.
    const t = window.setTimeout(() => {
      setAnimate(false)
      setPos(mod(pos))
    }, 820)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, n])
  useEffect(() => {
    if (animate) return
    const r = requestAnimationFrame(() => setAnimate(true))
    return () => cancelAnimationFrame(r)
  }, [animate])

  const step = (d: number) => onSelect(mod(selected + d))
  const onKey = (e: React.KeyboardEvent) => {
    const map: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }
    let next = selected
    if (map[e.key]) {
      e.preventDefault()
      step(map[e.key])
      next = mod(selected + map[e.key])
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      next = e.key === 'Home' ? 0 : n - 1
      onSelect(next)
    } else return
    refs.current[next]?.focus({ preventScroll: true })
  }

  const items = [...words, ...words, ...words]
  return (
    <div className="ns-words" style={{ fontSize, height: '3.3em' }}>
      <div
        role="tablist"
        aria-label={label}
        aria-orientation="vertical"
        onKeyDown={onKey}
        style={{
          display: 'grid',
          gridAutoRows: '1.1em',
          // Middle row shows item (pos + n); rows above and below show its neighbours.
          transform: `translate3d(0, ${(-(pos + n) + 1) * 1.1}em, 0)`,
          transition: animate ? 'transform 800ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
        }}
      >
        {items.map((w, k) => {
          const i = k % n
          const primary = k >= n && k < 2 * n
          const isSel = k === pos + n
          return (
            <button
              key={`${w}-${k}`}
              ref={
                primary
                  ? (el) => {
                      refs.current[i] = el
                    }
                  : undefined
              }
              type="button"
              role={primary ? 'tab' : undefined}
              id={primary ? `${controls}-tab-${i}` : undefined}
              aria-selected={primary ? i === selected : undefined}
              aria-controls={primary ? controls : undefined}
              aria-hidden={primary ? undefined : true}
              tabIndex={primary && i === selected ? 0 : -1}
              className="ns-word"
              data-active={isSel ? 'true' : 'false'}
              style={animate ? undefined : { transition: 'none' }}
              onClick={() => {
                if (isSel) return
                setAnimate(true)
                setPrevSelected(i)
                setPos(k - n)
                onSelect(i)
              }}
              data-cursor={isSel ? undefined : 'Select'}
            >
              <span>{w}</span>
              <span className="ns-micro ns-num ns-word__index" style={{ fontSize: '0.75rem', alignSelf: 'flex-start', marginTop: '0.9em' }}>
                0{i + 1}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
