import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TOUR_STEPS } from '../features/tour/steps'
import { findTarget, placeBubble } from '../features/tour/placement'
import { Mascot } from '../features/tour/Mascot'
import { TourHost } from '../features/tour/TourHost'
import { markTourSeen, progressLabel, TOUR_SEEN_KEY, tourSeen, useTourStore } from '../store/tourStore'
import { useStudioView } from '../store/studioViewStore'
import { resetStores } from './fixtures'

const tour = () => useTourStore.getState()

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? reduce : false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    onchange: null,
    dispatchEvent: () => false,
  }))
}

beforeEach(() => {
  resetStores()
  localStorage.clear()
  useTourStore.setState({ active: false, index: 0 })
})
afterEach(() => vi.unstubAllGlobals())

describe('tour steps', () => {
  it('cover every section the brief names, in a sensible order', () => {
    const ids = TOUR_STEPS.map((s) => s.id)
    for (const id of ['canvas', 'add-nodes', 'failures', 'analysis', 'critical', 'paths', 'simulation', 'presets', 'import-export', 'dashboard']) expect(ids).toContain(id)
    expect(ids[0]).toBe('welcome')
    expect(ids.at(-1)).toBe('done')
    expect(ids.indexOf('dashboard')).toBeGreaterThan(ids.indexOf('simulation'))
  })

  it('keep each explanation to one or two short sentences', () => {
    for (const s of TOUR_STEPS) {
      const sentences = s.text.split(/(?<=[.!?])\s+/).filter(Boolean)
      expect(sentences.length, s.id).toBeLessThanOrEqual(2)
      expect(s.text.length, s.id).toBeLessThanOrEqual(180)
      expect(s.text).not.toMatch(/—/)
    }
  })
})

describe('tour store', () => {
  it('next and back stay in range; the last Next finishes and remembers it', () => {
    tour().start()
    tour().back()
    expect(tour().index).toBe(0)
    for (let i = 1; i < TOUR_STEPS.length; i++) {
      tour().next()
      expect(tour().index).toBe(i)
    }
    expect(tourSeen()).toBe(false)
    tour().next()
    expect([tour().active, tourSeen()]).toEqual([false, true])
  })

  it('skip ends the tour and remembers it', () => {
    tour().start()
    tour().next()
    tour().skip()
    expect([tour().active, tour().index, localStorage.getItem(TOUR_SEEN_KEY)]).toEqual([false, 0, '1'])
  })

  it('starts by itself only on a first visit, and can always be replayed', () => {
    tour().startIfFirstVisit()
    expect(tour().active).toBe(true)
    tour().skip()
    tour().startIfFirstVisit()
    expect(tour().active).toBe(false)
    tour().start()
    expect([tour().active, tour().index]).toEqual([true, 0])
  })

  it('storage errors are caught: unreadable means not seen, unwritable is ignored', () => {
    const broken = () => {
      throw new DOMException('blocked', 'SecurityError')
    }
    expect(tourSeen(broken)).toBe(false)
    expect(() => markTourSeen(broken)).not.toThrow()
    class FullStorage implements Storage {
      length = 0
      clear() {}
      getItem() {
        return null
      }
      key() {
        return null
      }
      removeItem() {}
      setItem(): void {
        throw new DOMException('full', 'QuotaExceededError')
      }
    }
    expect(() => markTourSeen(() => new FullStorage())).not.toThrow()
  })

  it('progress label', () => {
    expect(progressLabel(2)).toBe(`Step 3 of ${TOUR_STEPS.length}`)
  })
})

describe('placement', () => {
  const viewport = { width: 1440, height: 900 }
  const bubble = { width: 320, height: 200 }

  it('beside the element when there is room, facing it', () => {
    expect(placeBubble({ x: 1100, y: 300, width: 300, height: 100 }, bubble, viewport)).toEqual({ left: 764, top: 250, facing: 'right' })
    expect(placeBubble({ x: 20, y: 300, width: 300, height: 100 }, bubble, viewport)).toEqual({ left: 336, top: 250, facing: 'left' })
  })

  it('below or above a wide element, and centred without one; always on screen', () => {
    const wide = placeBubble({ x: 0, y: 100, width: 1440, height: 200 }, bubble, viewport)
    expect(wide.top).toBe(316)
    const phone = placeBubble({ x: 0, y: 112, width: 390, height: 700 }, bubble, { width: 390, height: 844 })
    expect(phone.left).toBeGreaterThanOrEqual(12)
    expect(phone.top + bubble.height).toBeLessThanOrEqual(844 - 12)
    expect(placeBubble(null, bubble, viewport)).toEqual({ left: 560, top: 350, facing: 'right' })
  })

  it('findTarget takes the first visible candidate', () => {
    document.body.innerHTML = '<div data-tour="a"></div><div data-tour="b"></div>'
    const [a, b] = [document.querySelector<HTMLElement>('[data-tour="a"]'), document.querySelector<HTMLElement>('[data-tour="b"]')]
    if (!a || !b) throw new Error('setup')
    a.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0)
    b.getBoundingClientRect = () => new DOMRect(1, 1, 10, 10)
    const step = { ...TOUR_STEPS[1], targets: ['[data-tour="a"]', '[data-tour="b"]'] }
    expect(findTarget(step)).toBe(b)
    expect(findTarget({ ...step, targets: ['[data-tour="missing"]'] })).toBeNull()
    document.body.innerHTML = ''
  })
})

describe('mascot', () => {
  it('shows its pose and facing, animated normally and still with reduced motion', () => {
    mockReducedMotion(false)
    const { unmount } = render(<Mascot pose="wave" facing="left" talking />)
    expect(screen.getByTestId('tour-mascot')).toHaveAttribute('data-pose', 'wave')
    expect(screen.getByTestId('tour-mascot')).toHaveAttribute('data-animated', 'true')
    unmount()
    mockReducedMotion(true)
    render(<Mascot pose="point" facing="right" talking />)
    expect(screen.getByTestId('tour-mascot')).toHaveAttribute('data-facing', 'right')
    expect(screen.getByTestId('tour-mascot')).toHaveAttribute('data-animated', 'false')
  })
})

describe('tour host', () => {
  const host = () =>
    render(
      <MemoryRouter initialEntries={['/studio']}>
        <TourHost />
      </MemoryRouter>
    )

  it('renders the step as a labelled dialog with progress, announces it, and focuses Next', () => {
    mockReducedMotion(false)
    act(() => tour().start())
    host()
    expect(screen.getByRole('dialog', { name: 'Hi, I am Netbot' })).toBeInTheDocument()
    expect(screen.getByTestId('tour-progress')).toHaveTextContent(`Step 1 of ${TOUR_STEPS.length}`)
    expect(screen.getByTestId('tour-announcer')).toHaveTextContent('Hi, I am Netbot.')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
  })

  it('Next applies the step preparation; arrow keys step; Escape skips', () => {
    mockReducedMotion(false)
    act(() => tour().start())
    host()
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByTestId('tour')).toHaveAttribute('data-step', 'failures')
    expect(useStudioView.getState().panelTab).toBe('properties')
    fireEvent.keyDown(screen.getByTestId('tour'), { key: 'ArrowRight' })
    expect(useStudioView.getState().panelTab).toBe('analysis')
    fireEvent.keyDown(screen.getByTestId('tour'), { key: 'ArrowLeft' })
    expect(screen.getByTestId('tour')).toHaveAttribute('data-step', 'failures')
    fireEvent.keyDown(screen.getByTestId('tour'), { key: 'Escape' })
    expect(screen.queryByTestId('tour')).toBeNull()
    expect(tourSeen()).toBe(true)
  })

  it('reduced motion: the text still appears and the mascot is still', () => {
    mockReducedMotion(true)
    act(() => tour().start())
    host()
    expect(screen.getByTestId('tour')).toHaveAttribute('data-reduced-motion', 'true')
    expect(screen.getByTestId('tour-bubble')).toHaveTextContent('I will show you around NetShield')
    expect(screen.getByTestId('tour-mascot')).toHaveAttribute('data-animated', 'false')
  })
})
