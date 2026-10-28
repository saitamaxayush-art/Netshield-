import React, { useRef, useEffect } from 'react'
import gsap from 'gsap'
import { scrollStore } from '@/lib/useLenisScroll'
import { usePrefersReducedMotion } from '@/lib/useReducedMotion'

interface RotatingLabelProps {
  text?: string
  size?: number
  className?: string
}

/**
 * RotatingLabel: A small circular rotating text badge on an SVG path.
 * Rotates continuously and gently accelerates with scroll velocity.
 */
export const RotatingLabel: React.FC<RotatingLabelProps> = ({
  text = 'NETSHIELD LAB • DISCRETE MATHEMATICS • ',
  size = 110,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    const el = svgRef.current
    if (!el || prefersReducedMotion) return

    let currentRotation = 0

    const update = () => {
      // Base rotation speed + boost proportional to scroll velocity
      const velocity = Math.abs(scrollStore.velocity || 0)
      const delta = 0.45 + Math.min(velocity * 0.15, 3.5)
      currentRotation = (currentRotation + delta) % 360
      gsap.set(el, { rotate: currentRotation })
    }

    gsap.ticker.add(update)
    return () => gsap.ticker.remove(update)
  }, [prefersReducedMotion])

  const center = size / 2
  const radius = size * 0.38

  return (
    <div
      className={`relative flex items-center justify-center pointer-events-none select-none ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${size} ${size}`}
        className="w-full h-full will-change-transform"
      >
        <defs>
          <path
            id="rotatingCirclePath"
            d={`M ${center},${center} m -${radius},0 a ${radius},${radius} 0 1,1 ${radius * 2},0 a ${radius},${radius} 0 1,1 -${radius * 2},0`}
          />
        </defs>
        <text className="fill-[#17181B]/70 text-[8.5px] font-mono uppercase tracking-[0.22em]">
          <textPath href="#rotatingCirclePath" startOffset="0%">
            {text}
          </textPath>
        </text>
      </svg>
      {/* Center stationary Signal Red dot */}
      <div className="absolute w-2 h-2 rounded-full bg-[#E5484D] shadow-[0_0_8px_rgba(229,72,77,0.7)]" />
    </div>
  )
}
