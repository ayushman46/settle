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
import { t, tx, useT } from '../../i18n'
import { ExpenseError, saveExpense, useFriendsById, useProfile, type ExpenseDraft } from '../../data'
import { ME_ID, type Expense } from '../../domain/types'
import { today } from '../../engine/dates'
import { CategoryPicker, DateField, FriendAvatar, friendLabel, friendObjectLabel, PayerPicker } from '../../kit/index-a'
import { formatBillDate, formatPercent } from '../../lib/format'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { currencyDigits, formatMoney } from '../../lib/money'
import { shareLabel, type PersonSplit, type SplitResult } from '../../lib/split'
import { useBackClose } from '../../state/backStack'
import { reducer } from '../../state/reducer'
import { billCategory, billDate, stepProgress, suggestedCategory } from '../../state/selectors'
import { useFlow, useSession, useSplit } from '../../state/store'
import type { Session } from '../../types'
import { billExpenseDraft, billPayer, payerCandidates } from './billExpense'
import { DELIVERY_ENABLED } from './delivery.enabled'
import { personFeeLines } from './feeView'
import { linkToFriends } from './billPeople'
import { countUp, useEntranceProgress } from './entranceMotion'
import { GroupPicker } from './GroupPicker'
import { MerchantSheet } from './MerchantSheet'
import { TINY_RATE } from './screenUtils'
import styles from './ResultScreen.module.css'

/** The receipt's "what's on top of the items" line, or null when paid equals the items. */
function adjustmentLine(split: SplitResult, currency: string): string | null {
  const { adjustment } = split
  if (adjustment === 0) return null
  const abs = Math.abs(adjustment)
  const amount = formatMoney(abs, currency)
  // Up to one whole rupee/dollar/…: that's the bill being rounded, not tax or a discount.
  if (abs <= 10 ** currencyDigits(currency)) return t('bill.result.adjust.roundOff', { amount })
  const charges = adjustment > 0
  if (split.itemsTotal <= 0) return t(charges ? 'bill.result.adjust.charges' : 'bill.result.adjust.discounts')
  const rate = Math.abs(split.adjustmentRate)
  // "+0%" says nothing; the amount does.
  if (rate < TINY_RATE) return t(charges ? 'bill.result.adjust.charges.amount' : 'bill.result.adjust.discounts.amount', { amount })
  return t(charges ? 'bill.result.adjust.charges.percent' : 'bill.result.adjust.discounts.percent', { percent: formatPercent(rate) })
}

/** The success moment's line: what happens to the money now. */
function outcomeLine(split: SplitResult, payerId: string, payerName: string, currency: string): string {
  const money = (minor: number) => formatMoney(minor, currency)
  const payerShare = split.people.find((p) => p.person.id === payerId)?.total ?? 0
  const getsBack = split.paid - payerShare
  const owing = split.people.filter((p) => p.person.id !== payerId && p.total > 0).length
  if (payerId === ME_ID) {
    return getsBack > 0 ? t('bill.result.outcome.getBack', { amount: money(getsBack), count: owing }) : t('bill.result.outcome.nobody')
  }
  const mine = split.people.find((p) => p.person.id === ME_ID)?.total ?? 0
  if (mine > 0) return t('bill.result.outcome.owe', { name: payerName, amount: money(mine) })
  return t('bill.result.outcome.getsBack', { name: payerName, amount: money(getsBack) })
}

/**
 * "Here's the split" — the last step: the receipt with everyone's share, who paid, what it was
 * for and when, then "Save split" saves it as an expense and opens it (pay links, who's paid).
 */
export function ResultScreen() {
  const t = useT()
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
  /** The expense just saved, and whether that updated one saved before (for the success moment's words). */
  const [saved, setSaved] = useState<{ expense: Expense; updated: boolean } | null>(null)
  const saving = useRef(false)
  const opened = useRef(false)

  const day = today()
  // A bill that is already saved (re-opened to fix, or saved and come back to): saving updates it.
  const updating = session.expenseId !== null
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
      setSaved({ expense, updated: updating })
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
    flow.finish(`/app/expense/${saved.expense.id}`)
  }

  // Back during the success moment just finishes it (the expense is already saved).
  useBackClose(saved !== null, open)

  const shownDate = formatBillDate(date)
  const adds = split.check === split.paid
  const unassigned = split.unassignedItemIds.length
  const adjustment = adjustmentLine(split, currency)
  // A delivery order: everyone's fees get their own line, and nobody who didn't order pays.
  const withFees = DELIVERY_ENABLED && split.fees > 0

  const header = <TopBar onBack={flow.back} progress={stepProgress('result') ?? undefined} />

  if (people.length === 0) {
    return (
      <Screen header={header}>
        <PageTitle title={t('bill.result.title')} />
        <EmptyState
          icon={<UsersRound />}
          title={t('bill.result.noPeople.title')}
          text={t('bill.result.noPeople.body')}
          action={
            <Button size="md" onClick={() => flow.goTo('people')}>
              {t('bill.result.noPeople.cta')}
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
        <ActionBar hint={adds ? t('bill.result.next.hint') : undefined}>
          <Button block iconStart={<CircleCheck />} disabled={!adds} onClick={save}>
            {t(updating ? 'bill.result.saveChanges.cta' : 'bill.result.save.cta')}
          </Button>
        </ActionBar>
      }
    >
      <PageTitle
        title={t('bill.result.title')}
        subtitle={t(updating ? 'bill.result.updating.subtitle' : 'bill.result.subtitle')}
      />

      {unassigned > 0 && (
        <Banner tone="info" action={{ label: t('bill.result.unassigned.cta'), onAction: () => flow.goTo('assign') }}>
          {t('bill.result.unassigned.body', { count: unassigned })}
        </Banner>
      )}

      {!adds && (
        <Banner tone="error" title={t('bill.result.mismatch.title')}>
          {t('bill.result.mismatch.body')}
        </Banner>
      )}

      <Receipt padding="lg" className={styles.receipt}>
        <div className={styles.receiptHead}>
          <button
            type="button"
            className={styles.merchantButton}
            aria-haspopup="dialog"
            aria-label={meta.merchant ? t('bill.name.rename.aria', { name: meta.merchant }) : t('bill.name.empty')}
            onClick={() => setNameSheet((n) => ({ key: n.key + 1, open: true }))}
          >
            <span className={styles.merchant}>{meta.merchant ?? t('bill.name.empty')}</span>
            <Pencil aria-hidden="true" className={styles.merchantIcon} strokeWidth={2.25} />
          </button>
          {shownDate && <p className={styles.date}>{shownDate}</p>}
        </div>

        <div className={styles.totalBlock}>
          <p className={styles.totalLabel}>{t('bill.result.totalPaid')}</p>
          <Money
            value={countUp(split.paid, progress)}
            fitValue={split.paid}
            currency={currency}
            size="xl"
            className={styles.total}
          />
          <p className={styles.meta}>
            {t('bill.result.meta', { people: people.length, items: items.length })}
          </p>
          {adjustment && <p className={styles.adjustment}>{adjustment}</p>}
        </div>

        <Receipt.Divider />

        <ul role="list" className={styles.people} aria-label={t('bill.result.people.aria')}>
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
              withFees={withFees}
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
                {tx('bill.result.addsUpTo', { amount: formatMoney(split.paid, currency) }, {
                  m: () => <Money value={split.paid} currency={currency} size="inherit" strong />,
                })}
              </span>
            </p>
          </>
        )}
      </Receipt>

      <section className={styles.choices} aria-label={t('bill.result.details.aria')}>
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
          label={t('bill.result.category.label')}
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
          title={t(saved.updated ? 'bill.result.changesSaved.title' : 'bill.result.saved.title')}
          amount={<Money value={saved.expense.total} currency={saved.expense.currency} size="xl" />}
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
  /** The bill has delivery fees: show "Fees" and "Tax, charges & offers" lines. */
  withFees: boolean
  expanded: boolean
  onToggle: () => void
}

/** One person on the receipt: their total, what they owe the payer, and (expanded) their items. */
function PersonRow({ split, index, currency, progress, payerId, payerObject, paid, withFees, expanded, onToggle }: PersonRowProps) {
  const { person, lines, itemsSubtotal, adjustment, total } = split
  const t = useT()
  const detailsId = useId()
  const isPayer = person.id === payerId
  const feeLines = withFees ? personFeeLines(split) : null

  const money = (minor: number) => formatMoney(minor, currency)
  const status = isPayer
    ? t('bill.result.person.payer', { paid: money(paid), amount: money(paid - total) })
    : total > 0
      ? t('bill.result.person.owes', { name: payerObject, amount: money(total) })
      : feeLines?.none
        ? t('delivery.result.none', { amount: formatMoney(0, currency, { trimZeros: true }) })
        : t('bill.result.person.nothing')

  return (
    <li className={styles.person} style={{ '--i': index } as CSSProperties}>
      <button
        type="button"
        className={styles.personHead}
        aria-expanded={expanded}
        aria-controls={detailsId}
        aria-label={t('bill.result.person.aria', { name: person.name, amount: money(total), status })}
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
                {t('bill.result.person.paid')}
              </span>
            )}
          </span>
          <span className={styles.personTotal} data-final={money(total)}>
            <Money value={countUp(total, progress)} currency={currency} size="inherit" strong />
          </span>
        </span>
        <ChevronDown aria-hidden="true" className={styles.chevron} strokeWidth={2.25} />
        <span className={cx(styles.personStatus, feeLines?.none && !isPayer && styles.personNone)}>{status}</span>
      </button>

      <div id={detailsId} className={styles.details} hidden={!expanded}>
        {expanded && (
          <>
            {lines.length > 0 ? (
              <ul role="list" className={styles.lines}>
                {lines.map((line) => {
                  const label = shareLabel(line)
                  const note = [label, line.everyone ? t('bill.result.person.everyone') : null].filter(Boolean).join(' · ')
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
              <p className={styles.noLines}>{t('bill.result.person.noLines')}</p>
            )}
            {feeLines ? (
              <div className={styles.subtotals}>
                <ReceiptRow
                  label={t('bill.result.person.items')}
                  value={<Money value={itemsSubtotal} currency={currency} size="inherit" />}
                  emphasis="muted"
                />
                {feeLines.fees > 0 && (
                  <ReceiptRow
                    label={t('delivery.result.fees')}
                    value={<Money value={feeLines.fees} currency={currency} size="inherit" sign="always" />}
                    emphasis="muted"
                  />
                )}
                {feeLines.other !== 0 && (
                  <ReceiptRow
                    label={t('delivery.result.other')}
                    value={
                      <Money
                        value={feeLines.other}
                        currency={currency}
                        size="inherit"
                        sign="always"
                        tone={feeLines.other < 0 ? 'positive' : 'default'}
                      />
                    }
                    emphasis="muted"
                  />
                )}
                <ReceiptRow
                  label={t('delivery.result.total')}
                  value={<Money value={total} currency={currency} size="inherit" />}
                  emphasis="strong"
                />
              </div>
            ) : (
            <div className={styles.subtotals}>
              <ReceiptRow
                label={t('bill.result.person.items')}
                value={<Money value={itemsSubtotal} currency={currency} size="inherit" />}
                emphasis="muted"
              />
              {adjustment > 0 && (
                <ReceiptRow
                  label={t('bill.result.person.charges')}
                  value={<Money value={adjustment} currency={currency} size="inherit" sign="always" />}
                  emphasis="muted"
                />
              )}
              {adjustment < 0 && (
                <ReceiptRow
                  label={t('bill.result.person.discount')}
                  value={<Money value={adjustment} currency={currency} size="inherit" sign="always" tone="positive" />}
                  emphasis="muted"
                />
              )}
              <ReceiptRow
                label={t('bill.result.person.total')}
                value={<Money value={total} currency={currency} size="inherit" />}
                emphasis="strong"
              />
            </div>
            )}
          </>
        )}
      </div>
    </li>
  )
}
