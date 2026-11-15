/**
 * Fair rent: a flat's rent split by what each room is. Pure: nothing here reads a clock or a store.
 *
 * The method, in one breath: part of the rent pays for the common space and is shared equally by
 * everyone; the rest is shared by room points (the room's area, raised by what the room has), and
 * a room two people share has its part split between them. Amounts are whole rupees whenever the
 * rent is, and always add up to the rent exactly.
 */
import type { Minor } from '../../domain/types'
import { currencyDigits } from '../../lib/money'

export type RoomSize = 'small' | 'medium' | 'large'
export const ROOM_SIZES: readonly RoomSize[] = ['small', 'medium', 'large']

/** What a size chip counts as when no area is typed, in sq ft. Shown on the screen, so it is no secret. */
export const SIZE_AREA: Readonly<Record<RoomSize, number>> = { small: 90, medium: 120, large: 160 }

export interface Room {
  id: string
  size: RoomSize
  /** The typed area in sq ft; wins over the size chip. Null = go by the chip. */
  sqft: number | null
  bath: boolean
  balcony: boolean
  ac: boolean
  /** More light, quieter, a better view (or the opposite): a small manual nudge, in percent. */
  tweak: number
  /** Friend ids living in this room, in the order they were put there. */
  people: string[]
}

/** What each extra adds to a room's points, in percent. */
export interface Factors {
  bath: number
  balcony: number
  ac: number
}

export interface FairPlan {
  /** The whole monthly rent, in the currency's smallest unit. */
  rent: Minor
  currency: string
  /** The part of the rent that pays for common space, in percent. */
  commonPct: number
  factors: Factors
  rooms: Room[]
}

export const DEFAULT_FACTORS: Factors = { bath: 15, balcony: 10, ac: 10 }
export const COMMON_MIN = 20
export const COMMON_MAX = 60
export const COMMON_DEFAULT = 40
export const COMMON_STEP = 5
export const FACTOR_MAX = 50
export const FACTOR_STEP = 5
export const TWEAK_MAX = 20
export const TWEAK_STEP = 5
export const MAX_SQFT = 10_000
export const MAX_ROOMS = 12
export const MAX_PEOPLE = 12
/** A room never counts for less than this share of its bare area, whatever the nudge. */
const MIN_MULTIPLIER = 10

function clamp(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}

/** The area a room counts as: what was typed, or what its size chip stands for. */
export function roomArea(room: Pick<Room, 'size' | 'sqft'>): number {
  const typed = room.sqft
  if (typed !== null && Number.isFinite(typed) && typed > 0) return Math.min(MAX_SQFT, typed)
  return SIZE_AREA[room.size] ?? SIZE_AREA.medium
}

/** What a room's extras add up to, in percent of its bare area (100 = nothing added). */
export function roomMultiplier(room: Pick<Room, 'bath' | 'balcony' | 'ac' | 'tweak'>, factors: Factors): number {
  const extra =
    (room.bath ? clamp(factors.bath, 0, FACTOR_MAX, 0) : 0) +
    (room.balcony ? clamp(factors.balcony, 0, FACTOR_MAX, 0) : 0) +
    (room.ac ? clamp(factors.ac, 0, FACTOR_MAX, 0) : 0) +
    clamp(room.tweak, -TWEAK_MAX, TWEAK_MAX, 0)
  return Math.max(MIN_MULTIPLIER, 100 + extra)
}

/** Room points: area × what the room has. Always above zero. */
export function roomPoints(room: Room, factors: Factors): number {
  return (roomArea(room) * roomMultiplier(room, factors)) / 100
}

/**
 * The step amounts are dealt in: whole rupees (100 paise) when the total is a whole number of
 * rupees, otherwise the smallest unit, so the parts can still add up exactly.
 */
export function wholeUnit(total: Minor, currency: string): number {
  const major = 10 ** currencyDigits(currency)
  return major > 1 && total % major === 0 ? major : 1
}

/**
 * Deals `units` (a whole number) in proportion to `weights`: everyone gets the whole part of
 * their exact share, and the units left over go one each to the largest fractions. Equal
 * fractions are settled by `rank` (lower first), so identical people differ by at most one unit
 * and the same data gives the same answer on every phone.
 */
export function dealWhole(units: number, weights: readonly number[], rank: readonly number[]): number[] {
  const n = weights.length
  if (n === 0) return []
  const total = Number.isSafeInteger(units) && units > 0 ? units : 0
  const clean = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0))
  const sum = clean.reduce((a, b) => a + b, 0)
  const use = sum > 0 ? clean : clean.map(() => 1)
  const all = sum > 0 ? sum : n
  // Six decimals is far finer than any real difference between two people, and it takes the float dust out of ties.
  const exact = use.map((w) => Math.round(((total * w) / all) * 1e6) / 1e6)
  const out = exact.map((x) => Math.floor(x))
  const fraction = exact.map((x, i) => x - (out[i] ?? 0))
  const order = out.map((_, i) => i).sort((a, b) => (fraction[b] ?? 0) - (fraction[a] ?? 0) || (rank[a] ?? a) - (rank[b] ?? b) || a - b)
  let left = total - out.reduce((a, b) => a + b, 0)
  for (let i = 0; left > 0; i = (i + 1) % n, left -= 1) {
    const at = order[i] ?? 0
    out[at] = (out[at] ?? 0) + 1
  }
  // Only float dust can bring us here: take back from the smallest fractions first.
  for (let i = n - 1, guard = 0; left < 0 && guard < n * 4; i = (i - 1 + n) % n, guard += 1) {
    const at = order[i] ?? 0
    if ((out[at] ?? 0) > 0) {
      out[at] = (out[at] ?? 0) - 1
      left += 1
    }
  }
  return out
}

export interface PersonRent {
  friendId: string
  /** Position of their room in the plan (0 = the first room). */
  roomIndex: number
  room: Room
  /** The others living in the same room. */
  mates: string[]
  /** Their rent by this method. */
  amount: Minor
  /** What a plain equal split would have them pay. */
  equal: Minor
  /** `amount − equal`: above zero = pays more than an equal split. */
  diff: Minor
}

export interface FairResult {
  /** Everyone who is in a room: room by room, in the order they were put there. */
  people: PersonRent[]
  /** What the amounts add up to: the rent, or 0 when nobody is in a room. */
  total: Minor
  /** The part of the rent that pays for common space (shared equally). */
  commonPool: Minor
  /** The rest, shared by room points. */
  roomPool: Minor
  /** The step amounts were dealt in (100 = whole rupees). */
  unit: number
}

/** Names decide who gets an odd rupee, never ids: ids differ from phone to phone. */
export function nameRank(ids: readonly string[], nameOf: (id: string) => string): number[] {
  const keyed = ids.map((id, i) => ({ i, id, name: nameOf(id).trim().toLocaleLowerCase() }))
  const sorted = [...keyed].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const rank = new Array<number>(ids.length).fill(0)
  sorted.forEach((entry, position) => {
    rank[entry.i] = position
  })
  return rank
}

/**
 * Each person's rent. A person listed in two rooms counts in the first only; a room with nobody
 * in it is left out (the people who live there pay the whole rent between them).
 */
export function fairRent(plan: FairPlan, nameOf: (id: string) => string = (id) => id): FairResult {
  const rent = Number.isSafeInteger(plan.rent) && plan.rent > 0 ? plan.rent : 0
  const common = clamp(plan.commonPct, 0, 100, COMMON_DEFAULT) / 100
  const seen = new Set<string>()
  const rooms = plan.rooms.map((room, index) => {
    const people = room.people.filter((id) => {
      if (!id || seen.has(id)) return false
      seen.add(id)
      return true
    })
    return { room, index, people, points: roomPoints(room, plan.factors) }
  })
  const lived = rooms.filter((r) => r.people.length > 0)
  const ids = lived.flatMap((r) => r.people)
  const unit = wholeUnit(rent, plan.currency)
  const commonPool = Math.round(rent * common)
  if (ids.length === 0) return { people: [], total: 0, commonPool, roomPool: rent - commonPool, unit }

  const points = lived.reduce((sum, r) => sum + r.points, 0)
  const weights = lived.flatMap((r) => r.people.map(() => common / ids.length + ((1 - common) * r.points) / points / r.people.length))
  const rank = nameRank(ids, nameOf)
  const amounts = dealWhole(rent / unit, weights, rank)
  const equals = dealWhole(
    rent / unit,
    ids.map(() => 1),
    rank,
  )

  let at = 0
  const people: PersonRent[] = []
  for (const r of lived) {
    for (const friendId of r.people) {
      const amount = (amounts[at] ?? 0) * unit
      const equal = (equals[at] ?? 0) * unit
      people.push({ friendId, roomIndex: r.index, room: r.room, mates: r.people.filter((id) => id !== friendId), amount, equal, diff: amount - equal })
      at += 1
    }
  }
  return { people, total: rent, commonPool, roomPool: rent - commonPool, unit }
}

/** People of the flat who are in no room yet (so they are left out of the split until they are). */
export function unplaced(people: readonly string[], rooms: readonly Room[]): string[] {
  const placed = new Set(rooms.flatMap((r) => r.people))
  return people.filter((id) => !placed.has(id))
}
