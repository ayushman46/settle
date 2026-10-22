/**
 * Dividing an amount between people — pure and exact. Every mode ends in integer minor units
 * whose sum is the total, to the paisa: leftovers from rounding are handed out with the
 * largest-remainder method (`lib/money` `allocate`), and the payer is first in line for them, so
 * friends never pay a stray extra paisa.
 */
import type { Expense, Minor, Participant, SplitMode } from '../domain/types'
import { allocate, currencyDigits, MAX_MINOR } from '../lib/money'
import { computeSplit } from '../lib/split'

export type AmountSplitMode = Exclude<SplitMode, 'items'>

export type SplitIssue = 'no_people' | 'bad_total' | 'exact_mismatch' | 'percent_mismatch' | 'zero_weights'

/** 100% in basis points. Percent inputs are basis points: 2500 = 25%. */
export const FULL_PERCENT_BPS = 10_000

export interface AmountSplitInput {
  total: Minor
  currency: string
  mode: AmountSplitMode
  participants: Participant[]
  payerId: string
  roundToWhole?: boolean
}

export interface AmountSplitResult {
  /** friendId → amount owed for this expense (payer included). Σ === total whenever `ok`. */
  shares: Record<string, Minor>
  ok: boolean
  /** exact mode: total − Σ inputs (0 when ok; positive = still to assign). 0 for other modes. */
  remainder: Minor
  /** percent mode: 10 000 − Σ basis points (0 when ok). 0 for other modes. */
  percentRemainder: number
  issues: SplitIssue[]
}

/** True for a usable expense total: a whole number of minor units, above zero, within range. */
export function isValidTotal(total: unknown): total is Minor {
  return typeof total === 'number' && Number.isSafeInteger(total) && total > 0 && total <= MAX_MINOR
}

/** Participants with a usable id, first occurrence of each friend only, in order. */
export function uniqueParticipants(participants: readonly Participant[]): Participant[] {
  const seen = new Set<string>()
  const out: Participant[] = []
  for (const p of participants) {
    if (typeof p?.friendId !== 'string' || p.friendId === '' || seen.has(p.friendId)) continue
    seen.add(p.friendId)
    out.push(p)
  }
  return out
}

/** A typed input as a non-negative integer (null, NaN and negatives count as 0). */
function wholeInput(value: number | null): number {
  if (value === null || !Number.isFinite(value) || value <= 0) return 0
  return Math.min(Math.round(value), MAX_MINOR)
}

/** A share weight: null means the default of 1; anything unusable counts as 0. */
function weightOf(value: number | null): number {
  if (value === null) return 1
  return Number.isFinite(value) && value > 0 ? value : 0
}

/** `allocate`, but with the payer first in line for leftover minor units. */
function allocatePayerFirst(total: Minor, weights: readonly number[], ids: readonly string[], payerId: string): Minor[] {
  const payerIndex = ids.indexOf(payerId)
  if (payerIndex <= 0) return allocate(total, weights)
  const order = [payerIndex, ...ids.map((_, i) => i).filter((i) => i !== payerIndex)]
  const parts = allocate(total, order.map((i) => weights[i] ?? 0))
  const out = new Array<number>(ids.length).fill(0)
  order.forEach((index, k) => {
    out[index] = parts[k] ?? 0
  })
  return out
}

/**
 * Rounds everyone except the payer DOWN to whole currency units; the payer absorbs the
 * difference (so nobody is ever asked for more than their exact share). Σ is unchanged.
 * A no-op for currencies without minor units (JPY).
 */
export function roundSharesToWhole(shares: Readonly<Record<string, Minor>>, payerId: string, currency: string): Record<string, Minor> {
  const unit = 10 ** currencyDigits(currency)
  if (unit === 1) return { ...shares }
  const out: Record<string, Minor> = {}
  let absorbed = 0
  for (const [id, share] of Object.entries(shares)) {
    if (id === payerId) continue
    const rounded = share > 0 ? Math.floor(share / unit) * unit : share
    absorbed += share - rounded
    out[id] = rounded
  }
  const payerShare = (shares[payerId] ?? 0) + absorbed
  if (Object.hasOwn(shares, payerId) || payerShare !== 0) out[payerId] = payerShare
  return out
}

/**
 * Splits `total` between `participants` by `mode`.
 * - equal: everyone the same (± one minor unit, extra to the payer first).
 * - exact: each input is that person's amount; inputs must add up to the total.
 * - percent: inputs are basis points that must add up to 10 000; amounts by largest remainder.
 * - shares: inputs are weights (null = 1, 0 = left out); at least one must be positive.
 * When not `ok`, `shares` is still a live preview of what was typed (for editors).
 */
export function splitAmount(input: AmountSplitInput): AmountSplitResult {
  const people = uniqueParticipants(input.participants)
  const ids = people.map((p) => p.friendId)
  const issues: SplitIssue[] = []
  if (people.length === 0) issues.push('no_people')
  const totalOk = isValidTotal(input.total)
  if (!totalOk) issues.push('bad_total')
  const total = totalOk ? input.total : wholeInput(input.total)

  let amounts: number[]
  let remainder = 0
  let percentRemainder = 0

  switch (input.mode) {
    case 'exact': {
      amounts = people.map((p) => wholeInput(p.input))
      remainder = total - amounts.reduce((a, b) => a + b, 0)
      if (people.length > 0 && remainder !== 0) issues.push('exact_mismatch')
      break
    }
    case 'percent': {
      const bps = people.map((p) => wholeInput(p.input))
      const sum = bps.reduce((a, b) => a + b, 0)
      percentRemainder = FULL_PERCENT_BPS - sum
      if (people.length > 0 && percentRemainder !== 0) issues.push('percent_mismatch')
      // Exact when the percentages are complete; otherwise a preview of what's been typed.
      const covered = sum === FULL_PERCENT_BPS ? total : Math.min(Math.round((total * sum) / FULL_PERCENT_BPS), MAX_MINOR)
      amounts = sum > 0 ? allocatePayerFirst(covered, bps, ids, input.payerId) : bps.map(() => 0)
      break
    }
    case 'shares': {
      const weights = people.map((p) => weightOf(p.input))
      if (people.length > 0 && !weights.some((w) => w > 0)) {
        issues.push('zero_weights')
        amounts = weights.map(() => 0)
      } else {
        amounts = allocatePayerFirst(total, weights, ids, input.payerId)
      }
      break
    }
    case 'equal':
    default: {
      amounts = allocatePayerFirst(total, people.map(() => 1), ids, input.payerId)
      break
    }
  }

  let shares: Record<string, Minor> = {}
  ids.forEach((id, i) => {
    shares[id] = amounts[i] ?? 0
  })
  const ok = issues.length === 0
  if (ok && input.roundToWhole === true) shares = roundSharesToWhole(shares, input.payerId, input.currency)
  return { shares, ok, remainder: input.mode === 'exact' ? remainder : 0, percentRemainder, issues }
}

/**
 * The final shares of a saved (or about-to-be-saved) expense. Itemized bills divide the bill
 * snapshot item by item (`lib/split` `computeSplit`, delivery fees by the bill's fee split);
 * everything else goes through `splitAmount`.
 */
export function expenseShares(
  e: Pick<Expense, 'total' | 'currency' | 'mode' | 'participants' | 'payerId' | 'roundedToWhole' | 'bill'>,
): Record<string, Minor> {
  if (e.mode === 'items' && e.bill) {
    const people = uniqueParticipants(e.participants).map((p) => ({ id: p.friendId, name: p.friendId, color: 0 }))
    const fees = (e.bill.meta.fees ?? []).reduce((sum, fee) => sum + fee.amount, 0)
    const result = computeSplit({
      items: e.bill.items,
      people,
      assignments: e.bill.assignments,
      paid: e.total,
      fees,
      feeSplit: e.bill.feeSplit ?? 'proportional',
    })
    const shares: Record<string, Minor> = {}
    for (const p of result.people) shares[p.person.id] = p.total
    return e.roundedToWhole ? roundSharesToWhole(shares, e.payerId, e.currency) : shares
  }
  const mode: AmountSplitMode = e.mode === 'items' ? 'equal' : e.mode
  return splitAmount({
    total: e.total,
    currency: e.currency,
    mode,
    participants: e.participants,
    payerId: e.payerId,
    roundToWhole: e.roundedToWhole,
  }).shares
}

/**
 * "Split the rest equally": hands what's left of the total (exact) or of 100% (percent) to the
 * people who have nothing entered yet — or to everyone when all have something — in equal parts,
 * the payer first in line for leftovers. Nothing changes when nothing is left (or too much was
 * entered), or for equal and shares modes.
 */
export function splitRestEqually(input: AmountSplitInput): Participant[] {
  const people = uniqueParticipants(input.participants)
  if (input.mode !== 'exact' && input.mode !== 'percent') return people
  const goal = input.mode === 'exact' ? (isValidTotal(input.total) ? input.total : 0) : FULL_PERCENT_BPS
  const entered = people.map((p) => wholeInput(p.input))
  const rest = goal - entered.reduce((a, b) => a + b, 0)
  if (rest <= 0 || people.length === 0) return people
  const empty = people.map((_, i) => i).filter((i) => (entered[i] ?? 0) === 0)
  const targets = empty.length > 0 ? empty : people.map((_, i) => i)
  const parts = allocatePayerFirst(
    rest,
    targets.map(() => 1),
    targets.map((i) => people[i]?.friendId ?? ''),
    input.payerId,
  )
  const next = people.map((p, i) => ({ friendId: p.friendId, input: entered[i] ?? 0 }))
  targets.forEach((index, k) => {
    const p = next[index]
    if (p) p.input += parts[k] ?? 0
  })
  return next
}
