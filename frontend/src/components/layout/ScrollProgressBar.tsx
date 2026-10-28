import React from 'react'
import { motion, useScroll, useSpring } from 'motion/react'
import { usePrefersReducedMotion } from '@/lib/useReducedMotion'

export const ScrollProgressBar: React.FC = () => {
  const prefersReducedMotion = usePrefersReducedMotion()
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 200,
    damping: 30,
    restDelta: 0.001,
  })

  if (prefersReducedMotion) return null

  return (
    <motion.div
      style={{ scaleX, transformOrigin: '0%' }}
      className="fixed top-0 left-0 right-0 h-[2px] bg-[#E5484D] z-50 pointer-events-none opacity-90"
      aria-hidden="true"
    />
  )
}
