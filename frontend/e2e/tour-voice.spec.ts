/**
 * Netbot's voice, with speechSynthesis replaced by a recorder: what is spoken and cancelled, and when.
 * Also the mute badge on Netbot's head, and the tour without any speech support.
 */
import type { Page } from '@playwright/test'
import { expect, test } from './helpers'
import { TOUR_STEPS } from '../src/features/tour/steps'

type Call = ['speak', string] | ['cancel']
declare global {
  interface Window {
    __speech?: Call[]
    /** The voice each speak() call carried (null: the browser default). */
    __speechVoices?: Array<string | null>
  }
}

/** voicesAfterMs: undefined = loaded at once; a number = empty until then, then voiceschanged; null = never. */
async function mockSpeech(page: Page, voicesAfterMs?: number | null) {
  await page.addInitScript((after) => {
    const calls: Array<['speak', string] | ['cancel']> = []
    const used: Array<string | null> = []
    window.__speech = calls
    window.__speechVoices = used
    const all = [
      { name: 'Bad News', lang: 'en-US', default: true, localService: true, voiceURI: 'bad-news' },
      { name: 'Samantha', lang: 'en-US', default: false, localService: true, voiceURI: 'samantha' },
    ]
    let voices = after === undefined ? all : []
    const listeners: Array<() => void> = []
    // Like Chrome: the list starts loading on first use and arrives with voiceschanged.
    let started = false
    const load = () => {
      if (started || after === undefined || after === null) return
      started = true
      setTimeout(() => {
        voices = all
        for (const l of listeners) l()
      }, after)
    }
    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      speak: (u: { text: string; voice: { name: string } | null }) => {
        used.push(u.voice ? u.voice.name : null)
        calls.push(['speak', u.text])
      },
      cancel: () => void calls.push(['cancel']),
      getVoices: () => {
        load()
        return voices
      },
      addEventListener: (_t: string, l: () => void) => void listeners.push(l),
      removeEventListener: (_t: string, l: () => void) => {
        const i = listeners.indexOf(l)
        if (i >= 0) listeners.splice(i, 1)
      },
      pause: () => undefined,
      resume: () => undefined,
    }
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })
    class FakeUtterance {
      text: string
      voice: unknown = null
      lang = ''
      pitch = 1
      rate = 1
      onend: (() => void) | null = null
      constructor(text: string) {
        this.text = text
      }
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true })
  }, voicesAfterMs)
}

const calls = (page: Page) => page.evaluate(() => window.__speech ?? [])
const tutorial = (page: Page) => page.getByRole('switch', { name: 'Tutorial' })
const mute = (page: Page) => page.getByTestId('tour-mute')
const text = (i: number) => TOUR_STEPS[i].text

/** Calls made since `from`. */
async function since(page: Page, from: number) {
  return (await calls(page)).slice(from)
}

test.describe('voice', () => {
  test.beforeEach(async ({ page }) => {
    await mockSpeech(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/studio')
  })

  test('nothing is spoken on page load; the switch starts speech with the step text only', async ({ page, issues }) => {
    await page.waitForTimeout(800)
    expect(await calls(page)).toEqual([])
    await tutorial(page).click()
    await expect.poll(() => since(page, 0)).toEqual([['cancel'], ['speak', text(0)]])
    // Only the explanation: no title, counter or icon names.
    expect(text(0)).not.toMatch(/Step \d/)
    expect(issues).toEqual([])
  })

  test('Next and Back cancel the current speech before speaking the new step', async ({ page }) => {
    await tutorial(page).click()
    await expect.poll(() => calls(page)).toEqual([['cancel'], ['speak', text(0)]])
    let n = (await calls(page)).length
    await page.getByRole('button', { name: 'Next' }).click()
    await expect.poll(() => since(page, n)).toEqual([['cancel'], ['cancel'], ['speak', text(1)]])
    n = (await calls(page)).length
    await page.getByRole('button', { name: 'Back' }).click()
    await expect.poll(() => since(page, n)).toEqual([['cancel'], ['cancel'], ['speak', text(0)]])
  })

  test('mute stops speech at once and later steps stay silent; unmute speaks the current step again', async ({ page }) => {
    await tutorial(page).click()
    await expect.poll(() => calls(page)).toEqual([['cancel'], ['speak', text(0)]])
    let n = (await calls(page)).length
    await mute(page).click()
    await expect(mute(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(mute(page)).toHaveAccessibleName('Unmute voice')
    expect((await since(page, n)).filter((c) => c[0] === 'cancel').length).toBeGreaterThan(0)
    // The click does not advance or close the tour.
    await expect(page.getByTestId('tour')).toHaveAttribute('data-step', TOUR_STEPS[0].id)
    n = (await calls(page)).length
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByTestId('tour')).toHaveAttribute('data-step', TOUR_STEPS[2].id)
    await page.waitForTimeout(300)
    expect((await since(page, n)).filter((c) => c[0] === 'speak')).toEqual([])
    n = (await calls(page)).length
    await mute(page).click()
    await expect(mute(page)).toHaveAttribute('aria-pressed', 'false')
    await expect(mute(page)).toHaveAccessibleName('Mute voice')
    await expect.poll(async () => (await since(page, n)).filter((c) => c[0] === 'speak')).toEqual([['speak', text(2)]])
  })

  test('Skip and the Tutorial switch both cancel speech, and nothing is spoken after the tour closes', async ({ page }) => {
    await tutorial(page).click()
    await expect.poll(() => calls(page)).toEqual([['cancel'], ['speak', text(0)]])
    let n = (await calls(page)).length
    await page.getByRole('button', { name: 'Skip tutorial' }).click()
    await expect(page.getByTestId('tour')).toHaveCount(0)
    expect((await since(page, n)).map((c) => c[0])).toContain('cancel')
    expect((await since(page, n)).filter((c) => c[0] === 'speak')).toEqual([])

    await tutorial(page).click()
    await expect.poll(async () => (await since(page, n)).filter((c) => c[0] === 'speak')).toEqual([['speak', text(0)]])
    n = (await calls(page)).length
    await tutorial(page).click()
    await expect(page.getByTestId('tour')).toHaveCount(0)
    await page.waitForTimeout(400)
    const after = await since(page, n)
    expect(after.map((c) => c[0])).toContain('cancel')
    expect(after.filter((c) => c[0] === 'speak')).toEqual([])
  })

  test('the mute badge: on the head above the face, 44px target, focus ring, keyboard, clickable over the overlay', async ({ page }) => {
    await tutorial(page).click()
    await expect(mute(page)).toBeVisible()
    const geo = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="tour-mute"]')!.getBoundingClientRect()
      const badge = document.querySelector('[data-testid="tour-mute-badge"]')!.getBoundingClientRect()
      const svg = document.querySelector('[data-testid="tour-mascot"]')!.getBoundingClientRect()
      const top = document.elementFromPoint(btn.x + btn.width / 2, btn.y + btn.height / 2)
      return {
        target: [btn.width, btn.height],
        // Face plate starts at y 33 of the 110 unit drawing.
        badgeBottom: badge.bottom,
        faceTop: svg.top + (33 / 110) * svg.height,
        centredOnHead: Math.abs(badge.x + badge.width / 2 - (svg.x + svg.width / 2)) < 2,
        onTop: !!top?.closest('[data-testid="tour-mute"]'),
        inView: badge.left >= 0 && badge.top >= 0 && badge.right <= innerWidth && badge.bottom <= innerHeight,
      }
    })
    expect(geo.target[0]).toBeGreaterThanOrEqual(44)
    expect(geo.target[1]).toBeGreaterThanOrEqual(44)
    expect(geo.badgeBottom).toBeLessThanOrEqual(geo.faceTop)
    expect(geo).toMatchObject({ centredOnHead: true, onTop: true, inView: true })

    // Keyboard: Tab reaches it inside the tour, the ring shows, Space toggles it, the step stays.
    for (let i = 0; i < 6 && !(await mute(page).evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab')
    await expect(mute(page)).toBeFocused()
    const ring = await page.getByTestId('tour-mute-badge').evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(ring).not.toBe('none')
    await page.keyboard.press('Space')
    await expect(mute(page)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('tour')).toHaveAttribute('data-step', TOUR_STEPS[0].id)
  })
})

test.describe('voices that load late', () => {
  test('the first line waits for the voice list and uses the chosen voice, the same one as after unmute', async ({ page, issues }) => {
    await mockSpeech(page, 600)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/studio')
    await tutorial(page).click()
    // The bubble shows at once; speech waits for the voices.
    await expect(page.getByTestId('tour-bubble')).toContainText(text(0))
    expect((await calls(page)).filter((c) => c[0] === 'speak')).toEqual([])
    await expect.poll(async () => (await calls(page)).filter((c) => c[0] === 'speak')).toEqual([['speak', text(0)]])
    await mute(page).click()
    await mute(page).click()
    await expect.poll(async () => (await calls(page)).filter((c) => c[0] === 'speak').length).toBe(2)
    // Samantha (the friendly pick), never the browser default, on the first line and after unmute.
    expect(await page.evaluate(() => window.__speechVoices)).toEqual(['Samantha', 'Samantha'])
    expect(issues).toEqual([])
  })

  test('a voice list that never loads: the first line still speaks after the wait, with the browser default', async ({ page }) => {
    await mockSpeech(page, null)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/studio')
    await tutorial(page).click()
    await page.waitForTimeout(800)
    expect((await calls(page)).filter((c) => c[0] === 'speak')).toEqual([])
    await expect.poll(async () => (await calls(page)).filter((c) => c[0] === 'speak'), { timeout: 4000 }).toEqual([['speak', text(0)]])
    expect(await page.evaluate(() => window.__speechVoices)).toEqual([null])
    // Still usable: Next speaks at once (the choice is cached).
    await page.getByRole('button', { name: 'Next' }).click()
    await expect.poll(async () => (await calls(page)).filter((c) => c[0] === 'speak').length).toBe(2)
  })
})

test.describe('without speech synthesis', () => {
  test('the tour runs silently, with no mute badge and no errors', async ({ page, issues }) => {
    await page.addInitScript(() => {
      // Model a browser without the Web Speech API: the getter lives on Window.prototype.
      Reflect.deleteProperty(Window.prototype, 'speechSynthesis')
      Reflect.deleteProperty(window, 'speechSynthesis')
      Reflect.deleteProperty(window, 'SpeechSynthesisUtterance')
    })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/studio')
    expect(await page.evaluate(() => 'speechSynthesis' in window)).toBe(false)
    await tutorial(page).click()
    await expect(page.getByTestId('tour')).toHaveAttribute('data-step', TOUR_STEPS[0].id)
    await expect(mute(page)).toHaveCount(0)
    // The text is announced through the live region instead.
    await expect(page.getByTestId('tour-announcer')).toContainText(text(0))
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByTestId('tour')).toHaveAttribute('data-step', TOUR_STEPS[1].id)
    await tutorial(page).click()
    await expect(page.getByTestId('tour')).toHaveCount(0)
    expect(issues).toEqual([])
  })
})
