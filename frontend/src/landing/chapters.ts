import { useSyncExternalStore } from 'react'

export interface Chapter {
  id: string
  number: string
  label: string
  /** Shown in the header link row. */
  inHeader?: boolean
}

export const CHAPTERS: Chapter[] = [
  { id: 'top', number: '01', label: 'Intro' },
  { id: 'sandbox', number: '02', label: 'Sandbox', inHeader: true },
  { id: 'how', number: '03', label: 'How it works', inHeader: true },
  { id: 'topologies', number: '04', label: 'Topologies' },
  { id: 'reliability', number: '05', label: 'Reliability', inHeader: true },
  { id: 'paths', number: '06', label: 'Paths' },
  { id: 'method', number: '07', label: 'Method', inHeader: true },
  { id: 'start', number: '08', label: 'Start' },
]

/** Tiny store for the active chapter: shared by header, chapter nav and menu. */
let active = 'top'
let tone: 'dark' | 'light' = 'dark'
const listeners = new Set<() => void>()

export function setActiveChapter(id: string, nextTone: 'dark' | 'light') {
  if (id === active && nextTone === tone) return
  active = id
  tone = nextTone
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useActiveChapter = () => useSyncExternalStore(subscribe, () => active, () => active)
export const useChapterTone = () => useSyncExternalStore(subscribe, () => tone, () => tone)

/**
 * Observe every [data-chapter] section and mark the one crossing the
 * middle of the viewport as active. One IntersectionObserver, no scroll handler.
 */
export function observeChapters(root: HTMLElement): () => void {
  const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-chapter]'))
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        const el = e.target as HTMLElement
        setActiveChapter(el.dataset.chapter!, el.dataset.tone === 'light' ? 'light' : 'dark')
      }
    },
    { rootMargin: '-50% 0px -50% 0px', threshold: 0 }
  )
  sections.forEach((s) => io.observe(s))
  return () => io.disconnect()
}
