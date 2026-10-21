/**
 * How an expense reads in a list, from the owner's side: who paid, what it means for me, and
 * whether it's still open. Pure, so rows, filters and their tests agree to the paisa.
 */
import { ME_ID, type Expense, type Group, type Minor } from '../domain/types'
import { expenseStanding } from '../engine/balances'
import { uniqueParticipants } from '../engine/split'
import { formatMoney } from '../lib/money'

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
export function expenseRowView(e: Expense, { payerName, group, showGroup = true }: ExpenseRowViewInput): ExpenseRowView {
  const money = (minor: Minor) => formatMoney(minor, e.currency, { trimZeros: true })
  const standing = expenseStanding(e, ME_ID, group ? [group] : [])
  const people = uniqueParticipants(e.participants)
  const { net, myShare, outstanding, pending, role } = standing

  const paidPart = `${e.payerId === ME_ID ? 'You' : payerName} paid ${money(e.total)}`
  const justMe = people.length === 1 && people[0]?.friendId === ME_ID
  const context =
    showGroup && group && e.groupId === group.id ? group.name : justMe ? 'just you' : plural(people.length, 'person', 'people')
  const subtitle = `${paidPart} · ${context}`

  let side: RightSide
  if (role === 'none') {
    side = right(e.total, 'muted', "you're not in it", { caption: 'not involved' })
  } else if (outstanding === null) {
    // Settled through the group's balances: show what this expense did to mine.
    if (net > 0) side = right(net, 'positive', `you lent ${money(net)}`, { caption: 'you lent' })
    else if (net < 0) side = right(net, 'negative', `you borrowed ${money(-net)}`, { caption: 'you borrowed' })
    else side = right(e.total, 'muted', 'nothing to settle')
  } else if (role === 'paid') {
    // What I paid for others: net = Σ their shares.
    if (outstanding > 0) {
      side = right(outstanding, 'positive', `you're owed ${money(outstanding)}, ${pending} pending`, {
        status: { tone: 'warning', label: `${pending} pending` },
      })
    } else if (net > 0) {
      side = right(net, 'muted', `you got back ${money(net)}, settled`, { status: { tone: 'positive', label: 'Settled' } })
    } else {
      side = right(e.total, 'muted', 'nothing to collect')
    }
  } else if (outstanding < 0) {
    side = right(outstanding, 'negative', `you owe ${money(-outstanding)}`, { caption: 'you owe' })
  } else {
    side = right(myShare, 'muted', `you paid back ${money(myShare)}, settled`, { status: { tone: 'positive', label: 'Settled' } })
  }

  return {
    subtitle,
    amount: side.amount,
    tone: side.tone,
    caption: side.caption,
    status: side.status,
    spoken: `${subtitle}, ${side.phrase}`,
  }
}
