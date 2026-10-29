import { CHAPTERS, useActiveChapter, useChapterTone } from '../chapters'
import { headerOffset, scrollToTarget } from '../motion/engine'

/** Fixed chapter rail (wide screens). Smooth anchor scroll with header offset. */
export function ChapterNav() {
  const active = useActiveChapter()
  const tone = useChapterTone()
  return (
    <nav aria-label="Chapters">
      <ul className="ns-chapters" data-tone={tone}>
        {CHAPTERS.map((c) => (
          <li key={c.id}>
            <a
              href={`#${c.id}`}
              aria-current={active === c.id ? 'true' : undefined}
              data-cursor="Jump"
              onClick={(e) => {
                e.preventDefault()
                scrollToTarget(`#${c.id}`, { offset: c.id === 'top' ? 0 : -headerOffset() + 1 })
                history.replaceState(null, '', `#${c.id}`)
              }}
            >
              <span className="ns-chapters__label">{c.label}</span>
              <span className="ns-num">{c.number}</span>
              <span className="ns-chapters__tick" />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
