import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeNumberWords } from '../../shared/numberWords'
import {
  bestTranscript,
  createRecognizer,
  isSpeechSupported,
  MAX_LISTEN_MS,
  resetSpeechForTests,
  speechErrorCode,
  useSpeech,
  type SpeechRecognitionEventLike,
  type SpeechRecognitionLike,
} from './speech'

/** A stand-in for Chrome's `webkitSpeechRecognition`: tests drive its events. */
class FakeRecognition implements SpeechRecognitionLike {
  static instances: FakeRecognition[] = []
  lang = ''
  continuous = true
  interimResults = false
  maxAlternatives = 1
  onresult: SpeechRecognitionLike['onresult'] = null
  onerror: SpeechRecognitionLike['onerror'] = null
  onend: SpeechRecognitionLike['onend'] = null
  started = 0
  stopped = 0
  aborted = 0
  constructor() {
    FakeRecognition.instances.push(this)
  }
  start(): void {
    this.started++
  }
  stop(): void {
    this.stopped++
    this.onend?.()
  }
  abort(): void {
    this.aborted++
    this.onerror?.({ error: 'aborted' })
    this.onend?.()
  }
  /** One result: interim (one alternative) or final (several). */
  say(alternatives: string[], isFinal: boolean, confidence = 0.9): void {
    const result = Object.assign(
      alternatives.map((transcript, i) => ({ transcript, confidence: i === 0 ? confidence : 0.5 })),
      { isFinal },
    )
    const event: SpeechRecognitionEventLike = { resultIndex: 0, results: Object.assign([result], {}) }
    this.onresult?.(event)
  }
  fail(error: string): void {
    this.onerror?.({ error })
    this.onend?.()
  }
}

const latest = () => FakeRecognition.instances.at(-1) as FakeRecognition

function install(): void {
  vi.stubGlobal('webkitSpeechRecognition', FakeRecognition)
}

function handlers() {
  return { onInterim: vi.fn(), onFinal: vi.fn(), onError: vi.fn(), onEnd: vi.fn() }
}

beforeEach(() => {
  FakeRecognition.instances = []
  resetSpeechForTests()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('isSpeechSupported / createRecognizer', () => {
  it('is false (and gives no recognizer) where the browser has none', () => {
    expect(isSpeechSupported()).toBe(false)
    expect(createRecognizer({ lang: 'hi-IN', ...handlers() })).toBeNull()
  })

  it('uses the prefixed or standard class, set up for one utterance with 3 alternatives', () => {
    install()
    expect(isSpeechSupported()).toBe(true)
    const rec = createRecognizer({ lang: 'hi-IN', ...handlers() })
    rec?.start()
    expect(latest()).toMatchObject({ lang: 'hi-IN', continuous: false, interimResults: true, maxAlternatives: 3, started: 1 })
    vi.unstubAllGlobals()
    vi.stubGlobal('SpeechRecognition', FakeRecognition)
    expect(isSpeechSupported()).toBe(true)
  })
})

describe('createRecognizer — events', () => {
  it('passes interim text, then the final result with its alternatives, then the end', () => {
    install()
    const h = handlers()
    createRecognizer({ lang: 'hi-IN', ...h })?.start()
    latest().say(['dhai hazaar ka'], false)
    expect(h.onInterim).toHaveBeenLastCalledWith('dhai hazaar ka')
    latest().say(['dhai hazaar ka dinner', 'dhai hazaar ka dinner riya', 'dhai hazaar ka dinner'], true, 0.82)
    expect(h.onFinal).toHaveBeenCalledWith({
      transcript: 'dhai hazaar ka dinner',
      alternatives: ['dhai hazaar ka dinner', 'dhai hazaar ka dinner riya'],
      confidence: 0.82,
    })
    latest().stop()
    expect(h.onEnd).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['not-allowed', 'blocked'],
    ['service-not-allowed', 'blocked'],
    ['no-speech', 'no_speech'],
    ['audio-capture', 'no_mic'],
    ['network', 'network'],
    ['language-not-supported', 'language'],
    ['bad-grammar', 'other'],
  ] as const)('maps the browser error "%s" to %s', (browser, ours) => {
    install()
    const h = handlers()
    createRecognizer({ lang: 'en-IN', ...h })?.start()
    latest().fail(browser)
    expect(h.onError).toHaveBeenCalledWith(ours)
    expect(h.onEnd).toHaveBeenCalledTimes(1)
  })

  it('says nothing for "aborted" (we stopped it)', () => {
    expect(speechErrorCode('aborted')).toBeNull()
    install()
    const h = handlers()
    const rec = createRecognizer({ lang: 'en-IN', ...h })
    rec?.start()
    rec?.abort()
    expect(h.onError).not.toHaveBeenCalled()
    expect(h.onEnd).toHaveBeenCalledTimes(1)
  })

  it('stops after 15 seconds at most', () => {
    vi.useFakeTimers()
    install()
    const h = handlers()
    createRecognizer({ lang: 'en-IN', ...h })?.start()
    expect(MAX_LISTEN_MS).toBe(15_000)
    vi.advanceTimersByTime(14_999)
    expect(latest().stopped).toBe(0)
    vi.advanceTimersByTime(1)
    expect(latest().stopped).toBe(1)
    expect(h.onEnd).toHaveBeenCalledTimes(1)
  })

  it('listens with one recognizer at a time', () => {
    install()
    createRecognizer({ lang: 'en-IN', ...handlers() })?.start()
    const first = latest()
    createRecognizer({ lang: 'hi-IN', ...handlers() })?.start()
    expect(first.aborted).toBe(1)
    expect(latest().started).toBe(1)
  })

  it('reports a start that throws as an error and ends', () => {
    class Broken extends FakeRecognition {
      override start(): void {
        throw new Error('InvalidStateError')
      }
    }
    vi.stubGlobal('webkitSpeechRecognition', Broken)
    const h = handlers()
    createRecognizer({ lang: 'en-IN', ...h })?.start()
    expect(h.onError).toHaveBeenCalledWith('other')
    expect(h.onEnd).toHaveBeenCalledTimes(1)
  })
})

describe('bestTranscript', () => {
  it('takes the first alternative with an amount once number words are digits', () => {
    const result = {
      transcript: 'the hazaar ka dinner',
      alternatives: ['the hazaar ka dinner', 'dhai hazaar ka dinner', 'do hazaar ka dinner'],
      confidence: 0.6,
    }
    expect(bestTranscript(result, normalizeNumberWords)).toBe('dhai hazaar ka dinner')
  })

  it('falls back to the top one when none has an amount', () => {
    expect(bestTranscript({ transcript: 'dinner with Riya', alternatives: ['dinner with Riya', 'dinner with Rhea'], confidence: null })).toBe(
      'dinner with Riya',
    )
  })

  it('counts Indian digits too', () => {
    expect(bestTranscript({ transcript: 'डिनर', alternatives: ['डिनर', '२५०० का डिनर'], confidence: null })).toBe('२५०० का डिनर')
  })
})

describe('useSpeech', () => {
  it('goes listening → interim → done with the result', () => {
    install()
    const { result } = renderHook(() => useSpeech('hi-IN'))
    expect(result.current.status).toBe('idle')
    act(() => result.current.start())
    expect(result.current.status).toBe('listening')
    act(() => latest().say(['dhai hazaar'], false))
    expect(result.current.interim).toBe('dhai hazaar')
    act(() => latest().say(['dhai hazaar ka dinner'], true))
    act(() => latest().stop())
    expect(result.current).toMatchObject({ status: 'done', interim: '', error: null })
    expect(result.current.result?.transcript).toBe('dhai hazaar ka dinner')
  })

  it('ends in an error state with the code', () => {
    install()
    const { result } = renderHook(() => useSpeech('en-IN'))
    act(() => result.current.start())
    act(() => latest().fail('not-allowed'))
    expect(result.current).toMatchObject({ status: 'error', error: 'blocked' })
  })

  it('aborts when unmounted', () => {
    install()
    const { result, unmount } = renderHook(() => useSpeech('en-IN'))
    act(() => result.current.start())
    unmount()
    expect(latest().aborted).toBe(1)
  })

  it('is an error at once without speech recognition', () => {
    const { result } = renderHook(() => useSpeech('en-IN'))
    act(() => result.current.start())
    expect(result.current).toMatchObject({ status: 'error', error: 'other' })
  })
})
