import { TOKENS } from './tokens'

export const transitionFast = {
  duration: TOKENS.motion.duration.fast,
  ease: TOKENS.motion.ease.smooth,
}

export const transitionNormal = {
  duration: TOKENS.motion.duration.normal,
  ease: TOKENS.motion.ease.editorial,
}

export const transitionCinematic = {
  duration: TOKENS.motion.duration.cinematic,
  ease: TOKENS.motion.ease.editorial,
}

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: transitionNormal,
}

export const fadeInUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
  transition: transitionNormal,
}

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
}
