/**
 * How an expense reads in a list, from the owner's side: who paid, what it means for me, and
 * whether it's still open. Pure, so rows, filters and their tests agree to the paisa.
 */
import { memoizeLast } from '../data/store'
import { friendsStore } from '../data/stores'
import { ME_ID, type Expense, type Friend, type Group, type Minor } from '../domain/types'
import { t } from '../i18n'
import { expenseStanding } from '../engine/balances'
import { uniqueParticipants } from '../engine/split'
import { currencyDigits, formatMoney } from '../lib/money'
import { friendLabel } from './friendName'

/** "1 person", "4 people", "2 pending" — `many` defaults to `one` + "s". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}

/**
 * Everyone in a split, in order: the payer, the participants, then anyone else holding a share
 * (round-to-whole can give the payer a share without them being a participant).
 */
export function splitPeopleIds(e: Pick<Expense, 'participants' | 'shares' | 'payerId'>): string[] {
  const ids: string[] = []
  const payerIn = e.participants.some((p) => p.friendId === e.payerId) || Object.hasOwn(e.shares, e.payerId)
  if (payerIn) ids.push(e.payerId)
  for (const p of uniqueParticipants(e.participants)) if (!ids.includes(p.friendId)) ids.push(p.friendId)
  for (const id of Object.keys(e.shares)) if (!ids.includes(id)) ids.push(id)
  return ids
}

export type RowTone = 'positive' | 'negative' | 'muted'

export interface RowStatus {
  tone: 'positive' | 'warning'
  label: string
}

export interface ExpenseRowView {
  /** "You paid ₹2,766 · 4 people", "Riya paid ₹2,766 · Goa 2026". */
  subtitle: string
  /** The amount on the right: signed (+ owed to me, − I owe) unless `tone` is muted. */
  amount: Minor
  tone: RowTone
  /** Small words under the amount ("you owe", "you lent"); null when a status pill says it. */
  caption: string | null
  /** "Settled" / "2 pending", or null. */
  status: RowStatus | null
  /** The subtitle and the right side as one phrase, for the row's accessible name. */
  spoken: string
}

export interface ExpenseRowViewInput {
  /** The payer as the owner knows them (only used when someone else paid). */
  payerName: string
  /** The expense's group, when it still exists. */
  group: Group | null
  /** Name the group instead of counting people (default true). */
  showGroup?: boolean
  /**
   * The other person's name in a 1:1 entry ("You lent Riya", "You paid for Riya"). Defaults to
   * their name in your people (or "Someone" when they're gone).
   */
  otherName?: string
}

/** Your people by id (rebuilt only when the list changes), for naming the other side of a 1:1 entry. */
const friendIndex = memoizeLast((friends: readonly Friend[]): ReadonlyMap<string, Friend> => new Map(friends.map((f) => [f.id, f])))

/** The one participant of a 1:1 entry (one person who isn't the payer), or null. */
export function oneToOneOther(e: Pick<Expense, 'participants' | 'payerId'>): string | null {
  const people = uniqueParticipants(e.participants)
  const only = people.length === 1 ? people[0]?.friendId : undefined
  return only !== undefined && only !== e.payerId ? only : null
}

/**
 * A converted amount for a list: whole units from 100 up (₹3,013 for ₹3,013.44), exact below
 * (₹99.50) — the exact figure is on the expense page.
 */
function roughMoney(minor: Minor, currency: string): string {
  const unit = 10 ** currencyDigits(currency)
  const whole = minor >= 100 * unit ? Math.round(minor / unit) * unit : minor
  return formatMoney(whole, currency, { trimZeros: true })
}

interface RightSide {
  amount: Minor
  tone: RowTone
  caption: string | null
  status: RowStatus | null
  phrase: string
}

const right = (amount: Minor, tone: RowTone, phrase: string, extra: Partial<Pick<RightSide, 'caption' | 'status'>> = {}): RightSide => ({
  amount,
  tone,
  phrase,
  caption: extra.caption ?? null,
  status: extra.status ?? null,
})

/** The row's words and numbers for `e` (see `ExpenseRowView`). */
export function expenseRowView(e: Expense, { payerName, group, showGroup = true, otherName }: ExpenseRowViewInput): ExpenseRowView {
  const money = (minor: Minor) => formatMoney(minor, e.currency, { trimZeros: true })
  const standing = expenseStanding(e, ME_ID, group ? [group] : [])
  const people = uniqueParticipants(e.participants)
  const { net, myShare, outstanding, pending, role } = standing

  const payerIsMe = e.payerId === ME_ID
  const groupName = showGroup && group && e.groupId === group.id ? group.name : null
  const otherId = oneToOneOther(e)
  let subtitle: string
  if (otherId !== null) {
    // 1:1: "You lent Riya · cash", "Kabir lent you · cash", "You paid for Riya · Auto".
    const other = otherId === ME_ID ? null : (otherName ?? friendLabel(otherId, friendIndex(friendsStore.get()).get(otherId)))
    if (e.kind === 'loan') {
      subtitle = payerIsMe
        ? t('kit.row.loan.mine', { name: other ?? '' })
        : other === null
          ? t('kit.row.loan.toMe', { name: payerName })
          : t('kit.row.loan.others', { payer: payerName, name: other })
    } else {
      const context = groupName ?? e.title
      subtitle = payerIsMe
        ? t('kit.row.paidFor.mine', { name: other ?? '', context })
        : other === null
          ? t('kit.row.paidFor.toMe', { name: payerName, context })
          : t('kit.row.paidFor.others', { payer: payerName, name: other, context })
    }
  } else {
    // Paid abroad: "You paid ฿1,250 (₹3,013)".
    const paid = e.fx ? `${formatMoney(e.fx.amount, e.fx.currency, { trimZeros: true })} (${roughMoney(e.total, e.currency)})` : money(e.total)
    const justMe = people.length === 1 && people[0]?.friendId === ME_ID
    const context = groupName ?? (justMe ? t('kit.row.context.justYou') : t('kit.row.context.people', { count: people.length }))
    subtitle = payerIsMe ? t('kit.row.paid.mine', { amount: paid, context }) : t('kit.row.paid.others', { payer: payerName, amount: paid, context })
  }

  let side: RightSide
  if (role === 'none') {
    side = right(e.total, 'muted', t('kit.row.notIn'), { caption: t('kit.row.notIn.caption') })
  } else if (outstanding === null) {
    // Settled through the group's balances: show what this expense did to mine.
    if (net > 0) side = right(net, 'positive', t('kit.row.lent', { amount: money(net) }), { caption: t('kit.row.lent.caption') })
    else if (net < 0) side = right(net, 'negative', t('kit.row.borrowed', { amount: money(-net) }), { caption: t('kit.row.borrowed.caption') })
    else side = right(e.total, 'muted', t('kit.row.nothingToSettle'))
  } else if (role === 'paid') {
    // What I paid for others: net = Σ their shares.
    if (outstanding > 0) {
      side = right(outstanding, 'positive', t('kit.row.owed', { amount: money(outstanding), count: pending }), {
        status: { tone: 'warning', label: t('kit.row.pending', { count: pending }) },
      })
    } else if (net > 0) {
      side = right(net, 'muted', t('kit.row.gotBack', { amount: money(net) }), { status: { tone: 'positive', label: t('kit.row.settled') } })
    } else {
      side = right(e.total, 'muted', t('kit.row.nothingToCollect'))
    }
  } else if (outstanding < 0) {
    side = right(outstanding, 'negative', t('kit.row.owe', { amount: money(-outstanding) }), { caption: t('kit.row.owe.caption') })
  } else {
    side = right(myShare, 'muted', t('kit.row.paidBack', { amount: money(myShare) }), { status: { tone: 'positive', label: t('kit.row.settled') } })
  }

  return {
    subtitle,
    amount: side.amount,
    tone: side.tone,
    caption: side.caption,
    status: side.status,
    spoken: t('kit.row.spoken', { subtitle, phrase: side.phrase }),
  }
}
