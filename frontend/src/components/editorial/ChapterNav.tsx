import React, { useState, useEffect } from 'react'

export interface Chapter {
  id: string
  label: string
  number: string
}

interface ChapterNavProps {
  chapters: Chapter[]
}

/**
 * ChapterNav: Floating vertical indicator that highlights the current active chapter
 * via IntersectionObserver as the user traverses the luxury landing page.
 */
export const ChapterNav: React.FC<ChapterNavProps> = ({ chapters }) => {
  const [activeChapter, setActiveChapter] = useState<string>(chapters[0]?.id || '')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveChapter(entry.target.id)
          }
        })
      },
      {
        rootMargin: '-30% 0px -50% 0px',
        threshold: 0.1,
      }
    )

    chapters.forEach((ch) => {
      const el = document.getElementById(ch.id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [chapters])

  const scrollToChapter = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <nav
      className="fixed right-6 top-1/2 -translate-y-1/2 z-30 hidden xl:flex flex-col items-end gap-3 pointer-events-auto"
      aria-label="Chapter Table of Contents"
    >
      {chapters.map((ch) => {
        const isActive = activeChapter === ch.id
        return (
          <button
            key={ch.id}
            type="button"
            onClick={() => scrollToChapter(ch.id)}
            className="flex items-center gap-2.5 group cursor-pointer focus-visible:outline-none"
            aria-current={isActive ? 'true' : undefined}
          >
            <span
              className={`text-[10px] font-mono tracking-wider transition-all duration-300 ${
                isActive
                  ? 'opacity-100 text-[#E5484D] translate-x-0 font-medium'
                  : 'opacity-0 translate-x-2 text-[#8E97A2] group-hover:opacity-75 group-hover:translate-x-0'
              }`}
            >
              {ch.number} &bull; {ch.label}
            </span>

            <div
              className={`rounded-full transition-all duration-300 ${
                isActive
                  ? 'w-5 h-[2px] bg-[#E5484D] shadow-[0_0_8px_rgba(229,72,77,0.7)]'
                  : 'w-2 h-[1px] bg-[#3A3D44] group-hover:bg-[#C3CAD2] group-hover:w-3'
              }`}
            />
          </button>
        )
      })}
    </nav>
  )
}
