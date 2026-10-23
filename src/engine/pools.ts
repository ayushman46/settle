/**
 * Collections (chanda / pools): how much is in, against what goal, who is "in" and who still owes.
 * Pure and exact — every amount is integer minor units; nothing here reads a store.
 */
import type { Contribution, Minor, Pool } from '../domain/types'
import { currencyDigits } from '../lib/money'
import { nameKey } from '../lib/people'

export interface PoolProgress {
  collected: Minor
  /** Goal: fixed → perPerson × (memberIds.length || expectedCount); target → target; null when unknown. */
  goal: Minor | null
  /** max(0, goal − collected) or null. */
  remaining: Minor | null
  /** Over the goal (0 when not). */
  over: Minor
  /** 0..100, floor; null without a goal. */
  percent: number | null
  /** People counted "in": fixed → paid ≥ perPerson; target → anyone with a contribution. */
  inCount: number
  /** Expected head count, or null (open list without expectedCount). */
  expected: number | null
  /** friendId → what they still owe (fixed mode, memberIds only); 0 when done. */
  due: Record<string, Minor>
}

/** The key one person's contributions are summed under: their friend id, else their name, lower-cased. */
export function contributorKey(c: Pick<Contribution, 'friendId' | 'name'>): string {
  return c.friendId ?? nameKey(c.name)
}

/** Contributions summed per person key (friendId, else lower-cased name). */
export function paidBy(pool: Pick<Pool, 'contributions'>): Map<string, Minor> {
  const out = new Map<string, Minor>()
  for (const c of pool.contributions) {
    const key = contributorKey(c)
    out.set(key, (out.get(key) ?? 0) + c.amount)
  }
  return out
}

/** How many people the organiser expects: the listed people, else "about how many", else null. */
export function expectedCount(pool: Pick<Pool, 'memberIds' | 'expectedCount'>): number | null {
  if (pool.memberIds.length > 0) return pool.memberIds.length
  return pool.expectedCount !== null && pool.expectedCount > 0 ? pool.expectedCount : null
}

/** The collection's goal, or null when it can't be known (an open "same for everyone" list, a target without one). */
export function poolGoal(pool: Pick<Pool, 'mode' | 'perPerson' | 'target' | 'memberIds' | 'expectedCount'>): Minor | null {
  if (pool.mode === 'fixed') {
    const people = expectedCount(pool)
    return pool.perPerson !== null && pool.perPerson > 0 && people !== null ? pool.perPerson * people : null
  }
  return pool.target !== null && pool.target > 0 ? pool.target : null
}

/** True when this person counts as "in": paid their part (fixed) or gave anything (target). */
export function isIn(pool: Pick<Pool, 'mode' | 'perPerson'>, paid: Minor): boolean {
  if (paid <= 0) return false
  return pool.mode === 'fixed' && pool.perPerson !== null ? paid >= pool.perPerson : true
}

export function poolProgress(pool: Pool): PoolProgress {
  const paid = paidBy(pool)
  let collected = 0
  for (const amount of paid.values()) collected += amount
  const goal = poolGoal(pool)
  let inCount = 0
  for (const amount of paid.values()) if (isIn(pool, amount)) inCount++
  const due: Record<string, Minor> = {}
  if (pool.mode === 'fixed' && pool.perPerson !== null) {
    for (const id of pool.memberIds) due[id] = Math.max(0, pool.perPerson - (paid.get(id) ?? 0))
  }
  return {
    collected,
    goal,
    remaining: goal === null ? null : Math.max(0, goal - collected),
    over: goal === null ? 0 : Math.max(0, collected - goal),
    percent: goal === null ? null : Math.min(100, Math.floor((collected * 100) / goal)),
    inCount,
    expected: expectedCount(pool),
    due,
  }
}

/** ₹50 (or 50 of any currency) in minor units: the step suggestions round up to. */
export function suggestionStep(currency: string): Minor {
  return 50 * 10 ** currencyDigits(currency)
}

/** Target mode suggestion: ceil((goal − collected) / people left, to ₹50), min ₹50; null without goal or people. */
export function suggestedContribution(goal: Minor | null, collected: Minor, peopleLeft: number, currency: string): Minor | null {
  if (goal === null || goal <= 0 || !Number.isFinite(peopleLeft) || peopleLeft < 1) return null
  const left = goal - Math.max(0, collected)
  if (left <= 0) return null
  const step = suggestionStep(currency)
  const people = Math.floor(peopleLeft)
  // ceil(left / people / step) × step, in integers.
  return Math.max(step, Math.ceil(left / (people * step)) * step)
}
