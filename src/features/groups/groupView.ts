/**
 * How a group reads on screen — its kind, where I stand, what it spent and on what, and its
 * story so far (expenses and recorded payments by day). Pure, so lists, the detail screen and
 * their tests agree to the paisa.
 */
import { BRAND, ME_ID, type CategoryId, type Expense, type Group, type GroupKind, type Minor, type Settlement } from '../../domain/types'
import { groupBalances, simplifyDebts, type Transfer } from '../../engine/balances'
import { formatMoney } from '../../lib/money'
import type { GroupCardInput } from '../../share'

/* ------------------------------------------------------------------ kinds */

export interface GroupKindMeta {
  kind: GroupKind
  label: string
  /** The emoji a new group of this kind starts with. */
  emoji: string
  /** Example name for the name field. */
  placeholder: string
  /** Category whose soft tint sits behind the group's emoji. */
  tint: CategoryId
}

export const GROUP_KIND_META: Readonly<Record<GroupKind, GroupKindMeta>> = {
  trip: { kind: 'trip', label: 'Trip', emoji: '✈️', placeholder: 'Goa trip', tint: 'travel' },
  home: { kind: 'home', label: 'Home', emoji: '🏠', placeholder: 'Flat 302', tint: 'rent' },
  couple: { kind: 'couple', label: 'Couple', emoji: '💑', placeholder: 'Us two', tint: 'gift' },
  event: { kind: 'event', label: 'Event', emoji: '🎉', placeholder: 'Riya’s birthday', tint: 'entertainment' },
  other: { kind: 'other', label: 'Other', emoji: '👥', placeholder: 'Office lunch crew', tint: 'other' },
}

export const GROUP_KIND_ORDER: readonly GroupKind[] = ['trip', 'home', 'couple', 'event', 'other']

export function kindMeta(kind: GroupKind): GroupKindMeta {
  return GROUP_KIND_META[kind] ?? GROUP_KIND_META.other
}

/** "Just you", "2 people", "6 people" — everyone in the group, you included. */
export function membersLabel(count: number): string {
  if (count <= 1) return 'Just you'
  return `${count} people`
}

/* ------------------------------------------------------------------ where I stand */

export interface GroupStanding {
  /** My net balance in the group's currency: + owed to me, − I owe. */
  mine: Minor
  /** What the group spent (its own currency only). */
  spent: Minor
  /** Expenses counted in `spent`. */
  expenseCount: number
  /** Nobody owes anybody (true for a brand-new group too). */
  settled: boolean
  /** The fewest payments that square everyone up. */
  transfers: Transfer[]
}

/** Expenses of `group` booked in the group's own currency (the ones its balances count). */
export function ownExpenses(group: Group, expenses: readonly Expense[]): Expense[] {
  return expenses.filter((e) => e.groupId === group.id && e.currency === group.currency)
}

/**
 * What the group spent on: its own-currency expenses without loans (cash handed over isn't
 * spending — it still counts in the balances).
 */
export function spendingExpenses(group: Group, expenses: readonly Expense[]): Expense[] {
  return ownExpenses(group, expenses).filter((e) => e.kind !== 'loan')
}

export function groupStanding(group: Group, expenses: readonly Expense[], meId: string = ME_ID): GroupStanding {
  const balances = groupBalances(group, expenses)
  const own = spendingExpenses(group, expenses)
  return {
    mine: balances[meId] ?? 0,
    spent: own.reduce((sum, e) => sum + e.total, 0),
    expenseCount: own.length,
    settled: Object.values(balances).every((v) => v === 0),
    transfers: simplifyDebts(balances),
  }
}

export type StandingTone = 'positive' | 'negative' | 'muted'

export interface StandingLabel {
  /** Small words over the amount: "you're owed", "you owe", "settled up". */
  caption: string
  tone: StandingTone
  /** The amount to show (always positive), or null when there's nothing to settle. */
  amount: Minor | null
  /** One phrase for assistive tech: "you're owed ₹540". */
  spoken: string
}

/** My side of a group (or any balance) in words. `active`: there's been money in it at all. */
export function standingLabel(mine: Minor, currency: string, active: boolean): StandingLabel {
  const money = (minor: Minor) => formatMoney(minor, currency, { trimZeros: true })
  if (mine > 0) return { caption: 'you’re owed', tone: 'positive', amount: mine, spoken: `you’re owed ${money(mine)}` }
  if (mine < 0) return { caption: 'you owe', tone: 'negative', amount: -mine, spoken: `you owe ${money(-mine)}` }
  const caption = active ? 'settled up' : 'no expenses yet'
  return { caption, tone: 'muted', amount: null, spoken: caption }
}

/** Totals across groups, per currency: what I'm owed and what I owe (each group's net counted once). */
export function acrossGroups(standings: ReadonlyArray<{ group: Group; standing: GroupStanding }>): Record<string, { owedToMe: Minor; iOwe: Minor }> {
  const out: Record<string, { owedToMe: Minor; iOwe: Minor }> = {}
  for (const { group, standing } of standings) {
    if (standing.mine === 0) continue
    const slot = (out[group.currency] ??= { owedToMe: 0, iOwe: 0 })
    if (standing.mine > 0) slot.owedToMe += standing.mine
    else slot.iOwe -= standing.mine
  }
  return out
}

/* ------------------------------------------------------------------ totals */

export interface GroupTotals {
  currency: string
  spent: Minor
  count: number
  /** Biggest first. */
  byCategory: Array<{ category: CategoryId; amount: Minor; count: number }>
  /** Everyone with money in the group: what they paid and what their share came to. Members first, biggest share first. */
  people: Array<{ friendId: string; paid: Minor; share: Minor }>
  /** Expenses filed in this group in another currency (settled person to person, not counted here). */
  elsewhere: number
}

export function groupTotals(group: Group, expenses: readonly Expense[]): GroupTotals {
  const own = spendingExpenses(group, expenses)
  const categories = new Map<CategoryId, { amount: Minor; count: number }>()
  const paid = new Map<string, Minor>()
  const share = new Map<string, Minor>()
  for (const e of own) {
    const slot = categories.get(e.category) ?? { amount: 0, count: 0 }
    categories.set(e.category, { amount: slot.amount + e.total, count: slot.count + 1 })
    paid.set(e.payerId, (paid.get(e.payerId) ?? 0) + e.total)
    for (const [id, amount] of Object.entries(e.shares)) share.set(id, (share.get(id) ?? 0) + amount)
  }

  const ids = [...group.memberIds]
  for (const id of [...paid.keys(), ...share.keys()]) if (!ids.includes(id)) ids.push(id)
  const members = new Set(group.memberIds)
  const people = ids
    .map((friendId) => ({ friendId, paid: paid.get(friendId) ?? 0, share: share.get(friendId) ?? 0 }))
    .filter((p) => members.has(p.friendId) || p.paid > 0 || p.share > 0)
    .sort((a, b) => b.share - a.share || b.paid - a.paid || ids.indexOf(a.friendId) - ids.indexOf(b.friendId))

  return {
    currency: group.currency,
    spent: own.reduce((sum, e) => sum + e.total, 0),
    count: own.length,
    byCategory: [...categories.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.amount - a.amount || (a.category < b.category ? -1 : 1)),
    people,
    elsewhere: expenses.filter((e) => e.groupId === group.id && e.currency !== group.currency).length,
  }
}

/* ------------------------------------------------------------------ timeline */

export type TimelineEntry =
  | { kind: 'expense'; id: string; date: string; at: number; expense: Expense }
  | { kind: 'payment'; id: string; date: string; at: number; settlement: Settlement }

export interface TimelineDay {
  date: string
  entries: TimelineEntry[]
}

/** The group's expenses and recorded payments, newest day first (newest first within a day). */
export function groupTimeline(group: Group, expenses: readonly Expense[]): TimelineDay[] {
  const entries: TimelineEntry[] = [
    ...expenses
      .filter((e) => e.groupId === group.id)
      .map((expense): TimelineEntry => ({ kind: 'expense', id: expense.id, date: expense.date, at: expense.createdAt, expense })),
    ...group.settlements.map(
      (settlement): TimelineEntry => ({ kind: 'payment', id: settlement.id, date: settlement.date, at: settlement.createdAt, settlement }),
    ),
  ]
  entries.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : b.at - a.at || (a.id < b.id ? -1 : 1)))
  const days: TimelineDay[] = []
  for (const entry of entries) {
    const last = days[days.length - 1]
    if (last && last.date === entry.date) last.entries.push(entry)
    else days.push({ date: entry.date, entries: [entry] })
  }
  return days
}

/** Entries across all `days`. */
export function timelineSize(days: readonly TimelineDay[]): number {
  return days.reduce((sum, day) => sum + day.entries.length, 0)
}

/**
 * The first `limit` entries of a timeline, still by day: whole days come back as they are (so
 * their rows can skip re-rendering), and the day the limit falls in is cut short.
 */
export function timelineHead(days: readonly TimelineDay[], limit: number): TimelineDay[] {
  const out: TimelineDay[] = []
  const whole = Math.floor(limit)
  let left = whole > 0 ? whole : 0
  for (const day of days) {
    if (left === 0) break
    if (day.entries.length <= left) {
      out.push(day)
      left -= day.entries.length
    } else {
      out.push({ date: day.date, entries: day.entries.slice(0, left) })
      left = 0
    }
  }
  return out
}

/* ------------------------------------------------------------------ payments */

export const METHOD_LABELS: Readonly<Record<Settlement['method'], string>> = {
  upi: 'UPI',
  cash: 'Cash',
  other: 'Other',
}

/**
 * "Riya paid you", "You paid Riya", "Sam paid Riya". `fromName`/`toName` are the names as the
 * owner knows them (the owner's own name is never used — they're "you").
 */
export function paymentSentence(fromId: string, toId: string, fromName: string, toName: string, tense: 'past' | 'present' = 'past'): string {
  const verb = tense === 'past' ? 'paid' : 'pays'
  if (fromId === ME_ID) return `You ${tense === 'past' ? 'paid' : 'pay'} ${toName}`
  if (toId === ME_ID) return `${fromName} ${verb} you`
  return `${fromName} ${verb} ${toName}`
}

/* ------------------------------------------------------------------ sharing */

/**
 * The plain-text version of the group card, for the group chat:
 *
 * ```
 * 🏖️ Goa 2026
 * ₹48,000 spent · 14 expenses · 6 people
 *
 * To settle up:
 * Sam pays Riya ₹800
 * Ayush pays Riya ₹300
 *
 * — split with Settle
 * ```
 */
export function groupSummaryText(input: GroupCardInput): string {
  const money = (minor: Minor) => formatMoney(minor, input.currency, { trimZeros: true })
  const expenses = `${input.expenseCount} ${input.expenseCount === 1 ? 'expense' : 'expenses'}`
  const people = `${input.memberCount} ${input.memberCount === 1 ? 'person' : 'people'}`
  const lines = [`${input.emoji} ${input.name}`.trim(), `${money(input.total)} spent · ${expenses} · ${people}`, '']
  if (input.transfers.length === 0) {
    lines.push(input.expenseCount > 0 ? 'Everyone’s settled up ✓' : 'Nothing to settle yet.')
  } else {
    lines.push('To settle up:')
    for (const t of input.transfers) lines.push(`${t.from.name} pays ${t.to.name} ${money(t.amount)}`)
  }
  lines.push('', `— split with ${BRAND.name}`)
  return lines.join('\n')
}
