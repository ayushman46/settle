/**
 * Who was there when: pure maths, no stores, no clock.
 *
 * - "Came late, left early": expenses dated outside someone's stay that still split with them, and
 *   which of those can be fixed safely in one tap (an equal or shares split: taking them out is
 *   unambiguous) or need a person to look (any other split, an itemised bill, someone who has
 *   already paid their part back, or the only person on it).
 * - "Split by nights": each person's nights on the trip, as whole-number weights for a stay.
 *
 * Only the people on an expense change: the payer can be away and still be the payer (they booked
 * it online). Loans are never touched.
 */
import type { Expense, Group, Participant } from '../../domain/types'
import { daysBetween, isIsoDate } from '../../engine/dates'
import { splitAmount } from '../../engine/split'

/** When someone was there, both days inclusive. Null = from the start / to the end. */
export interface Stay {
  from: string | null
  to: string | null
}

/** One group's stays: friend id → stay. */
export type Stays = Readonly<Record<string, Stay>>

/** A stay that says something: at least one real date, and `from` not after `to`. */
export function usableStay(stay: Stay | null | undefined): Stay | null {
  if (!stay) return null
  const from = isIsoDate(stay.from) ? stay.from : null
  const to = isIsoDate(stay.to) ? stay.to : null
  if (from === null && to === null) return null
  if (from !== null && to !== null && from > to) return null
  return { from, to }
}

/** Whether `date` falls outside the stay ('before' it began, 'after' it ended) or inside (null). */
export function outsideStay(stay: Stay | null | undefined, date: string): 'before' | 'after' | null {
  const s = usableStay(stay)
  if (!s || !isIsoDate(date)) return null
  if (s.from !== null && date < s.from) return 'before'
  if (s.to !== null && date > s.to) return 'after'
  return null
}

/** Why a fix-up needs doing by hand. */
export type ByHandReason = 'paid' | 'bill' | 'mode' | 'last'

export interface ByHand {
  expense: Expense
  reason: ByHandReason
}

/** One person's fix-ups in a group. */
export interface PersonFixUps {
  friendId: string
  stay: Stay
  /** Expenses they can be taken off in one tap (newest first). */
  safe: Expense[]
  /** Expenses to fix by hand, with why (newest first). */
  byHand: ByHand[]
  /** Whether the expenses are all before they came, all after they left, or some of each. */
  side: 'before' | 'after' | 'both'
}

/** The key "Leave them" remembers a single fix-up by. */
export function fixUpKey(expenseId: string, friendId: string): string {
  return `${expenseId}|${friendId}`
}

const weight = (p: Participant): number => (p.input === null ? 1 : Number.isFinite(p.input) && p.input > 0 ? p.input : 0)

/** Why taking `friendId` off `e` can't be done in one tap, or null when it can. */
function byHandReason(e: Expense, friendId: string): ByHandReason | null {
  if (e.paidBack[friendId] !== undefined || (e.partPaid?.[friendId] ?? 0) > 0) return 'paid'
  if (e.kind === 'bill' || e.mode === 'items') return 'bill'
  if (e.mode !== 'equal' && e.mode !== 'shares') return 'mode'
  const left = e.participants.filter((p) => p.friendId !== friendId)
  if (left.length === 0) return 'last'
  if (e.mode === 'shares' && !left.some((p) => weight(p) > 0)) return 'last'
  return null
}

/**
 * Every member with expenses outside their stay that still include them. People are in name order
 * (ids differ per phone; names don't), expenses newest first. `declined` holds `fixUpKey`s the user
 * said to leave. Archived groups, loans, other groups' expenses and removed members are ignored.
 */
export function presenceFixUps(input: {
  group: Group
  expenses: readonly Expense[]
  stays: Stays
  declined?: readonly string[]
  nameOf: (id: string) => string
}): PersonFixUps[] {
  const { group, expenses, stays, nameOf } = input
  if (group.archived) return []
  const declined = new Set(input.declined ?? [])
  const mine = expenses
    .filter((e) => e.groupId === group.id && e.kind !== 'loan' && isIsoDate(e.date))
    .slice()
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
  const out: PersonFixUps[] = []
  for (const friendId of group.memberIds) {
    const stay = usableStay(stays[friendId])
    if (!stay) continue
    const safe: Expense[] = []
    const byHand: ByHand[] = []
    const sides = new Set<'before' | 'after'>()
    for (const e of mine) {
      if (!e.participants.some((p) => p.friendId === friendId)) continue
      const side = outsideStay(stay, e.date)
      if (!side || declined.has(fixUpKey(e.id, friendId))) continue
      sides.add(side)
      const reason = byHandReason(e, friendId)
      if (reason) byHand.push({ expense: e, reason })
      else safe.push(e)
    }
    if (safe.length === 0 && byHand.length === 0) continue
    out.push({
      friendId,
      stay,
      safe,
      byHand,
      side: sides.size > 1 ? 'both' : sides.has('before') ? 'before' : 'after',
    })
  }
  return out.sort((a, b) => nameOf(a.friendId).localeCompare(nameOf(b.friendId)) || (a.friendId < b.friendId ? -1 : 1))
}

/** The same expense's people without `friendId` (inputs kept), for `saveExpense`. */
export function withoutPerson(e: Expense, friendId: string): Participant[] {
  return e.participants.filter((p) => p.friendId !== friendId)
}

/* ------------------------------------------------------------------ split by nights */

/** Titles that read as somewhere to sleep. */
const STAY_WORDS =
  /\b(hotels?|stays?|villas?|air ?bnb|bnb|hostels?|resorts?|home ?stays?|rooms?|oyo|zostel|lodges?|guest ?houses?|cottages?|accommodation|agoda|treebo|fabhotels?|inn|suites?|tents?|camps?|houseboats?|dorms?|apartments?)\b/i

/** Whether this expense is a stay: a stay-like title, filed under travel and stays, rent or other. */
export function isStayExpense(e: Pick<Expense, 'title' | 'category'>): boolean {
  if (e.category !== 'travel' && e.category !== 'rent' && e.category !== 'other') return false
  return STAY_WORDS.test(e.title)
}

/**
 * The dates nights are counted over. It starts on the earliest "here from" anyone has, or on the
 * group's first expense when someone has no "here from" (they were there from the start), and ends
 * the same way on the latest "until" or the last expense. Null when there's nothing to count.
 */
export function tripRange(group: Group, expenses: readonly Expense[], stays: Stays): { from: string; to: string } | null {
  const dates = expenses.filter((e) => e.groupId === group.id && e.kind !== 'loan' && isIsoDate(e.date)).map((e) => e.date)
  const members = group.memberIds.map((id) => usableStay(stays[id]))
  const froms = members.map((s) => s?.from ?? null)
  const tos = members.map((s) => s?.to ?? null)
  const known = (list: Array<string | null>): string[] => list.filter((d): d is string => d !== null)
  const pick = (list: string[], latest: boolean): string | null => (list.length === 0 ? null : list.reduce((a, b) => ((latest ? b > a : b < a) ? b : a)))
  const from = pick(froms.includes(null) ? [...known(froms), ...dates] : known(froms), false)
  const to = pick(tos.includes(null) ? [...known(tos), ...dates] : known(tos), true)
  if (from === null || to === null || to <= from) return null
  return { from, to }
}

/** Nights someone was there within the range: a night for each evening they stayed on past. */
export function nightsIn(stay: Stay | null | undefined, range: { from: string; to: string }): number {
  const s = usableStay(stay)
  const start = s?.from && s.from > range.from ? s.from : range.from
  const end = s?.to && s.to < range.to ? s.to : range.to
  return Math.max(0, daysBetween(start, end))
}

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b]
  return a
}

export interface NightsPlan {
  range: { from: string; to: string }
  /** In the expense's own order. */
  rows: Array<{ friendId: string; nights: number; share: number }>
  /** Weights for `mode: 'shares'`, smallest whole numbers in the same proportion. */
  participants: Participant[]
}

/** Whether the expense is already split in these proportions. */
function sameProportions(e: Expense, weights: readonly number[]): boolean {
  if (e.mode === 'equal') return weights.every((w) => w === weights[0])
  if (e.mode !== 'shares') return false
  const have = e.participants.map(weight)
  const a = have.reduce(gcd, 0)
  const b = weights.reduce(gcd, 0)
  if (a === 0 || b === 0) return false
  return have.every((w, i) => w / a === (weights[i] ?? 0) / b)
}

/**
 * "Split by nights" for a stay: each person's nights, the whole-number weights and what each would
 * pay (the same maths `saveExpense` uses, so it adds up to the total). Null when it doesn't apply:
 * not a stay, not a plain split, no stays set in the group, everyone stayed equally, or it's already
 * split that way.
 */
export function nightsPlan(e: Expense, group: Group | null, expenses: readonly Expense[], stays: Stays): NightsPlan | null {
  if (!group || e.groupId !== group.id || e.kind !== 'split' || !isStayExpense(e) || e.participants.length < 2) return null
  if (!group.memberIds.some((id) => usableStay(stays[id]) !== null)) return null
  const range = tripRange(group, expenses, stays)
  if (!range) return null
  const nights = e.participants.map((p) => nightsIn(stays[p.friendId], range))
  if (nights.every((n) => n === nights[0]) || !nights.some((n) => n > 0)) return null
  const d = nights.reduce(gcd, 0)
  const weights = nights.map((n) => n / d)
  if (sameProportions(e, weights)) return null
  const participants = e.participants.map((p, i) => ({
    friendId: p.friendId,
    input: weights[i] ?? 0,
  }))
  const { shares } = splitAmount({
    total: e.total,
    currency: e.currency,
    mode: 'shares',
    participants,
    payerId: e.payerId,
    roundToWhole: e.roundedToWhole,
  })
  return {
    range,
    rows: e.participants.map((p, i) => ({
      friendId: p.friendId,
      nights: nights[i] ?? 0,
      share: shares[p.friendId] ?? 0,
    })),
    participants,
  }
}
