import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { ArrowDown, ChevronDown, CircleCheck, RotateCcw, Share2, UsersRound } from 'lucide-react'
import {
  ActionBar,
  Avatar,
  Banner,
  BottomSheet,
  Button,
  EmptyState,
  Money,
  PageTitle,
  Receipt,
  ReceiptRow,
  Screen,
  SuccessCheck,
  TopBar,
  useToast,
} from '../components'
import { formatBillDate, formatPercent } from '../lib/format'
import { haptic } from '../lib/haptics'
import { currencyDigits, formatMoney } from '../lib/money'
import { openDebts, owedBy, settleUp, type Settlement } from '../lib/settle'
import { buildShareText, shareResult } from '../lib/share'
import { shareLabel, type PersonSplit, type SplitResult } from '../lib/split'
import { getSavedUpiId, isValidUpiId, normalizeUpiId, saveUpiId } from '../lib/upi'
import { stepProgress } from '../state/selectors'
import { useFlow, useSession, useSplit } from '../state/store'
import { countUp, useEntranceProgress } from './entranceMotion'
import { plural, revealElement, TINY_RATE } from './screenUtils'
import { SettleUp } from './SettleUp'
import { UpiSheet, type UpiRequest } from './UpiSheet'
import styles from './ResultScreen.module.css'

/** The receipt's "what's on top of the items" line, or null when paid equals the items. */
function adjustmentLine(split: SplitResult, currency: string): string | null {
  const { adjustment } = split
  if (adjustment === 0) return null
  const abs = Math.abs(adjustment)
  const amount = formatMoney(abs, currency)
  // Up to one whole rupee/dollar/…: that's the bill being rounded, not tax or a discount.
  if (abs <= 10 ** currencyDigits(currency)) return `Includes ${amount} round-off`
  const what = adjustment > 0 ? 'tax & charges' : 'discounts'
  if (split.itemsTotal <= 0) return `Includes ${what}`
  const rate = Math.abs(split.adjustmentRate)
  // "+0%" says nothing; the amount does.
  if (rate < TINY_RATE) return `Includes ${amount} of ${what}`
  return `Includes ${what} (${adjustment > 0 ? '+' : '−'}${formatPercent(rate)})`
}

/** "Here's the split" — the receipt, who paid, settling up, and sharing it. */
export function ResultScreen() {
  const { session, dispatch } = useSession()
  const split = useSplit()
  const flow = useFlow()
  const toast = useToast()
  const { currency, meta, items, people } = session

  const progress = useEntranceProgress()
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [upiFor, setUpiFor] = useState<string | null>(null)
  const sharing = useRef(false)
  const settleRef = useRef<HTMLElement>(null)

  // The payer's UPI ID: what was typed for each payer during this visit, else the ID saved on
  // this device for that person's name. Every ID belongs to one payee — one typed for Aisha
  // never ends up on Ben's QR codes.
  const [upiByPayer, setUpiByPayer] = useState<Record<string, string>>({})

  // Success moment: one haptic per arrival (the check mark draws itself on mount).
  const celebrated = useRef(false)
  useEffect(() => {
    if (celebrated.current) return
    celebrated.current = true
    haptic('success')
  }, [])

  const settlement = settleUp(split, session.payerId)
  const payer = settlement?.payer ?? null
  const isInr = currency === 'INR'
  const upiText = payer ? (upiByPayer[payer.id] ?? getSavedUpiId(payer.name) ?? '') : ''
  const vpa = isInr && isValidUpiId(upiText) ? normalizeUpiId(upiText) : null

  const setPayer = (personId: string | null) => dispatch({ type: 'setPayer', personId })

  const setUpiText = (text: string) => {
    if (!payer) return
    setUpiByPayer((map) => ({ ...map, [payer.id]: text }))
    // Remember complete IDs (and forget a cleared one) under this payer's name; half-typed ones aren't saved.
    if (text.trim() === '' || isValidUpiId(text)) saveUpiId(payer.name, text)
  }

  // "Who paid? Settle up": the settle-up section usually starts below the fold.
  const goToSettleUp = () => {
    const section = settleRef.current
    if (!section) return
    revealElement(section)
    const radio =
      section.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ??
      section.querySelector<HTMLElement>('[role="radio"]')
    radio?.focus({ preventScroll: true })
  }

  const debt = upiFor === null ? undefined : openDebts(settlement).find((d) => d.person.id === upiFor)
  const request: UpiRequest | null =
    debt && settlement && vpa
      ? { debtor: debt.person, payer: settlement.payer, amount: debt.owes, vpa, merchant: meta.merchant }
      : null

  const share = async () => {
    if (sharing.current) return
    sharing.current = true
    try {
      const text = buildShareText(session, split, { upiId: vpa })
      const outcome = await shareResult(text, { title: meta.merchant ?? 'Our bill' })
      if (outcome === 'shared' || outcome === 'copied') haptic('success')
      if (outcome === 'copied') toast('Copied to clipboard', { tone: 'success' })
      if (outcome === 'failed') {
        haptic('error')
        toast("Couldn't share. Try again.", { tone: 'error' })
      }
    } finally {
      sharing.current = false
    }
  }

  const toggle = (personId: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(personId)) next.delete(personId)
      else next.add(personId)
      return next
    })
  }

  const date = formatBillDate(meta.date)
  const adds = split.check === split.paid
  const unassigned = split.unassignedItemIds.length
  const adjustment = adjustmentLine(split, currency)
  const canSettle = people.length > 1

  const header = <TopBar onBack={flow.back} progress={stepProgress('result') ?? undefined} />

  if (people.length === 0) {
    return (
      <Screen header={header}>
        <PageTitle title="Here's the split" />
        <EmptyState
          icon={<UsersRound />}
          title="No one to split with"
          text="Add the people at the table to see everyone's share."
          action={
            <Button size="md" onClick={() => flow.goTo('people')}>
              Add people
            </Button>
          }
        />
      </Screen>
    )
  }

  return (
    <Screen
      header={header}
      footer={
        <ActionBar>
          <Button block iconStart={<Share2 />} onClick={share}>
            Share the split
          </Button>
          <Button block variant="ghost" size="md" iconStart={<RotateCcw />} onClick={() => setConfirmOpen(true)}>
            Start a new bill
          </Button>
        </ActionBar>
      }
    >
      <PageTitle
        align="center"
        leading={<SuccessCheck size="md" />}
        eyebrow="Split complete"
        title="Here's the split"
      />

      {unassigned > 0 && (
        <Banner tone="info" action={{ label: 'Assign', onAction: () => flow.goTo('assign') }}>
          {unassigned === 1
            ? "1 item wasn't assigned, so it's split between everyone."
            : `${unassigned} items weren't assigned, so they're split between everyone.`}
        </Banner>
      )}

      {!adds && (
        <Banner tone="error" title="Something doesn't add up">
          The shares don't match what was paid. Go back and check the items.
        </Banner>
      )}

      <Receipt padding="lg" className={styles.receipt}>
        <div className={styles.receiptHead}>
          <p className={styles.merchant}>{meta.merchant ?? 'Your bill'}</p>
          {date && <p className={styles.date}>{date}</p>}
        </div>

        <div className={styles.totalBlock}>
          <p className={styles.totalLabel}>Total paid</p>
          <Money
            value={countUp(split.paid, progress)}
            fitValue={split.paid}
            currency={currency}
            size="xl"
            className={styles.total}
          />
          <p className={styles.meta}>
            {plural(people.length, 'person', 'people')} · {plural(items.length, 'item')}
          </p>
          {adjustment && <p className={styles.adjustment}>{adjustment}</p>}
          {canSettle && settlement === null && (
            <Button variant="ghost" size="sm" iconEnd={<ArrowDown />} className={styles.settleLink} onClick={goToSettleUp}>
              Who paid? Settle up
            </Button>
          )}
        </div>

        <Receipt.Divider />

        <ul role="list" className={styles.people} aria-label="Everyone's share">
          {split.people.map((personSplit, index) => (
            <PersonRow
              key={personSplit.person.id}
              split={personSplit}
              index={index}
              currency={currency}
              progress={progress}
              settlement={settlement}
              expanded={expanded.has(personSplit.person.id)}
              onToggle={() => toggle(personSplit.person.id)}
            />
          ))}
        </ul>

        {adds && (
          <>
            <Receipt.Divider />
            <p className={styles.check}>
              <CircleCheck aria-hidden="true" className={styles.checkIcon} strokeWidth={2.25} />
              <span>
                Adds up to <Money value={split.paid} currency={currency} size="inherit" strong />
              </span>
            </p>
          </>
        )}
      </Receipt>

      {canSettle && (
        <SettleUp
          ref={settleRef}
          people={people}
          payerId={payer?.id ?? null}
          onPayerChange={setPayer}
          settlement={settlement}
          currency={currency}
          upiText={upiText}
          onUpiTextChange={setUpiText}
          onRequest={setUpiFor}
        />
      )}

      <UpiSheet request={request} onClose={() => setUpiFor(null)} />

      <BottomSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Start a new bill?"
        description="This clears the current split. People you added are saved for next time."
        footer={
          <ActionBar>
            <Button
              block
              onClick={() => {
                setConfirmOpen(false)
                flow.startOver()
              }}
            >
              Start new bill
            </Button>
            <Button block variant="ghost" size="md" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
          </ActionBar>
        }
      />
    </Screen>
  )
}

interface PersonRowProps {
  split: PersonSplit
  index: number
  currency: string
  /** Entrance count-up progress (0..1). */
  progress: number
  settlement: Settlement | null
  expanded: boolean
  onToggle: () => void
}

/** One person on the receipt: their total, what they owe, and (expanded) their items. */
function PersonRow({ split, index, currency, progress, settlement, expanded, onToggle }: PersonRowProps) {
  const { person, lines, itemsSubtotal, adjustment, total } = split
  const detailsId = useId()
  const isPayer = settlement?.payer.id === person.id
  const owes = owedBy(settlement, person.id)

  const money = (minor: number) => formatMoney(minor, currency)
  let status: string
  if (settlement && isPayer) status = `paid ${money(settlement.paid)} · gets back ${money(settlement.getsBack)}`
  else if (settlement && owes !== null) status = owes > 0 ? `owes ${settlement.payer.name} ${money(owes)}` : 'owes nothing'
  else status = plural(lines.length, 'item')

  return (
    <li className={styles.person} style={{ '--i': index } as CSSProperties}>
      <button
        type="button"
        className={styles.personHead}
        aria-expanded={expanded}
        aria-controls={detailsId}
        aria-label={`${person.name}, ${money(total)}, ${status}`}
        onClick={onToggle}
      >
        <Avatar name={person.name} color={person.color} size="md" className={styles.personAvatar} />
        {/* Name and total share a line when they fit; otherwise the total drops below, so a name
            only ever wraps at its spaces. The sizer reserves the final width while totals count up. */}
        <span className={styles.personMain}>
          <span className={styles.personName}>
            {person.name}
            {isPayer && (
              <span className={styles.paidBadge} aria-hidden="true">
                Paid
              </span>
            )}
          </span>
          <span className={styles.personTotal} data-final={money(total)}>
            <Money value={countUp(total, progress)} currency={currency} size="inherit" strong />
          </span>
        </span>
        <ChevronDown aria-hidden="true" className={styles.chevron} strokeWidth={2.25} />
        <span className={styles.personStatus}>{status}</span>
      </button>

      <div id={detailsId} className={styles.details} hidden={!expanded}>
        {expanded && (
          <>
            {lines.length > 0 ? (
              <ul role="list" className={styles.lines}>
                {lines.map((line) => {
                  const label = shareLabel(line)
                  const note = [label, line.everyone ? 'everyone' : null].filter(Boolean).join(' · ')
                  return (
                    <li key={line.itemId} className={styles.line}>
                      <span className={styles.lineName}>
                        {line.name}
                        {note && (
                          <>
                            {' '}
                            <span className={styles.lineNote}>{note}</span>
                          </>
                        )}
                      </span>
                      <Money value={line.amount} currency={currency} size="sm" className={styles.lineAmount} />
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className={styles.noLines}>Nothing assigned to them.</p>
            )}
            <div className={styles.subtotals}>
              <ReceiptRow
                label="Items"
                value={<Money value={itemsSubtotal} currency={currency} size="inherit" />}
                emphasis="muted"
              />
              {adjustment > 0 && (
                <ReceiptRow
                  label="Tax & charges"
                  value={<Money value={adjustment} currency={currency} size="inherit" sign="always" />}
                  emphasis="muted"
                />
              )}
              {adjustment < 0 && (
                <ReceiptRow
                  label="Discount"
                  value={<Money value={adjustment} currency={currency} size="inherit" sign="always" tone="positive" />}
                  emphasis="muted"
                />
              )}
              <ReceiptRow
                label="Total"
                value={<Money value={total} currency={currency} size="inherit" />}
                emphasis="strong"
              />
            </div>
          </>
        )}
      </div>
    </li>
  )
}
