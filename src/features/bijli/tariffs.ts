/**
 * Domestic electricity tariffs in force on 27 October 2026, for splitting a flat's bill fairly.
 *
 * Each tariff gives what a bill of `units` comes to — `net`, after any subsidy or free units, and
 * `gross`, without the scheme that has a cliff (so the difference is what a cliff costs). Only
 * components read in the official orders are modelled: energy slabs, per-unit adders, fixed
 * charges and the verified levies. Month-to-month fuel adjustments, duties we couldn't verify and
 * arrears are not: the split is reconciled to the amount actually on the bill, so they're shared in
 * the same proportions. The shape — slabs, cliffs, subsidies — is what makes a split fair.
 *
 * Sources (orders and schedules): KERC Tariff Order 2025 (BESCOM, FY27); MERC Case 75/2025
 * (MSEDCL, FY27) and Case 211/2024 (AEML, FY27, FAC for October 2026); DERC Tariff Order 2021 with
 * the BSES subsidy leaflet (Delhi); TNERC T.O. 6/2025 and Order 5/2026 (TNPDCL); TGERC RST Order
 * FY27 (TGSPDCL); WBERC TP-102 (CESC, FPPAS Sept 2026); GERC Cases 2585/2025 and 2584/2025
 * (Torrent Ahmedabad, UGVCL); UPERC order of 2 July 2026 (UPPCL, FPPAS October 2026).
 */

export type TariffId = 'bescom' | 'msedcl' | 'aeml' | 'delhi' | 'tnpdcl' | 'tgspdcl' | 'cesc' | 'torrent' | 'ugvcl' | 'uppcl' | 'flat'

/** What a crossed limit costs the flat, for the one-line explanation. */
export type LostKind = 'subsidy' | 'freeUnits' | 'cheaperRate'

export interface TariffContext {
  /** Days the bill covers. */
  days: number
  /** Sanctioned load in kW (on the bill). */
  kw: number
  /** Delhi: the connection takes the state subsidy. */
  delhiSubsidy: boolean
  /** BESCOM: Gruha Jyothi eligible units a month; 0 when not enrolled. */
  gruhaJyothi: number
}

export interface TariffBill {
  /** What the bill comes to, in rupees, after any subsidy or free units. */
  net: number
  /** The same without the scheme that has a cliff (equal to `net` where there's none). */
  gross: number
}

export interface Tariff {
  id: TariffId
  /** The company, as printed on the bill. */
  company: string
  /** Where it supplies. */
  city: string
  period: 'monthly' | 'bimonthly'
  /** Slabs or cliffs make the last units dearer than the average: a fair split differs from "pay for your units". */
  slabs: boolean
  /** What crossing a limit loses, when the tariff has one. */
  lost: LostKind | null
  bill(units: number, ctx: TariffContext): TariffBill
}

/** Days a bill of each kind usually covers. */
export const PERIOD_DAYS = { monthly: 30, bimonthly: 60 } as const

/** Telescopic charge: each band's units at its rate. `bands` are [up to (units), ₹/unit]; null is "and above". */
export function telescopic(units: number, bands: ReadonlyArray<readonly [number | null, number]>): number {
  let charge = 0
  let from = 0
  for (const [upTo, rate] of bands) {
    if (units <= from) break
    const top = upTo ?? Number.POSITIVE_INFINITY
    charge += (Math.min(units, top) - from) * rate
    from = top
  }
  return charge
}

const same = (amount: number): TariffBill => ({ net: amount, gross: amount })

/** Delhi's fixed charge per kW, by sanctioned load. */
function delhiPerKw(kw: number): number {
  if (kw <= 2) return 20
  if (kw <= 5) return 50
  if (kw <= 15) return 100
  if (kw <= 25) return 200
  return 250
}

/** UGVCL's fixed charge by connected load. */
function ugvclFixed(kw: number): number {
  if (kw <= 2) return 15
  if (kw <= 4) return 25
  if (kw <= 6) return 45
  return 70
}

/** Telangana: the month's total picks the category, and the category prices every unit. */
function telanganaEnergy(units: number): number {
  if (units <= 100) return telescopic(units, [[50, 1.95], [null, 3.1]])
  if (units <= 200) return telescopic(units, [[100, 3.4], [null, 4.8]])
  return telanganaTop(units)
}
const telanganaTop = (units: number): number => telescopic(units, [[200, 5.1], [300, 7.7], [400, 9], [800, 9.5], [null, 10]])

/** Tamil Nadu, bimonthly, what the consumer pays after the state subsidy (from 10 May 2026). */
const TN_UPTO_500: ReadonlyArray<readonly [number | null, number]> = [[200, 0], [400, 4.7], [null, 6.3]]
const TN_ABOVE_500: ReadonlyArray<readonly [number | null, number]> = [[100, 0], [400, 4.7], [500, 6.3], [600, 8.4], [800, 9.45], [1000, 10.5], [null, 11.55]]

export const TARIFFS: readonly Tariff[] = [
  {
    id: 'bescom',
    company: 'BESCOM',
    city: 'Bengaluru',
    period: 'monthly',
    slabs: false,
    lost: 'freeUnits',
    bill(units, { kw, gruhaJyothi }) {
      // One rate since KERC's 2025 order (₹5.80) plus the 35 p pension & gratuity surcharge; ₹150/kW fixed.
      const fixed = 150 * kw
      const gross = fixed + units * 6.15
      const eligible = Math.min(200, Math.max(0, gruhaJyothi))
      // Gruha Jyothi: free up to the eligible units, the eligible amount off up to 200, the full bill above.
      if (eligible > 0 && units <= 200) return { gross, net: units <= eligible ? 0 : gross - (fixed + eligible * 6.15) }
      return same(gross)
    },
  },
  {
    id: 'msedcl',
    company: 'MSEDCL',
    city: 'Pune and the rest of Maharashtra',
    period: 'monthly',
    slabs: true,
    lost: null,
    bill(units) {
      // Telescopic energy, ₹1.60 wheeling on every unit, ₹130 + ₹10 urban fixed, 16% electricity duty.
      const energy = telescopic(units, [[100, 3.96], [300, 10.8], [500, 15.03], [null, 17.53]]) + 1.6 * units
      return same((energy + 140) * 1.16)
    },
  },
  {
    id: 'aeml',
    company: 'Adani Electricity (AEML)',
    city: 'Mumbai suburbs',
    period: 'monthly',
    slabs: true,
    lost: null,
    bill(units) {
      // Energy + FAC by slab (October 2026) + ₹2.28 wheeling; the fixed charge steps with the month's units;
      // 16% duty; TOSE 35.94 p a unit.
      const energy = telescopic(units, [[100, 2.65], [300, 5.85], [500, 7.1], [null, 8.35]])
      const fac = telescopic(units, [[100, 0.53], [300, 1.17], [500, 1.38], [null, 1.52]])
      const fixed = units <= 100 ? 90 : units <= 500 ? 135 : 160
      return same((energy + fac + 2.28 * units + fixed) * 1.16 + 0.3594 * units)
    },
  },
  {
    id: 'delhi',
    company: 'BSES Rajdhani, BSES Yamuna or Tata Power-DDL',
    city: 'Delhi',
    period: 'monthly',
    slabs: true,
    lost: 'subsidy',
    bill(units, { kw, days, delhiSubsidy }) {
      // Telescopic energy and a per-kW fixed charge, then 8% + 7% surcharges, FPPAS (10% in October 2026)
      // and 5% electricity tax: ×1.3125.
      const energy = telescopic(units, [[200, 3], [400, 4.5], [800, 6.5], [1200, 7], [null, 8]])
      const gross = (energy + delhiPerKw(kw) * kw) * 1.3125
      if (!delhiSubsidy) return same(gross)
      // The subsidy, its limits prorated by the days billed: the whole bill up to 200 units, up to ₹800 up to 400, nothing above.
      const scale = days / 30
      if (units <= 200 * scale) return { gross, net: 0 }
      if (units <= 400 * scale) return { gross, net: Math.max(0, gross - 800) }
      return same(gross)
    },
  },
  {
    id: 'tnpdcl',
    company: 'TNPDCL',
    city: 'Chennai and Tamil Nadu',
    period: 'bimonthly',
    slabs: true,
    lost: 'freeUnits',
    bill(units) {
      // Bimonthly. Up to 500 units: 200 free; above 500, only 100 free and dearer slabs. No fixed charge.
      const above = telescopic(units, TN_ABOVE_500)
      return { gross: above, net: units <= 500 ? telescopic(units, TN_UPTO_500) : above }
    },
  },
  {
    id: 'tgspdcl',
    company: 'TGSPDCL',
    city: 'Hyderabad and Telangana',
    period: 'monthly',
    slabs: true,
    lost: 'cheaperRate',
    bill(units, { kw }) {
      // The month's units pick the category, which reprices every unit; ₹10/kW fixed (₹50/kW above 800 units).
      const fixed = (units > 800 ? 50 : 10) * kw
      return { gross: telanganaTop(units) + fixed, net: telanganaEnergy(units) + fixed }
    },
  },
  {
    id: 'cesc',
    company: 'CESC',
    city: 'Kolkata',
    period: 'monthly',
    slabs: true,
    lost: null,
    bill(units, { kw }) {
      // Telescopic energy, ₹15/kVA fixed, FPPAS 8.2% (September 2026).
      const energy = telescopic(units, [[25, 5.18], [60, 5.69], [100, 6.7], [150, 7.45], [300, 7.62], [null, 9.21]])
      return same((energy + 15 * kw) * 1.082)
    },
  },
  {
    id: 'torrent',
    company: 'Torrent Power',
    city: 'Ahmedabad and Surat',
    period: 'monthly',
    slabs: true,
    lost: null,
    bill(units) {
      // Telescopic energy, ₹25 single-phase fixed, base FPPAS ₹3.72 a unit.
      return same(telescopic(units, [[50, 3.2], [200, 3.95], [null, 5]]) + 25 + 3.72 * units)
    },
  },
  {
    id: 'ugvcl',
    company: 'UGVCL',
    city: 'North Gujarat',
    period: 'monthly',
    slabs: true,
    lost: null,
    bill(units, { kw }) {
      // Telescopic energy, fixed by load, FPPAS ₹2.45 a unit + 3.99% (from July 2026).
      const energy = telescopic(units, [[50, 3.05], [100, 3.5], [250, 4.15], [null, 5.2]])
      return same((energy + 2.45 * units + ugvclFixed(kw)) * 1.0399)
    },
  },
  {
    id: 'uppcl',
    company: 'UPPCL or NPCL',
    city: 'Noida, Lucknow and urban UP',
    period: 'monthly',
    slabs: true,
    lost: null,
    bill(units, { kw }) {
      // Telescopic energy, ₹110/kW fixed, FPPAS −5.24% (October 2026).
      return same((telescopic(units, [[150, 5.5], [300, 6], [null, 6.5]]) + 110 * kw) * 0.9476)
    },
  },
  {
    id: 'flat',
    company: '',
    city: '',
    period: 'monthly',
    slabs: false,
    lost: null,
    // Anywhere else: every unit at the same rate (the bill's own average, once reconciled).
    bill: (units) => same(units),
  },
]

export function tariffById(id: TariffId): Tariff {
  return TARIFFS.find((t) => t.id === id) ?? (TARIFFS[TARIFFS.length - 1] as Tariff)
}
