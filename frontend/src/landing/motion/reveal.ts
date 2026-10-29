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
      timer = window.setTimeout(() => {
        if (tl.progress() === 0 && !tl.isActive()) tl.progress(1)
        io.disconnect()
      }, opts.failSafeMs ?? 600)
    },
    { threshold: 0.01 }
  )
  io.observe(trigger)

  return () => {
    window.clearTimeout(timer)
    io.disconnect()
    st.kill()
  }
}
