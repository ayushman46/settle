/**
 * Cash, exact notes: which notes and coins to hand over for an amount in rupees, and the change to
 * get back, so the fewest pieces change hands. Pure: no storage, no clock.
 *
 * The rule, in one sentence: of every way to pay with change, take the one where the fewest notes
 * and coins move in total; on a tie the payer hands over fewer; on a tie again, the smaller sum.
 */
import type { Minor } from '../../domain/types'

/** Notes and coins in use, in rupees, largest first (the ₹2,000 note was withdrawn in 2023). */
export const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1] as const
export type Denomination = (typeof DENOMINATIONS)[number]

/** ₹5 and under are coins; ₹10 and up are counted as notes. */
export const LARGEST_COIN = 5
const LARGEST: number = DENOMINATIONS[0]
const PAISE = 100

/** `count` pieces of one note or coin (`value` in rupees). */
export interface Pile {
  value: Denomination
  count: number
}

/** Cash handed over and the change that comes back. Amounts in paise, always whole rupees. */
export interface Handover {
  give: Minor
  givePiles: Pile[]
  /** 0 when the notes add up exactly. */
  change: Minor
  changePiles: Pile[]
  /** Notes and coins moving in both directions. */
  pieces: number
}

export interface RoundOption extends Handover {
  /** The rounded amount, paise. */
  to: Minor
  /** How far it is from the real amount, paise, always more than 0. */
  diff: Minor
  /** True when the rounded amount is more than what is owed (the payer lets the difference go). */
  up: boolean
}

export interface CashPlan extends Handover {
  /** What the cash is for, paise, a whole number of rupees. */
  amount: Minor
  /** True when the amount had paise and was taken to the nearest rupee. */
  fromPaise: boolean
  /** The notes that make the amount exactly, when the best way involves change; else null. */
  exact: Pile[] | null
  /** A nearby round amount that needs fewer notes, when there is one. */
  round: RoundOption | null
}

/** The fewest notes and coins that add up to `rupees` (largest first). Empty for 0 or junk. */
export function fewestPieces(rupees: number): Pile[] {
  if (!Number.isSafeInteger(rupees) || rupees <= 0) return []
  const piles: Pile[] = []
  let left = rupees
  for (const value of DENOMINATIONS) {
    const count = Math.floor(left / value)
    if (count > 0) piles.push({ value, count })
    left -= count * value
  }
  return piles
}

/** How many notes and coins are in `piles`. */
export function pieceCount(piles: readonly Pile[]): number {
  let n = 0
  for (const pile of piles) n += pile.count
  return n
}

/** What `piles` add up to, in rupees. */
export function pilesTotal(piles: readonly Pile[]): number {
  let sum = 0
  for (const pile of piles) sum += pile.value * pile.count
  return sum
}

/** The fewest pieces for every sum under ₹500, worked out once. */
let smallCounts: Uint8Array | null = null

/** How many pieces `fewestPieces(rupees)` has, without building the piles. */
function fewestCount(rupees: number): number {
  if (smallCounts === null) {
    smallCounts = new Uint8Array(LARGEST)
    for (let r = 1; r < LARGEST; r++) smallCounts[r] = pieceCount(fewestPieces(r))
  }
  return Math.floor(rupees / LARGEST) + (smallCounts[rupees % LARGEST] ?? 0)
}

/**
 * The best way to hand over `rupees` in cash. Overpaying by ₹500 or more never helps (a ₹500
 * note would go both ways), so only sums up to ₹499 over are tried.
 */
function handover(rupees: number): Handover {
  let over = 0
  let giveCount = fewestCount(rupees)
  let pieces = giveCount
  for (let extra = 1; extra < LARGEST; extra++) {
    const tryGive = fewestCount(rupees + extra)
    const total = tryGive + fewestCount(extra)
    if (total < pieces || (total === pieces && tryGive < giveCount)) {
      over = extra
      giveCount = tryGive
      pieces = total
    }
  }
  return {
    give: (rupees + over) * PAISE,
    givePiles: fewestPieces(rupees + over),
    change: over * PAISE,
    changePiles: fewestPieces(over),
    pieces,
  }
}

/** Rounding steps people actually agree to, in rupees. */
const ROUND_STEPS = [10, 50, 100] as const
/** A round amount is offered only this close: within ₹50 and within a tenth of the amount. */
const MAX_ROUND_DIFF = 50

/**
 * A round amount nearby that moves fewer notes than `plan` does, or null. Fewest pieces wins; on a
 * tie the one closer to the real amount; on a tie again the lower one.
 */
function roundOption(rupees: number, pieces: number): RoundOption | null {
  const limit = Math.min(MAX_ROUND_DIFF, Math.floor(rupees / 10))
  if (limit < 1) return null
  const candidates = new Set<number>()
  for (const step of ROUND_STEPS) {
    const down = Math.floor(rupees / step) * step
    for (const c of [down, down + step]) {
      if (c > 0 && c !== rupees && Math.abs(c - rupees) <= limit) candidates.add(c)
    }
  }
  let best: { to: number; diff: number; plan: Handover } | null = null
  for (const to of [...candidates].sort((a, b) => a - b)) {
    const plan = handover(to)
    const diff = Math.abs(to - rupees)
    if (plan.pieces >= pieces) continue
    if (best === null || plan.pieces < best.plan.pieces || (plan.pieces === best.plan.pieces && diff < best.diff)) best = { to, diff, plan }
  }
  if (!best) return null
  return { ...best.plan, to: best.to * PAISE, diff: best.diff * PAISE, up: best.to > rupees }
}

/**
 * The cash plan for `amount` (paise): what to give, what comes back, the exact notes if the payer
 * has them, and a round amount when that is simpler. Rupees only: null for any other currency, and
 * for an amount that isn't at least 50 paise (nothing to hand over).
 */
export function cashPlan(amount: Minor, currency: string): CashPlan | null {
  if (currency !== 'INR' || !Number.isSafeInteger(amount) || amount <= 0) return null
  const rupees = Math.round(amount / PAISE)
  if (rupees <= 0) return null
  const plan = handover(rupees)
  return {
    ...plan,
    amount: rupees * PAISE,
    fromPaise: amount % PAISE !== 0,
    exact: plan.change > 0 ? fewestPieces(rupees) : null,
    round: roundOption(rupees, plan.pieces),
  }
}
