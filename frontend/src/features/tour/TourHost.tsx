/**
 * Runs the guided tour: dims the page, cuts a spotlight around the live element of the current step,
 * and shows Netbot with a speech bubble, Next, Back, Skip and the step count. Netbot reads each step's
 * explanation aloud (browser speech synthesis) unless muted with the badge on its head. Keyboard: Tab
 * moves between the buttons, Enter activates, Escape skips, arrow keys step. With reduced motion the
 * spotlight jumps and the mascot stays still.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Volume2, VolumeX } from 'lucide-react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { progressLabel, useTourStore } from '@/store/tourStore'
import { useStudioView } from '@/store/studioViewStore'
import { Mascot } from './Mascot'
import { findTarget, placeBubble, SHEET_BELOW, SPOT_PAD, type Rect } from './placement'
import { TOUR_STEPS, type TourStep } from './steps'
import { existingVoice, getVoice, speechAvailable } from './voice'

const button = 'min-h-11 px-4 rounded-[3px] text-xs font-medium cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-teal'
/** Desktop sizes: about a third larger than the first version (mascot 88px, bubble 224px). */
const MASCOT = 120
const BUBBLE = 310
const MASCOT_SHEET = 72

function applyPrepare(step: TourStep): void {
  const view = useStudioView.getState()
  if (step.prepare?.panelTab) view.setPanelTab(step.prepare.panelTab)
  if (step.prepare?.section) view.setSection(step.prepare.section)
  if (step.prepare?.details !== undefined) view.setDetailsOpen(step.prepare.details)
}

/** The app's top bar stays above the tour (it holds the Tutorial switch), so the tour box keeps below it. */
function topInset(): number {
  const bar = document.querySelector('header')
  if (!bar || getComputedStyle(bar).position !== 'fixed') return 0
  return Math.max(0, bar.getBoundingClientRect().bottom)
}

export const TourHost: React.FC = () => {
  const active = useTourStore((s) => s.active)
  const index = useTourStore((s) => s.index)
  const muted = useTourStore((s) => s.muted)
  const { next, back, skip, setMuted } = useTourStore.getState()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  const step = TOUR_STEPS[index]
  const [rect, setRect] = useState<Rect | null>(null)
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight, topInset: 0 })
  const [boxSize, setBoxSize] = useState({ width: BUBBLE + MASCOT + 12, height: 280 })
  const boxSizeRef = useRef(boxSize)
  useEffect(() => {
    boxSizeRef.current = boxSize
  }, [boxSize])
  const rootRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const [canSpeak] = useState(speechAvailable)
  const speaking = canSpeak && !muted

  // Bring the app to the step: its page, then its panel or section.
  useEffect(() => {
    if (!active || !step) return
    if (pathname !== step.route) navigate(step.route)
    else applyPrepare(step)
  }, [active, step, pathname, navigate])

  // The voice follows the step: cancel whatever is playing, then read this step's explanation. Muting,
  // Skip, Finish and the Tutorial switch all end up here (or in the cleanup), so speech never overlaps
  // and never outlives the tour. The tour only opens from a click, the gesture browsers require.
  useEffect(() => {
    if (!canSpeak) return
    if (!active || !step || muted) {
      // Stopping never creates the voice, so nothing touches speech before the tour is turned on.
      existingVoice()?.hush()
      return
    }
    const voice = getVoice()
    voice.say(step.text)
    return () => voice.hush()
  }, [canSpeak, active, step, muted])

  // Follow the live element while the step is shown (layout, scrolling and resizing can move it).
  useEffect(() => {
    if (!active || !step) return
    let scrolled = false
    let aligned = false
    const measure = () => {
      const inset = topInset()
      setViewport((v) => (v.width === window.innerWidth && v.height === window.innerHeight && v.topInset === inset ? v : { width: window.innerWidth, height: window.innerHeight, topInset: inset }))
      const el = findTarget(step)
      if (el && !scrolled) {
        scrolled = true
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
      // Phone sheet: when the element sits where neither the top nor the bottom sheet can clear it, scroll
      // it to the top of its panel once, so the sheet can dock below it instead of covering it.
      if (el && !aligned && window.innerWidth < SHEET_BELOW) {
        const t = el.getBoundingClientRect()
        const h = boxSizeRef.current.height
        const clearBelow = t.bottom + SPOT_PAD <= window.innerHeight - h - 12
        const clearAbove = t.top - SPOT_PAD >= inset + 12 + h
        if (!clearBelow && !clearAbove) {
          aligned = true
          el.scrollIntoView({ block: 'start', inline: 'nearest' })
        }
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

  // The whole box (bubble, Netbot and the badge on its head) is what has to fit on screen.
  useLayoutEffect(() => {
    const el = boxRef.current
    if (el) setBoxSize((b) => (b.width === el.offsetWidth && b.height === el.offsetHeight ? b : { width: el.offsetWidth, height: el.offsetHeight }))
  }, [active, index, viewport.width, viewport.height, canSpeak])

  // Focus the main action on every step, so Enter moves on.
  useEffect(() => {
    if (active) nextRef.current?.focus()
  }, [active, index])

  if (!active || !step) return null
  const sheet = viewport.width < SHEET_BELOW
  const mascotSize = sheet ? MASCOT_SHEET : MASCOT
  const boxWidth = sheet ? viewport.width - 24 : Math.min(BUBBLE + 12 + MASCOT, viewport.width - 24)
  const placed = placeBubble(rect, boxSize, viewport)
  const last = index === TOUR_STEPS.length - 1
  const hole = rect && { left: rect.x - SPOT_PAD, top: rect.y - SPOT_PAD, width: rect.width + 2 * SPOT_PAD, height: rect.height + 2 * SPOT_PAD }
  const motionTransition = reduced ? { duration: 0 } : { type: 'spring' as const, stiffness: 220, damping: 28 }
  // While the voice reads the explanation, the live region carries only the step and title, so a screen
  // reader user does not hear the same sentence twice; muted or without speech, it carries the text too.
  const announcement = speaking ? `${progressLabel(index)}. ${step.title}.` : `${progressLabel(index)}. ${step.title}. ${step.text}`

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      skip()
    } else if (e.key === 'ArrowRight') next()
    else if (e.key === 'ArrowLeft') back()
    else if (e.key === 'Tab') {
      // Focus stays in the tour (the bubble's buttons and the mute badge). Moved here explicitly, because
      // browsers differ in what Tab reaches (Safari skips buttons by default).
      e.preventDefault()
      const focusable = [...(rootRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])]
      if (focusable.length === 0) return
      const at = focusable.indexOf(document.activeElement instanceof HTMLElement ? document.activeElement : focusable[0])
      const nextIndex = (at + (e.shiftKey ? -1 : 1) + focusable.length) % focusable.length
      focusable[nextIndex].focus()
    }
  }

  const muteBadge = canSpeak ? (
    // 44px target; the visible round badge sits on the antenna tip, so it reads as part of Netbot.
    <button
      type="button"
      data-testid="tour-mute"
      aria-label={muted ? 'Unmute voice' : 'Mute voice'}
      aria-pressed={muted}
      onClick={(e) => {
        e.stopPropagation()
        setMuted(!muted)
      }}
      className="group w-11 h-11 flex items-center justify-center cursor-pointer focus-visible:outline-none"
    >
      <span
        data-testid="tour-mute-badge"
        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shadow-lg group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-accent-teal ${
          muted ? 'bg-bg-surface border-state-failure text-state-failure' : 'bg-accent-teal border-accent-teal text-bg-primary'
        }`}
      >
        {muted ? <VolumeX className="w-4 h-4" aria-hidden="true" /> : <Volume2 className="w-4 h-4" aria-hidden="true" />}
      </span>
    </button>
  ) : null

  const mascot = (
    // Room above the drawing for the badge on its head, so the badge is inside the measured box.
    <div className={`shrink-0 ${canSpeak ? 'pt-4' : ''}`} data-testid="tour-mascot-box">
      <Mascot pose={step.pose} facing={placed.facing} talking={speaking} size={mascotSize} head={muteBadge} />
    </div>
  )

  return (
    <div ref={rootRef} className="fixed inset-0 z-[80]" data-testid="tour" data-step={step.id} data-reduced-motion={reduced} data-layout={sheet ? 'sheet' : 'beside'} onKeyDown={onKeyDown}>
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
        ref={boxRef}
        data-testid="tour-box"
        className={`absolute flex ${sheet ? 'flex-col' : 'items-end gap-3'}`}
        style={{ width: boxWidth, flexDirection: sheet ? 'column' : placed.facing === 'right' ? 'row' : 'row-reverse' }}
        initial={false}
        animate={{ left: placed.left, top: placed.top }}
        transition={motionTransition}
      >
        {sheet && <div className={`flex ${placed.facing === 'right' ? 'justify-end' : 'justify-start'} -mb-6`}>{mascot}</div>}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-title"
          aria-describedby="tour-text"
          data-testid="tour-bubble"
          className={`flex-1 min-w-0 ${sheet ? 'p-4 space-y-3' : 'p-6 space-y-4'} bg-bg-surface border border-accent-teal/60 rounded-[6px] shadow-2xl`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="tour-title" className="text-base font-semibold text-text-primary leading-snug">
              {step.title}
            </h2>
            {/* The counter is visual; the live region says it once in words. */}
            <span className="text-2xs font-mono text-text-secondary whitespace-nowrap" data-testid="tour-progress" aria-hidden="true">
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
            <button type="button" onClick={skip} className={`${button} -ml-2 text-text-secondary hover:text-text-primary`}>
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
        {!sheet && mascot}
      </motion.div>
      <div role="status" aria-live="polite" className="sr-only" data-testid="tour-announcer">
        {announcement}
      </div>
    </div>
  )
}

export default TourHost
