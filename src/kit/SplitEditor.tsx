import { useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { CircleAlert, CircleCheck, CircleDashed, RotateCcw, Wand2 } from 'lucide-react'
import { Button, Money, SegmentedControl, Stepper, Switch, type SegmentedOption } from '../components'
import { useFriendsById } from '../data'
import { ME_ID, type Minor, type Participant } from '../domain/types'
import { t, useT } from '../i18n'
import { isValidTotal, splitAmount, splitRestEqually, uniqueParticipants, type AmountSplitMode } from '../engine/split'
import { cx } from '../lib/cx'
import { haptic } from '../lib/haptics'
import { cleanAmountText, currencyDigits, currencySymbol, formatMoney, MAX_MINOR, parseMoneyInput, toInputString } from '../lib/money'
import { FriendAvatar } from './FriendAvatar'
import { friendLabel, friendObjectLabel } from './friendName'
import {
  clearedInputs,
  cleanPercentText,
  formatBps,
  parsePercentText,
  percentText,
  restoreInputs,
  restPreview,
  roundingCover,
  splitStatus,
  type SplitStatusTone,
} from './splitInputs'
import styles from './SplitEditor.module.css'

export interface SplitEditorProps {
  /** The amount being split (minor units); null while it hasn't been typed. */
  total: Minor | null
  currency: string
  mode: AmountSplitMode
  onModeChange: (mode: AmountSplitMode) => void
  /** Who's in, in display order, with their mode-specific input (see `SplitMode`). */
  participants: readonly Participant[]
  onParticipantsChange: (participants: Participant[]) => void
  /** Who paid — first in line for leftover paise, and the one who covers rounding. */
  payerId: string
  roundToWhole: boolean
  onRoundToWholeChange: (roundToWhole: boolean) => void
  className?: string
}

function modeOptions(): readonly SegmentedOption<AmountSplitMode>[] {
  return [
    { value: 'equal', label: t('kit.split.mode.equal') },
    { value: 'exact', label: t('kit.split.mode.exact') },
    { value: 'percent', label: '%', 'aria-label': t('kit.split.mode.percent.aria') },
    { value: 'shares', label: t('kit.split.mode.shares') },
  ]
}

const MAX_SHARES = 99

const STATUS_ICONS: Readonly<Record<SplitStatusTone, typeof CircleCheck>> = {
  ok: CircleCheck,
  pending: CircleDashed,
  over: CircleAlert,
  idle: CircleDashed,
}

/** Clean minor units a field can show and read back unchanged, or null. */
function shownMinor(value: number | null): Minor | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null
  return Math.min(Math.round(value), MAX_MINOR)
}

/**
 * Keeps the editor's sticky status above the screen's own sticky action bar (the `Screen`
 * footer), whatever its height — hint shown or not, keyboard up or down.
 */
function useStickyFooterGap(ref: RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const el = ref.current
    const footer = el?.closest('main')?.parentElement?.querySelector<HTMLElement>(':scope > [data-toast-anchor]')
    if (!el || !footer) return
    const apply = (): void => {
      const sticky = window.getComputedStyle(footer).position === 'sticky'
      el.style.setProperty('--split-footer-gap', sticky ? `${footer.offsetHeight}px` : '0px')
    }
    apply()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(apply) : null
    observer?.observe(footer)
    window.addEventListener('resize', apply)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', apply)
    }
  }, [ref])
}

/** Moves focus to the next amount/percent field in the editor on Enter — fast entry, row after row. */
function focusNextField(event: KeyboardEvent<HTMLInputElement>): void {
  if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
  event.preventDefault()
  const input = event.currentTarget
  const fields = Array.from(input.closest('[data-split-rows]')?.querySelectorAll<HTMLInputElement>('input') ?? [])
  const next = fields[fields.indexOf(input) + 1]
  if (next) next.focus()
  else input.blur()
}

function selectOnFocus(input: HTMLInputElement): void {
  const valueAtFocus = input.value
  requestAnimationFrame(() => {
    if (document.activeElement === input && input.value === valueAtFocus) input.select()
  })
}

interface MoneyCellProps {
  value: number | null
  currency: string
  label: string
  placeholder: string
  onChange: (value: Minor | null) => void
}

/** A compact amount field for one person (exact mode). Keeps typing as typed ("12."). */
function MoneyCell({ value, currency, label, placeholder, onChange }: MoneyCellProps) {
  const shown = shownMinor(value)
  const [text, setText] = useState(() => toInputString(shown, currency, { trimZeros: true }))
  const [textCurrency, setTextCurrency] = useState(currency)
  if (currency !== textCurrency) {
    setTextCurrency(currency)
    setText(toInputString(shown, currency, { trimZeros: true }))
  } else if (parseMoneyInput(text, currency) !== shown) {
    setText(toInputString(shown, currency, { trimZeros: true }))
  }
  const symbol = currencySymbol(currency)
  return (
    <span className={styles.cell}>
      <span className={styles.affix} aria-hidden="true">
        {symbol}
      </span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="next"
        className={styles.cellInput}
        aria-label={label}
        value={text}
        placeholder={placeholder}
        onChange={(event) => {
          const next = cleanAmountText(event.currentTarget.value, currency)
          setText(next)
          const minor = parseMoneyInput(next, currency)
          if (minor !== shown) onChange(minor)
        }}
        onFocus={(event) => selectOnFocus(event.currentTarget)}
        onKeyDown={focusNextField}
      />
    </span>
  )
}

interface PercentCellProps {
  value: number | null
  label: string
  placeholder: string
  onChange: (bps: number | null) => void
}

/** A compact percentage field for one person; the value is basis points. Never above 100%. */
function PercentCell({ value, label, placeholder, onChange }: PercentCellProps) {
  const shown = value === null || !Number.isFinite(value) || value < 0 ? null : Math.round(value)
  const [text, setText] = useState(() => percentText(shown))
  if (parsePercentText(text) !== shown) setText(percentText(shown))
  return (
    <span className={cx(styles.cell, styles.percentCell)}>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="next"
        className={styles.cellInput}
        aria-label={label}
        value={text}
        placeholder={placeholder}
        onChange={(event) => {
          const next = cleanPercentText(event.currentTarget.value)
          const bps = parsePercentText(next)
          if (bps !== null && bps > 10_000) {
            haptic('warning')
            return
          }
          setText(next)
          if (bps !== shown) onChange(bps)
        }}
        onFocus={(event) => selectOnFocus(event.currentTarget)}
        onKeyDown={focusNextField}
      />
      <span className={styles.affix} aria-hidden="true">
        %
      </span>
    </span>
  )
}

/**
 * How a total is divided: Equally / Exact / % / Shares, one row per person with their live
 * share, and a sticky status that says whether it adds up ("₹200 left to assign", "Adds up to
 * 100%") with "Split the rest equally" and "Reset" right there. Switching modes remembers what
 * was typed in each, so flicking back and forth never loses work.
 */
export function SplitEditor({
  total,
  currency,
  mode,
  onModeChange,
  participants,
  onParticipantsChange,
  payerId,
  roundToWhole,
  onRoundToWholeChange,
  className,
}: SplitEditorProps) {
  useT()
  const friendsById = useFriendsById()
  const statusRef = useRef<HTMLDivElement>(null)
  /** What was typed in each mode, by friendId — restored when coming back to that mode. */
  const memory = useRef<Partial<Record<AmountSplitMode, Record<string, number | null>>>>({})
  useStickyFooterGap(statusRef)

  const people = uniqueParticipants(participants)
  const validTotal = isValidTotal(total)
  const splitInput = { total: total ?? 0, currency, mode, participants: people, payerId, roundToWhole }
  const result = splitAmount(splitInput)
  const status = splitStatus({ total, currency, mode, participants: people, result })
  const preview = validTotal ? restPreview(splitInput) : {}
  const cover = roundingCover(splitInput)
  const digits = currencyDigits(currency)
  const symbol = currencySymbol(currency)
  const canReset = mode !== 'equal' && people.some((p) => p.input !== null)

  const nameOf = (id: string) => friendLabel(id, friendsById[id] ?? null)
  const objectOf = (id: string) => friendObjectLabel(id, friendsById[id] ?? null)
  const money = (minor: Minor) => formatMoney(minor, currency, { trimZeros: true })

  const setInput = (friendId: string, input: number | null): void => {
    onParticipantsChange(people.map((p) => (p.friendId === friendId ? { friendId, input } : p)))
  }

  const switchMode = (next: AmountSplitMode): void => {
    if (next === mode) return
    memory.current[mode] = Object.fromEntries(people.map((p) => [p.friendId, p.input]))
    onParticipantsChange(next === 'equal' ? clearedInputs(people) : restoreInputs(people, memory.current[next]))
    onModeChange(next)
  }

  const splitRest = (): void => {
    haptic('success')
    onParticipantsChange(splitRestEqually(splitInput))
  }

  const reset = (): void => {
    haptic('tap')
    memory.current[mode] = undefined
    onParticipantsChange(clearedInputs(people))
  }

  const payerName = nameOf(payerId)
  const payerIsYou = payerId === ME_ID
  const roundDescription = !roundToWhole
    ? payerIsYou
      ? t('kit.split.round.off.mine')
      : t('kit.split.round.off.theirs', { name: payerName })
    : cover > 0
      ? payerIsYou
        ? t('kit.split.round.cover.mine', { amount: money(cover) })
        : t('kit.split.round.cover.theirs', { name: payerName, amount: money(cover) })
      : t('kit.split.round.none')

  const StatusIcon = STATUS_ICONS[status.tone]

  return (
    <div className={cx(styles.editor, className)}>
      <SegmentedControl className={styles.modes} options={modeOptions()} value={mode} onChange={switchMode} ariaLabel={t('kit.split.mode.aria')} />

      {people.length > 0 ? (
        <ul className={styles.rows} aria-label={t('kit.split.rows.aria')} data-split-rows="">
          {people.map((p) => {
            const id = p.friendId
            const share = result.shares[id] ?? 0
            const weight = p.input === null ? 1 : p.input
            const out = mode === 'shares' && weight <= 0
            let sub: string | null = null
            if (validTotal) {
              if (mode === 'exact' && p.input !== null && p.input > 0) sub = formatBps(Math.round((p.input / (total ?? 1)) * 10_000))
              else if (mode === 'percent' || mode === 'shares') sub = out ? t('kit.split.notPaying') : money(share)
            }
            return (
              <li key={id} className={cx(styles.row, out && styles.out)}>
                <FriendAvatar friendId={id} size="md" />
                <span className={styles.who}>
                  <span className={styles.name}>{nameOf(id)}</span>
                  {sub !== null && <span className={styles.sub}>{sub}</span>}
                </span>
                <span className={styles.control}>
                  {mode === 'equal' &&
                    (validTotal ? (
                      <Money value={share} currency={currency} strong className={styles.share} />
                    ) : (
                      <span className={styles.dash}>
                        <span aria-hidden="true">–</span>
                        <span className="visually-hidden">{t('kit.split.noAmount')}</span>
                      </span>
                    ))}
                  {mode === 'exact' && (
                    <MoneyCell
                      value={p.input}
                      currency={currency}
                      label={t('kit.split.amountFor', { name: objectOf(id) })}
                      placeholder={preview[id] !== undefined ? toInputString(preview[id], currency, { trimZeros: true }) : '0'}
                      onChange={(minor) => setInput(id, minor)}
                    />
                  )}
                  {mode === 'percent' && (
                    <PercentCell
                      value={p.input}
                      label={t('kit.split.percentFor', { name: objectOf(id) })}
                      placeholder={preview[id] !== undefined ? percentText(preview[id]) : '0'}
                      onChange={(bps) => setInput(id, bps)}
                    />
                  )}
                  {mode === 'shares' && (
                    <Stepper
                      value={Math.round(weight)}
                      min={0}
                      max={MAX_SHARES}
                      label={t('kit.split.sharesFor', { name: objectOf(id) })}
                      onChange={(n) => setInput(id, n)}
                    />
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className={styles.empty}>{t('kit.split.empty')}</p>
      )}

      <div ref={statusRef} className={cx(styles.status, styles[status.tone])}>
        {status.progress !== null && (
          <span className={styles.meter} aria-hidden="true">
            <span className={styles.meterFill} style={{ transform: `scaleX(${status.progress})` }} />
          </span>
        )}
        <div className={styles.statusRow}>
          <StatusIcon className={styles.statusIcon} aria-hidden="true" strokeWidth={2.25} />
          <p className={styles.statusText} aria-live="polite" aria-atomic="true">
            <span className={styles.message}>{status.message}</span>
            {status.detail && (
              <>
                {' · '}
                <span className={styles.detail}>{status.detail}</span>
              </>
            )}
          </p>
          {(status.canSplitRest || canReset) && (
            <span className={styles.actions}>
              {status.canSplitRest && (
                <Button size="sm" variant="accent" iconStart={<Wand2 aria-hidden="true" />} onClick={splitRest}>
                  {t('kit.split.rest.cta')}
                </Button>
              )}
              {canReset && (
                <Button size="sm" variant="ghost" iconStart={<RotateCcw aria-hidden="true" />} onClick={reset}>
                  {t('kit.split.reset.cta')}
                </Button>
              )}
            </span>
          )}
        </div>
      </div>

      {digits > 0 && (
        <Switch
          className={styles.round}
          checked={roundToWhole}
          onChange={onRoundToWholeChange}
          label={t('kit.split.round.label', { symbol })}
          description={roundDescription}
        />
      )}
    </div>
  )
}
