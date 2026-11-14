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

export type SpinMode = 'fair' | 'luck'

/** The part of the wheel everyone shares equally in fair mode (the rest goes by how far behind). */
export const FAIR_EQUAL_PART = 0.5

export interface SpinSlice {
  id: string
  /** Exact weight; all slices sum to 1. */
  weight: number
  /**
   * Chance in percent, to one decimal (12.5). Each is rounded on its own, so people with the same
   * standing always show the same number; together they may come to 99.9 or 100.1.
   */
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
 * so every phone draws the same wheel. Percentages are rounded to one decimal each (see `percent`).
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
  let at = 0
  return people.map((id, i) => {
    const weight = weights[i] ?? 0
    const start = at
    at = i === n - 1 ? 360 : at + weight * 360
    return { id, weight, percent: Math.round(weight * 1000) / 10, start, end: at, behind: behind[i] ?? 0 }
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

/** A chance as people read it: 50 → "50", 12.5 → "12.5". */
export function percentText(percent: number): string {
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(1)
}

/** The longest name written on the wheel (the full name is in the list under it). */
export const WHEEL_NAME_MAX = 9
/** A slice thinner than this has no name on the wheel: there's no room for a line of text. */
export const MIN_LABEL_DEGREES = 11

function cut(text: string, max: number): string {
  const chars = [...text]
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : text
}

/**
 * The short names written on the wheel: first names, cut with "…" past `WHEEL_NAME_MAX`. Two people
 * with the same first name get their surname's initial ("Rahul S."). Same order as `names`.
 */
export function wheelNames(names: readonly string[]): string[] {
  const words = names.map((name) => name.trim().split(/\s+/).filter(Boolean))
  const first = words.map((w) => cut(w[0] ?? '', WHEEL_NAME_MAX))
  return first.map((short, i) => {
    const clash = first.some((other, j) => j !== i && other.toLocaleLowerCase() === short.toLocaleLowerCase())
    const initial = [...(words[i]?.[1] ?? '')][0]
    return clash && initial ? `${cut(words[i]?.[0] ?? '', WHEEL_NAME_MAX - 3)} ${initial.toLocaleUpperCase()}.` : short
  })
}

export interface WheelLabel {
  id: string
  text: string
  /** The direction of the slice's middle, degrees clockwise from the top (on the wheel, before it turns). */
  angle: number
  /** Turn the text half round, so it isn't upside down where the wheel comes to rest. */
  flip: boolean
}

/**
 * What is written on each slice: its short name along the slice's middle, read from the centre out
 * on the right-hand side of the wheel and from the edge in on the left, so no name is upside down
 * once the wheel (turned by `rotation` degrees) stops. Slices too thin for a line of text get no
 * label: the list under the wheel names everyone. Nothing for a wheel of one.
 */
export function wheelLabels(slices: readonly SpinSlice[], nameOf: (id: string) => string, rotation: number): WheelLabel[] {
  if (slices.length < 2) return []
  const short = wheelNames(slices.map((s) => nameOf(s.id)))
  const out: WheelLabel[] = []
  slices.forEach((s, i) => {
    if (s.end - s.start < MIN_LABEL_DEGREES) return
    const angle = (s.start + s.end) / 2
    const resting = (((angle + rotation) % 360) + 360) % 360
    out.push({ id: s.id, text: short[i] ?? '', angle, flip: resting > 180 })
  })
  return out
}
