import React, { useRef, useEffect, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { usePrefersReducedMotion } from '@/lib/useReducedMotion'

gsap.registerPlugin(ScrollTrigger)

interface SplitLinesProps {
  children: string
  className?: string
  innerClassName?: string
  tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span' | 'div'
  delay?: number
  stagger?: number
  triggerHook?: string
  scrub?: boolean | number
}

/**
 * SplitLines: Splits text into measured visual lines wrapped in overflow-hidden masks.
 * Animates inner line upward from translateY(110%) to 0% with opacity ramp.
 * Retains full screen reader accessibility via aria-label and aria-hidden.
 */
export const SplitLines: React.FC<SplitLinesProps> = ({
  children,
  className = '',
  innerClassName = '',
  tag: Tag = 'div',
  delay = 0,
  stagger = 0.09,
  triggerHook = 'top 85%',
  scrub = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()
  const [lines, setLines] = useState<string[]>([children])

  // Measure and break lines according to container width and rendered word bounding rects
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof window === 'undefined') return

    const computeLines = () => {
      // Create temporary measurer to extract exact wrapping lines
      const words = children.trim().split(/\s+/)
      if (words.length <= 1) {
        setLines([children])
        return
      }

      const measurer = document.createElement('div')
      measurer.style.position = 'absolute'
      measurer.style.visibility = 'hidden'
      measurer.style.pointerEvents = 'none'
      measurer.style.width = `${el.clientWidth}px`
      measurer.className = className

      // Append wrapped spans for each word
      measurer.innerHTML = words
        .map((w, i) => `<span data-word-idx="${i}">${w}</span>`)
        .join(' ')

      document.body.appendChild(measurer)

      const spans = measurer.querySelectorAll('span')
      const calculatedLines: string[] = []
      let currentLineWords: string[] = []
      let lastTop = -1

      spans.forEach((span) => {
        const top = span.getBoundingClientRect().top
        if (lastTop !== -1 && Math.abs(top - lastTop) > 4) {
          calculatedLines.push(currentLineWords.join(' '))
          currentLineWords = []
        }
        currentLineWords.push(span.textContent || '')
        lastTop = top
      })

      if (currentLineWords.length > 0) {
        calculatedLines.push(currentLineWords.join(' '))
      }

      document.body.removeChild(measurer)
      if (calculatedLines.length > 0) {
        setLines(calculatedLines)
      }
    }

    computeLines()

    // Recompute on window resize or document fonts ready
    window.addEventListener('resize', computeLines)
    if (document.fonts) {
      document.fonts.ready.then(computeLines)
    }

    return () => window.removeEventListener('resize', computeLines)
  }, [children, className])

  // GSAP animation on lines
  useEffect(() => {
    const el = containerRef.current
    if (!el || prefersReducedMotion || lines.length === 0) return

    const innerLines = el.querySelectorAll('.line-mask-inner')
    if (innerLines.length === 0) return

    gsap.set(innerLines, { yPercent: 110, opacity: 0.1 })

    const triggerConfig: ScrollTrigger.Vars = {
      trigger: el,
      start: triggerHook,
      toggleActions: scrub ? undefined : 'play none none none',
      scrub: scrub ? 0.8 : false,
    }

    const tween = gsap.to(innerLines, {
      yPercent: 0,
      opacity: 1,
      duration: 1.15,
      ease: 'power4.out',
      stagger: stagger,
      delay: delay,
      scrollTrigger: triggerConfig,
    })

    // Failsafe reveal: Guarantees text is fully legible if scroll trigger is delayed or jumped
    const failsafeTimer = setTimeout(() => {
      const rect = el.getBoundingClientRect()
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        gsap.to(innerLines, {
          yPercent: 0,
          opacity: 1,
          duration: 0.5,
          ease: 'power2.out',
          overwrite: 'auto',
        })
      }
    }, 1500 + delay * 1000)

    return () => {
      clearTimeout(failsafeTimer)
      tween.kill()
      if (tween.scrollTrigger) tween.scrollTrigger.kill()
    }
  }, [lines, prefersReducedMotion, delay, stagger, triggerHook, scrub])

  const CustomTag = Tag as 'div'

  return (
    <CustomTag
      ref={containerRef}
      className={`relative ${className}`}
      aria-label={children}
    >
      <span aria-hidden="true" className="block">
        {lines.map((line, idx) => (
          <span key={`${idx}-${line}`} className="line-mask block">
            <span
              className={`line-mask-inner block ${
                prefersReducedMotion ? '!translate-y-0 !opacity-100' : ''
              } ${innerClassName}`}
            >
              {line}
            </span>
          </span>
        ))}
      </span>
    </CustomTag>
  )
}
