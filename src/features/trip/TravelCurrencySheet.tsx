import { useId, useMemo, useState } from 'react'
import { Check, Search, SearchX } from 'lucide-react'
import { BottomSheet, EmptyState, TextField } from '../../components'
import { useT } from '../../i18n'
import { COMMON_CURRENCIES, currencyName, isKnownCurrency } from '../../lib/currencies'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { currencySymbol } from '../../lib/money'
import styles from '../bill/CurrencySheet.module.css'

export interface TravelCurrencySheetProps {
  open: boolean
  /** The group's own currency (balances stay in it). */
  groupCurrency: string
  /** The trip currency now; null = the same as the group. */
  value: string | null
  onClose: () => void
  /** The pick; null for "Same as the group". */
  onSelect: (code: string | null) => void
}

function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim()
}

/** Common currencies other than the group's, matching `query`; the current pick first. */
function options(query: string, groupCurrency: string, value: string | null): string[] {
  const codes = COMMON_CURRENCIES.map((c) => c.code).filter((code) => code !== groupCurrency)
  const q = fold(query)
  if (!q) return value ? [value, ...codes.filter((code) => code !== value)] : codes
  const matches = codes.filter((code) => {
    const fallback = COMMON_CURRENCIES.find((c) => c.code === code)?.name ?? ''
    return fold(code).includes(q) || fold(currencyName(code)).includes(q) || fold(fallback).includes(q)
  })
  const typed = query.trim().toUpperCase()
  if (typed.length === 3 && typed !== groupCurrency && isKnownCurrency(typed) && !matches.includes(typed)) matches.unshift(typed)
  return matches
}

/**
 * "Spending in": the currency a trip pays in, picked like any currency — with "Same as the group
 * (₹)" first, which turns it off. Expenses are converted into the group's currency at that day's rate.
 */
export function TravelCurrencySheet({ open, groupCurrency, value, onClose, onSelect }: TravelCurrencySheetProps) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setQuery('')
  }
  const listId = useId()
  const list = useMemo(() => options(query, groupCurrency, value), [query, groupCurrency, value])
  const symbol = currencySymbol(groupCurrency)
  const pick = (code: string | null) => {
    haptic('select')
    onSelect(code)
  }

  return (
    <BottomSheet open={open} onClose={onClose} size="tall" title={t('trip.group.label')} description={t('trip.group.sheet', { symbol })}>
      <div className={styles.search}>
        <TextField
          type="search"
          label={t('trip.picker.search')}
          hideLabel
          placeholder={t('trip.picker.placeholder')}
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
      {list.length === 0 && query.trim() !== '' ? (
        <EmptyState size="sm" headingLevel={3} icon={<SearchX />} title={t('trip.picker.none')} text={t('trip.picker.noneText')} />
      ) : (
        <ul id={listId} role="list" className={styles.list} aria-label={t('trip.picker.list')}>
          {!query.trim() && (
            <li>
              <button type="button" className={cx(styles.option, value === null && styles.selected)} aria-current={value === null || undefined} onClick={() => pick(null)}>
                <span className={styles.symbol} aria-hidden="true">
                  {symbol.length <= 3 ? symbol : groupCurrency.slice(0, 1)}
                </span>
                <span className={styles.text}>
                  <span className={styles.name}>{t('trip.group.same', { symbol })}</span>
                  <span className={styles.code}>{groupCurrency}</span>
                </span>
                {value === null && <Check aria-hidden="true" className={styles.check} strokeWidth={2.5} />}
              </button>
            </li>
          )}
          {list.map((code) => {
            const selected = code === value
            const sym = currencySymbol(code)
            return (
              <li key={code}>
                <button type="button" className={cx(styles.option, selected && styles.selected)} aria-current={selected || undefined} onClick={() => pick(code)}>
                  <span className={styles.symbol} aria-hidden="true">
                    {sym.length <= 3 ? sym : code.slice(0, 1)}
                  </span>
                  <span className={styles.text}>
                    <span className={styles.name}>{currencyName(code)}</span>
                    <span className={styles.code}>{code}</span>
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
