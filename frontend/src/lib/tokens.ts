/**
 * NetShield Design Tokens
 * Coherent token system establishing architectural, technical restraint.
 * Hard prohibition compliance: No purple gradients, rectangular radii (2px - 4px),
 * WCAG AA contrast against near-black navy #13151F.
 */

export const TOKENS = {
  colors: {
    bg: {
      primary: '#13151F',
      surface: '#181B28',
      surfaceHover: '#1E2235',
      surfaceActive: '#252A40',
      surfaceElevated: '#1F2336',
      scrim: 'rgba(19, 21, 31, 0.85)',
    },
    text: {
      primary: '#E9ECEE',
      secondary: '#94A3B8',
      muted: '#8693A7',
      dim: '#475569',
    },
    border: {
      subtle: '#222638',
      strong: '#2F364E',
      focus: '#2DD4BF',
    },
    accent: {
      teal: '#2DD4BF',
      tealHover: '#14B8A6',
      cyan: '#38BDF8',
      dim: 'rgba(45, 212, 191, 0.12)',
    },
    state: {
      success: '#10B981',
      successDim: 'rgba(16, 185, 129, 0.12)',
      failure: '#F65A74',
      failureDim: 'rgba(244, 63, 94, 0.12)',
      warning: '#F59E0B',
      warningDim: 'rgba(245, 158, 11, 0.12)',
    },
    components: {
      // Qualitative palette for connected component partition visualization
      palette: [
        '#2DD4BF', // Teal
        '#38BDF8', // Sky Cyan
        '#A78BFA', // Note: keep restrained, or use cool steel/slate
        '#34D399', // Emerald
        '#FBBF24', // Amber
        '#FB7185', // Rose
        '#818CF8', // Indigo
      ],
    },
  },
  typography: {
    fontFamilies: {
      serif: 'Newsreader, Georgia, serif',
      sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: 'JetBrains Mono, ui-monospace, Menlo, monospace',
    },
  },
  radius: {
    xs: '2px',
    sm: '3px',
    md: '4px',
  },
  motion: {
    duration: {
      instant: 0.1,
      fast: 0.2,
      normal: 0.35,
      slow: 0.6,
      cinematic: 1.2,
    },
    ease: {
      editorial: [0.16, 1, 0.3, 1] as const,
      smooth: [0.4, 0, 0.2, 1] as const,
      linear: [0, 0, 1, 1] as const,
    },
  },
} as const
