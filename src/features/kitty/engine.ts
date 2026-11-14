/**
 * The trip kitty, worked out from the group itself. Before a trip everyone hands the same amount
 * to one person (the holder), who pays for the group from it. In Settle's books that is nothing
 * new: each hand-over is a recorded payment (member → holder) and each kitty spend is an ordinary
 * group expense paid by the holder. So the kitty is a small ledger over the group's payments and
 * bills from the moment it started, plus the little this phone keeps (`store.ts`): who holds it,
 * how much each, and since when. Anything from before (old bills, old debts, a bill added that
 * morning) is not the kitty's and is left to the group's usual balances. Bills and payments dated
 * a later day always count; ones dated the start day count when they were added after the start.
 *
 * Pure: `today` comes in, nothing reads the clock. Every sum is exact to the paisa.
 */
import { ME_ID, type Expense, type Group, type Minor } from '../../domain/types'
import { addDays, daysBetween } from '../../engine/dates'
import { currencyDigits } from '../../lib/money'

export interface KittyConfig {
  holderId: string
  /** What each person puts in (minor units). */
  perHead: Minor
  /** YYYY-MM-DD: the day it started. Payments and bills dated after this day belong to the kitty. */
  startedOn: string
  /**
   * The moment it started (ms since 1970). On `startedOn` itself, only payments and bills added
   * from then on belong to the kitty. Kitties saved before this was kept lack it: they count the
   * whole start day.
   */
  startedAt?: number
}

export interface KittyMember {
  id: string
  holder: boolean
  /**
   * What they've put in since the start: payments from them to the holder, less what the holder
   * paid back to them, never below 0. Always 0 for the holder (their share is their own money).
   */
  putIn: Minor
  /** What they still have to put in to reach `perHead` (0 when they have; 0 for the holder). */
  toPutIn: Minor
  /** They've put in `perHead` (always true for the holder). */
  done: boolean
  /** Their share of what the holder has paid for the group since the start. */
  spentOn: Minor
  /** `putIn − spentOn`: their part of what's left, or (negative) what they're short. 0 for the holder. */
  part: Minor
}

export interface KittyView {
  holderId: string
  perHead: Minor
  startedOn: string
  currency: string
  /** Holder first, then the group's order. */
  members: KittyMember[]
  /** How many of the others have put in their full `perHead`. */
  doneCount: number
  /** How many others there are (members besides the holder). */
  othersCount: number
  /** What the others have actually put in since the start (returns taken off). */
  fromOthers: Minor
  /** What the holder has paid for the group since the start (bills in the group's currency; loans aren't spending). */
  spent: Minor
  /** The others' shares of `spent`: the part that comes out of their money ("Spent" on the sheet). */
  othersSpent: Minor
  /** The holder's own share of `spent` (paid from their own money). */
  holderSpent: Minor
  /**
   * What's left in the kitty: over the other people, what they put in less their share of what
   * was spent, floored at 0. The holder's own share is their own money and isn't in it.
   */
  left: Minor
  /** Whole days the kitty has run, counting today (at least 1). */
  days: number
  /** Average the holder has spent for the group per day since the start. */
  perDay: Minor
  /** The others' money spent per day: the pace `left` goes down at, and the one the sheet shows. */
  othersPerDay: Minor
  /**
   * What the others have spent beyond what they put in (`othersSpent − fromOthers` when that is
   * positive), paid by the holder for now; else 0. `fromOthers − othersSpent` is `left` otherwise.
   */
  over: Minor
  /** The day `left` runs out at `othersPerDay`, or null when nothing is being spent. Today when it already has. */
  runsOutOn: string | null
  /** Whole days until it runs out (0 = today), or null. */
  daysLeft: number | null
  /**
   * When it runs out within a day: the same extra amount for each of the others that covers the
   * next 2 days at this pace, rounded up to the next 100 (₹100). Null otherwise.
   */
  topUp: Minor | null
}

/** Days of spending a top-up covers. */
export const TOP_UP_DAYS = 2

/** A top-up is rounded up to a multiple of this many whole currency units (₹100). */
const TOP_UP_STEP_UNITS = 100

/** When the kitty starts counting: its day, and (on that day) the moment, if known. */
interface Start {
  on: string
  at: number | null
}

/** A bill or payment dated `date` and added at `createdAt` falls inside the kitty. */
function inKitty(date: string, createdAt: number, start: Start): boolean {
  if (date !== start.on) return date > start.on
  return start.at === null || !Number.isFinite(createdAt) || createdAt >= start.at
}

function isKittySpend(e: Expense, group: Group, holderId: string, start: Start): boolean {
  return (
    e.groupId === group.id &&
    e.currency === group.currency &&
    e.kind !== 'loan' &&
    e.payerId === holderId &&
    inKitty(e.date, e.createdAt, start) &&
    Number.isSafeInteger(e.total)
  )
}

/** Rounds `amount` up to the next multiple of 100 whole units of `currency` (₹100). */
export function roundUpTopUp(amount: Minor, currency: string): Minor {
  if (!(amount > 0)) return 0
  const step = TOP_UP_STEP_UNITS * 10 ** currencyDigits(currency)
  return Math.ceil(amount / step) * step
}

function add(map: Record<string, Minor>, id: string, amount: Minor): void {
  map[id] = (map[id] ?? 0) + amount
}

/**
 * The kitty for `group`, or null when it can't be one: the holder is no longer in the group, or
 * the amount isn't a positive whole number of paise.
 */
export function kittyView(group: Group, expenses: readonly Expense[], config: KittyConfig, today: string): KittyView | null {
  const { holderId, perHead } = config
  if (!group.memberIds.includes(holderId) || !Number.isSafeInteger(perHead) || perHead <= 0) return null
  // A start date in the future (a phone with a wrong clock) counts from the start of today.
  const future = config.startedOn > today
  const startedOn = future ? today : config.startedOn
  const at = config.startedAt
  const start: Start = { on: startedOn, at: !future && typeof at === 'number' && Number.isFinite(at) ? at : null }

  // Money in (member → holder) and money handed back (holder → member), since the start.
  const net: Record<string, Minor> = {}
  for (const s of group.settlements) {
    if (!inKitty(s.date, s.createdAt, start) || !Number.isSafeInteger(s.amount) || s.amount <= 0 || s.fromId === s.toId) continue
    if (s.toId === holderId) add(net, s.fromId, s.amount)
    else if (s.fromId === holderId) add(net, s.toId, -s.amount)
  }
  const putInOf = (id: string): Minor => Math.max(0, net[id] ?? 0)

  // The holder's spending for the group since the start, and each person's share of it.
  const spentOn: Record<string, Minor> = {}
  let spent = 0
  let holderSpent = 0
  for (const e of expenses) {
    if (!isKittySpend(e, group, holderId, start)) continue
    spent += e.total
    for (const [id, raw] of Object.entries(e.shares)) {
      const share = typeof raw === 'number' && Number.isSafeInteger(raw) ? raw : 0
      if (id === holderId) holderSpent += share
      else add(spentOn, id, share)
    }
  }

  const order = [holderId, ...group.memberIds.filter((id) => id !== holderId)]
  const members: KittyMember[] = order.map((id) => {
    if (id === holderId) return { id, holder: true, putIn: 0, toPutIn: 0, done: true, spentOn: 0, part: 0 }
    const putIn = putInOf(id)
    const on = spentOn[id] ?? 0
    const toPutIn = Math.max(0, perHead - putIn)
    return { id, holder: false, putIn, toPutIn, done: toPutIn === 0, spentOn: on, part: putIn - on }
  })

  // Everyone but the holder, including anyone who has since left the group: their money still counts.
  const others = new Set<string>([...Object.keys(net), ...Object.keys(spentOn), ...order])
  others.delete(holderId)
  let fromOthers = 0
  let othersSpent = 0
  for (const id of others) {
    fromOthers += putInOf(id)
    othersSpent += spentOn[id] ?? 0
  }
  // Sums of the same numbers, so Put in − Spent = Left whenever the kitty hasn't run dry.
  const left = Math.max(0, fromOthers - othersSpent)
  const over = Math.max(0, othersSpent - fromOthers)

  const days = Math.max(1, daysBetween(startedOn, today) + 1)
  const perDay = Math.round(spent / days)
  const othersPerDay = Math.round(othersSpent / days)

  let daysLeft: number | null = null
  if (othersPerDay > 0) daysLeft = Math.floor(left / othersPerDay)
  else if (left === 0 && spent > 0) daysLeft = 0
  const runsOutOn = daysLeft === null ? null : addDays(today, daysLeft)

  const othersCount = members.length - 1
  let topUp: Minor | null = null
  if (daysLeft !== null && daysLeft <= 1 && othersPerDay > 0 && othersCount > 0) {
    const need = TOP_UP_DAYS * othersPerDay - left
    if (need > 0) topUp = roundUpTopUp(Math.ceil(need / othersCount), group.currency)
  }

  return {
    holderId,
    perHead,
    startedOn,
    currency: group.currency,
    members,
    doneCount: members.filter((m) => !m.holder && m.done).length,
    othersCount,
    fromOthers,
    spent,
    othersSpent,
    holderSpent,
    left,
    days,
    perDay,
    othersPerDay,
    over,
    runsOutOn,
    daysLeft,
    topUp,
  }
}

/**
 * Who should hold a new kitty: whoever has paid the most for the group so far (bills in the
 * group's currency; loans aren't spending), ties to the name first alphabetically (ids differ per
 * phone); you when nobody has paid anything yet.
 */
export function suggestedHolder(group: Group, expenses: readonly Expense[], nameOf: (id: string) => string): string {
  const paid: Record<string, Minor> = {}
  for (const e of expenses) {
    if (e.groupId !== group.id || e.currency !== group.currency || e.kind === 'loan' || !group.memberIds.includes(e.payerId)) continue
    if (!Number.isSafeInteger(e.total)) continue
    paid[e.payerId] = (paid[e.payerId] ?? 0) + e.total
  }
  let best: string | null = null
  for (const id of group.memberIds) {
    const amount = paid[id] ?? 0
    if (amount <= 0) continue
    const top = best === null ? 0 : (paid[best] ?? 0)
    if (best === null || amount > top || (amount === top && nameOf(id).localeCompare(nameOf(best)) < 0)) best = id
  }
  return best ?? (group.memberIds.includes(ME_ID) ? ME_ID : (group.memberIds[0] ?? ME_ID))
}

/** What a running kitty's holder is holding of other people's money right now. */
export interface KittyHeld {
  holderId: string
  /** The others' money still in the kitty (the sheet's "Left"), in minor units; never negative. */
  held: Minor
}

/**
 * For a group's balance card: null when the group has no running kitty (or it can't be one),
 * else who holds it and how much of the others' money they hold. Pure: `today` comes in.
 */
export function kittyHeld(group: Group, expenses: readonly Expense[], config: KittyConfig | null, today: string): KittyHeld | null {
  if (!config || group.archived || group.memberIds.length < 2) return null
  const view = kittyView(group, expenses, config, today)
  return view ? { holderId: view.holderId, held: view.left } : null
}
