/**
 * The eight languages as big tiles — the language's own name large, its English name small — as a
 * native radio group (arrow keys and screen readers work as for any radio buttons). Used by
 * onboarding's first step and You → Language. Optionally "Automatic" first (null = follow the
 * phone). A language whose chunk is loading shows a spinner after a short pause.
 */
import { Check } from 'lucide-react'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { Spinner } from '../../components/Spinner'
import type { LanguageCode } from '../../domain/types'
import { LANGUAGES, languageInfo } from '../languages'
import { hasCatalog } from '../load'
import { useT } from '../react'
import styles from './LanguageGrid.module.css'

export interface LanguageGridProps {
  /** The chosen language; null = automatic. */
  value: LanguageCode | null
  onChange: (code: LanguageCode | null) => void
  /** Offer "Automatic" first, saying which language the phone gives. */
  automatic?: LanguageCode
  /** The choice whose chunk is still loading ('auto' for Automatic). */
  pending?: LanguageCode | 'auto' | null
  /** The group's accessible name. */
  label: string
  className?: string
}

/** True once `on` has stayed true for `ms` — a spinner that never flickers for fast loads. */
function useDelayed(on: boolean, ms = 150): boolean {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!on) return
    const timer = setTimeout(() => setShown(true), ms)
    return () => {
      clearTimeout(timer)
      setShown(false)
    }
  }, [on, ms])
  return on && shown
}

export function LanguageGrid({ value, onChange, automatic, pending = null, label, className }: LanguageGridProps) {
  const t = useT()
  const name = useId()
  const spin = useDelayed(pending !== null)

  const tile = (key: string, checked: boolean, disabled: boolean, onPick: () => void, title: ReactNode, caption: ReactNode, extra?: string, busy = false) => (
    <label key={key} className={[styles.tile, extra].filter(Boolean).join(' ')} data-checked={checked ? 'true' : undefined} data-disabled={disabled ? 'true' : undefined}>
      <input className={styles.input} type="radio" name={name} value={key} checked={checked} disabled={disabled} onChange={onPick} />
      {title}
      {caption}
      {busy && spin ? (
        <Spinner size="sm" className={styles.busy} />
      ) : checked ? (
        <span className={styles.mark} aria-hidden="true">
          <Check strokeWidth={3} />
        </span>
      ) : null}
    </label>
  )

  return (
    <div role="radiogroup" aria-label={label} className={[styles.grid, className].filter(Boolean).join(' ')} aria-busy={pending !== null || undefined}>
      {automatic !== undefined &&
        tile(
          'auto',
          value === null,
          false,
          () => onChange(null),
          <span className={styles.native}>{t('common.language.automatic')}</span>,
          <span className={styles.english}>{t('common.language.automatic.hint', { language: languageInfo(automatic).native })}</span>,
          styles.automatic,
          pending === 'auto',
        )}
      {LANGUAGES.map((l) => {
        const available = hasCatalog(l.code)
        return tile(
          l.code,
          value === l.code,
          !available,
          () => onChange(l.code),
          <span className={styles.native} lang={l.code}>
            {l.native}
          </span>,
          <span className={styles.english}>{available ? (l.code === 'en' ? '\u00a0' : l.english) : t('common.language.soon', { language: l.english })}</span>,
          undefined,
          pending === l.code,
        )
      })}
    </div>
  )
}
