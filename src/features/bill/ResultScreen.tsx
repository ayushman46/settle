import { useId, useRef, useState, type CSSProperties } from 'react'
import { ChevronDown, CircleCheck, Pencil, UsersRound } from 'lucide-react'
import {
  ActionBar,
  Banner,
  Button,
  EmptyState,
  Money,
  PageTitle,
  ReceiptRow,
  Receipt,
  Screen,
  SuccessBurst,
  TopBar,
  useToast,
} from '../../components'
import { ExpenseError, saveExpense, useFriendsById, useProfile, type ExpenseDraft } from '../../data'
import { ME_ID, type Expense } from '../../domain/types'
import { today } from '../../engine/dates'
import { CategoryPicker, DateField, FriendAvatar, friendLabel, friendObjectLabel, PayerPicker } from '../../kit/index-a'
import { formatBillDate, formatPercent } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { currencyDigits, formatMoney } from '../../lib/money'
import { shareLabel, type PersonSplit, type SplitResult } from '../../lib/split'
import { useBackClose } from '../../state/backStack'
import { reducer } from '../../state/reducer'
import { billCategory, billDate, stepProgress, suggestedCategory } from '../../state/selectors'
import { useFlow, useSession, useSplit } from '../../state/store'
import type { Session } from '../../types'
import { billExpenseDraft, billPayer, payerCandidates } from './billExpense'
import { linkToFriends } from './billPeople'
import { countUp, useEntranceProgress } from './entranceMotion'
import { GroupPicker } from './GroupPicker'
import { MerchantSheet } from './MerchantSheet'
import { plural, TINY_RATE } from './screenUtils'
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

/** The success moment's line: what happens to the money now. */
function outcomeLine(split: SplitResult, payerId: string, payerName: string, currency: string): string {
  const money = (minor: number) => formatMoney(minor, currency)
  const payerShare = split.people.find((p) => p.person.id === payerId)?.total ?? 0
  const getsBack = split.paid - payerShare
  const owing = split.people.filter((p) => p.person.id !== payerId && p.total > 0).length
  if (payerId === ME_ID) {
    return getsBack > 0 ? `You get back ${money(getsBack)} from ${plural(owing, 'person', 'people')}` : 'Nobody owes anything'
  }
  const mine = split.people.find((p) => p.person.id === ME_ID)?.total ?? 0
  if (mine > 0) return `You owe ${payerName} ${money(mine)}`
  return `${payerName} gets back ${money(getsBack)}`
}

/**
 * "Here's the split" — the last step: the receipt with everyone's share, who paid, what it was
 * for and when, then "Save split" saves it as an expense and opens it (pay links, who's paid).
 */
export function ResultScreen() {
  const { session, dispatch } = useSession()
  const split = useSplit()
  const flow = useFlow()
  const toast = useToast()
  const friendsById = useFriendsById()
  const profile = useProfile()
  const { currency, meta, items, people } = session

  const progress = useEntranceProgress()
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const [nameSheet, setNameSheet] = useState({ key: 0, open: false })
  const [saved, setSaved] = useState<Expense | null>(null)
  const saving = useRef(false)
  const opened = useRef(false)

  const day = today()
  const payerId = billPayer(session)
  const payerName = friendLabel(payerId, friendsById[payerId] ?? null)
  const category = billCategory(session)
  const date = billDate(session, day)

  const toggle = (personId: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(personId)) next.delete(personId)
      else next.add(personId)
      return next
    })
  }

  const save = () => {
    if (saving.current) return
    saving.current = true
    // Everyone on the bill must be one of your people before it's saved (they normally are already).
    let current: Session = session
    const links = linkToFriends(session.people, friendsById, profile.name)
    if (Object.keys(links).length > 0) {
      current = reducer(session, { type: 'linkPeople', links })
      dispatch({ type: 'linkPeople', links })
    }
    const draft: ExpenseDraft = billExpenseDraft(current, today())
    try {
      const expense = saveExpense(draft)
      // Going back now and saving again updates this expense rather than adding another.
      dispatch({ type: 'setExpenseId', expenseId: expense.id })
      setSaved(expense)
    } catch (error) {
      saving.current = false
      if (!(error instanceof ExpenseError)) throw error
      haptic('error')
      toast(error.message, { tone: 'error' })
    }
  }

  const open = () => {
    if (!saved || opened.current) return
    opened.current = true
    flow.finish(`/app/expense/${saved.id}`)
  }

  // Back during the success moment just finishes it (the expense is already saved).
  useBackClose(saved !== null, open)

  const shownDate = formatBillDate(date)
  const adds = split.check === split.paid
  const unassigned = split.unassignedItemIds.length
  const adjustment = adjustmentLine(split, currency)

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
        <ActionBar hint={adds ? 'Next: share a pay link and see who has paid' : undefined}>
          <Button block iconStart={<CircleCheck />} disabled={!adds} onClick={save}>
            Save split
          </Button>
        </ActionBar>
      }
    >
      <PageTitle title="Here's the split" subtitle="Check it, say who paid, and save." />

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
          <button
            type="button"
            className={styles.merchantButton}
            aria-haspopup="dialog"
            aria-label={meta.merchant ? `Rename bill, ${meta.merchant}` : 'Name this bill'}
            onClick={() => setNameSheet((n) => ({ key: n.key + 1, open: true }))}
          >
            <span className={styles.merchant}>{meta.merchant ?? 'Name this bill'}</span>
            <Pencil aria-hidden="true" className={styles.merchantIcon} strokeWidth={2.25} />
          </button>
          {shownDate && <p className={styles.date}>{shownDate}</p>}
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
              payerId={payerId}
              payerObject={friendObjectLabel(payerId, friendsById[payerId] ?? null)}
              paid={split.paid}
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

      <section className={styles.choices} aria-label="Details">
        <div className={styles.chips}>
          <PayerPicker
            value={payerId}
            candidates={payerCandidates(session)}
            onChange={(id) => dispatch({ type: 'setPayer', personId: id })}
          />
          <DateField value={date} onChange={(value) => dispatch({ type: 'setDate', date: value })} />
          <GroupPicker value={session.groupId} onChange={(groupId) => dispatch({ type: 'setGroup', groupId })} />
        </div>
        <CategoryPicker
          value={category}
          suggested={session.category === null ? suggestedCategory(session) : null}
          onChange={(value) => dispatch({ type: 'setCategory', category: value })}
          label="What was it for?"
        />
      </section>

      <MerchantSheet
        key={`name-${nameSheet.key}`}
        open={nameSheet.open}
        merchant={meta.merchant}
        onClose={() => setNameSheet((n) => ({ ...n, open: false }))}
        onSave={(name) => {
          dispatch({ type: 'setMerchant', merchant: name })
          setNameSheet((n) => ({ ...n, open: false }))
        }}
      />

      {saved && (
        <SuccessBurst
          title="Split saved"
          amount={<Money value={saved.total} currency={saved.currency} size="xl" />}
          subtitle={outcomeLine(split, payerId, payerName, currency)}
          onDone={open}
        />
      )}
    </Screen>
  )
}

interface PersonRowProps {
  split: PersonSplit
  index: number
  currency: string
  /** Entrance count-up progress (0..1). */
  progress: number
  payerId: string
  /** The payer as the object of a phrase ("owes you", "owes Riya"). */
  payerObject: string
  /** What was paid for the whole bill. */
  paid: number
  expanded: boolean
  onToggle: () => void
}

/** One person on the receipt: their total, what they owe the payer, and (expanded) their items. */
function PersonRow({ split, index, currency, progress, payerId, payerObject, paid, expanded, onToggle }: PersonRowProps) {
  const { person, lines, itemsSubtotal, adjustment, total } = split
  const detailsId = useId()
  const isPayer = person.id === payerId

  const money = (minor: number) => formatMoney(minor, currency)
  const status = isPayer
    ? `paid ${money(paid)} · gets back ${money(paid - total)}`
    : total > 0
      ? `owes ${payerObject} ${money(total)}`
      : 'owes nothing'

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
        <FriendAvatar friendId={person.id} size="md" className={styles.personAvatar} />
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
