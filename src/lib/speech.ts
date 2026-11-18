/**
 * Speech to text for "Speak to split" — a thin, typed layer over the browser's Web Speech API
 * (`SpeechRecognition`, `webkitSpeechRecognition` in Chrome and Safari). The browser does the
 * recognising (Chrome online, through Google's speech service; Safari partly on the device);
 * Settle never records or keeps audio. One recognizer at a time; 15 s at most per go.
 *
 * Numbers in words ("dhai hazaar") are turned into digits by the caller with the shared grammar
 * (`normalizeNumberWords`, passed to `bestTranscript`) — this module stays small so Home's chunk
 * doesn't carry the grammar.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { VoiceLang } from '../../shared/api'

export type SpeechStatus = 'idle' | 'listening' | 'done' | 'error'
export type SpeechErrorCode = 'blocked' | 'no_speech' | 'no_mic' | 'network' | 'language' | 'other'

export interface SpeechResult {
  /** The recogniser's best guess. */
  transcript: string
  /** Every guess, best first (the best one included). */
  alternatives: string[]
  /** 0…1 for the best guess, when the browser says. */
  confidence: number | null
}

export interface Recognizer {
  start(): void
  stop(): void
  abort(): void
}

/* ---------- The parts of the Web Speech API we use (TypeScript's DOM lib lacks them) ---------- */

interface SpeechAlternativeLike {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechResultLike {
  readonly isFinal: boolean
  readonly length: number
  readonly [index: number]: SpeechAlternativeLike | undefined
}

interface SpeechResultListLike {
  readonly length: number
  readonly [index: number]: SpeechResultLike | undefined
}

export interface SpeechRecognitionEventLike {
  readonly resultIndex: number
  readonly results: SpeechResultListLike
}

export interface SpeechRecognitionErrorEventLike {
  readonly error: string
}

/** What `new SpeechRecognition()` gives us. */
export interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

interface SpeechWindow {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}

/** The browser's recogniser class, or null (Firefox, old browsers, tests without a fake). */
function recognitionClass(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as SpeechWindow
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** True when this browser can turn speech into text. */
export function isSpeechSupported(): boolean {
  return recognitionClass() !== null
}

/** The longest one go of listening (it usually ends sooner: on a pause, or Stop). */
export const MAX_LISTEN_MS = 15_000

/**
 * Once something has been heard, this long with nothing new ends it. The browser's own
 * end-of-speech cuts in at the first breath ("Rent 32000, … me, Aditya and Neha" came back as
 * "rent 32000"), so we listen continuously and decide ourselves.
 */
export const END_SILENCE_MS = 1_600

/** The browser's error names → ours (`aborted` is ours too: we stopped it, nothing to say). */
export function speechErrorCode(error: string): SpeechErrorCode | null {
  switch (error) {
    case 'aborted':
      return null
    case 'not-allowed':
    case 'service-not-allowed':
      return 'blocked'
    case 'no-speech':
      return 'no_speech'
    case 'audio-capture':
      return 'no_mic'
    case 'network':
      return 'network'
    case 'language-not-supported':
      return 'language'
    default:
      return 'other'
  }
}

/** The recogniser listening now (one at a time across the app). */
let active: SpeechRecognitionLike | null = null

export interface RecognizerOptions {
  lang: VoiceLang
  /** Everything heard so far, as it comes in. */
  onInterim(text: string): void
  /** The whole utterance, once, just before `onEnd` (not when nothing was heard). */
  onFinal(result: SpeechResult): void
  /** Only when nothing usable was heard. */
  onError(code: SpeechErrorCode): void
  onEnd(): void
  /** Hard cap on one go (default 15 s). */
  maxMs?: number
  /** Quiet after speech that ends it (default 1.6 s). */
  silenceMs?: number
}

/** One finished stretch of speech: its guesses, best first, and the top one's confidence. */
export interface SpeechSegment {
  alternatives: string[]
  confidence: number | null
}

/** For comparing segments: lower-case, single spaces. */
function squash(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * The final segments in order, without repeats. Android Chrome in continuous mode can re-send the
 * whole utterance as each new final ("dinner", "dinner 2400", "dinner 2400 with Riya"): a segment
 * that starts with everything so far replaces it; one that's already at the end is dropped.
 */
export function mergeSegments(segments: readonly SpeechSegment[]): SpeechSegment[] {
  const out: SpeechSegment[] = []
  for (const segment of segments) {
    const top = squash(segment.alternatives[0] ?? '')
    if (!top) continue
    const sofar = squash(out.map((s) => s.alternatives[0] ?? '').join(' '))
    if (sofar && top.startsWith(sofar)) {
      out.length = 0
      out.push(segment)
    } else if (sofar && (sofar === top || sofar.endsWith(` ${top}`))) {
      continue
    } else {
      out.push(segment)
    }
  }
  return out
}

/** The utterance from its segments: the tops joined, then each variant with one segment's other guesses. */
export function joinSegments(segments: readonly SpeechSegment[]): SpeechResult | null {
  if (segments.length === 0) return null
  const tops = segments.map((s) => s.alternatives[0] ?? '')
  const alternatives = [tops.join(' ')]
  segments.forEach((segment, i) => {
    for (const other of segment.alternatives.slice(1)) {
      const text = tops.map((top, k) => (k === i ? other : top)).join(' ')
      if (!alternatives.includes(text)) alternatives.push(text)
    }
  })
  const known = segments.map((s) => s.confidence).filter((c): c is number => c !== null)
  return { transcript: alternatives[0] ?? '', alternatives, confidence: known.length > 0 ? Math.min(...known) : null }
}

/**
 * A recogniser for one utterance in `lang`: continuous, interim results on, up to 3 alternatives
 * per stretch. It ends on a pause after speech, on Stop or at the cap, then hands over everything
 * heard (what was still on screen when Stop came, too). Null when the browser has none. Starting
 * it aborts any other one still listening.
 */
export function createRecognizer(opts: RecognizerOptions): Recognizer | null {
  const Recognition = recognitionClass()
  if (!Recognition) return null
  let rec: SpeechRecognitionLike
  try {
    rec = new Recognition()
  } catch {
    return null
  }
  rec.lang = opts.lang
  rec.continuous = true
  rec.interimResults = true
  rec.maxAlternatives = 3

  let cap: ReturnType<typeof setTimeout> | null = null
  let quiet: ReturnType<typeof setTimeout> | null = null
  let finished = false
  let segments: SpeechSegment[] = []
  /** What's heard but not final yet, with the finals before it. */
  let pending = ''
  let failure: SpeechErrorCode | null = null
  const clear = () => {
    if (cap !== null) clearTimeout(cap)
    if (quiet !== null) clearTimeout(quiet)
    cap = null
    quiet = null
  }
  const finish = (deliver = true) => {
    if (finished) return
    finished = true
    clear()
    if (active === rec) active = null
    const heard = joinSegments(segments) ?? (pending ? { transcript: pending, alternatives: [pending], confidence: null } : null)
    if (deliver && heard) opts.onFinal(heard)
    else if (deliver && failure) opts.onError(failure)
    opts.onEnd()
  }
  const halt = () => {
    try {
      rec.stop()
    } catch {
      finish()
    }
  }

  rec.onresult = (event) => {
    if (finished) return
    // The whole list every time: in continuous mode Android's resultIndex can't be trusted.
    const finals: SpeechSegment[] = []
    let interim = ''
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i]
      if (!result) continue
      if (result.isFinal) {
        const alternatives: string[] = []
        for (let k = 0; k < result.length; k++) {
          const text = result[k]?.transcript.replace(/\s+/g, ' ').trim()
          if (text && !alternatives.includes(text)) alternatives.push(text)
        }
        if (alternatives.length === 0) continue
        const top = result[0]
        const confidence = top && Number.isFinite(top.confidence) && top.confidence > 0 ? top.confidence : null
        finals.push({ alternatives, confidence })
      } else {
        interim += result[0]?.transcript ?? ''
      }
    }
    segments = mergeSegments(finals)
    const sofar = segments.map((s) => s.alternatives[0] ?? '').join(' ')
    const next = interim.replace(/\s+/g, ' ').trim()
    if (!next || squash(sofar).endsWith(squash(next))) pending = ''
    else pending = sofar && !squash(next).startsWith(squash(sofar)) ? `${sofar} ${next}` : next
    const shown = pending || sofar
    if (!shown) return
    opts.onInterim(shown)
    if (quiet !== null) clearTimeout(quiet)
    quiet = setTimeout(halt, opts.silenceMs ?? END_SILENCE_MS)
  }
  rec.onerror = (event) => {
    if (finished) return
    const code = speechErrorCode(event.error)
    if (code) failure = code
  }
  rec.onend = () => finish()

  return {
    start() {
      if (active && active !== rec) {
        try {
          active.abort()
        } catch {
          // Already stopped.
        }
      }
      active = rec
      try {
        rec.start()
      } catch {
        // Some browsers throw when started twice or without permission: report it plainly.
        failure = 'other'
        finish()
        return
      }
      clear()
      cap = setTimeout(halt, opts.maxMs ?? MAX_LISTEN_MS)
    },
    stop() {
      clear()
      halt()
    },
    abort() {
      clear()
      try {
        rec.abort()
      } catch {
        // Not started.
      }
      finish(false)
    },
  }
}

/** Any digit, in Latin or an Indian script. */
const DIGIT = /[0-9०-९০-৯੦-੯૦-૯୦-୯௦-௯౦-౯೦-೯൦-൯０-９]/

/**
 * Picks the transcript to use: the first alternative whose normalized text contains a digit
 * (an amount was heard), else the top one, or a longer guess that carries on from it (the top
 * one sometimes drops the last words). `normalize` turns number words into digits.
 */
export function bestTranscript(result: SpeechResult, normalize: (text: string) => string = (text) => text): string {
  const options = result.alternatives.length > 0 ? result.alternatives : [result.transcript]
  const chosen = options.find((option) => DIGIT.test(normalize(option))) ?? options[0] ?? result.transcript
  // The top guess sometimes drops the end of what was said ("biryani 1450" when another guess
  // has "biryani 1450 and Sana Sana paid"): a guess that carries on from it keeps those words.
  const start = chosen.toLowerCase()
  const longer = options.filter((option) => option.length > chosen.length && option.toLowerCase().startsWith(`${start} `))
  return longer.reduce((best, option) => (option.length > best.length ? option : best), chosen)
}

export interface SpeechState {
  status: SpeechStatus
  /** What's been heard so far (cleared when it's final). */
  interim: string
  result: SpeechResult | null
  error: SpeechErrorCode | null
  start(): void
  stop(): void
}

/** Speech recognition as React state; aborts on unmount or when `lang` changes. */
export function useSpeech(lang: VoiceLang): SpeechState {
  const [status, setStatus] = useState<SpeechStatus>('idle')
  const [interim, setInterim] = useState('')
  const [result, setResult] = useState<SpeechResult | null>(null)
  const [error, setError] = useState<SpeechErrorCode | null>(null)
  const recognizer = useRef<Recognizer | null>(null)
  const outcome = useRef<{ final: boolean; error: boolean }>({ final: false, error: false })

  useEffect(
    () => () => {
      recognizer.current?.abort()
      recognizer.current = null
    },
    [lang],
  )

  const start = useCallback(() => {
    recognizer.current?.abort()
    outcome.current = { final: false, error: false }
    setInterim('')
    setResult(null)
    setError(null)
    const rec = createRecognizer({
      lang,
      onInterim: (text) => setInterim(text),
      onFinal: (heard) => {
        outcome.current.final = true
        setInterim('')
        setResult(heard)
      },
      onError: (code) => {
        outcome.current.error = true
        setError(code)
      },
      onEnd: () => {
        if (recognizer.current === rec) recognizer.current = null
        const { final, error: failed } = outcome.current
        setStatus(failed ? 'error' : final ? 'done' : 'idle')
      },
    })
    if (!rec) {
      setError('other')
      setStatus('error')
      return
    }
    recognizer.current = rec
    setStatus('listening')
    rec.start()
  }, [lang])

  const stop = useCallback(() => {
    recognizer.current?.stop()
  }, [])

  return { status, interim, result, error, start, stop }
}

/** Forgets the recogniser listening now (tests). */
export function resetSpeechForTests(): void {
  active = null
}
