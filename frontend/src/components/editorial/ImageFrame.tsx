import React, { useRef, useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { usePrefersReducedMotion } from '@/lib/useReducedMotion'

gsap.registerPlugin(ScrollTrigger)

interface ImageFrameProps {
  children: React.ReactNode
  className?: string
  innerClassName?: string
  expandOnScroll?: boolean
  parallaxOffset?: number
  aspectRatio?: string
  initialInset?: string
}

/**
 * ImageFrame: Clip-path inset frame that expands on scroll with an inner element that
 * scales from ~1.25 to 1.0 and parallaxes smoothly within the frame.
 */
export const ImageFrame: React.FC<ImageFrameProps> = ({
  children,
  className = '',
  innerClassName = '',
  expandOnScroll = true,
  parallaxOffset = 30,
  aspectRatio = 'aspect-[16/10]',
  initialInset = 'inset(12% 14% 12% 14%)',
}) => {
  const frameRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const frame = frameRef.current
    const inner = innerRef.current
    if (!frame || !inner || prefersReducedMotion) return

    if (expandOnScroll) {
      // Inset expansion tied to scroll scrub
      gsap.set(frame, { clipPath: initialInset })
      gsap.set(inner, { scale: 1.25, y: -parallaxOffset })

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: frame,
          start: 'top 90%',
          end: 'bottom 40%',
          scrub: 0.8,
        },
      })

      tl.to(frame, {
        clipPath: 'inset(0% 0% 0% 0%)',
        ease: 'none',
      }).to(
        inner,
        {
          scale: 1.0,
          y: parallaxOffset,
          ease: 'none',
        },
        0
      )

      return () => {
        tl.kill()
        if (tl.scrollTrigger) tl.scrollTrigger.kill()
      }
    } else {
      // Trigger-based expansion upon entering viewport
      gsap.set(frame, { clipPath: initialInset })
      gsap.set(inner, { scale: 1.2 })

      const tween = gsap.to(frame, {
        clipPath: 'inset(0% 0% 0% 0%)',
        duration: 1.4,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: frame,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
      })

      const innerTween = gsap.to(inner, {
        scale: 1.0,
        duration: 1.6,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: frame,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
      })

      return () => {
        tween.kill()
        if (tween.scrollTrigger) tween.scrollTrigger.kill()
        innerTween.kill()
        if (innerTween.scrollTrigger) innerTween.scrollTrigger.kill()
      }
    }
  }, [expandOnScroll, parallaxOffset, initialInset, prefersReducedMotion])

  return (
    <div
      ref={frameRef}
      className={`relative overflow-hidden ${aspectRatio} ${className} ${
        prefersReducedMotion ? '!clip-path-none' : ''
      }`}
      style={{
        clipPath: prefersReducedMotion ? 'none' : undefined,
        willChange: 'clip-path',
      }}
    >
      <div
        ref={innerRef}
        className={`w-full h-full ${innerClassName} ${
          prefersReducedMotion ? '!transform-none' : ''
        }`}
        style={{ willChange: 'transform' }}
      >
        {children}
      </div>
    </div>
  )
}
