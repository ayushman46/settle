import type { CSSProperties } from 'react'
import { cx } from '../lib/cx'
import { currencySymbol, formatMoney, type MoneySign } from '../lib/money'
import styles from './Money.module.css'

export interface MoneyProps {
  /** Amount in minor units (integer). */
  value: number
  /** ISO 4217 code. */
  currency: string
  /**
   * `sm` 13px · `md` 16px (default) · `lg` 20px · `inherit` matches the surrounding text ·
   * `xl` 44px display (smaller raised symbol) that fills its container's width and shrinks so
   * long amounts always fit.
   */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'inherit'
  /** Passed to `formatMoney` (`always` → explicit + / −). */
  sign?: MoneySign
  /** Drop `.00` on whole amounts. */
  trimZeros?: boolean
  /** Secondary ink. */
  muted?: boolean
  /** Semantic colour: `positive` (savings/discounts), `negative`, `accent` (accent-ink text). */
  tone?: 'default' | 'positive' | 'negative' | 'accent'
  /** Heavier weight for totals. */
  strong?: boolean
  /**
   * `xl` only: the amount whose length sets the fit-to-width size — e.g. the final total while
   * `value` counts up to it, so the size doesn't jump as digits appear. Defaults to `value`.
   */
  fitValue?: number
  className?: string
  id?: string
}

/** Rough advance widths (em) of Geist's tabular digits and of the narrower separators. */
const DIGIT_EM = 0.62
const OTHER_EM = 0.34
/** The raised symbol is drawn at 0.55em with a small gap after it. */
const SYMBOL_SCALE = 0.55
const SYMBOL_GAP_EM = 0.08

/** Estimated rendered width of an `xl` amount, in em of its font size. */
function xlWidthEm(text: string, symbol: string): number {
  const at = symbol ? text.indexOf(symbol) : -1
  const rest = at === -1 ? text : text.slice(0, at) + text.slice(at + symbol.length)
  let em = 0
  for (const ch of rest) em += /\d/.test(ch) ? DIGIT_EM : OTHER_EM
  if (at !== -1) em += Array.from(symbol).length * DIGIT_EM * SYMBOL_SCALE + SYMBOL_GAP_EM
  // A little slack for the caret-free edges and font differences.
  return em + 0.2
}

/**
 * A formatted amount. Every amount uses the app's sans (Geist) with tabular digits, so columns
 * line up while grouping commas stay tight ("₹2,299", never "₹2, 299").
 */
export function Money({
  value,
  currency,
  size = 'md',
  sign,
  trimZeros,
  muted = false,
  tone = 'default',
  strong = false,
  fitValue,
  className,
  id,
}: MoneyProps) {
  const text = formatMoney(value, currency, { sign, trimZeros })
  const classes = cx(
    styles.money,
    styles[size],
    muted && styles.muted,
    tone !== 'default' && styles[tone],
    strong && styles.strong,
    className,
  )

  if (size === 'xl') {
    const symbol = currencySymbol(currency)
    const fitText = fitValue === undefined ? text : formatMoney(fitValue, currency, { sign, trimZeros })
    const fit = { '--money-fit-em': xlWidthEm(fitText, symbol).toFixed(2) } as CSSProperties
    const at = symbol ? text.indexOf(symbol) : -1
    // One plain text node for assistive tech (and text queries); the styled copy is visual only.
    return (
      <span id={id} className={classes}>
        <span className="visually-hidden">{text}</span>
        <span aria-hidden="true" className={styles.fit} style={fit}>
          {at === -1 ? (
            text
          ) : (
            <>
              {text.slice(0, at)}
              <span className={styles.symbol}>{symbol}</span>
              {text.slice(at + symbol.length)}
            </>
          )}
        </span>
      </span>
    )
  }

  return (
    <span id={id} className={classes}>
      {text}
    </span>
  )
}
