/**
 * "Next round's on you" — turning a group's balances into a fair turn order. Instead of paying
 * each other back, friends who meet often take turns paying for everyone; each round is split
 * equally between the current members, so the payer gains `amount − own share` and everyone else
 * moves down by their share. All maths is integer minor units through `splitAmount` (exact to the
 * paisa, payer first in line for leftovers), so Σ balances stays 0 after every round.
 *
 * Proofs and worked examples: spec 04 §4.3–4.4 (verified on 3,000 random groups).
 */
import type { Minor } from '../domain/types'
import { currencyDigits } from '../lib/money'
import { simplifyDebts, type Transfer } from './balances'
import { splitAmount } from './split'

/** Σ of positive balances — what a full settle-up would move (balances sum to 0). */
export function outstanding(balances: Readonly<Record<string, Minor>>): Minor {
  let sum = 0
  for (const v of Object.values(balances)) if (v > 0) sum += v
  return sum
}

/** Balances after `payerId` pays `amount` split equally between `sharerIds` (payer first in line for leftover paise). */
export function applyRound(
  balances: Readonly<Record<string, Minor>>,
  payerId: string,
  amount: Minor,
  sharerIds: readonly string[],
  currency: string,
): Record<string, Minor> {
  const next: Record<string, Minor> = { ...balances }
  const { shares } = splitAmount({
    total: amount,
    currency,
    mode: 'equal',
    participants: sharerIds.map((friendId) => ({ friendId, input: null })),
    payerId,
  })
  for (const [id, share] of Object.entries(shares)) next[id] = (next[id] ?? 0) - share
  next[payerId] = (next[payerId] ?? 0) + amount
  for (const id of Object.keys(next)) if (next[id] === 0) next[id] = 0 // no −0
  return next
}

/**
 * The smallest round (paid by this person, split equally between `sharerCount`) after which they
 * are exactly square; null when not behind. With payer-first rounding their share of `A` is
 * ⌈A/k⌉, so their gain is ⌊A(k−1)/k⌋; the smallest `A` whose gain reaches the debt `D` is
 * ⌈Dk/(k−1)⌉, and its gain is exactly `D`. Someone outside the sharers gains `A`, so `A = D`.
 */
export function squaresAt(balance: Minor, sharerCount: number, isSharer: boolean): Minor | null {
  if (!(balance < 0)) return null
  const debt = -balance
  if (!isSharer) return debt
  const k = sharerCount
  if (k <= 1) return null
  return Math.ceil((debt * k) / (k - 1))
}

export interface RoundStep {
  payerId: string
  /** Outstanding before and after the round. */
  before: Minor
  after: Minor
  /** before − after (> 0). */
  settles: Minor
  balancesAfter: Record<string, Minor>
  /** squaresAt for this payer before the round. */
  squaresAt: Minor | null
}

export interface RotationInput {
  balances: Readonly<Record<string, Minor>>
  /** Who may pay (current members, in display order — the tie-break). */
  candidateIds: readonly string[]
  /** Who shares each round (current members). */
  sharerIds: readonly string[]
  amount: Minor
  currency: string
}

/**
 * The payer who leaves the least outstanding (ties: most behind, then earliest in candidateIds);
 * null if nobody paying would bring the group any closer to square.
 */
export function nextRound(input: RotationInput): RoundStep | null {
  const { balances, candidateIds, sharerIds, amount, currency } = input
  const before = outstanding(balances)
  if (before === 0 || !(amount > 0) || !Number.isSafeInteger(amount)) return null
  let best: (RoundStep & { order: number; own: Minor }) | null = null
  candidateIds.forEach((payerId, order) => {
    const after = applyRound(balances, payerId, amount, sharerIds, currency)
    const left = outstanding(after)
    const own = balances[payerId] ?? 0
    if (
      best === null ||
      left < best.after ||
      (left === best.after && own < best.own) ||
      (left === best.after && own === best.own && order < best.order)
    ) {
      best = {
        payerId,
        before,
        after: left,
        settles: before - left,
        balancesAfter: after,
        squaresAt: squaresAt(own, sharerIds.length, sharerIds.includes(payerId)),
        order,
        own,
      }
    }
  })
  const chosen = best as (RoundStep & { order: number; own: Minor }) | null
  if (chosen === null || chosen.settles <= 0) return null
  return {
    payerId: chosen.payerId,
    before: chosen.before,
    after: chosen.after,
    settles: chosen.settles,
    balancesAfter: chosen.balancesAfter,
    squaresAt: chosen.squaresAt,
  }
}

export interface RotationPlan {
  rounds: RoundStep[]
  /** Outstanding after the last round. */
  leftover: Minor
  /** The payments that square what's left (former members included — they settle by transfer). */
  finish: Transfer[]
}

/** Up to `maxRounds` (default 6) greedy rounds, then the payments that square what's left. */
export function rotationPlan(input: RotationInput & { maxRounds?: number }): RotationPlan {
  const maxRounds = input.maxRounds ?? 6
  const rounds: RoundStep[] = []
  let current: Record<string, Minor> = { ...input.balances }
  for (let i = 0; i < maxRounds; i++) {
    const round = nextRound({ ...input, balances: current })
    if (!round) break
    rounds.push(round)
    current = round.balancesAfter
  }
  return { rounds, leftover: outstanding(current), finish: simplifyDebts(current) }
}

/** How many recent expenses the usual round looks at. */
export const USUAL_ROUND_WINDOW = 10

/**
 * The usual round: the median of the last 10 expense totals (newest first, valid only), rounded
 * to whole currency units (×100 paise for INR; nothing beyond integers for JPY); null with none.
 */
export function usualRound(totalsNewestFirst: readonly Minor[], currency: string): Minor | null {
  const last = totalsNewestFirst
    .slice(0, USUAL_ROUND_WINDOW)
    .filter((v) => Number.isSafeInteger(v) && v > 0)
    .sort((a, b) => a - b)
  if (last.length === 0) return null
  const mid = Math.floor(last.length / 2)
  const median = last.length % 2 === 1 ? (last[mid] ?? 0) : Math.round(((last[mid - 1] ?? 0) + (last[mid] ?? 0)) / 2)
  const unit = 10 ** currencyDigits(currency)
  return Math.max(unit, Math.round(median / unit) * unit)
}

export interface NextRoundSuggestion {
  payerId: string
  /** −balance of the payer (> 0). */
  behind: Minor
  squaresAt: Minor | null
  usual: Minor | null
  /** nextRound(usual) when it picked this payer, else null. */
  usualStep: RoundStep | null
  groupOut: Minor
}

/**
 * What the "Next round's on …" card shows: nextRound(usual)'s payer when it helps, else the
 * most-behind current member (ties: member order). Null when no current member is behind.
 */
export function suggestNextRound(input: Omit<RotationInput, 'amount'> & { usual: Minor | null }): NextRoundSuggestion | null {
  const { balances, candidateIds, sharerIds, currency, usual } = input
  const groupOut = outstanding(balances)
  const step = usual !== null && usual > 0 ? nextRound({ balances, candidateIds, sharerIds, currency, amount: usual }) : null
  let payerId: string | null = null
  if (step && (balances[step.payerId] ?? 0) < 0) payerId = step.payerId
  if (payerId === null) {
    let most = 0
    for (const id of candidateIds) {
      const b = balances[id] ?? 0
      if (b < most) {
        most = b
        payerId = id
      }
    }
  }
  if (payerId === null) return null
  const balance = balances[payerId] ?? 0
  if (!(balance < 0)) return null
  return {
    payerId,
    behind: -balance,
    squaresAt: squaresAt(balance, sharerIds.length, sharerIds.includes(payerId)),
    usual,
    usualStep: step && step.payerId === payerId ? step : null,
    groupOut,
  }
}
