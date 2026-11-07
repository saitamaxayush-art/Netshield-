/**
 * Runs the guided tour: dims the page, cuts a spotlight around the live element of the current step,
 * and shows Netbot with a speech bubble, Next, Back, Skip and the step count. Keyboard: Tab moves
 * between the buttons, Enter activates, Escape skips, arrow keys step. The step text is announced
 * through a live region. With reduced motion the spotlight jumps and the mascot stays still.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { progressLabel, useTourStore } from '@/store/tourStore'
import { useStudioView } from '@/store/studioViewStore'
import { Mascot } from './Mascot'
import { findTarget, placeBubble, type Rect } from './placement'
import { TOUR_STEPS, type TourStep } from './steps'

const PAD = 8
const BUBBLE_WIDTH = 320
const button = 'min-h-10 px-3 rounded-[3px] text-xs font-medium cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-teal'

function applyPrepare(step: TourStep): void {
  const view = useStudioView.getState()
  if (step.prepare?.panelTab) view.setPanelTab(step.prepare.panelTab)
  if (step.prepare?.section) view.setSection(step.prepare.section)
  if (step.prepare?.details !== undefined) view.setDetailsOpen(step.prepare.details)
}

export const TourHost: React.FC = () => {
  const active = useTourStore((s) => s.active)
  const index = useTourStore((s) => s.index)
  const { next, back, skip } = useTourStore.getState()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const step = TOUR_STEPS[index]
  const [rect, setRect] = useState<Rect | null>(null)
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight })
  const [bubbleHeight, setBubbleHeight] = useState(200)
  const dialogRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  // Bring the app to the step: its page, then its panel or section.
  useEffect(() => {
    if (!active || !step) return
    if (pathname !== step.route) navigate(step.route)
    else applyPrepare(step)
  }, [active, step, pathname, navigate])

  // Follow the live element while the step is shown (layout, scrolling and resizing can move it).
  useEffect(() => {
    if (!active || !step) return
    let scrolled = false
    const measure = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight })
      const el = findTarget(step)
      if (el && !scrolled) {
        scrolled = true
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
      const r = el?.getBoundingClientRect()
      setRect((prev) => {
        if (!r) return prev === null ? prev : null
        const next = { x: r.x, y: r.y, width: r.width, height: r.height }
        return prev && prev.x === next.x && prev.y === next.y && prev.width === next.width && prev.height === next.height ? prev : next
      })
    }
    measure()
    const timer = setInterval(measure, 150)
    window.addEventListener('resize', measure)
    return () => {
      clearInterval(timer)
      window.removeEventListener('resize', measure)
    }
  }, [active, step])

  useLayoutEffect(() => {
    if (dialogRef.current) setBubbleHeight(dialogRef.current.offsetHeight)
  }, [active, index, viewport.width])

  // Focus the main action on every step, so Enter moves on.
  useEffect(() => {
    if (active) nextRef.current?.focus()
  }, [active, index])

  if (!active || !step) return null
  const width = Math.min(BUBBLE_WIDTH, viewport.width - 24)
  const placed = placeBubble(rect, { width, height: bubbleHeight }, viewport)
  const last = index === TOUR_STEPS.length - 1
  const hole = rect && { left: rect.x - PAD, top: rect.y - PAD, width: rect.width + 2 * PAD, height: rect.height + 2 * PAD }
  const motionTransition = reduced ? { duration: 0 } : { type: 'spring' as const, stiffness: 220, damping: 28 }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      skip()
    } else if (e.key === 'ArrowRight') next()
    else if (e.key === 'ArrowLeft') back()
    else if (e.key === 'Tab') {
      // Focus stays in the tour. Moved here explicitly, because browsers differ in what Tab reaches
      // (Safari skips buttons by default).
      e.preventDefault()
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])]
      if (focusable.length === 0) return
      const at = focusable.indexOf(document.activeElement instanceof HTMLElement ? document.activeElement : focusable[0])
      const nextIndex = (at + (e.shiftKey ? -1 : 1) + focusable.length) % focusable.length
      focusable[nextIndex].focus()
    }
  }

  return (
    <div className="fixed inset-0 z-[80]" data-testid="tour" data-step={step.id} data-reduced-motion={reduced} onKeyDown={onKeyDown}>
      {/* Blocks the page while the tour is open; the spotlight is a hole in the dimming. */}
      <div className="absolute inset-0" aria-hidden="true" onClick={(e) => e.stopPropagation()} />
      {hole ? (
        <motion.div
          data-testid="tour-spotlight"
          aria-hidden="true"
          className="absolute rounded-[6px] pointer-events-none ring-2 ring-accent-teal"
          style={{ boxShadow: '0 0 0 9999px rgba(19, 21, 31, 0.78)' }}
          initial={false}
          animate={hole}
          transition={motionTransition}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(19,21,31,0.78)]" aria-hidden="true" />
      )}
      <motion.div
        className="absolute flex items-end gap-2"
        style={{ width, flexDirection: placed.facing === 'right' ? 'row' : 'row-reverse' }}
        initial={false}
        animate={{ left: placed.left, top: placed.top }}
        transition={motionTransition}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-title"
          aria-describedby="tour-text"
          data-testid="tour-bubble"
          className="flex-1 min-w-0 p-4 bg-bg-surface border border-accent-teal/60 rounded-[6px] shadow-2xl space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id="tour-title" className="text-sm font-semibold text-text-primary">
              {step.title}
            </h2>
            <span className="text-[11px] font-mono text-text-secondary whitespace-nowrap" data-testid="tour-progress">
              {progressLabel(index)}
            </span>
          </div>
          <p id="tour-text" className="text-xs text-text-secondary leading-relaxed">
            {step.text}
          </p>
          <div className="h-1 bg-bg-surface-active rounded-[1px] overflow-hidden" aria-hidden="true">
            <div className="h-full bg-accent-teal" style={{ width: `${((index + 1) / TOUR_STEPS.length) * 100}%` }} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={skip} className={`${button} text-text-secondary hover:text-text-primary`}>
              Skip tutorial
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={back} disabled={index === 0} className={`${button} border border-border-strong text-text-primary disabled:opacity-40 disabled:cursor-not-allowed`}>
                Back
              </button>
              <button ref={nextRef} type="button" onClick={next} className={`${button} bg-accent-teal text-bg-primary font-semibold`}>
                {last ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        </div>
        <div className="shrink-0">
          <Mascot pose={step.pose} facing={placed.facing} talking size={viewport.width < 480 ? 56 : 88} />
        </div>
      </motion.div>
      <div role="status" aria-live="polite" className="sr-only" data-testid="tour-announcer">
        {`${progressLabel(index)}. ${step.title}. ${step.text}`}
      </div>
    </div>
  )
}

export default TourHost
