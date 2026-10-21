import { useId, useRef, type ComponentPropsWithRef, type ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import { cx } from '../lib/cx'
import { mergeRefs } from './helpers'
import styles from './TextField.module.css'

export interface TextFieldProps extends Omit<ComponentPropsWithRef<'input'>, 'size'> {
  /** Visible label (required for accessibility; use `hideLabel` only when the context names it). */
  label: ReactNode
  /** Visually hide the label (still read by screen readers). */
  hideLabel?: boolean
  /** Helper text under the field. Hidden while an `error` shows. */
  hint?: ReactNode
  /** Error message: red ring, `aria-invalid`, announced politely. */
  error?: ReactNode
  /** Inline slot before the text (icon, symbol). */
  startAdornment?: ReactNode
  /** Inline slot after the text (e.g. an `IconButton`). */
  endAdornment?: ReactNode
  /** Class for the outer wrapper (label + field + messages). */
  containerClassName?: string
}

/** Labelled single-line text input: 52px, soft fill, ink focus ring, hint/error wiring. */
export function TextField({
  label,
  hideLabel = false,
  hint,
  error,
  startAdornment,
  endAdornment,
  containerClassName,
  className,
  id,
  ref,
  type = 'text',
  disabled,
  'aria-describedby': describedBy,
  ...rest
}: TextFieldProps) {
  const autoId = useId()
  const inputId = id ?? `field-${autoId}`
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const inputRef = useRef<HTMLInputElement>(null)
  const hasError = error != null && error !== false && error !== ''
  const showHint = hint != null && !hasError
  const describedByIds = cx(describedBy, showHint && hintId, hasError && errorId) || undefined

  return (
    <div className={cx(styles.field, disabled && styles.disabled, containerClassName)}>
      <label htmlFor={inputId} className={cx(styles.label, hideLabel && 'visually-hidden')}>
        {label}
      </label>
      <div
        className={cx(styles.control, hasError && styles.invalid)}
        onPointerDown={(event) => {
          // Taps on the padding focus the input (but leave adornment buttons alone).
          if (event.target === event.currentTarget) {
            event.preventDefault()
            inputRef.current?.focus()
          }
        }}
      >
        {startAdornment != null && <span className={styles.start}>{startAdornment}</span>}
        <input
          {...rest}
          ref={mergeRefs(inputRef, ref)}
          id={inputId}
          type={type}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={describedByIds}
          className={cx(styles.input, className)}
        />
        {endAdornment != null && <span className={styles.end}>{endAdornment}</span>}
      </div>
      <div className={styles.messages} aria-live="polite">
        {hasError ? (
          <p id={errorId} className={styles.error}>
            <CircleAlert aria-hidden="true" className={styles.errorIcon} />
            <span>{error}</span>
          </p>
        ) : (
          showHint && (
            <p id={hintId} className={styles.hint}>
              {hint}
            </p>
          )
        )}
      </div>
    </div>
  )
}
