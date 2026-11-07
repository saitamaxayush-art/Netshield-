import type { TourStep } from './steps'

/** The first target of a step that is on screen, or null. */
export function findTarget(step: TourStep, doc: Document = document): HTMLElement | null {
  for (const selector of step.targets) {
    for (const el of doc.querySelectorAll<HTMLElement>(selector)) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) return el
    }
  }
  return null
}

/** Where the speech bubble goes: beside the highlighted element if there is room, else above or below it. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Placement {
  left: number
  top: number
  /** Which way the mascot faces (toward the element). */
  facing: 'left' | 'right'
}

const GAP = 16
const MARGIN = 12

export function placeBubble(target: Rect | null, bubble: { width: number; height: number }, viewport: { width: number; height: number }): Placement {
  const clampX = (x: number) => Math.max(MARGIN, Math.min(viewport.width - bubble.width - MARGIN, x))
  const clampY = (y: number) => Math.max(MARGIN, Math.min(viewport.height - bubble.height - MARGIN, y))
  if (!target) return { left: clampX((viewport.width - bubble.width) / 2), top: clampY((viewport.height - bubble.height) / 2), facing: 'right' }
  const midY = clampY(target.y + target.height / 2 - bubble.height / 2)
  // To the left of the element (the mascot then points right, at it).
  if (target.x - GAP - bubble.width >= MARGIN) return { left: target.x - GAP - bubble.width, top: midY, facing: 'right' }
  // To the right of it.
  if (target.x + target.width + GAP + bubble.width <= viewport.width - MARGIN) return { left: target.x + target.width + GAP, top: midY, facing: 'left' }
  const left = clampX(target.x + target.width / 2 - bubble.width / 2)
  const facing = target.x + target.width / 2 > viewport.width / 2 ? 'right' : 'left'
  // Below, then above, then over the bottom of a large element (the canvas) where it covers least.
  if (target.y + target.height + GAP + bubble.height <= viewport.height - MARGIN) return { left, top: target.y + target.height + GAP, facing }
  if (target.y - GAP - bubble.height >= MARGIN) return { left, top: target.y - GAP - bubble.height, facing }
  return { left, top: clampY(viewport.height - bubble.height - MARGIN), facing }
}
