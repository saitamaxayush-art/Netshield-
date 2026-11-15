/**
 * Netbot's voice: the browser's own speech synthesis (Web Speech API), no audio files and no network.
 * Every say() cancels whatever is queued or speaking first, so at most one utterance exists at a time and
 * speech never overlaps. Without speechSynthesis the voice is simply unavailable and every call is a no-op.
 */

/** The parts of SpeechSynthesis used here, so tests can pass a fake. */
export interface SynthLike {
  speak(utterance: SpeechSynthesisUtterance): void
  cancel(): void
  getVoices(): SpeechSynthesisVoice[]
  addEventListener?(type: 'voiceschanged', listener: () => void): void
  removeEventListener?(type: 'voiceschanged', listener: () => void): void
}

export interface Voice {
  readonly available: boolean
  /** Stop anything in progress, then speak this text. */
  say(text: string): void
  /** Stop at once. */
  hush(): void
  /** The utterance currently owned by the voice, or null (for tests). */
  current(): SpeechSynthesisUtterance | null
}

/** Friendly English voices first, then any English voice, then the browser default (null). */
const PREFERRED = ['Samantha', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny', 'Karen', 'Daniel', 'Google UK English Female']

export function pickVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'))
  for (const name of PREFERRED) {
    const match = english.find((v) => v.name.includes(name))
    if (match) return match
  }
  return english.find((v) => v.lang.toLowerCase() === 'en-us') ?? english[0] ?? null
}

/** How long to wait for a voice list that is still loading before using the browser default. */
export const VOICE_WAIT_MS = 1500

/**
 * Resolve the voice once. Chrome and others load voices lazily: getVoices() is empty at first and the list
 * arrives with voiceschanged. Wait for it (up to VOICE_WAIT_MS), pick, and keep that choice for the session,
 * so every utterance, the first included, uses the same voice.
 */
function resolveVoice(synth: SynthLike, waitMs: number): Promise<SpeechSynthesisVoice | null> {
  const now = synth.getVoices()
  if (now.length > 0) return Promise.resolve(pickVoice(now))
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      window.clearTimeout(timer)
      synth.removeEventListener?.('voiceschanged', onChange)
      resolve(pickVoice(synth.getVoices()))
    }
    const onChange = () => {
      if (synth.getVoices().length > 0) finish()
    }
    const timer = window.setTimeout(finish, waitMs)
    synth.addEventListener?.('voiceschanged', onChange)
  })
}

export function createVoice(synth: SynthLike | null, Utterance: (new (text: string) => SpeechSynthesisUtterance) | null, waitMs = VOICE_WAIT_MS): Voice {
  if (!synth || !Utterance) return { available: false, say: () => undefined, hush: () => undefined, current: () => null }
  // undefined while the list is still loading; then the chosen voice, or null for the browser default.
  const initial = synth.getVoices()
  let chosen: SpeechSynthesisVoice | null | undefined = initial.length > 0 ? pickVoice(initial) : undefined
  const ready =
    chosen !== undefined
      ? Promise.resolve(chosen)
      : resolveVoice(synth, waitMs).then((v) => {
          chosen = v
          return v
        })
  let current: SpeechSynthesisUtterance | null = null
  // Every say or hush bumps this, so a line held while the voice loads is dropped if anything newer came.
  let generation = 0
  const hush = () => {
    generation++
    current = null
    synth.cancel()
  }
  const speakNow = (text: string, voice: SpeechSynthesisVoice | null) => {
    const u = new Utterance(text)
    if (voice) u.voice = voice
    u.lang = voice?.lang ?? 'en-US'
    // A little higher than normal for a small robot, at a normal, clear speed.
    u.pitch = 1.3
    u.rate = 1
    u.onend = () => {
      if (current === u) current = null
    }
    current = u
    synth.speak(u)
  }
  return {
    available: true,
    say(text) {
      hush()
      const mine = generation
      if (chosen !== undefined) speakNow(text, chosen)
      // Still loading: hold this line (the bubble text is already on screen) and speak it with the right
      // voice, unless a newer line, mute, Skip or the switch came first.
      else void ready.then((v) => mine === generation && speakNow(text, v))
    },
    hush,
    current: () => current,
  }
}

let shared: Voice | null = null
/** The page's voice, created on first use (never at import, and never before the visitor turns the tour on). */
export function getVoice(): Voice {
  if (shared) return shared
  const w = typeof window === 'undefined' ? null : window
  const synth = w && 'speechSynthesis' in w ? w.speechSynthesis : null
  const Utterance = w && typeof w.SpeechSynthesisUtterance === 'function' ? w.SpeechSynthesisUtterance : null
  shared = createVoice(synth, Utterance)
  return shared
}

/** The voice if it was ever created, else null: stopping never needs to create it. */
export function existingVoice(): Voice | null {
  return shared
}

export function speechAvailable(): boolean {
  if (typeof window === 'undefined') return false
  return 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function'
}

/** Tests only: forget the shared voice so a new environment is picked up. */
export function resetVoiceForTests(): void {
  shared = null
}
