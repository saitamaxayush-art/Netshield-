/** One inline message at a time, for refused edits such as a self loop. Dismisses itself. */
import { create } from 'zustand'

export const TOAST_MS = 5000

interface ToastState {
  message: string | null
  show: (message: string) => void
  dismiss: () => void
}

let timer: ReturnType<typeof setTimeout> | null = null

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  show: (message) => {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => set({ message: null }), TOAST_MS)
    set({ message })
  },
  dismiss: () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    set({ message: null })
  },
}))
