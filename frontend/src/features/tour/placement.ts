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

/** The viewport, and how much of its top is taken by a bar that stays above the tour (the app's top bar). */
export interface Viewport {
  width: number
  height: number
  topInset?: number
}

const GAP = 16
const MARGIN = 12
/** The spotlight draws this far around the element; the tour box keeps clear of that too. */
export const SPOT_PAD = 8
/** Below this width the tour box is a full width sheet docked to the top or bottom. */
export const SHEET_BELOW = 640

export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return w > 0 && h > 0 ? w * h : 0
}

/**
 * Where the tour box (speech bubble with Netbot) goes. Candidates are tried in order of preference and the
 * first that keeps clear of the highlighted element wins; if none does (a very large element), the one
 * covering least of it. Every candidate is clamped fully inside the viewport and below the top inset.
 */
export function placeBubble(target: Rect | null, box: { width: number; height: number }, viewport: Viewport): Placement {
  const minY = (viewport.topInset ?? 0) + MARGIN
  const clampX = (x: number) => Math.max(MARGIN, Math.min(viewport.width - box.width - MARGIN, x))
  const clampY = (y: number) => Math.max(minY, Math.min(viewport.height - box.height - MARGIN, y))
  if (!target) return { left: clampX((viewport.width - box.width) / 2), top: clampY(minY + (viewport.height - minY - box.height) / 2 - MARGIN / 2), facing: 'right' }

  const spot: Rect = { x: target.x - SPOT_PAD, y: target.y - SPOT_PAD, width: target.width + 2 * SPOT_PAD, height: target.height + 2 * SPOT_PAD }
  const centreX = target.x + target.width / 2
  const centreY = target.y + target.height / 2
  const sheet = viewport.width < SHEET_BELOW

  const raw: Array<[number, number]> = sheet
    ? // A sheet: away from the element first (bottom when it sits in the upper half).
      centreY < (minY + viewport.height) / 2
      ? [
          [MARGIN, viewport.height - box.height - MARGIN],
          [MARGIN, minY],
        ]
      : [
          [MARGIN, minY],
          [MARGIN, viewport.height - box.height - MARGIN],
        ]
    : [
        [spot.x - GAP - box.width, centreY - box.height / 2], // left of it
        [spot.x + spot.width + GAP, centreY - box.height / 2], // right of it
        [centreX - box.width / 2, spot.y + spot.height + GAP], // below
        [centreX - box.width / 2, spot.y - GAP - box.height], // above
        [viewport.width - box.width - MARGIN, viewport.height - box.height - MARGIN], // corners
        [MARGIN, viewport.height - box.height - MARGIN],
        [viewport.width - box.width - MARGIN, minY],
        [MARGIN, minY],
      ]
  let best: { left: number; top: number; cover: number } | null = null
  for (const [x, y] of raw) {
    const left = clampX(x)
    const top = clampY(y)
    const cover = overlapArea({ x: left, y: top, width: box.width, height: box.height }, spot)
    if (cover === 0) {
      best = { left, top, cover }
      break
    }
    if (!best || cover < best.cover) best = { left, top, cover }
  }
  const chosen = best ?? { left: clampX(centreX - box.width / 2), top: clampY(centreY), cover: 0 }
  // Face the element: the mascot points from the box toward it.
  const facing = chosen.left + box.width / 2 <= centreX ? 'right' : 'left'
  return { left: chosen.left, top: chosen.top, facing }
}
