import React, { useRef, useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { usePrefersReducedMotion } from '@/lib/useReducedMotion'

gsap.registerPlugin(ScrollTrigger)

interface PanelWipeProps {
  children: React.ReactNode
  theme: 'dark' | 'light'
  className?: string
  id?: string
  direction?: 'up' | 'inset'
}

/**
 * PanelWipe: A full-width section background (white or black) that rises or is revealed
 * through a clip-path as scroll advances, making colour shifts feel like one continuous architectural move.
 */
export const PanelWipe: React.FC<PanelWipeProps> = ({
  children,
  theme,
  className = '',
  id,
  direction = 'up',
}) => {
  const sectionRef = useRef<HTMLElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  const isLight = theme === 'light'
  const bgClass = isLight ? 'bg-[#F3F5F7] text-[#17181B]' : 'bg-[#17181B] text-[#E4E8EC]'

  useEffect(() => {
    const el = sectionRef.current
    if (!el || prefersReducedMotion) return

    if (direction === 'up') {
      // Panel wipe rising from below
      gsap.set(el, { clipPath: 'polygon(0% 12%, 100% 12%, 100% 100%, 0% 100%)' })

      const tween = gsap.to(el, {
        clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'top 50%',
          scrub: 0.8,
        },
      })

      return () => {
        tween.kill()
        if (tween.scrollTrigger) tween.scrollTrigger.kill()
      }
    } else {
      // Inset wipe reveal
      gsap.set(el, { clipPath: 'inset(6% 8% 6% 8%)' })

      const tween = gsap.to(el, {
        clipPath: 'inset(0% 0% 0% 0%)',
        ease: 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'top 40%',
          scrub: 0.8,
        },
      })

      return () => {
        tween.kill()
        if (tween.scrollTrigger) tween.scrollTrigger.kill()
      }
    }
  }, [direction, prefersReducedMotion])

  return (
    <section
      ref={sectionRef}
      id={id}
      className={`relative w-full ${bgClass} ${className} transition-colors duration-500`}
      style={{
        clipPath: prefersReducedMotion ? 'none' : undefined,
        willChange: 'clip-path',
      }}
    >
      {children}
    </section>
  )
}
