/**
 * Fair bijli: splitting a flat's electricity bill so everyone pays for what they used — including
 * what their extra units did to the bill (dearer slabs, a lost subsidy, lost free units).
 *
 * The method is serial cost sharing (Moulin & Shenker, 1992). Everyone's everyday use (fridge,
 * lights, fans, geyser) is shared by the days they were home. Above that, each layer of units is
 * shared only by the people who used that much, so the top layer — and any cliff it crosses — falls
 * on whoever used the most. The lightest flatmate pays exactly what they'd pay if everyone used as
 * little as them; with one AC user it is "everyday split by days; your AC's units at the price they
 * actually added". On a flat-rate tariff it equals paying for your units.
 *
 * Extra units come from AC nights (weights from BEE's star-label method, calibrated to the bill),
 * room meters, or nothing (equal by days). Shares are reconciled to the amount actually billed, so
 * fuel adjustments and levies the tariff doesn't model are shared in the same proportions, and
 * Σ shares is the bill to the paisa.
 */
import { allocate, MAX_MINOR } from '../../lib/money'
import type { Minor } from '../../domain/types'
import type { Tariff, TariffContext } from './tariffs'

export type AcSize = 'none' | '1' | '1.5' | '2'
export type AcKind = 'inverter' | 'efficient' | 'old'
export type SplitBasis = 'ac' | 'meter' | 'equal'
/** Who pays a lost subsidy: whoever's use crossed the limit (default), or everyone by days. */
export type LostRule = 'crosser' | 'shared'

/**
 * Units an AC uses in an 8-hour night, 3-star inverter: BEE's 1,600 cooling hours with the ISO 16358
 * load line give about 0.45 / 0.66 / 0.93 kWh an hour for 1 / 1.5 / 2 tons.
 */
export const AC_UNITS_PER_NIGHT: Readonly<Record<Exclude<AcSize, 'none'>, number>> = { '1': 3.5, '1.5': 5, '2': 7 }
/** 5-star (or new inverter): ×0.8. Non-inverter or over 8 years old: ×1.7. */
export const AC_KIND_FACTOR: Readonly<Record<AcKind, number>> = { inverter: 1, efficient: 0.8, old: 1.7 }
/** Everyday units a person uses a day when the flat has no low bill to learn from. */
export const EVERYDAY_UNITS_PER_DAY = 3

export interface FairPersonInput {
  id: string
  /** Days home in the bill's period. */
  days: number
  /** AC nights (8 hours each) in the period. */
  acNights: number
  acSize: AcSize
  /** Units on their room's meter, for the room-meter basis. */
  roomUnits: number
}

export interface FairInput {
  tariff: Tariff
  ctx: TariffContext
  /** Units on the bill. */
  units: number
  /** The amount on the bill, in paise. */
  amount: Minor
  basis: SplitBasis
  /** Everyday units for the whole flat; null for the default (3 a person a day). */
  baseline: number | null
  acKind: AcKind
  lostRule: LostRule
  people: readonly FairPersonInput[]
}

export interface FairPerson {
  id: string
  share: Minor
  /** Their part of the everyday units and of the fixed charges. */
  everyday: Minor
  /** Their extra units (AC or room), at what they added to the bill. */
  extra: Minor
  /** The subsidy, free units or cheaper rate the flat lost because of their use. */
  lost: Minor
  /** Units put down to them (everyday by days + their extra). */
  units: number
  /** Their extra units alone. */
  extraUnits: number
  /** What an equal split (by days) would charge them. */
  equal: Minor
}

export interface FairResult {
  people: FairPerson[]
  /** Everyday units used for the split. */
  baseline: number
  /** Units above the everyday ones. */
  extraUnits: number
  /** How much of the extra units the AC nights account for (1 = all); null when not on AC nights. */
  acExplains: number | null
  /** What the tariff makes of the units, in paise, before matching the bill. */
  model: Minor
  /** The bill minus the model: fuel charges, arrears, levies the tariff doesn't know. */
  residual: Minor
  /** About what the bill would have been without anyone's extra units, matched like the shares. */
  withoutExtra: Minor | null
  /** The subsidy or free units lost to the extra use, in total. */
  lost: Minor
  /** Serial and per-unit give the same answer (no slabs, no cliffs in play). */
  flat: boolean
}

const toPaise = (rupees: number): Minor => Math.min(Math.max(0, Math.round(rupees * 100)), MAX_MINOR)
const clean = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0)

/** Units one AC night uses for `size` and `kind`. */
export function acUnitsPerNight(size: AcSize, kind: AcKind): number {
  return size === 'none' ? 0 : AC_UNITS_PER_NIGHT[size] * AC_KIND_FACTOR[kind]
}

/** The everyday units the split assumes when none are given: 3 a person a day, never more than the bill. */
export function defaultBaseline(people: readonly Pick<FairPersonInput, 'days'>[], units: number): number {
  const personDays = people.reduce((sum, p) => sum + clean(p.days), 0)
  return Math.min(clean(units), Math.round(EVERYDAY_UNITS_PER_DAY * personDays))
}

/** Each person's attributable units: everyday by days + their extra. */
function attribute(input: FairInput, weights: readonly number[]): { q: number[]; extra: number[]; baseline: number; acExplains: number | null } {
  const U = clean(input.units)
  const n = input.people.length
  if (input.basis === 'equal') return { q: weights.map((w) => w * U), extra: weights.map(() => 0), baseline: U, acExplains: null }

  if (input.basis === 'meter') {
    const rooms = input.people.map((p) => clean(p.roomUnits))
    const roomTotal = rooms.reduce((a, b) => a + b, 0)
    // Room meters reading more than the main meter: scale them down to it.
    const fit = roomTotal > U && roomTotal > 0 ? U / roomTotal : 1
    const extra = rooms.map((r) => r * fit)
    const baseline = Math.max(0, U - roomTotal * fit)
    return { q: weights.map((w, i) => w * baseline + (extra[i] ?? 0)), extra, baseline, acExplains: null }
  }

  // AC nights: the units above everyday use, shared by AC-nights × units-a-night.
  const baseline = Math.min(U, input.baseline === null ? defaultBaseline(input.people, U) : clean(input.baseline))
  const E = U - baseline
  const ac = input.people.map((p) => clean(p.acNights) * acUnitsPerNight(p.acSize, input.acKind))
  const acTotal = ac.reduce((a, b) => a + b, 0)
  if (acTotal === 0 || E === 0) {
    // Nobody's AC to put the extra on: it's everyday use too.
    return { q: weights.map((w) => w * U), extra: Array.from({ length: n }, () => 0), baseline: U, acExplains: E === 0 ? null : 0 }
  }
  const extra = ac.map((a) => (E * a) / acTotal)
  return { q: weights.map((w, i) => w * baseline + (extra[i] ?? 0)), extra, baseline, acExplains: acTotal / E }
}

/** Splits `input`'s bill fairly. Σ shares === input.amount. */
export function fairSplit(input: FairInput): FairResult {
  const { tariff, ctx } = input
  const people = input.people
  const n = people.length
  const amount = Math.min(Math.max(0, Math.round(input.amount)), MAX_MINOR)
  const U = clean(input.units)
  const days = people.map((p) => clean(p.days))
  const dayTotal = days.reduce((a, b) => a + b, 0)
  const weights = days.map((d) => (dayTotal > 0 ? d / dayTotal : 1 / Math.max(1, n)))
  const empty: FairResult = { people: [], baseline: 0, extraUnits: 0, acExplains: null, model: 0, residual: amount, withoutExtra: null, lost: 0, flat: true }
  if (n === 0) return empty

  const net = (Q: number) => tariff.bill(Math.max(0, Q), ctx).net
  const benefit = (Q: number) => {
    const b = tariff.bill(Math.max(0, Q), ctx)
    return Math.max(0, b.gross - b.net)
  }
  const { q, extra, baseline, acExplains } = attribute(input, weights)
  const F = net(0)
  const V = (Q: number) => net(Q) - F

  // Serial layers: sort by units; layer k costs V(Q_k) − V(Q_{k−1}), shared by everyone using at least q_(k).
  const order = q.map((units, i) => ({ units, i })).sort((a, b) => a.units - b.units)
  const everyday = weights.map((w) => w * F)
  const extraCost = Array.from({ length: n }, () => 0)
  const lostCost = Array.from({ length: n }, () => 0)
  let below = 0
  let prevQ = 0
  order.forEach(({ units }, k) => {
    const sharing = n - k
    // The last layer ends at the bill's units exactly (no floating-point drift).
    const Qk = k === n - 1 ? U : Math.min(U, below + sharing * units)
    const cost = V(Qk) - V(prevQ)
    const lost = Math.max(0, benefit(prevQ) - benefit(Qk))
    for (let j = k; j < n; j++) {
      const who = order[j]?.i ?? 0
      if (k === 0) everyday[who] = (everyday[who] ?? 0) + cost / sharing
      else {
        extraCost[who] = (extraCost[who] ?? 0) + (cost - lost) / sharing
        lostCost[who] = (lostCost[who] ?? 0) + lost / sharing
      }
    }
    below += units
    prevQ = Qk
  })

  // House rule: a lost subsidy shared by everyone (by days) instead of landing on whoever crossed.
  const lostTotal = lostCost.reduce((a, b) => a + b, 0)
  if (input.lostRule === 'shared' && lostTotal > 0) {
    for (let i = 0; i < n; i++) {
      everyday[i] = (everyday[i] ?? 0) + lostTotal * (weights[i] ?? 0)
      lostCost[i] = 0
    }
  }

  // Match the bill: the model's shares scaled to the amount on it (equal by days when the model says nothing).
  const model = net(U)
  const raw = people.map((_, i) => (everyday[i] ?? 0) + (extraCost[i] ?? 0) + (lostCost[i] ?? 0))
  const rawTotal = raw.reduce((a, b) => a + b, 0)
  const basis = rawTotal > 0 ? raw : weights
  const shares = allocate(amount, basis)
  const scale = rawTotal > 0 ? amount / 100 / rawTotal : 0

  const out: FairPerson[] = people.map((p, i) => {
    const share = shares[i] ?? 0
    // The parts, matched like the share and made to add up to it to the paisa.
    const lost = rawTotal > 0 ? toPaise((lostCost[i] ?? 0) * scale) : 0
    const extraPart = rawTotal > 0 ? toPaise((extraCost[i] ?? 0) * scale) : 0
    const everydayPart = Math.max(0, share - lost - extraPart)
    return {
      id: p.id,
      share,
      everyday: everydayPart,
      extra: share - everydayPart - lost,
      lost,
      units: q[i] ?? 0,
      extraUnits: extra[i] ?? 0,
      equal: 0,
    }
  })
  const equal = allocate(amount, weights)
  out.forEach((p, i) => (p.equal = equal[i] ?? 0))

  const extraUnits = Math.max(0, U - baseline)
  const withoutExtra = extraUnits > 0 && model > 0 ? toPaise((net(baseline) * amount) / 100 / model) : null
  // Linear in the range used: the same as paying for your units.
  const flat = !tariff.slabs && benefit(U) === benefit(0) && lostTotal === 0
  return {
    people: out,
    baseline,
    extraUnits,
    acExplains,
    model: toPaise(model),
    residual: amount - toPaise(model),
    withoutExtra,
    lost: toPaise(lostTotal * scale),
    flat,
  }
}
