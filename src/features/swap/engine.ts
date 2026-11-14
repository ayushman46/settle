/**
 * Pay it forward: when someone owes you and you owe someone else, the first can pay the second
 * directly. One payment instead of two passing through you. Pure: balances in, suggestions out.
 */
import type { Minor } from '../../domain/types'

/** Below this (₹50) a suggestion isn't worth the message. */
export const MIN_SWAP: Minor = 5_000

/** Someone with money open with you, in one currency. */
export interface SwapPerson {
  id: string
  /** As you know them (ties are broken by name, so every phone agrees). */
  name: string
  /** + they owe you, − you owe them. */
  net: Minor
}

/** `fromId` (owes you) pays `toId` (you owe) `amount` directly. */
export interface Swap {
  fromId: string
  toId: string
  amount: Minor
}

export interface SwapPlan {
  swaps: Swap[]
  /** How many fewer payments it takes, all told, if every suggestion is followed. */
  saved: number
}

interface Side {
  id: string
  name: string
  left: Minor
}

function largestFirst(a: Side, b: Side): number {
  if (a.left !== b.left) return b.left - a.left
  const an = a.name.toLocaleLowerCase('en')
  const bn = b.name.toLocaleLowerCase('en')
  if (an !== bn) return an < bn ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * Pairs the people who owe you with the people you owe: the largest of each first, for the
 * smaller of the two amounts, each person used until their balance runs out. Stops once the
 * largest pair left would be under `min`.
 */
export function swapPlan(people: readonly SwapPerson[], min: Minor = MIN_SWAP): SwapPlan {
  const owesMe: Side[] = []
  const iOwe: Side[] = []
  for (const p of people) {
    if (!Number.isSafeInteger(p.net) || p.net === 0) continue
    if (p.net > 0) owesMe.push({ id: p.id, name: p.name, left: p.net })
    else iOwe.push({ id: p.id, name: p.name, left: -p.net })
  }
  const before = owesMe.length + iOwe.length
  const swaps: Swap[] = []
  const floor = Math.max(1, min)
  while (owesMe.length > 0 && iOwe.length > 0) {
    owesMe.sort(largestFirst)
    iOwe.sort(largestFirst)
    const from = owesMe[0]
    const to = iOwe[0]
    if (!from || !to) break
    const amount = Math.min(from.left, to.left)
    // Every other pair is smaller still.
    if (amount < floor) break
    swaps.push({ fromId: from.id, toId: to.id, amount })
    from.left -= amount
    to.left -= amount
    if (from.left === 0) owesMe.shift()
    if (to.left === 0) iOwe.shift()
  }
  const after = swaps.length + owesMe.length + iOwe.length
  return { swaps, saved: Math.max(0, before - after) }
}

/** The key a suggestion is put away under: the pair and the amount (a new amount asks again). */
export function swapKey(swap: Swap): string {
  return `${swap.fromId}>${swap.toId}:${swap.amount}`
}

/** What a swap leaves open: who is cleared with you, and what's still owed either way. */
export interface SwapOutcome {
  /** both: everyone cleared; from: the one who owes you is cleared (you still owe `toLeft`);
   *  to: you're cleared with the one you owe (`fromLeft` still owed to you); neither: both still open. */
  cleared: 'both' | 'from' | 'to' | 'neither'
  /** What the one who owes you will still owe you. */
  fromLeft: Minor
  /** What you will still owe the one you owe. */
  toLeft: Minor
}

/**
 * After `swap`, from today's balances: `owed` is what its payer owes you now, `owe` what you owe
 * its payee now (both positive). Pure, so every sentence about a swap says the same thing.
 */
export function swapOutcome(swap: Swap, owed: Minor, owe: Minor): SwapOutcome {
  const fromLeft = Math.max(0, owed - swap.amount)
  const toLeft = Math.max(0, owe - swap.amount)
  const cleared = fromLeft === 0 && toLeft === 0 ? 'both' : fromLeft === 0 ? 'from' : toLeft === 0 ? 'to' : 'neither'
  return { cleared, fromLeft, toLeft }
}
