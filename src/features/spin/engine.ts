/**
 * "Who pays?": a wheel that picks who gets this bill. Pure: the random number generator comes in,
 * so a seeded one gives the same spin every time (tests).
 *
 * Fair (the default): half the wheel is shared equally, so everyone keeps a slice; the other half
 * goes to whoever is behind (has paid less for the group than their share of its spending), more
 * the further behind they are. Nobody behind (or everyone square) = equal slices.
 * Pure luck: equal slices.
 */
import type { Expense, Group, Minor } from '../../domain/types'
import { groupBalances } from '../../engine/balances'
import { allocate } from '../../lib/money'

export type SpinMode = 'fair' | 'luck'

/** The part of the wheel everyone shares equally in fair mode (the rest goes by how far behind). */
export const FAIR_EQUAL_PART = 0.5

export interface SpinSlice {
  id: string
  /** Exact weight; all slices sum to 1. */
  weight: number
  /** Whole-number chance; all slices sum to 100. */
  percent: number
  /** Where the slice starts and ends on the wheel, in degrees clockwise from the top. */
  start: number
  end: number
  /** How far behind they are in the group (0 when they're not), minor units. */
  behind: Minor
}

/** A random number in [0, 1). */
export type Random = () => number

/**
 * The wheel's slices for `ids` (already without anyone left out of this spin), ordered by name
 * so every phone draws the same wheel. Percentages are rounded by largest remainder, ties to the
 * name first, so they always add up to 100.
 */
export function spinSlices(ids: readonly string[], balances: Readonly<Record<string, Minor>>, mode: SpinMode, nameOf: (id: string) => string): SpinSlice[] {
  const people = [...new Set(ids)].sort((a, b) => nameOf(a).localeCompare(nameOf(b)) || (a < b ? -1 : a > b ? 1 : 0))
  const n = people.length
  if (n === 0) return []
  const behind = people.map((id) => {
    const b = balances[id]
    return typeof b === 'number' && Number.isFinite(b) && b < 0 ? -Math.round(b) : 0
  })
  const totalBehind = behind.reduce((sum, v) => sum + v, 0)
  const weights =
    mode === 'luck' || totalBehind === 0
      ? people.map(() => 1 / n)
      : behind.map((v) => FAIR_EQUAL_PART / n + ((1 - FAIR_EQUAL_PART) * v) / totalBehind)
  const percents = allocate(100, weights)
  let at = 0
  return people.map((id, i) => {
    const weight = weights[i] ?? 0
    const start = at
    at = i === n - 1 ? 360 : at + weight * 360
    return { id, weight, percent: percents[i] ?? 0, start, end: at, behind: behind[i] ?? 0 }
  })
}

/** The slices for a group's members, less anyone left out of this spin. */
export function groupSpinSlices(
  group: Group,
  expenses: readonly Expense[],
  mode: SpinMode,
  leftOut: ReadonlySet<string>,
  nameOf: (id: string) => string,
): SpinSlice[] {
  const balances = groupBalances(group, expenses)
  return spinSlices(
    group.memberIds.filter((id) => !leftOut.has(id)),
    balances,
    mode,
    nameOf,
  )
}

export interface SpinResult {
  id: string
  /** Where the pointer lands on the wheel (degrees clockwise from the top), inside the winner's slice. */
  angle: number
}

/** One spin: a point on the wheel from `random`, and whose slice it's in. Null for an empty wheel. */
export function spin(slices: readonly SpinSlice[], random: Random): SpinResult | null {
  if (slices.length === 0) return null
  let r = random()
  if (!Number.isFinite(r) || r < 0) r = 0
  if (r >= 1) r = 1 - Number.EPSILON
  const angle = r * 360
  const hit = slices.find((s) => angle >= s.start && angle < s.end) ?? slices[slices.length - 1]
  if (!hit) return null
  return { id: hit.id, angle }
}

/** A small seeded generator (mulberry32) for tests and replays. */
export function seededRandom(seed: number): Random {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
