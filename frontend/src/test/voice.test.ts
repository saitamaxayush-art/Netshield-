import { afterEach, describe, expect, it, vi } from 'vitest'
import { createVoice, pickVoice, type SynthLike } from '../features/tour/voice'

/** A fake speech engine that models the real queue: speak() queues, cancel() empties the queue. */
class FakeSynth implements SynthLike {
  queue: SpeechSynthesisUtterance[] = []
  maxQueued = 0
  spoken: string[] = []
  cancels = 0
  voices: SpeechSynthesisVoice[] = []
  private listeners: Array<() => void> = []
  speak(u: SpeechSynthesisUtterance) {
    this.queue.push(u)
    this.spoken.push(u.text)
    this.maxQueued = Math.max(this.maxQueued, this.queue.length)
  }
  cancel() {
    this.cancels++
    this.queue = []
  }
  getVoices() {
    return this.voices
  }
  addEventListener(_type: 'voiceschanged', listener: () => void) {
    this.listeners.push(listener)
  }
  fireVoicesChanged() {
    for (const l of this.listeners) l()
  }
}

class FakeUtterance {
  text: string
  voice: SpeechSynthesisVoice | null = null
  lang = ''
  pitch = 1
  rate = 1
  onend: (() => void) | null = null
  constructor(text: string) {
    this.text = text
  }
}
const Utterance = FakeUtterance as unknown as new (text: string) => SpeechSynthesisUtterance

const voice = (name: string, lang: string) => ({ name, lang, default: false, localService: true, voiceURI: name }) as SpeechSynthesisVoice
/** A synth whose voices are already loaded. */
const loaded = () => {
  const synth = new FakeSynth()
  synth.voices = [voice('Samantha', 'en-US')]
  return synth
}
afterEach(() => vi.useRealTimers())

describe('Netbot voice', () => {
  it('never has two utterances active: every say cancels the previous one first', () => {
    const synth = loaded()
    const v = createVoice(synth, Utterance)
    for (const text of ['one', 'two', 'three', 'four']) v.say(text)
    expect(synth.maxQueued).toBe(1)
    expect(synth.queue.map((u) => u.text)).toEqual(['four'])
    expect(synth.cancels).toBe(4)
    expect(v.current()?.text).toBe('four')
    v.hush()
    expect([synth.queue.length, v.current()]).toEqual([0, null])
  })

  it('speaks with a slightly higher pitch at a normal rate, in English, with the chosen voice', async () => {
    const synth = loaded()
    createVoice(synth, Utterance).say('Hello')
    await Promise.resolve()
    await Promise.resolve()
    const u = synth.queue[0]
    expect([u.pitch, u.rate, u.lang, u.voice?.name]).toEqual([1.3, 1, 'en-US', 'Samantha'])
  })

  it('prefers a friendly English voice, then any English one, else the default', () => {
    expect(pickVoice([voice('Thomas', 'fr-FR'), voice('Samantha', 'en-US')])?.name).toBe('Samantha')
    expect(pickVoice([voice('Thomas', 'fr-FR'), voice('Fred', 'en-GB')])?.name).toBe('Fred')
    expect(pickVoice([voice('Thomas', 'fr-FR')])).toBeNull()
    expect(pickVoice([])).toBeNull()
  })

  it('voices still loading: the first line waits for voiceschanged and uses the chosen voice, never the default', async () => {
    vi.useFakeTimers()
    const synth = new FakeSynth()
    const v = createVoice(synth, Utterance)
    v.say('first line')
    expect(synth.spoken).toEqual([])
    await vi.advanceTimersByTimeAsync(300)
    synth.voices = [voice('Thomas', 'fr-FR'), voice('Google US English', 'en-US')]
    synth.fireVoicesChanged()
    await vi.advanceTimersByTimeAsync(0)
    expect(synth.queue.map((u) => [u.text, u.voice?.name])).toEqual([['first line', 'Google US English']])
    // Cached: later lines use the same voice at once.
    v.say('second line')
    expect(synth.queue.map((u) => [u.text, u.voice?.name])).toEqual([['second line', 'Google US English']])
  })

  it('voices that never load: the first line still speaks after the wait, with the browser default', async () => {
    vi.useFakeTimers()
    const synth = new FakeSynth()
    createVoice(synth, Utterance, 1500).say('first line')
    await vi.advanceTimersByTimeAsync(1499)
    expect(synth.spoken).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(synth.queue.map((u) => [u.text, u.voice])).toEqual([['first line', null]])
  })

  it('a line held while voices load is dropped when Next, mute or Skip comes first; one utterance at most', async () => {
    vi.useFakeTimers()
    const synth = new FakeSynth()
    const v = createVoice(synth, Utterance)
    v.say('step 1')
    v.say('step 2')
    v.hush()
    v.say('step 3')
    synth.voices = [voice('Samantha', 'en-US')]
    synth.fireVoicesChanged()
    await vi.advanceTimersByTimeAsync(0)
    expect(synth.spoken).toEqual(['step 3'])
    expect(synth.maxQueued).toBe(1)
  })

  it('without speech synthesis it is unavailable and every call is a silent no-op', () => {
    const v = createVoice(null, null)
    expect(v.available).toBe(false)
    expect(() => {
      v.say('x')
      v.hush()
    }).not.toThrow()
    expect(v.current()).toBeNull()
  })
})
