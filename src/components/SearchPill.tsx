import { useEffect, useId, useState, type ReactNode, type Ref } from 'react'
import { ArrowUp, Sparkles } from 'lucide-react'
import { cx } from '../lib/cx'
import { Spinner } from './Spinner'
import styles from './SearchPill.module.css'

export interface SearchPillProps {
  /** Short prompt shown when there are no examples, and the default accessible name ("Just say it…"). */
  placeholder: string
  value?: string
  onChange?: (value: string) => void
  /** Enter / the arrow button. Only offered once something is typed. */
  onSubmit?: (value: string) => void
  /** Visual before the text. Default: the AI sparkle on the brand gradient. */
  leading?: ReactNode
  /** Visual or control after the text (e.g. a mic button); the submit arrow replaces it while typing. */
  trailing?: ReactNode
  /** Example requests that take turns in the empty field ("Dinner 2400 with Riya and Sam"). */
  examples?: readonly string[]
  /** Working on it: spinner in the arrow, field marked busy, submitting paused. */
  busy?: boolean
  /** Render as one big button (opens a sheet) instead of a text field. */
  asButton?: boolean
  onClick?: () => void
  /** Accessible name override (defaults to `placeholder`). */
  label?: string
  /** Accessible name of the submit arrow. Default "Go". */
  submitLabel?: string
  autoFocus?: boolean
  maxLength?: number
  disabled?: boolean
  inputRef?: Ref<HTMLInputElement>
  id?: string
  className?: string
}

/** How long each example stays (ms), and how many full rounds before settling on the first. */
const EXAMPLE_MS = 3200
const ROUNDS = 2

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * The big "Just say it" input: a pill with the AI sparkle, example requests that take turns while
 * it's empty (pausing on hover/focus, two rounds at most, none with reduced motion) and a submit
 * arrow that appears once there's text. `asButton` turns the whole pill into a button that opens
 * something (e.g. a sheet with the real input).
 */
export function SearchPill({
  placeholder,
  value = '',
  onChange,
  onSubmit,
  leading,
  trailing,
  examples = [],
  busy = false,
  asButton = false,
  onClick,
  label,
  submitLabel = 'Go',
  autoFocus,
  maxLength = 500,
  disabled = false,
  inputRef,
  id,
  className,
}: SearchPillProps) {
  const autoId = useId()
  const fieldId = id ?? `say-${autoId}`
  const hintId = `${fieldId}-hint`
  const [turn, setTurn] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = examples.length
  const empty = value === ''
  const cycling = count > 1 && empty && !paused && !disabled && turn < count * ROUNDS

  useEffect(() => {
    if (!cycling || prefersReducedMotion()) return
    const timer = setTimeout(() => {
      if (document.visibilityState !== 'hidden') setTurn((t) => t + 1)
    }, EXAMPLE_MS)
    return () => clearTimeout(timer)
  }, [cycling, turn])

  // After the last round this lands back on the first example and stays.
  const index = count === 0 ? -1 : turn % count
  const example = index >= 0 ? examples[index] : undefined
  const name = label ?? placeholder
  const canSubmit = onSubmit !== undefined && value.trim() !== '' && !disabled

  const ghost = empty && (
    <span className={styles.ghost} aria-hidden="true" data-ghost="">
      {example !== undefined ? (
        <span key={turn} className={cx(styles.example, turn > 0 && styles.rolling)}>
          {example}
        </span>
      ) : (
        <span className={styles.example}>{placeholder}</span>
      )}
    </span>
  )
  const hint = examples[0] !== undefined && (
    <span id={hintId} className="visually-hidden">
      For example: {examples[0]}
    </span>
  )
  const lead = (
    <span className={styles.leading} aria-hidden="true">
      {leading ?? (
        <span className={styles.spark}>
          <Sparkles strokeWidth={2.25} />
        </span>
      )}
    </span>
  )
  const pause = {
    onPointerEnter: () => setPaused(true),
    onPointerLeave: () => setPaused(false),
  }

  if (asButton) {
    return (
      <button
        id={id}
        type="button"
        className={cx(styles.pill, styles.button, className)}
        aria-label={name}
        aria-describedby={hint ? hintId : undefined}
        disabled={disabled}
        onClick={onClick}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        {...pause}
      >
        {lead}
        <span className={styles.field}>{ghost}</span>
        {trailing != null && (
          <span className={styles.trailing} aria-hidden="true">
            {trailing}
          </span>
        )}
        {hint}
      </button>
    )
  }

  return (
    <form
      className={cx(styles.pill, busy && styles.busy, disabled && styles.disabled, className)}
      onSubmit={(event) => {
        event.preventDefault()
        if (canSubmit && !busy) onSubmit?.(value.trim())
      }}
      {...pause}
    >
      {lead}
      <span className={styles.field}>
        {ghost}
        <input
          ref={inputRef}
          id={fieldId}
          type="text"
          enterKeyHint="go"
          autoComplete="off"
          autoCorrect="on"
          spellCheck
          autoFocus={autoFocus}
          maxLength={maxLength}
          disabled={disabled}
          aria-label={name}
          aria-describedby={hint ? hintId : undefined}
          aria-busy={busy || undefined}
          readOnly={busy}
          value={value}
          className={styles.input}
          onChange={(event) => onChange?.(event.currentTarget.value)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        />
      </span>
      {canSubmit || busy ? (
        <button type="submit" className={styles.submit} aria-label={submitLabel} disabled={busy || !canSubmit} aria-busy={busy || undefined}>
          {busy ? <Spinner size="sm" /> : <ArrowUp aria-hidden="true" strokeWidth={2.5} />}
        </button>
      ) : (
        trailing != null && <span className={styles.trailing}>{trailing}</span>
      )}
      {hint}
    </form>
  )
}
