import { useId, useLayoutEffect, useRef } from 'react'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { graphemes } from '../../lib/people'
import styles from './NoteField.module.css'

export interface NoteFieldProps {
  value: string
  onChange: (value: string) => void
  /** Most characters (as people count them — an emoji is one). */
  maxLength: number
  label?: string
  placeholder?: string
  className?: string
}

/** How close to the limit before the "N left" counter appears. */
const COUNTER_FROM = 60

/**
 * An optional note that grows with what's typed (line breaks kept), styled like the other
 * fields. A quiet "N left" appears only near the limit.
 */
export function NoteField({ value, onChange, maxLength, label, placeholder, className }: NoteFieldProps) {
  const t = useT()
  const id = useId()
  const ref = useRef<HTMLTextAreaElement>(null)
  const left = maxLength - graphemes(value).length

  // Grow to fit the text (browsers without `field-sizing: content`).
  useLayoutEffect(() => {
    const area = ref.current
    if (!area || (typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content'))) return
    area.style.height = 'auto'
    area.style.height = `${area.scrollHeight}px`
  }, [value])

  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={id} className={styles.label}>
        {label ?? t('split.note.label')}
      </label>
      <textarea
        ref={ref}
        id={id}
        className={styles.area}
        value={value}
        rows={2}
        placeholder={placeholder ?? t('split.note.placeholder')}
        autoCapitalize="sentences"
        aria-describedby={left <= COUNTER_FROM ? `${id}-left` : undefined}
        onChange={(event) => {
          const next = event.target.value
          // Paste past the limit keeps what fits.
          onChange(graphemes(next).length > maxLength ? graphemes(next).slice(0, maxLength).join('') : next)
        }}
      />
      {left <= COUNTER_FROM && (
        <p id={`${id}-left`} className={cx(styles.counter, left <= 0 && styles.full)} aria-live="polite">
          {left <= 0 ? t('split.note.full') : t('split.note.left', { count: left })}
        </p>
      )}
    </div>
  )
}
