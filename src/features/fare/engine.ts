/**
 * Fair fare: a shared cab split by where each person got off. Pure.
 *
 * The ride is cut into legs at each stop. A leg's cost is the total × its weight ÷ all the weights
 * (its distance when every leg has one, else every leg counts the same), shared equally by whoever
 * was still in the cab. Each person pays the sum of their parts, allocated to the paisa so the
 * amounts always add up to the total exactly.
 */
import type { Minor } from '../../domain/types'
import { allocate } from '../../lib/money'

export interface FareRider {
  id: string
  name: string
}

export interface FareInput {
  riders: readonly FareRider[]
  total: Minor
  /**
   * Who got off at each stop, in order (several people can share a stop). Anyone not listed rode
   * to the end. Unknown ids, repeats and empty stops are ignored.
   */
  stops: readonly (readonly string[])[]
  /** Distance of each leg in km (leg i ends at stop i; one more for the last leg when riders are left). Used only when every leg has one. */
  km?: readonly (number | null | undefined)[]
}

export interface FareLeg {
  /** Who was in the cab for this leg. */
  riderIds: string[]
  /** Who got off at its end. */
  offIds: string[]
  km: number | null
}

export interface FarePerson {
  id: string
  amount: Minor
  /** Legs ridden (from the start), of all the legs. */
  legsRidden: number
  /** Distance ridden, when distances were used. */
  kmRidden: number | null
}

export interface FareResult {
  legs: FareLeg[]
  /** In the riders' order. */
  people: FarePerson[]
  /** Paise per person; sums to the total exactly. */
  amounts: Record<string, Minor>
  /** Everyone rode to the same stop: an equal split. */
  equal: boolean
  /** Distances were used as the weights. */
  byKm: boolean
}

/** Legs of the ride: one per stop, the riders still aboard and who got off at its end. */
export function fareLegs(riders: readonly FareRider[], stops: FareInput['stops'], km: FareInput['km'] = []): FareLeg[] {
  const known = new Set(riders.map((r) => r.id))
  const seen = new Set<string>()
  const groups: string[][] = []
  for (const stop of stops) {
    const off = stop.filter((id) => known.has(id) && !seen.has(id))
    off.forEach((id) => seen.add(id))
    if (off.length > 0) groups.push([...new Set(off)])
  }
  const left = riders.map((r) => r.id).filter((id) => !seen.has(id))
  if (left.length > 0) groups.push(left)
  const legs: FareLeg[] = []
  let aboard = riders.map((r) => r.id)
  groups.forEach((off, i) => {
    const distance = km[i]
    legs.push({ riderIds: aboard, offIds: off, km: typeof distance === 'number' && Number.isFinite(distance) && distance > 0 ? distance : null })
    aboard = aboard.filter((id) => !off.includes(id))
  })
  return legs
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/** The fair split. Rounding paise go by name (then id), so every phone gets the same answer. */
export function fairFare(input: FareInput): FareResult {
  const { riders } = input
  const total = Number.isSafeInteger(input.total) && input.total > 0 ? input.total : 0
  const legs = fareLegs(riders, input.stops, input.km)
  const byKm = legs.length > 1 && legs.every((leg) => leg.km !== null)
  // Integer weights keep the shares exact: km in hundredths, each leg's part per rider over a common multiple.
  const legWeight = legs.map((leg) => (byKm ? Math.round((leg.km ?? 0) * 100) : 1))
  const multiple = legs.reduce((m, leg) => (m * leg.riderIds.length) / gcd(m, leg.riderIds.length), 1)

  const weight = new Map<string, number>()
  const ridden = new Map<string, number>()
  const kmRidden = new Map<string, number>()
  legs.forEach((leg, i) => {
    const part = ((legWeight[i] ?? 0) * multiple) / leg.riderIds.length
    for (const id of leg.riderIds) {
      weight.set(id, (weight.get(id) ?? 0) + part)
      ridden.set(id, (ridden.get(id) ?? 0) + 1)
      kmRidden.set(id, (kmRidden.get(id) ?? 0) + (legWeight[i] ?? 0))
    }
  })

  const order = riders
    .map((r, i) => ({ r, i }))
    .sort((a, b) => a.r.name.localeCompare(b.r.name) || (a.r.id < b.r.id ? -1 : a.r.id > b.r.id ? 1 : 0))
  const shares = allocate(
    total,
    order.map(({ r }) => weight.get(r.id) ?? 0),
  )
  const amounts: Record<string, Minor> = {}
  order.forEach(({ r }, k) => {
    amounts[r.id] = shares[k] ?? 0
  })

  return {
    legs,
    people: riders.map((r) => ({
      id: r.id,
      amount: amounts[r.id] ?? 0,
      legsRidden: ridden.get(r.id) ?? 0,
      kmRidden: byKm ? (kmRidden.get(r.id) ?? 0) / 100 : null,
    })),
    amounts,
    equal: legs.length <= 1,
    byKm,
  }
}
