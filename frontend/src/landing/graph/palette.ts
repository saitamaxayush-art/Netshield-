/** Silver steps for connected components (largest component first). */
export const INK_STEPS = ['var(--s-100)', 'var(--s-300)', 'var(--s-500)', '#6f7781']
export const PAPER_STEPS = ['var(--s-50)', 'var(--s-300)', '#aab2bb', 'var(--s-500)']

export const componentFill = (tone: 'ink' | 'paper', index: number | undefined) => {
  if (index === undefined) return undefined
  const steps = tone === 'ink' ? INK_STEPS : PAPER_STEPS
  return steps[Math.min(index, steps.length - 1)]
}
