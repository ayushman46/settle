import { useId, useMemo, useState } from 'react'
import { Check, Search, SearchX } from 'lucide-react'
import { BottomSheet, EmptyState, TextField } from '../components'
import { COMMON_CURRENCIES, currencyName, isKnownCurrency } from '../lib/currencies'
import { cx } from '../lib/cx'
import { haptic } from '../lib/haptics'
import { currencySymbol } from '../lib/money'
import styles from './CurrencySheet.module.css'

export interface CurrencySheetProps {
  open: boolean
  /** The bill's current currency (shown checked, listed first). */
  currency: string
  onClose: () => void
  onSelect: (code: string) => void
}

interface Option {
  code: string
  name: string
}

/** Case- and accent-insensitive comparison text. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim()
}

function optionFor(code: string): Option {
  return { code, name: currencyName(code) }
}

/** Common currencies matching `query` (name or code); the current one first when not searching. */
function currencyOptions(query: string, current: string): Option[] {
  const all = COMMON_CURRENCIES.map((c) => optionFor(c.code))
  const q = fold(query)
  if (!q) {
    const rest = all.filter((o) => o.code !== current)
    return [optionFor(current), ...rest]
  }
  const matches = all.filter((o) => {
    const fallbackName = COMMON_CURRENCIES.find((c) => c.code === o.code)?.name ?? ''
    return fold(o.code).includes(q) || fold(o.name).includes(q) || fold(fallbackName).includes(q)
  })
  // Any real ISO code typed in full works too, even if it isn't in the common list.
  const typed = query.trim().toUpperCase()
  if (typed.length === 3 && isKnownCurrency(typed) && !matches.some((o) => o.code === typed)) {
    matches.unshift(optionFor(typed))
  }
  return matches
}

/**
 * Searchable currency picker. Changing it keeps every amount's number (rounded for currencies
 * without decimals); only the currency changes. The screen offers Undo.
 */
export function CurrencySheet({ open, currency, onClose, onSelect }: CurrencySheetProps) {
  const [query, setQuery] = useState('')
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setQuery('')
  }
  const listId = useId()
  const options = useMemo(() => currencyOptions(query, currency), [query, currency])

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      size="tall"
      title="Currency"
      description="Numbers stay the same — only the currency changes. Currencies without decimals round to whole amounts."
    >
      <div className={styles.search}>
        <TextField
          type="search"
          label="Search currencies"
          hideLabel
          placeholder="Search name or code"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          startAdornment={<Search aria-hidden="true" className={styles.searchIcon} />}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          aria-controls={listId}
        />
      </div>
      {options.length === 0 ? (
        <EmptyState
          size="sm"
          headingLevel={3}
          icon={<SearchX />}
          title="No matches"
          text="Try a name like “Euro” or a code like “EUR”."
        />
      ) : (
        <ul id={listId} role="list" className={styles.list} aria-label="Currencies">
          {options.map((option) => {
            const selected = option.code === currency
            const symbol = currencySymbol(option.code)
            return (
              <li key={option.code}>
                <button
                  type="button"
                  className={cx(styles.option, selected && styles.selected)}
                  aria-current={selected || undefined}
                  onClick={() => {
                    haptic('select')
                    onSelect(option.code)
                  }}
                >
                  <span className={styles.symbol} aria-hidden="true">
                    {symbol.length <= 3 ? symbol : option.code.slice(0, 1)}
                  </span>
                  <span className={styles.text}>
                    <span className={styles.name}>{option.name}</span>
                    <span className={styles.code}>{option.code}</span>
                  </span>
                  {selected && <Check aria-hidden="true" className={styles.check} strokeWidth={2.5} />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </BottomSheet>
  )
}
