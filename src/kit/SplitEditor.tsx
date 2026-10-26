import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { CircleAlert, CircleCheck, CircleDashed, RotateCcw, Wand2 } from 'lucide-react'
import { Button, Chip, Money, Stepper, Switch } from '../components'
import { useFriendsById } from '../data'
import { ME_ID, type Minor, type Participant } from '../domain/types'
import { t, useT, type MessageKey } from '../i18n'
import { hadSum, isMoneyMode, isValidTotal, splitAmount, splitRestEqually, uniqueParticipants, type AmountSplitMode } from '../engine/split'
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
  /** Sets the amount being split — "Use ₹1,200" in What each had when none is typed. Omit to hide it. */
  onTotalChange?: (total: Minor) => void
  /** The ways to split on offer, in order. Default: all of them. */
  modes?: readonly AmountSplitMode[]
  className?: string
}

const SPLIT_MODES: readonly AmountSplitMode[] = ['equal', 'had', 'exact', 'percent', 'shares']

const MODE_LABELS: Readonly<Record<AmountSplitMode, MessageKey>> = {
  equal: 'kit.split.mode.equal',
  had: 'kit.split.mode.had',
  exact: 'kit.split.mode.exact',
  percent: 'kit.split.mode.percent.aria',
  shares: 'kit.split.mode.shares',
}

/** One line under the modes on what each is for — "what's the point of percentages?" answered in place. */
const MODE_HINTS: Readonly<Record<AmountSplitMode, MessageKey>> = {
  equal: 'kit.split.mode.equal.hint',
  had: 'kit.split.mode.had.hint',
  exact: 'kit.split.mode.exact.hint',
  percent: 'kit.split.mode.percent.hint',
  shares: 'kit.split.mode.shares.hint',
}

interface ModePickerProps {
  modes: readonly AmountSplitMode[]
  value: AmountSplitMode
  onChange: (mode: AmountSplitMode) => void
  describedBy: string
}

/**
 * The ways to split as chips that wrap (five don't fit a segmented bar on a 320 px phone), with
 * radio-group keys: arrows move the choice, Home/End jump to the ends, one stop in the tab order.
 */
function ModePicker({ modes, value, onChange, describedBy }: ModePickerProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const index = Math.max(0, modes.indexOf(value))
  const select = (i: number): void => {
    const n = modes.length
    const at = ((i % n) + n) % n
    refs.current[at]?.focus()
    const next = modes[at]
    if (next !== undefined && next !== value) onChange(next)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const moves: Readonly<Record<string, number>> = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      Home: 0,
      End: modes.length - 1,
    }
    const to = moves[event.key]
    if (to === undefined) return
    event.preventDefault()
    select(to)
  }
  return (
    <div role="radiogroup" aria-label={t('kit.split.mode.aria')} aria-describedby={describedBy} className={styles.modes} onKeyDown={onKeyDown}>
      {modes.map((mode, i) => (
        <Chip
          key={mode}
          ref={(el) => {
            refs.current[i] = el
          }}
          role="radio"
          selected={mode === value}
          tabIndex={i === index ? 0 : -1}
          onClick={() => {
            if (mode !== value) onChange(mode)
          }}
        >
          {t(MODE_LABELS[mode])}
        </Chip>
      ))}
    </div>
  )
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

/** A compact amount field for one person (exact and had modes). Keeps typing as typed ("12."). */
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
 * How a total is divided: Equally / What each had / Exact / Percentages / Shares, one row per
 * person with their live share, and a sticky status that says whether it adds up ("₹200 left to assign", "Adds up to
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
  onTotalChange,
  modes = SPLIT_MODES,
  className,
}: SplitEditorProps) {
  useT()
  const hintId = useId()
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
  const someoneHad = mode === 'had' && hadSum(people) > 0
  const useTotal = onTotalChange && status.useTotal !== undefined ? status.useTotal : null

  const nameOf = (id: string) => friendLabel(id, friendsById[id] ?? null)
  const objectOf = (id: string) => friendObjectLabel(id, friendsById[id] ?? null)
  const money = (minor: Minor) => formatMoney(minor, currency, { trimZeros: true })

  const setInput = (friendId: string, input: number | null): void => {
    onParticipantsChange(people.map((p) => (p.friendId === friendId ? { friendId, input } : p)))
  }

  const switchMode = (next: AmountSplitMode): void => {
    if (next === mode) return
    const typed = Object.fromEntries(people.map((p) => [p.friendId, p.input]))
    memory.current[mode] = typed
    // Exact amounts and what each had are both money: what's typed in one carries over to the other.
    const saved = memory.current[next] ?? (isMoneyMode(mode) && isMoneyMode(next) ? typed : undefined)
    onParticipantsChange(next === 'equal' ? clearedInputs(people) : restoreInputs(people, saved))
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
      <div className={styles.modePicker}>
        <ModePicker modes={modes} value={mode} onChange={switchMode} describedBy={hintId} />
        <p id={hintId} className={styles.modeHint}>
          {t(MODE_HINTS[mode])}
        </p>
      </div>

      {people.length > 0 ? (
        <ul className={styles.rows} aria-label={t('kit.split.rows.aria')} data-split-rows="">
          {people.map((p) => {
            const id = p.friendId
            const share = result.shares[id] ?? 0
            const weight = p.input === null ? 1 : p.input
            const had = mode === 'had' && p.input !== null && p.input > 0 ? p.input : 0
            const out = (mode === 'shares' && weight <= 0) || (mode === 'had' && had === 0 && someoneHad)
            let sub: string | null = null
            if (validTotal) {
              if (mode === 'exact' && p.input !== null && p.input > 0) sub = formatBps(Math.round((p.input / (total ?? 1)) * 10_000))
              else if (mode === 'percent' || mode === 'shares') sub = out ? t('kit.split.notPaying') : money(share)
              else if (mode === 'had' && had > 0 && share !== had) sub = t('kit.split.pays', { amount: money(share) })
            }
            if (mode === 'had' && out) sub = t('kit.split.notPaying')
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
                  {mode === 'had' && (
                    <MoneyCell
                      value={p.input}
                      currency={currency}
                      label={t('kit.split.hadFor', { name: objectOf(id) })}
                      placeholder="0"
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
          {(status.canSplitRest || canReset || useTotal !== null) && (
            <span className={styles.actions}>
              {useTotal !== null && (
                <Button size="sm" variant="accent" iconStart={<CircleCheck aria-hidden="true" />} onClick={() => onTotalChange?.(useTotal)}>
                  {t('kit.split.useTotal.cta', { amount: money(useTotal) })}
                </Button>
              )}
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
