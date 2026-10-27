import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowRight, Bike, ChevronDown, Equal, PiggyBank, Scale } from 'lucide-react'
import { ActionBar, AmountInput, Button, Card, Chip, Money, PageTitle, Screen, TopBar } from '../../components'
import { t, useT } from '../../i18n'
import { currencyName } from '../../lib/currencies'
import { cx } from '../../lib/cx'
import { formatPercent } from '../../lib/format'
import { cleanAmountText, formatMoney, parseMoneyInput, toInputString } from '../../lib/money'
import {
  billBreakdown,
  canContinue,
  computedBillTotal,
  defaultPaid,
  effectivePaid,
  feesTotal,
  itemsTotal,
  stepProgress,
  type BreakdownRow,
} from '../../state/selectors'
import { useFlow, useSession } from '../../state/store'
import type { FeeSplit, Minor, Session } from '../../types'
import { BillCheckCard } from './BillCheckCard'
import { DELIVERY_ENABLED } from './delivery.enabled'
import { FeePolicy } from './FeePolicy'
import { explainFeePolicy, feePolicyFacts } from './feeView'
import { revealElement, TINY_RATE } from './screenUtils'
import styles from './PaidScreen.module.css'

interface Explanation {
  tone: 'extra' | 'saving' | 'same'
  icon: ReactNode
  text: string
}

/** Screen readers hear the explanation once typing settles, not on every keystroke. */
const SPEAK_AFTER_MS = 700

/** With delivery fees: how the fees (equally or by what each had), tax and the coupon are shared. */
function explainFees(session: Session, fees: Minor): Explanation {
  const facts = feePolicyFacts(session, fees)
  return { tone: 'extra', icon: facts.feeSplit === 'equal' ? <Bike /> : <Scale />, text: explainFeePolicy(facts) }
}

/** How the amount paid compares with the items, in one friendly line (null when there's nothing to say). */
function explain(paid: Minor, items: Minor, currency: string): Explanation | null {
  if (paid <= 0) return null
  if (items <= 0) {
    return { tone: 'same', icon: <Equal />, text: t('bill.paid.explain.free') }
  }
  const diff = paid - items
  if (diff === 0) return { tone: 'same', icon: <Equal />, text: t('bill.paid.explain.same') }
  const rate = Math.abs(diff) / items
  const amount = formatMoney(Math.abs(diff), currency)
  if (diff > 0) {
    return {
      tone: 'extra',
      icon: <Scale />,
      text:
        rate < TINY_RATE
          ? t('bill.paid.explain.extra.amount', { amount })
          : t('bill.paid.explain.extra.percent', { percent: formatPercent(rate) }),
    }
  }
  const text =
    rate < TINY_RATE
      ? t('bill.paid.explain.saving', { amount })
      : t('bill.paid.explain.saving.percent', { amount, percent: formatPercent(rate) })
  return { tone: 'saving', icon: <PiggyBank />, text }
}

interface QuickAmount {
  key: string
  label: string
  value: Minor
}

/** Step 2: what actually left the wallet. Everything else is shared in proportion to it. */
export function PaidScreen() {
  const t = useT()
  const { session, dispatch } = useSession()
  const flow = useFlow()
  const { currency, meta } = session
  const items = itemsTotal(session)
  const paid = effectivePaid(session)
  const ready = canContinue(session, 'paid')
  const [text, setText] = useState(() => toInputString(effectivePaid(session), currency, { trimZeros: true }))
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const breakdownId = useId()
  const breakdownRef = useRef<HTMLDivElement>(null)
  const noteId = useId()
  // Delivery orders: the fee policy, and its explanation in place of the one-liner.
  const fees = DELIVERY_ENABLED ? feesTotal(session) : 0
  const feeSplit: FeeSplit = session.feeSplit ?? 'proportional'
  const explanation = fees > 0 && paid > 0 ? explainFees(session, fees) : explain(paid, items, currency)
  const explanationText = explanation?.text ?? ''
  /** What the hidden live region says: the explanation, once typing pauses (at once for a chip). */
  const [spoken, setSpoken] = useState(explanationText)
  const speakNow = useRef(false)
  useEffect(() => {
    const delay = speakNow.current ? 0 : SPEAK_AFTER_MS
    speakNow.current = false
    const timer = setTimeout(() => setSpoken(explanationText), delay)
    return () => clearTimeout(timer)
  }, [explanationText])

  // Opening the breakdown brings its rows into view (above the sticky action bar).
  useEffect(() => {
    if (breakdownOpen) revealElement(breakdownRef.current)
  }, [breakdownOpen])

  const setAmountText = (next: string): void => {
    const clean = cleanAmountText(next, currency)
    setText(clean)
    dispatch({ type: 'setPaid', paid: clean === '' ? null : parseMoneyInput(clean, currency) })
  }

  const pick = (value: Minor): void => {
    if (fees === 0 && (explain(value, items, currency)?.text ?? '') !== explanationText) speakNow.current = true
    setText(toInputString(value, currency, { trimZeros: true }))
    dispatch({ type: 'setPaid', paid: value })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    event.preventDefault()
    if (!ready) return
    event.currentTarget.blur()
    flow.next()
  }

  const quick: QuickAmount[] = []
  if (meta.total !== null && meta.total > 0) {
    quick.push({ key: 'total', label: t('bill.paid.quick.total'), value: meta.total })
  } else {
    // No printed total: what the bill's own lines add up to (items + tax/service/tip − discounts).
    const computed = computedBillTotal(session)
    if (computed > 0 && computed !== items) quick.push({ key: 'computed', label: t('bill.paid.quick.computed'), value: computed })
  }
  if (items > 0 && items !== meta.total) quick.push({ key: 'items', label: t('bill.paid.quick.items'), value: items })

  const rows = billBreakdown(session)
  const totalRow = rows.find((row) => row.kind === 'total')
  const showBreakdown = meta.total !== null || rows.some((row) => row.kind !== 'items' && row.kind !== 'total')

  return (
    <Screen
      header={<TopBar onBack={flow.back} progress={stepProgress('paid') ?? undefined} />}
      footer={
        <ActionBar hint={ready ? undefined : t('bill.paid.missing.hint')}>
          <Button block disabled={!ready} iconEnd={<ArrowRight />} onClick={flow.next}>
            {t('bill.paid.next.cta')}
          </Button>
        </ActionBar>
      }
    >
      <PageTitle
        title={t('bill.paid.title')}
        subtitle={t('bill.paid.subtitle')}
      />

      <div className={styles.amount}>
        <AmountInput
          size="hero"
          label={t('bill.paid.amount.label', { currency: currencyName(currency) })}
          currency={currency}
          value={text}
          onChange={setAmountText}
          placeholder={toInputString(defaultPaid(session), currency, { trimZeros: true })}
          onKeyDown={onKeyDown}
          enterKeyHint="next"
          containerClassName={styles.hero}
        />

        {quick.length > 0 && (
          <div className={styles.chips} role="group" aria-label={t('bill.paid.quick.aria')}>
            {quick.map((choice) => (
              <Chip key={choice.key} selected={paid === choice.value} onClick={() => pick(choice.value)}>
                {choice.label} <Money value={choice.value} currency={currency} size="inherit" trimZeros />
              </Chip>
            ))}
          </div>
        )}

        {fees > 0 && (
          <FeePolicy
            value={feeSplit}
            describedBy={noteId}
            onChange={(next) => {
              speakNow.current = true
              dispatch({ type: 'setFeeSplit', feeSplit: next })
            }}
          />
        )}

        <p id={noteId} className={cx(styles.note, explanation && styles[explanation.tone])}>
          {explanation && (
            <>
              <span className={styles.noteIcon} aria-hidden="true">
                {explanation.icon}
              </span>
              <span>{explanation.text}</span>
            </>
          )}
        </p>
        <p className="visually-hidden" aria-live="polite">
          {spoken}
        </p>
      </div>

      <BillCheckCard onPaidChange={(next) => setText(toInputString(next, currency, { trimZeros: true }))} />

      {showBreakdown && totalRow && (
        <Card ref={breakdownRef} padding="none">
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={breakdownOpen}
            aria-controls={breakdownId}
            onClick={() => setBreakdownOpen((open) => !open)}
          >
            <span className={styles.toggleTitle}>{t('bill.paid.breakdown.title')}</span>
            <Money value={totalRow.amount} currency={currency} strong />
            <ChevronDown aria-hidden="true" className={cx(styles.chevron, breakdownOpen && styles.chevronOpen)} />
          </button>
          <div id={breakdownId} className={styles.breakdownBody} hidden={!breakdownOpen}>
            <dl className={styles.rows}>
              {rows.map((row) => (
                <BreakdownLine key={row.key} row={row} currency={currency} />
              ))}
            </dl>
          </div>
        </Card>
      )}
    </Screen>
  )
}

function BreakdownLine({ row, currency }: { row: BreakdownRow; currency: string }) {
  // A few paise of rounding stay quiet; a real "Other charges/discounts" line (kind 'other') is
  // signed and toned like any charge or saving.
  const smallRoundOff = row.kind === 'roundoff'
  const value =
    row.kind === 'items' || row.kind === 'total' ? (
      <Money value={row.amount} currency={currency} strong={row.kind === 'total'} />
    ) : (
      <Money
        value={row.amount}
        currency={currency}
        sign="always"
        tone={row.amount < 0 && !smallRoundOff ? 'positive' : 'default'}
        muted={smallRoundOff}
      />
    )
  return (
    <div className={cx(styles.line, row.kind === 'total' && styles.lineTotal, smallRoundOff && styles.lineMuted)}>
      <dt>{row.label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
