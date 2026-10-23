import { useId, useState } from 'react'
import { Check, Lock } from 'lucide-react'
import { Chip, SegmentedControl, Stepper } from '../../components'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { formatQuantity } from '../../lib/format'
import { choiceToPick, isUnitItem, MAX_SHARED, type ItemChoice } from './picks'
import { money, portionWords } from './claimView'
import styles from './ItemPicker.module.css'

export interface PickerItem {
  name: string
  amount: number
  /** Whole units on the line (2…99), else undefined. */
  q?: number
  /** Sorted by the organiser before the link went out: who sorted it, and this person's part. */
  fixed?: { by: string; yours: string | null }
}

export interface ItemPickerProps {
  items: readonly PickerItem[]
  currency: string
  choices: Readonly<Record<number, ItemChoice>>
  onChange: (index: number, choice: ItemChoice) => void
  /** "I didn't have anything" is on: rows are shown but can't be changed. */
  disabled?: boolean
}

const QUICK_SHARES = [2, 3, 4, 5, 6] as const

function SharedBetween({ value, onChange, label, disabled }: { value: number; onChange: (n: number) => void; label: string; disabled?: boolean }) {
  const t = useT()
  const [more, setMore] = useState(value > 6)
  const id = useId()
  return (
    <div className={styles.shared}>
      <span id={id} className={styles.sharedLabel}>
        {t('claim.page.sharedBetween')}
      </span>
      <div className={styles.chips} role="group" aria-labelledby={id}>
        {QUICK_SHARES.map((n) => (
          <Chip
            key={n}
            selected={!more && value === n}
            disabled={disabled}
            onClick={() => {
              setMore(false)
              onChange(n)
            }}
          >
            {n}
          </Chip>
        ))}
        <Chip
          selected={more}
          disabled={disabled}
          onClick={() => {
            setMore(true)
            if (value < 7) onChange(7)
          }}
        >
          {t('claim.page.more')}
        </Chip>
      </div>
      {more && (
        <Stepper
          value={Math.max(7, value)}
          min={7}
          max={MAX_SHARED}
          onChange={onChange}
          label={`${label}: ${t('claim.page.morePeople')}`}
          disabled={disabled}
        />
      )}
    </div>
  )
}

function OneUnitRow({ item, choice, onChange, disabled }: { item: PickerItem; choice: ItemChoice; onChange: (c: ItemChoice) => void; disabled?: boolean }) {
  const t = useT()
  const on = choice.kind === 'me' || choice.kind === 'shared'
  return (
    <>
      <button
        type="button"
        className={cx(styles.toggle, on && styles.toggleOn)}
        aria-pressed={on}
        aria-label={`${t('claim.page.hadThis')}: ${item.name}`}
        disabled={disabled}
        onClick={() => {
          haptic('select')
          onChange(on ? { kind: 'none' } : { kind: 'me' })
        }}
      >
        <span className={styles.tick} aria-hidden="true">
          {on && <Check strokeWidth={3} />}
        </span>
        {t('claim.page.hadThis')}
      </button>
      {on && (
        <div className={styles.controls}>
          <SegmentedControl
            size="sm"
            ariaLabel={`${item.name}: ${t('claim.page.howShared')}`}
            value={choice.kind === 'shared' ? 'shared' : 'me'}
            onChange={(v) => onChange(v === 'shared' ? { kind: 'shared', n: choice.kind === 'shared' ? choice.n : 2 } : { kind: 'me' })}
            options={[
              { value: 'me', label: t('claim.page.justMe') },
              { value: 'shared', label: t('claim.page.shared') },
            ]}
          />
          {choice.kind === 'shared' && (
            <SharedBetween value={choice.n} label={item.name} disabled={disabled} onChange={(n) => onChange({ kind: 'shared', n })} />
          )}
        </div>
      )}
    </>
  )
}

function UnitRow({ item, q, choice, onChange, disabled }: { item: PickerItem; q: number; choice: ItemChoice; onChange: (c: ItemChoice) => void; disabled?: boolean }) {
  const t = useT()
  if (choice.kind === 'shared') {
    return (
      <div className={styles.controls}>
        <SharedBetween value={choice.n} label={item.name} disabled={disabled} onChange={(n) => onChange({ kind: 'shared', n })} />
        <button type="button" className={styles.link} disabled={disabled} onClick={() => onChange({ kind: 'units', k: 0 })}>
          {t('claim.page.backToUnits')}
        </button>
      </div>
    )
  }
  const k = choice.kind === 'units' ? choice.k : 0
  return (
    <div className={styles.unitControls}>
      <div className={styles.stepperRow}>
        <span className={styles.stepperLabel} aria-hidden="true">
          {t('claim.page.iHad')}
        </span>
        <Stepper
          value={k}
          min={0}
          max={q}
          label={t('claim.page.stepperLabel', { name: item.name })}
          formatValue={(v) => `${v} ${t('claim.page.ofQ', { q: String(q) })}`}
          disabled={disabled}
          onChange={(v) => onChange({ kind: 'units', k: v })}
        />
      </div>
      <button type="button" className={styles.link} disabled={disabled} onClick={() => onChange({ kind: 'shared', n: 2 })}>
        {t('claim.page.weShared', { q: String(q) })}
      </button>
    </div>
  )
}

/**
 * "What did you have?" — one row per bill line: a toggle (one-unit lines: just me or shared
 * between n) or a stepper ("I had 1 of 4", or "We shared all 4"); lines the organiser already
 * sorted are greyed out. Under each line, the part picked in words and money.
 */
export function ItemPicker({ items, currency, choices, onChange, disabled = false }: ItemPickerProps) {
  const t = useT()
  return (
    <ul className={cx(styles.list, disabled && styles.listDisabled)} role="list">
      {items.map((item, index) => {
        const choice = choices[index] ?? { kind: 'none' }
        const pick = choiceToPick(index, choice, item.q)
        const units = isUnitItem(item.q) ? item.q : null
        return (
          <li key={index} className={cx(styles.row, item.fixed && styles.fixed, pick && styles.picked)}>
            <div className={styles.head}>
              <span className={styles.name}>
                {item.name}
                {units !== null && <span className={styles.qty}> ×{formatQuantity(units)}</span>}
              </span>
              <span className={styles.amount}>{money(item.amount, currency)}</span>
            </div>
            {item.fixed ? (
              <p className={styles.sortedBy}>
                <Lock aria-hidden="true" className={styles.lock} strokeWidth={2.25} />
                {t('claim.page.sortedBy', { name: item.fixed.by })}
                {item.fixed.yours && <span className={styles.yours}> · {t('claim.page.yours', { part: item.fixed.yours })}</span>}
              </p>
            ) : (
              <>
                {pick && <p className={styles.portion}>{portionWords(item.q ?? 1, pick, item.amount, currency)}</p>}
                {units !== null ? (
                  <UnitRow item={item} q={units} choice={choice} disabled={disabled} onChange={(c) => onChange(index, c)} />
                ) : (
                  <OneUnitRow item={item} choice={choice} disabled={disabled} onChange={(c) => onChange(index, c)} />
                )}
              </>
            )}
          </li>
        )
      })}
    </ul>
  )
}
