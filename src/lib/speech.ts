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

/** The longest one go of listening (the browser usually stops sooner, on silence). */
export const MAX_LISTEN_MS = 15_000

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
  onInterim(text: string): void
  onFinal(result: SpeechResult): void
  onError(code: SpeechErrorCode): void
  onEnd(): void
  /** Hard cap on one go (default 15 s). */
  maxMs?: number
}

/**
 * A recogniser for one utterance in `lang` (interim results on, up to 3 alternatives). Null when
 * the browser has none. Starting it aborts any other one still listening.
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
  rec.continuous = false
  rec.interimResults = true
  rec.maxAlternatives = 3

  let timer: ReturnType<typeof setTimeout> | null = null
  let finished = false
  let gotFinal = false
  const clear = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  const finish = () => {
    if (finished) return
    finished = true
    clear()
    if (active === rec) active = null
    opts.onEnd()
  }

  rec.onresult = (event) => {
    if (finished) return
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      if (!result) continue
      if (result.isFinal) {
        const alternatives: string[] = []
        for (let k = 0; k < result.length; k++) {
          const text = result[k]?.transcript.trim()
          if (text && !alternatives.includes(text)) alternatives.push(text)
        }
        const top = result[0]
        if (alternatives.length === 0) continue
        gotFinal = true
        const confidence = top && Number.isFinite(top.confidence) && top.confidence > 0 ? top.confidence : null
        opts.onFinal({ transcript: alternatives[0] ?? '', alternatives, confidence })
      } else {
        interim += result[0]?.transcript ?? ''
      }
    }
    if (!gotFinal && interim.trim()) opts.onInterim(interim.trim())
  }
  rec.onerror = (event) => {
    if (finished) return
    const code = speechErrorCode(event.error)
    if (code) opts.onError(code)
  }
  rec.onend = finish

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
        opts.onError('other')
        finish()
        return
      }
      clear()
      timer = setTimeout(() => {
        try {
          rec.stop()
        } catch {
          finish()
        }
      }, opts.maxMs ?? MAX_LISTEN_MS)
    },
    stop() {
      clear()
      try {
        rec.stop()
      } catch {
        finish()
      }
    },
    abort() {
      clear()
      try {
        rec.abort()
      } catch {
        // Not started.
      }
      finish()
    },
  }
}

/** Any digit, in Latin or an Indian script. */
const DIGIT = /[0-9०-९০-৯੦-੯૦-૯୦-୯௦-௯౦-౯೦-೯൦-൯０-９]/

/**
 * Picks the transcript to use: the first alternative whose normalized text contains a digit
 * (an amount was heard), else the top one. `normalize` turns number words into digits.
 */
export function bestTranscript(result: SpeechResult, normalize: (text: string) => string = (text) => text): string {
  const options = result.alternatives.length > 0 ? result.alternatives : [result.transcript]
  for (const option of options) if (DIGIT.test(normalize(option))) return option
  return options[0] ?? result.transcript
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
