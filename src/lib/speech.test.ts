import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeNumberWords } from '../../shared/numberWords'
import {
  bestTranscript,
  createRecognizer,
  END_SILENCE_MS,
  joinSegments,
  mergeSegments,
  isSpeechSupported,
  LONG_SILENCE_MS,
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
  /** Chrome's list of results so far (continuous mode keeps them; an interim is replaced by the next). */
  results: Array<{ isFinal: boolean } & Array<{ transcript: string; confidence: number }>> = []
  /** One result: interim (one alternative) or final (several). */
  say(alternatives: string[], isFinal: boolean, confidence = 0.9): void {
    const result = Object.assign(
      alternatives.map((transcript, i) => ({ transcript, confidence: i === 0 ? confidence : 0.5 })),
      { isFinal },
    )
    if (this.results.at(-1)?.isFinal === false) this.results.pop()
    const resultIndex = this.results.length
    this.results.push(result)
    const event: SpeechRecognitionEventLike = { resultIndex, results: Object.assign([...this.results], {}) }
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

  it('uses the prefixed or standard class, listening continuously with 3 alternatives', () => {
    install()
    expect(isSpeechSupported()).toBe(true)
    const rec = createRecognizer({ lang: 'hi-IN', ...handlers() })
    rec?.start()
    expect(latest()).toMatchObject({ lang: 'hi-IN', continuous: true, interimResults: true, maxAlternatives: 3, started: 1 })
    vi.unstubAllGlobals()
    vi.stubGlobal('SpeechRecognition', FakeRecognition)
    expect(isSpeechSupported()).toBe(true)
  })
})

describe('createRecognizer — events', () => {
  it('passes interim text, then the whole utterance with its alternatives once it ends', () => {
    install()
    const h = handlers()
    const rec = createRecognizer({ lang: 'hi-IN', ...h })
    rec?.start()
    expect(latest()).toMatchObject({ continuous: true, interimResults: true, maxAlternatives: 3 })
    latest().say(['dhai hazaar ka'], false)
    expect(h.onInterim.mock.lastCall?.[0]).toBe('dhai hazaar ka')
    latest().say(['dhai hazaar ka dinner', 'dhai hazaar ka dinner riya', 'dhai hazaar ka dinner'], true, 0.82)
    expect(h.onFinal).not.toHaveBeenCalled()
    rec?.stop()
    expect(h.onFinal).toHaveBeenCalledWith({
      transcript: 'dhai hazaar ka dinner',
      alternatives: ['dhai hazaar ka dinner', 'dhai hazaar ka dinner riya'],
      confidence: 0.82,
    })
    expect(h.onEnd).toHaveBeenCalledTimes(1)
  })

  it('keeps listening through a pause, and joins the stretches', () => {
    vi.useFakeTimers()
    install()
    const h = handlers()
    createRecognizer({ lang: 'en-IN', ...h })?.start()
    latest().say(['rent 32000', 'went 32000'], true)
    vi.advanceTimersByTime(END_SILENCE_MS - 100)
    expect(latest().stopped).toBe(0)
    latest().say(['me Aditya'], false)
    expect(h.onInterim.mock.lastCall?.[0]).toBe('rent 32000 me Aditya')
    expect(h.onInterim.mock.lastCall?.[1]).toMatchObject({ pending: 'me Aditya' })
    latest().say(['me Aditya and Neha'], true)
    vi.advanceTimersByTime(END_SILENCE_MS)
    expect(latest().stopped).toBe(1)
    expect(h.onFinal).toHaveBeenCalledWith({
      transcript: 'rent 32000 me Aditya and Neha',
      alternatives: ['rent 32000 me Aditya and Neha', 'went 32000 me Aditya and Neha'],
      confidence: 0.9,
    })
  })

  it('ends on its own after a pause once something is heard (not before)', () => {
    vi.useFakeTimers()
    install()
    const h = handlers()
    createRecognizer({ lang: 'en-IN', ...h })?.start()
    vi.advanceTimersByTime(END_SILENCE_MS * 3)
    expect(latest().stopped).toBe(0)
    latest().say(['lunch 450 with Sneha'], true)
    vi.advanceTimersByTime(END_SILENCE_MS)
    expect(latest().stopped).toBe(1)
    expect(h.onFinal).toHaveBeenCalledTimes(1)
  })

  it("keeps what was on screen when Stop comes before the browser's final", () => {
    install()
    const h = handlers()
    const rec = createRecognizer({ lang: 'en-IN', ...h })
    rec?.start()
    latest().say(['cab 840 with Riya'], false)
    rec?.stop()
    expect(h.onFinal).toHaveBeenCalledWith({ transcript: 'cab 840 with Riya', alternatives: ['cab 840 with Riya'], confidence: null })
    expect(h.onError).not.toHaveBeenCalled()
  })

  it('keeps the words still on screen when Stop comes after some were settled', () => {
    install()
    const h = handlers()
    const rec = createRecognizer({ lang: 'en-IN', ...h })
    rec?.start()
    latest().say(['villa 24000 Rahul paid'], true)
    latest().say(['cab 3200 Sid'], false)
    rec?.stop()
    expect(h.onFinal.mock.calls[0]?.[0].transcript).toBe('villa 24000 Rahul paid cab 3200 Sid')
  })

  it("doesn't repeat Android's cumulative finals", () => {
    install()
    const h = handlers()
    const rec = createRecognizer({ lang: 'en-IN', ...h })
    rec?.start()
    latest().say(['dinner'], true)
    latest().say(['dinner 2400'], true)
    latest().say(['dinner 2400 with Riya'], true)
    latest().say(['with Riya'], true)
    rec?.stop()
    expect(h.onFinal.mock.calls[0]?.[0].transcript).toBe('dinner 2400 with Riya')
  })

  it('reports an error only when nothing was heard', () => {
    install()
    const h = handlers()
    createRecognizer({ lang: 'en-IN', ...h })?.start()
    latest().say(['petrol 3000 with Vikram'], true)
    latest().fail('network')
    expect(h.onError).not.toHaveBeenCalled()
    expect(h.onFinal.mock.calls[0]?.[0].transcript).toBe('petrol 3000 with Vikram')
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

  it('stops after 90 seconds at most', () => {
    vi.useFakeTimers()
    install()
    const h = handlers()
    createRecognizer({ lang: 'en-IN', ...h })?.start()
    expect(MAX_LISTEN_MS).toBe(90_000)
    vi.advanceTimersByTime(89_999)
    expect(latest().stopped).toBe(0)
    vi.advanceTimersByTime(1)
    expect(latest().stopped).toBe(1)
    expect(h.onEnd).toHaveBeenCalledTimes(1)
  })

  it('carries on when the browser ends a session mid-split, keeping what was heard', () => {
    vi.useFakeTimers()
    install()
    const h = handlers()
    createRecognizer({ lang: 'en-IN', ...h })?.start()
    const fake = latest()
    fake.say(['villa 24000 Riya paid'], true)
    fake.results = []
    fake.onend?.() // Android ends the session on its own, mid-sentence
    expect(fake.started).toBe(2)
    expect(h.onEnd).not.toHaveBeenCalled()
    fake.say(['cab 3200 Sam paid'], true)
    expect(h.onInterim.mock.lastCall?.[0]).toBe('villa 24000 Riya paid cab 3200 Sam paid')
    vi.advanceTimersByTime(LONG_SILENCE_MS)
    expect(h.onFinal.mock.calls[0]?.[0].transcript).toBe('villa 24000 Riya paid cab 3200 Sam paid')
    expect(h.onEnd).toHaveBeenCalledTimes(1)
  })

  it('hands over what it has when the browser ends a session with an error', () => {
    install()
    const h = handlers()
    createRecognizer({ lang: 'en-IN', ...h })?.start()
    latest().say(['tea 40'], true)
    latest().fail('network')
    expect(latest().started).toBe(1)
    expect(h.onFinal).toHaveBeenCalledTimes(1)
  })

  it('waits longer for the pause once a long split is under way', () => {
    vi.useFakeTimers()
    install()
    const h = handlers()
    createRecognizer({ lang: 'en-IN', ...h })?.start()
    latest().say(['Goa trip villa 24000 Riya paid cab 3200'], true)
    vi.advanceTimersByTime(END_SILENCE_MS + 100)
    expect(latest().stopped).toBe(0)
    vi.advanceTimersByTime(LONG_SILENCE_MS - END_SILENCE_MS)
    expect(latest().stopped).toBe(1)
  })

  it('lets the caller decide the pause from what has been heard', () => {
    vi.useFakeTimers()
    install()
    const h = handlers()
    const silenceFor = (heard: string) => (/ and$/.test(heard) ? 3_500 : 2_000)
    createRecognizer({ lang: 'en-IN', ...h, silenceFor })?.start()
    latest().say(['dinner 4850 with Neha and'], true)
    vi.advanceTimersByTime(3_000)
    expect(latest().stopped).toBe(0)
    latest().say(['Arjun'], true)
    vi.advanceTimersByTime(1_999)
    expect(latest().stopped).toBe(0)
    vi.advanceTimersByTime(1)
    expect(latest().stopped).toBe(1)
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

describe('mergeSegments / joinSegments', () => {
  it("joins stretches, with each one's other guesses as alternatives", () => {
    const joined = joinSegments(
      mergeSegments([
        { alternatives: ['pizza for 800 and 99', 'pizza for 899'], confidence: 0.7 },
        { alternatives: ['split with Rahul', 'split with Rahel'], confidence: 0.9 },
      ]),
    )
    expect(joined).toEqual({
      transcript: 'pizza for 800 and 99 split with Rahul',
      alternatives: ['pizza for 800 and 99 split with Rahul', 'pizza for 899 split with Rahul', 'pizza for 800 and 99 split with Rahel'],
      confidence: 0.7,
    })
  })

  it('is null with nothing heard', () => {
    expect(joinSegments(mergeSegments([{ alternatives: ['  '], confidence: null }]))).toBeNull()
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

  it('takes a guess that carries on from it, when the top one dropped the last words', () => {
    const result = { transcript: 'biryani 1450', alternatives: ['biryani 1450', 'biryani 1450 and Sana Sana paid', 'Biryani 1450 present in Sana'], confidence: null }
    expect(bestTranscript(result)).toBe('biryani 1450 and Sana Sana paid')
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
    act(() => result.current.stop())
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
