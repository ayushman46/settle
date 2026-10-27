import { describe, expect, it } from 'vitest'
import { acUnitsPerNight, defaultBaseline, fairSplit, type FairInput, type FairPersonInput } from './fairSplit'
import { tariffById, telescopic, type TariffContext, type TariffId } from './tariffs'

const CTX: TariffContext = { days: 30, kw: 3, delhiSubsidy: true, gruhaJyothi: 0 }
const r = (rupees: number) => Math.round(rupees * 100)

function person(id: string, extra: Partial<FairPersonInput> = {}): FairPersonInput {
  return { id, days: 30, acNights: 0, acSize: '1.5', roomUnits: 0, ...extra }
}

function split(tariff: TariffId, units: number, amount: number, people: FairPersonInput[], extra: Partial<FairInput> = {}) {
  return fairSplit({
    tariff: tariffById(tariff),
    ctx: { ...CTX, ...extra.ctx },
    units,
    amount: r(amount),
    basis: 'ac',
    baseline: null,
    acKind: 'inverter',
    lostRule: 'crosser',
    people,
    ...extra,
  })
}
const shares = (result: ReturnType<typeof fairSplit>) => result.people.map((p) => p.share / 100)

describe('tariffs', () => {
  it('telescopic slabs charge each band at its rate', () => {
    expect(telescopic(450, [[200, 3], [400, 4.5], [800, 6.5]])).toBe(600 + 900 + 325)
    expect(telescopic(0, [[200, 3]])).toBe(0)
  })

  it('Delhi: the subsidy cliffs at 200 and 400 units', () => {
    const delhi = tariffById('delhi')
    expect(delhi.bill(270, CTX).net).toBeCloseTo(597.81, 2)
    expect(delhi.bill(450, CTX).net).toBeCloseTo(2592.19, 2)
    expect(delhi.bill(200, CTX).net).toBe(0)
    expect(delhi.bill(270, { ...CTX, delhiSubsidy: false }).net).toBeCloseTo(1397.81, 2)
  })

  it('Tamil Nadu: unit 501 costs the flat 100 free units', () => {
    const tn = tariffById('tnpdcl')
    expect(tn.bill(500, CTX).net).toBeCloseTo(1570, 2)
    expect(tn.bill(501, CTX).net).toBeCloseTo(2048.4, 2)
  })

  it('Telangana: the month’s units reprice every unit', () => {
    const tg = tariffById('tgspdcl')
    const ctx = { ...CTX, kw: 0 }
    expect(tg.bill(100, ctx).net).toBeCloseTo(252.5, 2)
    expect(tg.bill(101, ctx).net).toBeCloseTo(344.8, 2)
    expect(tg.bill(200, ctx).net).toBeCloseTo(820, 2)
    expect(tg.bill(201, ctx).net).toBeCloseTo(1027.7, 2)
  })

  it('Pune and Mumbai bills come to the orders’ figures', () => {
    expect(tariffById('msedcl').bill(520, CTX).net).toBeCloseTo(7986.14, 2)
    // AEML before duty (D5 table): 2,648.82 at 300 units; with 16% duty on all but TOSE.
    expect(tariffById('aeml').bill(300, CTX).net).toBeCloseTo((1435 + 287 + 684 + 135) * 1.16 + 107.82, 2)
  })
})

describe('fairSplit — the worked examples', () => {
  it('Bengaluru, no slabs: the same as paying for your units', () => {
    const result = split('bescom', 450, 3367.5, [person('A', { acNights: 28 }), person('B'), person('C')], {
      baseline: 270,
      ctx: { ...CTX, kw: 4 },
    })
    expect(shares(result)).toEqual([1860.5, 753.5, 753.5])
    expect(result.flat).toBe(true)
    expect(result.residual).toBe(0)
    expect(result.people[1]?.equal).toBe(r(1122.5))
  })

  it('Bengaluru with Gruha Jyothi: the AC costs the flat its free power — or the loss is shared', () => {
    const people = [person('A', { acNights: 30 }), person('B'), person('C')]
    const extra = { baseline: 150, ctx: { ...CTX, kw: 4, gruhaJyothi: 165 } }
    const crosser = split('bescom', 450, 3367.5, people, extra)
    expect(shares(crosser)).toEqual([3367.5, 0, 0])
    expect(crosser.people[0]?.lost).toBe(r(1522.5))
    const sharedLoss = split('bescom', 450, 3367.5, people, { ...extra, lostRule: 'shared' })
    expect(shares(sharedLoss)).toEqual([2352.5, 507.5, 507.5])
  })

  it('Delhi: the light users pay ₹199 each; the AC user pays their units and the ₹800 subsidy the flat lost', () => {
    const result = split('delhi', 450, 2592.19, [person('A', { acNights: 30 }), person('B'), person('C')], { baseline: 270 })
    expect(shares(result)).toEqual([2193.65, 199.27, 199.27])
    expect(result.people[0]).toMatchObject({ everyday: r(199.27), extra: r(1194.38), lost: r(800) })
    expect(result.withoutExtra).toBe(r(597.81))
    expect(result.lost).toBe(r(800))
    expect(result.flat).toBe(false)
    // An equal split would have been ₹864.06 (or .07) each.
    expect(result.people.map((p) => p.equal).reduce((a, b) => a + b, 0)).toBe(r(2592.19))
  })

  it('Delhi, the house rule "share a lost subsidy": ₹800 split three ways', () => {
    const result = split('delhi', 450, 2592.19, [person('A', { acNights: 30 }), person('B'), person('C')], { baseline: 270, lostRule: 'shared' })
    const [a, b, c] = shares(result)
    expect(a).toBeCloseTo(1660.31, 1)
    expect(b).toBeCloseTo(465.94, 1)
    expect(c).toBeCloseTo(465.94, 1)
    expect((a ?? 0) + (b ?? 0) + (c ?? 0)).toBeCloseTo(2592.19, 2)
  })

  it('Pune, two AC users: the moderate one never pays for the top slab only the heaviest reached', () => {
    // A ran 36 AC nights, B 20 (5 units a night): 180 and 100 of the 280 extra units.
    const result = split('msedcl', 520, 7986.14, [person('A', { acNights: 36 }), person('B', { acNights: 20 }), person('C')], { baseline: 240 })
    // The research rounds A to ₹4,323.51, a paisa short of the bill; to the paisa it's ₹4,323.52.
    expect(shares(result)).toEqual([4323.52, 2722.25, 940.37])
    expect(result.acExplains).toBe(1)
  })

  it('Chennai, bimonthly: the AC user pays the 100 free units the flat lost by crossing 500', () => {
    const people = [person('A', { days: 60, acNights: 60 }), person('B', { days: 60 }), person('C', { days: 60 })]
    const result = split('tnpdcl', 900, 5820, people, { baseline: 480, ctx: { ...CTX, days: 60 } })
    expect(result.people[0]?.share).toBe(r(4857.33))
    expect(result.people[0]?.lost).toBe(r(470))
    expect((result.people[1]?.share ?? 0) + (result.people[2]?.share ?? 0)).toBe(r(962.67))
    const sharedLoss = split('tnpdcl', 900, 5820, people, { baseline: 480, ctx: { ...CTX, days: 60 }, lostRule: 'shared' })
    expect(shares(sharedLoss)).toEqual([4544, 638, 638])
  })
})

describe('fairSplit — inputs', () => {
  it('matches the bill: a residual (fuel charge, arrears) is shared in the same proportions', () => {
    const result = split('delhi', 450, 2700, [person('A', { acNights: 30 }), person('B'), person('C')], { baseline: 270 })
    expect(result.residual).toBe(r(2700) - r(2592.19))
    expect(result.people.reduce((sum, p) => sum + p.share, 0)).toBe(r(2700))
    expect(result.people[0]!.share).toBeGreaterThan(result.people[1]!.share * 10)
  })

  it('days away: everyday use and fixed charges follow the days home', () => {
    const result = split('bescom', 300, 2445, [person('A'), person('B', { days: 15 })], { basis: 'equal' })
    expect(shares(result)).toEqual([1630, 815])
  })

  it('room meters: each room’s units on its people, the rest shared', () => {
    const result = split('bescom', 300, 2295, [person('A', { roomUnits: 120 }), person('B', { roomUnits: 30 })], { basis: 'meter' })
    expect(result.baseline).toBe(150)
    // A: 75 + 120 = 195 units; B: 75 + 30 = 105 — on a flat rate, by units (fixed ₹450 split equally).
    const [a, b] = shares(result)
    expect(a).toBeCloseTo(225 + 195 * 6.15, 2)
    expect(b).toBeCloseTo(225 + 105 * 6.15, 2)
  })

  it('room meters that add up to more than the main meter are scaled down to it', () => {
    const result = split('bescom', 100, 1065, [person('A', { roomUnits: 150 }), person('B', { roomUnits: 50 })], { basis: 'meter' })
    expect(result.baseline).toBe(0)
    expect(result.people.map((p) => p.extraUnits)).toEqual([75, 25])
  })

  it('no AC nights logged: the extra units are everyday use, split by days', () => {
    const result = split('delhi', 450, 2592.19, [person('A'), person('B'), person('C')], { baseline: 270 })
    expect(new Set(shares(result).map((x) => Math.round(x))).size).toBe(1)
    expect(result.acExplains).toBe(0)
  })

  it('says how much of the extra the AC nights explain', () => {
    // 10 nights × 5 units = 50 of 180 extra units.
    const result = split('delhi', 450, 2592.19, [person('A', { acNights: 10 }), person('B'), person('C')], { baseline: 270 })
    expect(result.acExplains).toBeCloseTo(50 / 180, 5)
  })

  it('defaults to 3 everyday units a person a day, never more than the bill', () => {
    expect(defaultBaseline([{ days: 30 }, { days: 30 }, { days: 30 }], 450)).toBe(270)
    expect(defaultBaseline([{ days: 30 }, { days: 30 }, { days: 30 }], 200)).toBe(200)
  })

  it('AC units a night follow size and kind', () => {
    expect(acUnitsPerNight('1.5', 'inverter')).toBe(5)
    expect(acUnitsPerNight('1.5', 'efficient')).toBe(4)
    expect(acUnitsPerNight('1', 'old')).toBeCloseTo(5.95, 5)
    expect(acUnitsPerNight('none', 'inverter')).toBe(0)
  })

  it('a free month (within the subsidy) costs nobody anything', () => {
    const result = split('delhi', 150, 0, [person('A'), person('B')])
    expect(shares(result)).toEqual([0, 0])
  })

  it('the bill is always split to the paisa, whatever the inputs', () => {
    const tariffs: TariffId[] = ['bescom', 'msedcl', 'aeml', 'delhi', 'tnpdcl', 'tgspdcl', 'cesc', 'torrent', 'ugvcl', 'uppcl', 'flat']
    for (const id of tariffs) {
      for (const units of [0, 37, 199, 401, 777, 1500]) {
        const people = [person('A', { acNights: 17, acSize: '2' }), person('B', { days: 9, acNights: 3, acSize: '1' }), person('C', { days: 0 }), person('D')]
        const result = split(id, units, 1234.57, people)
        expect(result.people.reduce((sum, p) => sum + p.share, 0)).toBe(r(1234.57))
        for (const p of result.people) {
          expect(p.share).toBeGreaterThanOrEqual(0)
          expect(p.everyday + p.extra + p.lost).toBe(p.share)
        }
      }
    }
  })
})
