import { useId, useLayoutEffect, useRef, type ComponentPropsWithRef, type CSSProperties, type ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import { cx } from '../lib/cx'
import { currencyDigits, currencySymbol, parseMoneyInput, toInputString } from '../lib/money'
import { applyAmountEdit, caretIndex, layoutAmount, type AmountLayout } from './amountFormat'
import { mergeRefs } from './helpers'
import styles from './AmountInput.module.css'

type NativeInputProps = Omit<
  ComponentPropsWithRef<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'size' | 'type' | 'inputMode' | 'children'
>

export interface AmountInputProps extends NativeInputProps {
  /** Raw text as typed (controlled). Parse it with `parseMoneyInput`. */
  value: string
  /** Receives the cleaned text (digits and `.`/`,` separators only). */
  onChange: (text: string) => void
  /** ISO 4217 code — shows its symbol before the digits. */
  currency: string
  /** Accessible label. Visible for `field`, visually hidden for `hero` unless `hideLabel={false}`. */
  label: ReactNode
  /** `hero`: huge centred payments-app amount that shrinks to fit. `field`: form-sized field. */
  size?: 'hero' | 'field'
  hideLabel?: boolean
  hint?: ReactNode
  error?: ReactNode
  /** Select everything on focus so typing replaces the prefilled value. Default true. */
  selectOnFocus?: boolean
  /**
   * Show the amount grouped as the person types ("2,299.50"), like payments apps. The value and
   * `onChange` stay raw ("2299.50"). Default true.
   */
  grouping?: boolean
  /** Class for the outer wrapper. */
  containerClassName?: string
}

const MAX_LENGTH = 18
/** Characters that survive: digits in any script plus the separators people type. */
const DISALLOWED = /[^\p{Nd}.,٫٬]/gu

/** Digits-and-separators only, capped in length. */
function clean(text: string): string {
  return text.replace(DISALLOWED, '').slice(0, MAX_LENGTH)
}

function asTyped(text: string): AmountLayout {
  return { text, added: new Array<boolean>(text.length).fill(false) }
}

function inputTypeOf(event: Event): string | undefined {
  return 'inputType' in event && typeof event.inputType === 'string' ? event.inputType : undefined
}

const PASTE_TYPES = new Set(['insertFromPaste', 'insertFromDrop', 'insertReplacementText'])

/**
 * A pasted (or dropped / autofilled) amount, read as a whole — "₹2,299", "Rs 1,500", "2,299/-",
 * "$1,500" — the way bank and UPI messages write it, so "2,299" isn't taken for 2.299. Typing
 * keeps its keystroke-by-keystroke rules. Null when the text isn't an amount.
 */
function pastedAmount(pasted: string, currency: string): string | null {
  // "Rs. 2,299/-" is the Indian way of writing "exactly"; that dash is never a minus.
  const text = pasted.replace(/\/-/g, '')
  const minor = parseMoneyInput(text, currency)
  if (minor === null) return null
  const digits = currencyDigits(currency)
  // Keep the decimals when they were pasted ("2,299.00" stays "2299.00"); otherwise whole ("2299").
  const hadDecimals = digits > 0 && new RegExp(`[.,]\\d{${digits}}\\D*$`).test(text)
  return toInputString(minor, currency, { trimZeros: !hadDecimals })
}

/** Font scale for the hero so long amounts shrink instead of overflowing (tabular digits = predictable widths). */
function fitScale(chars: number): number {
  const comfortable = 8
  if (chars <= comfortable) return 1
  return Math.max(0.42, comfortable / chars)
}

/**
 * Money entry: currency symbol + tabular digits (Geist), decimal keypad, select-on-focus. Pasted
 * amounts are read whole ("₹2,299" → 2299); typing is cleaned keystroke by keystroke.
 */
export function AmountInput({
  value,
  onChange,
  currency,
  label,
  size = 'hero',
  hideLabel = size === 'hero',
  hint,
  error,
  selectOnFocus = true,
  grouping = true,
  containerClassName,
  className,
  id,
  ref,
  placeholder,
  disabled,
  onFocus,
  'aria-describedby': describedBy,
  ...rest
}: AmountInputProps) {
  const autoId = useId()
  const inputId = id ?? `amount-${autoId}`
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const inputRef = useRef<HTMLInputElement>(null)
  /** Caret position to restore after an edit re-renders the grouped text (in amount characters). */
  const pendingCaret = useRef<number | null>(null)
  const layout = grouping ? layoutAmount(value) : asTyped(value)
  const symbol = currencySymbol(currency)
  const hasError = error != null && error !== false && error !== ''
  const showHint = hint != null && !hasError
  const describedByIds = cx(describedBy, showHint && hintId, hasError && errorId) || undefined
  // A placeholder amount ("2299") is shown grouped too; other placeholder text is left alone.
  const placeholderText = grouping && placeholder !== undefined ? layoutAmount(placeholder).text : placeholder
  const shown = layout.text || placeholderText || '0'

  // Regrouping moves characters around: put the caret back after the same digit.
  useLayoutEffect(() => {
    const count = pendingCaret.current
    const input = inputRef.current
    pendingCaret.current = null
    if (count === null || !input || document.activeElement !== input) return
    const at = caretIndex(layout, count)
    if (input.selectionStart !== at || input.selectionEnd !== at) input.setSelectionRange(at, at)
  })
  const hero = size === 'hero'
  const fitStyle = hero
    ? ({ '--amount-fit': String(fitScale(shown.length + Math.ceil(symbol.length / 2))) } as CSSProperties)
    : undefined

  return (
    <div className={cx(styles.root, hero ? styles.hero : styles.field, disabled && styles.disabled, containerClassName)}>
      <label htmlFor={inputId} className={cx(styles.label, hideLabel && 'visually-hidden')}>
        {label}
      </label>
      <div
        className={cx(styles.control, hasError && styles.invalid)}
        style={fitStyle}
        onPointerDown={(event) => {
          // The whole amount area is the target: tapping the symbol or margins focuses the input.
          if (event.target !== inputRef.current && !disabled) {
            event.preventDefault()
            inputRef.current?.focus()
          }
        }}
      >
        <span className={styles.symbol} aria-hidden="true">
          {symbol}
        </span>
        <span className={styles.sizer}>
          <span className={styles.mirror} aria-hidden="true">
            {shown}
          </span>
          <input
            {...rest}
            ref={mergeRefs(inputRef, ref)}
            id={inputId}
            type="text"
            // Tiny intrinsic width: the mirror text (not the browser's 20-char default) sizes the field.
            size={1}
            inputMode="decimal"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={disabled}
            placeholder={placeholderText}
            value={layout.text}
            aria-invalid={hasError || undefined}
            aria-describedby={describedByIds}
            className={cx(styles.input, className)}
            onChange={(event) => {
              const input = event.currentTarget
              const inputType = inputTypeOf(event.nativeEvent)
              const edit = grouping ? applyAmountEdit(value, input.value, input.selectionEnd, inputType) : null
              const raw = edit ? edit.raw : input.value
              const pasted =
                (inputType !== undefined && PASTE_TYPES.has(inputType)) ||
                (edit ? edit.inserted.length > 1 : input.value.length - value.length > 1)
              const next = (pasted ? pastedAmount(raw, currency) : null) ?? clean(raw)
              if (next === value) return
              if (edit) {
                pendingCaret.current = edit.caret
                // Only for the render this edit causes (React re-renders controlled inputs synchronously).
                queueMicrotask(() => {
                  pendingCaret.current = null
                })
              }
              onChange(next)
            }}
            onFocus={(event) => {
              onFocus?.(event)
              if (!selectOnFocus) return
              const input = event.currentTarget
              const valueAtFocus = input.value
              // After the click's own caret placement, so the selection sticks (iOS/Android too) —
              // unless typing already started, which must never be swallowed.
              requestAnimationFrame(() => {
                if (document.activeElement === input && input.value === valueAtFocus) input.select()
              })
            }}
          />
        </span>
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
