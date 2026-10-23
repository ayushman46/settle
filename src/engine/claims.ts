/**
 * "Claim your items": the maths behind a claim link. Friends pick what they had (fractions of each
 * bill line); this works out a friend's exact share on their own phone, adds every claim up on the
 * organiser's board, turns claims plus the organiser's decisions into the bill's item weights, and
 * compares what people say they paid with their final share.
 *
 * Exact: rational arithmetic on bigints (never floats), rounding half up only at the very end, and
 * the same proportional rule as the split itself (tax, service and discounts in proportion to what
 * each person had). Conflicts are reported, never resolved here.
 */
import type { ClaimDecision, ClaimPick, ClaimReply, Minor } from '../domain/types'
import { allocate } from '../lib/money'

/* ------------------------------------------------------------------ fractions */

/** A non-negative fraction in lowest terms (bigint). */
export interface Fraction {
  n: bigint
  d: bigint
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a
  let y = b < 0n ? -b : b
  while (y !== 0n) {
    const t = x % y
    x = y
    y = t
  }
  return x
}

/** `num/den` in lowest terms (den ≠ 0). */
export function fraction(num: number | bigint, den: number | bigint): Fraction {
  const n = BigInt(num)
  const d = BigInt(den)
  const g = gcd(n, d) || 1n
  return { n: n / g, d: d / g }
}

const ZERO = fraction(0, 1)
const ONE = fraction(1, 1)

export function addFractions(x: Fraction, y: Fraction): Fraction {
  return fraction(x.n * y.d + y.n * x.d, x.d * y.d)
}

function subFractions(x: Fraction, y: Fraction): Fraction {
  return fraction(x.n * y.d - y.n * x.d, x.d * y.d)
}

/** -1, 0 or 1. */
export function compareFractions(x: Fraction, y: Fraction): number {
  const a = x.n * y.d
  const b = y.n * x.d
  return a < b ? -1 : a > b ? 1 : 0
}

/** Round half up of a non-negative bigint ratio. */
function roundDiv(num: bigint, den: bigint): bigint {
  return (2n * num + den) / (2n * den)
}

function lcm(a: bigint, b: bigint): bigint {
  return (a / gcd(a, b)) * b
}

/* ------------------------------------------------------------------ a friend's share */

export interface ClaimItem {
  name: string
  amount: Minor
  quantity: number
}

/** itemIndex → [personIndex, weight][] for items sorted before the link went out. */
export type FixedItems = ReadonlyArray<readonly [item: number, weights: ReadonlyArray<readonly [person: number, weight: number]>]>

export interface ClaimShareInput {
  items: readonly ClaimItem[]
  /** What was paid (minor). */
  total: Minor
  picks: readonly ClaimPick[]
  fixed?: FixedItems
  personIndex: number | null
}

export interface ClaimShare {
  /** Their exact part of the item prices, rounded half up. */
  itemsPart: Minor
  /** What they owe: total × (their items ÷ all items), rounded half up. */
  share: Minor
}

function safeAmount(value: number | undefined): bigint {
  return Number.isSafeInteger(value) && (value as number) > 0 ? BigInt(value as number) : 0n
}

/**
 * A friend's share from their own picks (the claim page): their exact part of each item they
 * claimed, plus their part of items the organiser already sorted, then the bill's extras in the
 * same proportion — `total × mine ÷ itemsTotal`, rounded half up. Zero when the items add up to
 * nothing (the page then asks them to check with the organiser).
 */
export function claimShare(input: ClaimShareInput): ClaimShare {
  const { items, total, picks, fixed = [], personIndex } = input
  const itemsTotal = items.reduce((sum, item) => sum + safeAmount(item.amount), 0n)
  let mine = ZERO
  for (const pick of picks) {
    const item = items[pick.item]
    if (!item || pick.den <= 0 || pick.num <= 0) continue
    mine = addFractions(mine, fraction(safeAmount(item.amount) * BigInt(pick.num), pick.den))
  }
  if (personIndex !== null) {
    for (const [index, weights] of fixed) {
      const item = items[index]
      const own = weights.find(([person]) => person === personIndex)
      if (!item || !own) continue
      const sum = weights.reduce((s, [, w]) => s + Math.max(0, w), 0)
      if (sum <= 0 || own[1] <= 0) continue
      mine = addFractions(mine, fraction(safeAmount(item.amount) * BigInt(own[1]), sum))
    }
  }
  if (itemsTotal === 0n) return { itemsPart: 0, share: 0 }
  const paid = safeAmount(total)
  return {
    itemsPart: Number(roundDiv(mine.n, mine.d)),
    share: Number(roundDiv(paid * mine.n, mine.d * itemsTotal)),
  }
}

/* ------------------------------------------------------------------ the board */

export type ClaimRowStatus = 'complete' | 'partial' | 'over' | 'unclaimed' | 'fixed'

export interface ClaimRowClaim {
  friendId: string
  part: Fraction
}

export interface ClaimRow {
  index: number
  status: ClaimRowStatus
  /** Each active claim on the item, in reply order (the organiser's own picks first). */
  claims: ClaimRowClaim[]
  claimed: Fraction
  /** 1 − claimed when partial, else 0. */
  rest: Fraction
  /** claimed − 1 when over, else 0. */
  extra: Fraction
}

export interface ClaimBoardInput {
  itemCount: number
  fixedIndexes: ReadonlySet<number>
  /** Active replies + the organiser's own picks, as (friendId, picks). */
  claimers: ReadonlyArray<{ friendId: string; picks: readonly ClaimPick[] }>
}

/**
 * Every item's claims added up exactly: `complete` (the whole item), `partial` (some left over),
 * `over` (claimed more than once — a conflict) or `unclaimed`. Items sorted before the link went
 * out are `fixed` whatever anyone claimed. Never resolves anything.
 */
export function claimBoard(input: ClaimBoardInput): ClaimRow[] {
  const rows: ClaimRow[] = []
  for (let index = 0; index < input.itemCount; index++) {
    if (input.fixedIndexes.has(index)) {
      rows.push({ index, status: 'fixed', claims: [], claimed: ONE, rest: ZERO, extra: ZERO })
      continue
    }
    const claims: ClaimRowClaim[] = []
    let claimed = ZERO
    for (const claimer of input.claimers) {
      for (const pick of claimer.picks) {
        if (pick.item !== index || pick.den <= 0 || pick.num <= 0) continue
        const part = fraction(pick.num, pick.den)
        claims.push({ friendId: claimer.friendId, part })
        claimed = addFractions(claimed, part)
      }
    }
    const c = compareFractions(claimed, ONE)
    const status: ClaimRowStatus = claims.length === 0 ? 'unclaimed' : c === 0 ? 'complete' : c < 0 ? 'partial' : 'over'
    rows.push({
      index,
      status,
      claims,
      claimed,
      rest: claims.length > 0 && c < 0 ? subFractions(ONE, claimed) : ZERO,
      extra: c > 0 ? subFractions(claimed, ONE) : ZERO,
    })
  }
  return rows
}

/** Largest weight an item share may have (the bill's own limit). */
export const MAX_CLAIM_WEIGHT = 99

/**
 * Whole-number weights (≤ 99) in the same proportions as the claims: each part × the LCM of the
 * denominators, divided by their GCD, the same friend's parts summed. When the largest would pass
 * 99 they're scaled down by largest remainder (each at least 1) — the money itself stays exact,
 * because the split allocates by these weights.
 */
export function weightsFor(claims: readonly ClaimRowClaim[]): Record<string, number> {
  if (claims.length === 0) return {}
  let L = 1n
  for (const claim of claims) L = lcm(L, claim.part.d)
  let big = claims.map((claim) => (claim.part.n * L) / claim.part.d)
  const g = big.reduce((acc, w) => gcd(acc, w), 0n) || 1n
  big = big.map((w) => w / g)
  const max = big.reduce((m, w) => (w > m ? w : m), 0n)
  let weights: number[]
  if (max > BigInt(MAX_CLAIM_WEIGHT)) {
    const sum = big.reduce((a, b) => a + b, 0n)
    const target = Math.max(claims.length, Number((sum * BigInt(MAX_CLAIM_WEIGHT)) / max))
    weights = allocate(
      target,
      big.map((w) => Number(w)),
    ).map((w) => Math.max(1, w))
  } else {
    weights = big.map((w) => Number(w))
  }
  const out: Record<string, number> = {}
  claims.forEach((claim, k) => {
    out[claim.friendId] = (out[claim.friendId] ?? 0) + (weights[k] ?? 0)
  })
  // Two parts of the same friend can add up past the cap: same proportions, smaller numbers.
  const values = Object.values(out)
  const top = Math.max(...values)
  if (top > MAX_CLAIM_WEIGHT) {
    const ids = Object.keys(out)
    const sum = values.reduce((a, b) => a + b, 0)
    const target = Math.max(ids.length, Math.floor((sum * MAX_CLAIM_WEIGHT) / top))
    const scaled = allocate(target, values).map((w) => Math.min(MAX_CLAIM_WEIGHT, Math.max(1, w)))
    ids.forEach((id, k) => {
      out[id] = scaled[k] ?? 1
    })
  }
  return out
}

/**
 * The item's shares for a row and the organiser's decision, or null while it's still open (it
 * then stays unassigned, which the split shares between everyone):
 * - complete → as claimed;
 * - over + `as_claimed` → in proportion to the claims;
 * - partial + `scale_up` → only the claimers, in proportion;
 * - partial + `rest_everyone` → the claims plus the rest shared equally by everyone at the table;
 * - any + `assign` → the organiser's own pick.
 * A decision that no longer fits the row (say, more picks arrived since) leaves it open.
 */
export function resolveRow(
  row: ClaimRow,
  decision: ClaimDecision | undefined,
  everyoneIds: readonly string[],
): Record<string, number> | null {
  if (decision?.kind === 'assign') {
    const shares: Record<string, number> = {}
    for (const [id, weight] of Object.entries(decision.shares)) {
      if (Number.isSafeInteger(weight) && weight > 0) shares[id] = Math.min(MAX_CLAIM_WEIGHT, weight)
    }
    return Object.keys(shares).length > 0 ? shares : null
  }
  if (row.status === 'fixed' || row.claims.length === 0) return null
  if (row.status === 'complete') return weightsFor(row.claims)
  if (row.status === 'over' && decision?.kind === 'as_claimed') return weightsFor(row.claims)
  if (row.status === 'partial' && decision?.kind === 'scale_up') return weightsFor(row.claims)
  if (row.status === 'partial' && decision?.kind === 'rest_everyone' && everyoneIds.length > 0) {
    const each = fraction(row.rest.n, row.rest.d * BigInt(everyoneIds.length))
    return weightsFor([...row.claims, ...everyoneIds.map((friendId) => ({ friendId, part: each }))])
  }
  return null
}

/* ------------------------------------------------------------------ payments */

/** Gap between what someone says they paid and their final share (organiser absorbs ≤ tolerance). */
export interface PaymentGap {
  friendId: string
  paid: Minor | null
  share: Minor
  /** share − paid (paid counts as 0 when they didn't say). */
  due: Minor
  settled: boolean
}

/**
 * For each active reply: what they said they paid against their final share. Within
 * (items they claimed + 1) paise — the most rounding can move a share — it counts as paid.
 */
export function paymentGaps(replies: readonly ClaimReply[], finalShares: Readonly<Record<string, Minor>>): PaymentGap[] {
  const out: PaymentGap[] = []
  const seen = new Set<string>()
  for (const reply of replies) {
    if (reply.state !== 'active' || seen.has(reply.friendId)) continue
    seen.add(reply.friendId)
    const share = finalShares[reply.friendId] ?? 0
    const due = share - (reply.paid ?? 0)
    const tolerance = reply.picks.length + 1
    const settled = reply.paid !== null ? Math.abs(due) <= tolerance : share === 0
    out.push({ friendId: reply.friendId, paid: reply.paid, share, due, settled })
  }
  return out
}

/* ------------------------------------------------------------------ words */

const VULGAR: Readonly<Record<string, string>> = { '1/2': '½', '1/3': '⅓', '1/4': '¼', '2/3': '⅔', '3/4': '¾' }

/** "½", "⅓", "¼", "⅔", "¾"; else "5/12" (lowest terms). */
export function fractionWord(part: Fraction): string {
  const key = `${part.n}/${part.d}`
  return VULGAR[key] ?? key
}

/** Words for a portion: "1 of 4" on a 4-unit item, ½ ⅓ ¼ ⅔ ¾, "all" for the whole, else "5/12". */
export function portionLabel(pick: Pick<ClaimPick, 'num' | 'den'>, quantity: number): string {
  const f = fraction(pick.num, pick.den)
  if (Number.isInteger(quantity) && quantity >= 2) {
    const units = f.n * BigInt(quantity)
    if (units % f.d === 0n) return `${units / f.d} of ${quantity}`
  }
  if (f.n === f.d) return 'all'
  return fractionWord(f)
}

/** A count that may be fractional as words: 2 → "2", 3/2 → "1½", 17/12 → "1 5/12". */
export function mixedNumber(value: Fraction): string {
  const whole = value.n / value.d
  const rest = fraction(value.n - whole * value.d, value.d)
  if (rest.n === 0n) return String(whole)
  const word = fractionWord(rest)
  if (whole === 0n) return word
  return VULGAR[`${rest.n}/${rest.d}`] ? `${whole}${word}` : `${whole} ${word}`
}
