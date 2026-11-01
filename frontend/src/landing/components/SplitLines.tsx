import React, { useRef } from 'react'
import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { useGSAP } from '@gsap/react'
import { DUR, STAGGER, motionEnabled } from '../motion/engine'
import { revealOnScroll } from '../motion/reveal'

export interface SplitLinesProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType
  /** Seconds before the first line starts. */
  delay?: number
  /** ScrollTrigger start; "load" plays on mount (hero). */
  start?: string
  children: React.ReactNode
}

/**
 * Measured line splitting with overflow masks (GSAP SplitText). Lines are
 * re-split after fonts load and on resize (autoSplit). The mask box is
 * taller than the line box and compensated with negative margins (see
 * .ns-line-mask) so descenders and italic overhang never clip. On headings
 * SplitText sets aria-label and hides the line copies from readers; other
 * elements keep their line text readable in order (aria-label is not valid there).
 */
export function SplitLines({ as: Tag = 'p', delay = 0, start, children, ...rest }: SplitLinesProps) {
  const ref = useRef<HTMLElement>(null)

  useGSAP(
    () => {
      const el = ref.current
      if (!el || !motionEnabled()) return
      let played = false
      const tl = gsap.timeline({ paused: true, onStart: () => (played = true) })

      const split = SplitText.create(el, {
        type: 'lines',
        linesClass: 'ns-line',
        mask: 'lines',
        autoSplit: true,
        // Headings get an aria-label (allowed); other elements keep their split text readable in order.
        aria: /^H[1-6]$/.test(el.tagName) ? 'auto' : 'none',
        onSplit(self) {
          // After the reveal has played, a re-split (resize, fonts) keeps the final state.
          if (played) return
          tl.clear()
          tl.fromTo(
            self.lines,
            { yPercent: 112 },
            {
              yPercent: 0,
              duration: DUR.reveal,
              ease: 'nsReveal',
              stagger: STAGGER.line,
              delay,
              onStart: () => gsap.set(self.lines, { willChange: 'transform' }),
              onComplete: () => gsap.set(self.lines, { clearProps: 'transform,willChange' }),
            }
          )
        },
      })

      let stop = () => {}
      if (start === 'load') tl.play()
      else stop = revealOnScroll(el, tl, { start })

      return () => {
        stop()
        tl.kill()
        split.revert()
      }
    },
    { scope: ref }
  )

  return (
    <Tag ref={ref} {...rest}>
      {children}
    </Tag>
  )
}

/**
 * ScriptCaps heading: a small italic accent word over an uppercase serif
 * line, revealed in sequence (accent first, then the masked lines).
 * `emphasis` (one word at most) is rendered in signal red.
 */
export function ScriptCaps({
  as = 'h2',
  accent,
  text,
  emphasis,
  size = 'h2',
  start,
  delay = 0,
  className = '',
  id,
}: {
  as?: 'h1' | 'h2' | 'h3'
  accent?: string
  text: string
  emphasis?: string
  size?: 'mega' | 'h2'
  start?: string
  delay?: number
  className?: string
  id?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const Tag = as

  useGSAP(
    () => {
      const el = ref.current
      if (!el || !motionEnabled()) return
      const tl = gsap.timeline({ paused: true })
      tl.fromTo(
        el,
        { yPercent: 60, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: DUR.reveal, ease: 'nsReveal', delay, clearProps: 'transform,opacity' }
      )
      if (start === 'load') {
        tl.play()
        return () => tl.kill()
      }
      const stop = revealOnScroll(el.parentElement ?? el, tl, { start })
      return () => {
        stop()
        tl.kill()
      }
    },
    { scope: ref }
  )

  let body: React.ReactNode = text
  if (emphasis) {
    const i = text.indexOf(emphasis)
    if (i >= 0) {
      body = (
        <>
          {text.slice(0, i)}
          <span className="ns-em">{emphasis}</span>
          {text.slice(i + emphasis.length)}
        </>
      )
    }
  }

  return (
    <Tag className={`ns-${size} ${className}`} id={id} aria-label={accent ? `${accent} ${text}` : text}>
      {accent && (
        <span ref={ref} className="ns-script" aria-hidden="true">
          {accent}
        </span>
      )}
      <SplitLines as="span" style={{ display: 'block' }} aria-hidden="true" delay={delay + (accent ? 0.12 : 0)} start={start}>
        {body}
      </SplitLines>
    </Tag>
  )
}
