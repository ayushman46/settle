import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { AmountInput } from '../components'
import type { Minor } from '../domain/types'
import { cx } from '../lib/cx'
import { cleanAmountText, currencySymbol, MAX_MINOR, parseMoneyInput, toInputString } from '../lib/money'
import { amountInWords } from './amountWords'
import styles from './AmountHero.module.css'

export interface AmountHeroProps {
  /** Amount in minor units; null while nothing is typed. */
  value: Minor | null
  currency: string
  /** Receives the parsed amount (null when the field is empty). */
  onChange: (value: Minor | null) => void
  /** Shows a currency pill above the amount that calls this (e.g. to open a currency sheet). */
  onCurrencyClick?: () => void
  autoFocus?: boolean
  /** Accessible name. Default "Amount". */
  label?: string
  /** Line under the amount. Default: the amount in words for rupees ("Two thousand rupees"). */
  hint?: ReactNode
  error?: ReactNode
  disabled?: boolean
  id?: string
  className?: string
}

/** A value the field can show and read back unchanged (whole, non-negative, in range), or null. */
function displayable(value: Minor | null): Minor | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null
  return Math.min(Math.round(value), MAX_MINOR)
}

function textFor(value: Minor | null, currency: string): string {
  return toInputString(displayable(value), currency, { trimZeros: true })
}

/**
 * The pay-screen amount: huge centred digits that shrink to fit, a currency pill, and the
 * rupee amount in words underneath. Typing is kept as typed ("12." stays "12.") while the
 * parent only ever sees clean minor units; outside changes (a prefill, a new currency) replace it.
 */
export function AmountHero({
  value,
  currency,
  onChange,
  onCurrencyClick,
  autoFocus = false,
  label = 'Amount',
  hint,
  error,
  disabled = false,
  id,
  className,
}: AmountHeroProps) {
  const [text, setText] = useState(() => textFor(value, currency))
  const [textCurrency, setTextCurrency] = useState(currency)

  // Adopt outside changes: a new currency always re-expresses the amount; otherwise only a value
  // that differs from what's typed (so "12." or "12.50" survive while they mean the same amount).
  const shown = displayable(value)
  if (currency !== textCurrency) {
    setTextCurrency(currency)
    setText(textFor(value, currency))
  } else if (parseMoneyInput(text, currency) !== shown) {
    setText(textFor(value, currency))
  }

  const words = hint === undefined ? amountInWords(shown, currency) : null
  const symbol = currencySymbol(currency)

  return (
    <div className={cx(styles.hero, className)}>
      {onCurrencyClick && (
        <button
          type="button"
          className={styles.currency}
          disabled={disabled}
          aria-label={`Currency: ${currency}. Change`}
          onClick={onCurrencyClick}
        >
          {symbol !== currency && (
            <span className={styles.symbol} aria-hidden="true">
              {symbol}
            </span>
          )}
          <span>{currency}</span>
          <ChevronDown aria-hidden="true" strokeWidth={2.5} className={styles.chevron} />
        </button>
      )}
      <AmountInput
        id={id}
        size="hero"
        label={label}
        currency={currency}
        value={text}
        placeholder="0"
        autoFocus={autoFocus}
        disabled={disabled}
        hint={hint}
        error={error}
        enterKeyHint="done"
        onChange={(raw) => {
          const next = cleanAmountText(raw, currency)
          setText(next)
          const minor = parseMoneyInput(next, currency)
          if (minor !== shown) onChange(minor)
        }}
      />
      {words && !error && (
        // The digits are already announced; the words are a visual double-check.
        <p className={styles.words} aria-hidden="true">
          {words}
        </p>
      )}
    </div>
  )
}
