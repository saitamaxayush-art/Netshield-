/**
 * Guided tour state. "Seen" is remembered in localStorage (wrapped in try/catch: a private window or
 * blocked storage just means the tour may show again). Starting, moving and finishing are pure state
 * changes; the TourHost component reacts to them.
 */
import { create } from 'zustand'
import { TOUR_STEPS } from '@/features/tour/steps'

export const TOUR_SEEN_KEY = 'netshield_tour_seen'

export function tourSeen(storage: () => Storage | null = defaultStorage): boolean {
  try {
    return storage()?.getItem(TOUR_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function markTourSeen(storage: () => Storage | null = defaultStorage): void {
  try {
    storage()?.setItem(TOUR_SEEN_KEY, '1')
  } catch {
    // Not remembered; the tour may offer itself again next time.
  }
}

function defaultStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

interface TourState {
  active: boolean
  index: number
  start: () => void
  /** Start only if this browser has not seen the tour. */
  startIfFirstVisit: () => void
  next: () => void
  back: () => void
  /** Leave early; counts as seen. */
  skip: () => void
}

export const useTourStore = create<TourState>((set, get) => ({
  active: false,
  index: 0,
  start: () => set({ active: true, index: 0 }),
  startIfFirstVisit: () => {
    if (!get().active && !tourSeen()) set({ active: true, index: 0 })
  },
  next: () => {
    const { index } = get()
    if (index >= TOUR_STEPS.length - 1) {
      markTourSeen()
      set({ active: false, index: 0 })
    } else set({ index: index + 1 })
  },
  back: () => set({ index: Math.max(0, get().index - 1) }),
  skip: () => {
    markTourSeen()
    set({ active: false, index: 0 })
  },
}))

export const progressLabel = (index: number, total = TOUR_STEPS.length): string => `Step ${index + 1} of ${total}`
