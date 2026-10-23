import { useEffect, useRef } from 'react'
import { ChevronDown, Mic, Square } from 'lucide-react'
import { findNumberPhrases, normalizeNumberWords } from '../../../shared/numberWords'
import { Button } from '../../components'
import { useT } from '../../i18n'
import { bestTranscript, useSpeech, type SpeechErrorCode } from '../../lib/speech'
import type { HeardNumber } from './describeView'
import { voiceLanguage, type VoiceLang } from './voiceLanguages'
import styles from './VoiceInput.module.css'

export interface VoiceHeard {
  /** What was said, number words turned into digits ("2500 ka dinner …"). */
  text: string
  /** Each number phrase that was rewritten, as spoken. */
  heard: HeardNumber[]
}

export interface VoiceInputProps {
  lang: VoiceLang
  /** Opens the "Speak in" sheet. */
  onLanguage: () => void
  onResult: (heard: VoiceHeard) => void
  onError: (code: SpeechErrorCode) => void
  /** Listening ended with nothing heard (stopped, or cancelled): back to typing. */
  onDone: () => void
}

/**
 * The listening panel inside "Just say it" (loaded on the first tap of a mic): "Listening…" with
 * the language, what's been heard so far, Stop (Escape too) and an example in that language.
 * Listening starts as it appears and ends on silence, Stop, 15 s, or when it goes away.
 */
export default function VoiceInput({ lang, onLanguage, onResult, onError, onDone }: VoiceInputProps) {
  const t = useT()
  const speech = useSpeech(lang)
  const { start, stop, status, result, error } = speech
  const language = voiceLanguage(lang)
  const latest = useRef({ onResult, onError, onDone })
  useEffect(() => {
    latest.current = { onResult, onError, onDone }
  })

  // Listen as soon as the panel is up (and again in a newly picked language).
  useEffect(() => {
    start()
  }, [start])

  // The outcome goes to the sheet once the recogniser has finished.
  const wasListening = useRef(false)
  useEffect(() => {
    if (status === 'listening') {
      wasListening.current = true
      return
    }
    if (!wasListening.current) return
    wasListening.current = false
    if (status === 'done' && result) {
      const best = bestTranscript(result, normalizeNumberWords)
      const heard = findNumberPhrases(best).map((span) => ({ text: span.text, value: span.value }))
      latest.current.onResult({ text: normalizeNumberWords(best), heard })
    } else if (status === 'error' && error) {
      latest.current.onError(error)
    } else {
      latest.current.onDone()
    }
  }, [status, result, error])

  // Escape stops listening (and doesn't close the sheet).
  useEffect(() => {
    if (status !== 'listening') return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.isComposing) return
      event.preventDefault()
      event.stopPropagation()
      stop()
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [status, stop])

  const listening = status === 'listening'

  return (
    <section className={styles.panel} aria-label={t('voice.listen.aria', { language: language.name })}>
      <p className="visually-hidden" role="status">
        {listening ? t('voice.listen.aria', { language: language.name }) : ''}
      </p>
      <div className={styles.head}>
        <p className={styles.title}>
          <span className={styles.dot} aria-hidden="true">
            <Mic strokeWidth={2.5} />
          </span>
          {t('voice.listen.title')}
        </p>
        <button
          type="button"
          className={styles.language}
          aria-haspopup="dialog"
          onClick={onLanguage}
        >
          <span lang={lang} aria-hidden="true">{language.native}</span>
          <span className="visually-hidden">{t('voice.listen.language.aria', { native: language.native, language: language.name })}</span>
          <ChevronDown aria-hidden="true" strokeWidth={2.5} />
        </button>
      </div>

      <p className={styles.interim} aria-hidden={speech.interim === ''}>
        {speech.interim ? `“${speech.interim}…”` : ' '}
      </p>

      <Button size="sm" variant="secondary" iconStart={<Square />} onClick={stop} disabled={!listening} className={styles.stop}>
        {t('voice.listen.stop.cta')}
      </Button>

      <p className={styles.tip}>
        {t('voice.listen.tip')}{' '}
        <span lang={lang} className={styles.example}>
          “{language.example}”
        </span>
        .
      </p>
    </section>
  )
}
