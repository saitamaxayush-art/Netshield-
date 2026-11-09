/**
 * Guided tour state, for this page session only. The tour is shown only when the visitor turns it on
 * with the Tutorial switch; nothing is remembered between page loads, so it always starts off and there
 * is no hidden "already seen" state that could keep it away. Skip, Escape and Finish turn it off.
 */
import { create } from 'zustand'
import { TOUR_STEPS } from '@/features/tour/steps'

interface TourState {
  active: boolean
  index: number
  /** Turn the tutorial on (from its first step) or off. */
  setActive: (on: boolean) => void
  toggle: () => void
  next: () => void
  back: () => void
  /** Leave early: turns the tutorial off. */
  skip: () => void
}

export const useTourStore = create<TourState>((set, get) => ({
  active: false,
  index: 0,
  setActive: (on) => set({ active: on, index: 0 }),
  toggle: () => get().setActive(!get().active),
  next: () => {
    const { index } = get()
    if (index >= TOUR_STEPS.length - 1) set({ active: false, index: 0 })
    else set({ index: index + 1 })
  },
  back: () => set({ index: Math.max(0, get().index - 1) }),
  skip: () => set({ active: false, index: 0 }),
}))

export const progressLabel = (index: number, total = TOUR_STEPS.length): string => `Step ${index + 1} of ${total}`
