/**
 * The split itself — pure and deterministic.
 *
 * 1. Each item's price is divided between the people who had it, by their share weights
 *    (largest-remainder, so every paisa is accounted for). Unassigned items go to everyone.
 * 2. What was actually paid (tax, tips, discounts, round-off included) is then divided in
 *    proportion to each person's item subtotal. Totals always add up to exactly `paid`.
 * 3. Delivery-app fees (part of `paid`) follow the bill's fee split: in proportion (the default,
 *    same totals as step 2) or equally between the people who had anything.
 */
import type { BillItem, FeeSplit, Minor, Person, Shares } from '../types'
import { allocate } from './money'

export interface SplitLine {
  itemId: string
  name: string
  /** This person's part of the item price. */
  amount: Minor
  /** This person's weight on the item. */
  shares: number
  /** Sum of all weights on the item. */
  totalShares: number
  /** People on the item. */
  sharedWith: number
  /** True when every person on the item has the same weight. */
  even: boolean
  /** The item was unassigned, so it was split among everyone. */
  everyone: boolean
}

export interface PersonSplit {
  person: Person
  /** In item order. */
  lines: SplitLine[]
  itemsSubtotal: Minor
  /** `total - itemsSubtotal`: their part of tax/charges (+) or discounts (−). */
  adjustment: Minor
  total: Minor
  /** Their part of the delivery-app fees (included in `total`; for display). */
  fees: Minor
}

export interface SplitResult {
  /** In input order. */
  people: PersonSplit[]
  paid: Minor
  itemsTotal: Minor
  /** `paid - itemsTotal`. */
  adjustment: Minor
  /** `adjustment / itemsTotal` (0 when there are no item amounts). */
  adjustmentRate: number
  unassignedItemIds: string[]
  /** Σ person totals — always equals `paid` when anyone is splitting. */
  check: Minor
  /** The fees that were shared: `fees` clamped to 0…max(0, paid). */
  fees: Minor
}

export interface SplitInput {
  items: readonly BillItem[]
  people: readonly Person[]
  assignments: Readonly<Record<string, Shares>>
  paid: Minor
  /** Σ of the bill's delivery-app fees (part of `paid`). Default 0. */
  fees?: Minor
  /** How the fees are shared. Default 'proportional'. */
  feeSplit?: FeeSplit
}

function toInt(value: number): number {
  if (!Number.isFinite(value)) return 0
  const r = Math.round(value)
  return r === 0 ? 0 : r
}

/** Keeps only people who exist, with weights floored to positive integers (people order). */
export function validShares(shares: Readonly<Shares> | undefined, people: readonly Person[]): Shares {
  const out: Shares = {}
  if (!shares) return out
  for (const person of people) {
    if (!Object.hasOwn(shares, person.id)) continue
    const weight = shares[person.id]
    if (typeof weight !== 'number' || !Number.isFinite(weight)) continue
    const floored = Math.floor(weight)
    if (floored > 0) out[person.id] = floored
  }
  return out
}

/** Who is on an item and with what weight, in people order. Empty → unassigned. */
function sharersOf(shares: Readonly<Shares> | undefined, people: readonly Person[]) {
  const valid = validShares(shares, people)
  const sharers: Array<{ person: Person; weight: number }> = []
  for (const person of people) {
    const weight = valid[person.id]
    if (weight !== undefined) sharers.push({ person, weight })
  }
  return sharers
}

/**
 * Live preview of one item's split: personId → amount for everyone with a valid share.
 * Matches what `computeSplit` gives those people for the item.
 */
export function itemShareAmounts(
  amount: Minor,
  shares: Readonly<Shares> | undefined,
  people: readonly Person[],
): Record<string, Minor> {
  const sharers = sharersOf(shares, people)
  const parts = allocate(toInt(amount), sharers.map((s) => s.weight))
  const out: Record<string, Minor> = {}
  sharers.forEach((s, i) => {
    out[s.person.id] = parts[i] ?? 0
  })
  return out
}

export function computeSplit(input: SplitInput): SplitResult {
  const { items, people, assignments } = input
  const paid = toInt(input.paid)
  const amounts = items.map((item) => toInt(item.amount))
  const itemsTotal = amounts.reduce((a, b) => a + b, 0)
  const adjustment = paid - itemsTotal
  const adjustmentRate = itemsTotal !== 0 ? adjustment / itemsTotal : 0
  // A coupon can't make the fees more than what was paid.
  const fees = Math.min(Math.max(0, toInt(input.fees ?? 0)), Math.max(0, paid))

  if (people.length === 0) {
    return {
      people: [],
      paid,
      itemsTotal,
      adjustment,
      adjustmentRate,
      unassignedItemIds: items.map((item) => item.id),
      check: 0,
      fees,
    }
  }

  const linesByPerson = new Map<string, SplitLine[]>(people.map((p) => [p.id, []]))
  const unassignedItemIds: string[] = []

  items.forEach((item, index) => {
    const amount = amounts[index] ?? 0
    let sharers = sharersOf(assignments[item.id], people)
    const everyone = sharers.length === 0
    if (everyone) {
      unassignedItemIds.push(item.id)
      sharers = people.map((person) => ({ person, weight: 1 }))
    }
    const weights = sharers.map((s) => s.weight)
    const parts = allocate(amount, weights)
    const totalShares = weights.reduce((a, b) => a + b, 0)
    const even = weights.every((w) => w === weights[0])
    sharers.forEach((s, i) => {
      linesByPerson.get(s.person.id)?.push({
        itemId: item.id,
        name: item.name,
        amount: parts[i] ?? 0,
        shares: s.weight,
        totalShares,
        sharedWith: sharers.length,
        even,
        everyone,
      })
    })
  })

  const subtotals = people.map((p) =>
    (linesByPerson.get(p.id) ?? []).reduce((sum, line) => sum + line.amount, 0),
  )
  // allocate() splits equally when every subtotal is 0 (e.g. only free items).
  let totals: Minor[]
  let feeParts: Minor[]
  if (input.feeSplit === 'equal' && fees > 0) {
    // Fees shared equally by everyone who had something (everyone, if nobody did); the rest of
    // what was paid in proportion to what each person had.
    const had = subtotals.map((subtotal) => (subtotal > 0 ? 1 : 0))
    feeParts = allocate(fees, had.some((x) => x > 0) ? had : subtotals.map(() => 1))
    const rest = allocate(paid - fees, subtotals)
    totals = rest.map((part, i) => part + (feeParts[i] ?? 0))
  } else {
    totals = allocate(paid, subtotals)
    feeParts = allocate(fees, subtotals)
  }

  const result: PersonSplit[] = people.map((person, i) => {
    const itemsSubtotal = subtotals[i] ?? 0
    const total = totals[i] ?? 0
    return {
      person,
      lines: linesByPerson.get(person.id) ?? [],
      itemsSubtotal,
      adjustment: total - itemsSubtotal,
      total,
      fees: feeParts[i] ?? 0,
    }
  })

  return {
    people: result,
    paid,
    itemsTotal,
    adjustment,
    adjustmentRate,
    unassignedItemIds,
    check: totals.reduce((a, b) => a + b, 0),
    fees,
  }
}

const EVEN_FRACTIONS: Readonly<Record<number, string>> = { 2: '½', 3: '⅓', 4: '¼' }

/**
 * Short label for a person's part of an item: null when they had it alone; "½", "⅓", "¼", "1/5"…
 * for even splits; "2 of 3 shares" for uneven ones.
 */
export function shareLabel(line: SplitLine): string | null {
  if (line.sharedWith <= 1) return null
  if (line.even) return EVEN_FRACTIONS[line.sharedWith] ?? `1/${line.sharedWith}`
  return `${line.shares} of ${line.totalShares} shares`
}
