import { ScrollTrigger } from 'gsap/ScrollTrigger'

/**
 * Plays a paused timeline once its trigger scrolls into view. Fail safe:
 * if the trigger has been visible for 600ms and the timeline still has not
 * started (missed trigger, jump, refresh race), it is completed instantly.
 * Content can never stay hidden.
 */
export function revealOnScroll(
  trigger: Element,
  tl: gsap.core.Timeline,
  opts: { start?: string; failSafeMs?: number } = {}
): () => void {
  const st = ScrollTrigger.create({
    trigger,
    start: opts.start ?? 'top 88%',
    once: true,
    onEnter: () => tl.play(),
  })

  let timer: number | undefined
  const io = new IntersectionObserver(
    ([entry]) => {
      window.clearTimeout(timer)
      if (!entry.isIntersecting) return
      // Only arm fail-safe once element has scrolled near the activation threshold
      const rect = entry.boundingClientRect
      if (rect.top > window.innerHeight * 0.95) return

      timer = window.setTimeout(() => {
        if (tl.progress() === 0 && !tl.isActive()) {
          tl.play()
        }
        io.disconnect()
      }, opts.failSafeMs ?? 1200)
    },
    { threshold: 0.05 }
  )
  io.observe(trigger)

  return () => {
    window.clearTimeout(timer)
    io.disconnect()
    st.kill()
  }
}
