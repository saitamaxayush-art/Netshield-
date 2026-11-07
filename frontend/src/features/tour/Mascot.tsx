/**
 * Netbot, the tour guide: an original, simple robot drawn in SVG (rounded body, one eye, antenna, two
 * arms) in the studio colours. Animated with Motion: an idle bob and blink, a wave or a pointing arm, and
 * a talking mouth while it speaks. With reduced motion it stays still in its pose.
 */
import React from 'react'
import { motion } from 'motion/react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { TOKENS } from '@/lib/tokens'
import type { MascotPose } from './steps'

const C = TOKENS.colors

export const Mascot: React.FC<{ pose: MascotPose; facing: 'left' | 'right'; talking: boolean; size?: number }> = ({ pose, facing, talking, size = 88 }) => {
  // Follows the system setting live (Motion's own hook reads it once).
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const still = reduced
  // Arm angles (degrees, around the shoulder). Motion uses transform-box fill-box on SVG, so origins are fractions of each shape's own box. The free arm points toward the highlighted element.
  const pointArm = facing === 'right' ? -70 : 70
  return (
    <motion.svg
      data-testid="tour-mascot"
      data-pose={pose}
      data-facing={facing}
      data-animated={!still}
      viewBox="0 0 100 110"
      width={size}
      height={size * 1.1}
      aria-hidden="true"
      animate={still ? undefined : { y: [0, -4, 0] }}
      transition={still ? undefined : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      style={{ overflow: 'visible' }}
    >
      {/* Antenna */}
      <line x1="50" y1="22" x2="50" y2="8" stroke={C.border.strong} strokeWidth="3" strokeLinecap="round" />
      <motion.circle
        cx="50"
        cy="7"
        r="5"
        fill={C.accent.teal}
        animate={still ? undefined : { opacity: [1, 0.45, 1] }}
        transition={still ? undefined : { duration: 1.6, repeat: Infinity }}
      />
      {/* Left arm (viewer's left), shoulder at (18, 62) */}
      <motion.g
        style={{ originX: 0.5, originY: 0 }}
        animate={{ rotate: pose === 'point' && facing === 'left' ? pointArm : pose === 'wave' && facing === 'left' ? (still ? 150 : [140, 170, 140]) : 20 }}
        transition={still ? { duration: 0 } : pose === 'wave' ? { duration: 0.9, repeat: Infinity } : { type: 'spring', stiffness: 160, damping: 14 }}
      >
        <rect x="14" y="62" width="8" height="26" rx="4" fill={C.bg.surfaceActive} stroke={C.border.strong} strokeWidth="2" />
      </motion.g>
      {/* Right arm, shoulder at (82, 62) */}
      <motion.g
        style={{ originX: 0.5, originY: 0 }}
        animate={{ rotate: pose === 'point' && facing === 'right' ? pointArm : pose === 'wave' && facing === 'right' ? (still ? -150 : [-140, -170, -140]) : -20 }}
        transition={still ? { duration: 0 } : pose === 'wave' ? { duration: 0.9, repeat: Infinity } : { type: 'spring', stiffness: 160, damping: 14 }}
      >
        <rect x="78" y="62" width="8" height="26" rx="4" fill={C.bg.surfaceActive} stroke={C.border.strong} strokeWidth="2" />
      </motion.g>
      {/* Body */}
      <rect x="20" y="22" width="60" height="72" rx="22" fill={C.bg.surfaceElevated} stroke={C.accent.teal} strokeWidth="2.5" />
      {/* Face plate */}
      <rect x="29" y="33" width="42" height="34" rx="12" fill={C.bg.primary} />
      {/* Eye: blinks */}
      <motion.g
        style={{ originX: 0.5, originY: 0.5 }}
        animate={still ? undefined : { scaleY: [1, 1, 0.1, 1] }}
        transition={still ? undefined : { duration: 3.6, times: [0, 0.9, 0.95, 1], repeat: Infinity }}
      >
        <circle cx="50" cy="48" r="9" fill={C.accent.teal} />
        <circle cx={facing === 'right' ? 53 : 47} cy="46" r="3.5" fill={C.bg.primary} />
      </motion.g>
      {/* Mouth: moves while speaking */}
      <motion.rect
        x="42"
        y="59"
        width="16"
        height="3"
        rx="1.5"
        fill={C.accent.teal}
        style={{ originX: 0.5, originY: 0.5 }}
        animate={talking && !still ? { scaleY: [1, 2.2, 1, 1.8, 1] } : { scaleY: 1 }}
        transition={talking && !still ? { duration: 0.8, repeat: Infinity } : { duration: 0 }}
      />
      {/* Chest light */}
      <circle cx="50" cy="80" r="4" fill={C.state.success} />
    </motion.svg>
  )
}
