import { describe, expect, it, vi } from 'vitest'
import { cashPlan, DENOMINATIONS, fewestPieces, pieceCount, pilesTotal, type Pile } from './engine'

// The machine may be busy: these loops check thousands of amounts.
vi.setConfig({ testTimeout: 30_000 })

const rs = (rupees: number): number => rupees * 100
/** "500x3 100" for piles, to keep expectations readable. */
const show = (piles: readonly Pile[]): string => piles.map((p) => (p.count === 1 ? `${p.value}` : `${p.value}x${p.count}`)).join(' ')
const plan = (rupees: number) => {
  const p = cashPlan(rs(rupees), 'INR')
  if (!p) throw new Error(`no plan for ${rupees}`)
  return p
}

/** The fewest pieces for every sum up to `max`, by trying everything (no greedy shortcut). */
function fewestByForce(max: number): number[] {
  const best = new Array<number>(max + 1).fill(Infinity)
  best[0] = 0
  for (let sum = 1; sum <= max; sum++) {
    for (const d of DENOMINATIONS) {
      if (d <= sum) best[sum] = Math.min(best[sum] ?? Infinity, (best[sum - d] ?? Infinity) + 1)
    }
  }
  return best
}

describe('fewestPieces', () => {
  it('uses the largest notes first', () => {
    expect(show(fewestPieces(1370))).toBe('500x2 200 100 50 20')
    expect(show(fewestPieces(130))).toBe('100 20 10')
    expect(show(fewestPieces(1500))).toBe('500x3')
    expect(show(fewestPieces(888))).toBe('500 200 100 50 20 10 5 2 1')
  })

  it('handles coins, and nothing at all', () => {
    expect(show(fewestPieces(9))).toBe('5 2x2')
    expect(show(fewestPieces(4))).toBe('2x2')
    expect(show(fewestPieces(1))).toBe('1')
    expect(fewestPieces(0)).toEqual([])
    expect(fewestPieces(-5)).toEqual([])
    expect(fewestPieces(1.5)).toEqual([])
    expect(fewestPieces(Number.NaN)).toEqual([])
  })

  it('is truly the fewest for every amount up to ₹3,000', () => {
    const best = fewestByForce(3000)
    const wrong: number[] = []
    for (let r = 1; r <= 3000; r++) {
      const piles = fewestPieces(r)
      if (pilesTotal(piles) !== r || pieceCount(piles) !== best[r]) wrong.push(r)
    }
    expect(wrong).toEqual([])
  })

  it('copes with a very large amount without counting note by note', () => {
    const piles = fewestPieces(10_00_00_000 + 370)
    expect(piles[0]).toEqual({ value: 500, count: 2_00_000 })
    expect(pilesTotal(piles)).toBe(10_00_00_370)
  })
})

describe('cashPlan', () => {
  it('₹1,370: give ₹1,500 as three ₹500 notes, get ₹130 back as ₹100, ₹20, ₹10', () => {
    const p = plan(1370)
    expect(p.amount).toBe(rs(1370))
    expect(p.give).toBe(rs(1500))
    expect(show(p.givePiles)).toBe('500x3')
    expect(p.change).toBe(rs(130))
    expect(show(p.changePiles)).toBe('100 20 10')
    expect(p.pieces).toBe(6)
    expect(p.fromPaise).toBe(false)
  })

  it('offers the exact notes too when the best way involves change', () => {
    expect(show(plan(1370).exact ?? [])).toBe('500x2 200 100 50 20')
    expect(plan(1000).exact).toBeNull()
  })

  it('₹1,370: rounding to ₹1,400 and calling ₹30 even moves fewer notes', () => {
    const round = plan(1370).round
    expect(round).not.toBeNull()
    expect(round?.to).toBe(rs(1400))
    expect(round?.diff).toBe(rs(30))
    expect(round?.up).toBe(true)
    expect(round?.pieces).toBe(4)
    expect(round?.give).toBe(rs(1500))
    expect(show(round?.changePiles ?? [])).toBe('100')
  })

  it('exact amounts: the notes add up and there is no change', () => {
    for (const [rupees, piles] of [
      [10, '10'],
      [500, '500'],
      [1000, '500x2'],
      [700, '500 200'],
      [2500, '500x5'],
      [250, '200 50'],
      [5, '5'],
      [2, '2'],
      [1, '1'],
    ] as const) {
      const p = plan(rupees)
      expect(p.give, `give for ${rupees}`).toBe(rs(rupees))
      expect(show(p.givePiles), `piles for ${rupees}`).toBe(piles)
      expect(p.change).toBe(0)
      expect(p.changePiles).toEqual([])
      expect(p.exact).toBeNull()
    }
  })

  it('amounts under ₹10', () => {
    // ₹9: a ₹10 note and ₹1 back (2 pieces) beats 5 + 2 + 2 (3 pieces).
    expect(plan(9)).toMatchObject({ give: rs(10), change: rs(1), pieces: 2 })
    expect(show(plan(9).changePiles)).toBe('1')
    // ₹8: ₹10 and ₹2 back (2) beats 5 + 2 + 1 (3).
    expect(plan(8)).toMatchObject({ give: rs(10), change: rs(2), pieces: 2 })
    // ₹7: 5 + 2 (2 pieces) beats ₹10 and 2 + 1 back (3).
    expect(plan(7)).toMatchObject({ give: rs(7), change: 0, pieces: 2 })
    expect(show(plan(7).givePiles)).toBe('5 2')
    // ₹6: 5 + 1.
    expect(plan(6)).toMatchObject({ give: rs(6), change: 0, pieces: 2 })
    // ₹4: a tie at two pieces (2 + 2, or ₹5 with ₹1 back): the payer hands over fewer.
    expect(plan(4)).toMatchObject({ give: rs(5), change: rs(1), pieces: 2 })
    // ₹3: a tie again (2 + 1, or ₹5 with ₹2 back).
    expect(plan(3)).toMatchObject({ give: rs(5), change: rs(2), pieces: 2 })
    // Too small to round to anything.
    for (const r of [1, 2, 3, 4, 5, 6, 7, 8, 9]) expect(plan(r).round, `round for ${r}`).toBeNull()
  })

  it('just under a note: hand over the note', () => {
    expect(plan(499)).toMatchObject({ give: rs(500), change: rs(1), pieces: 2 })
    expect(plan(480)).toMatchObject({ give: rs(500), change: rs(20), pieces: 2 })
    expect(plan(999)).toMatchObject({ give: rs(1000), change: rs(1), pieces: 3 })
    expect(plan(95)).toMatchObject({ give: rs(100), change: rs(5), pieces: 2 })
  })

  it('never has the same note going both ways, and never overpays by ₹500 or more', () => {
    const wrong: number[] = []
    for (let r = 1; r <= 2500; r++) {
      const p = plan(r)
      const given = new Set(p.givePiles.map((x) => x.value))
      if (p.changePiles.some((back) => given.has(back.value)) || p.change >= rs(500)) wrong.push(r)
    }
    expect(wrong).toEqual([])
  })

  it('the notes always add up: given − change = the amount, to the rupee', () => {
    const wrong: number[] = []
    for (let r = 1; r <= 2500; r++) {
      const p = plan(r)
      const ok =
        pilesTotal(p.givePiles) * 100 === p.give &&
        pilesTotal(p.changePiles) * 100 === p.change &&
        p.give - p.change === rs(r) &&
        p.pieces === pieceCount(p.givePiles) + pieceCount(p.changePiles) &&
        (p.exact === null || pilesTotal(p.exact) === r) &&
        (p.round === null ||
          (pilesTotal(p.round.givePiles) * 100 === p.round.give &&
            pilesTotal(p.round.changePiles) * 100 === p.round.change &&
            p.round.give - p.round.change === p.round.to &&
            p.round.pieces === pieceCount(p.round.givePiles) + pieceCount(p.round.changePiles) &&
            Math.abs(p.round.to - rs(r)) === p.round.diff))
      if (!ok) wrong.push(r)
    }
    expect(wrong).toEqual([])
  })

  it('nothing moves fewer pieces: checked against every way to pay with change, up to ₹2,000', () => {
    const best = fewestByForce(4200)
    const wrong: number[] = []
    for (let r = 1; r <= 2000; r++) {
      let fewest = Infinity
      // Far more overpayment than the engine tries, to prove its ₹499 limit loses nothing.
      for (let over = 0; over <= 2000; over++) fewest = Math.min(fewest, (best[r + over] ?? Infinity) + (best[over] ?? Infinity))
      if (plan(r).pieces !== fewest) wrong.push(r)
    }
    expect(wrong).toEqual([])
  })

  it('on a tie the payer hands over fewer notes', () => {
    // ₹130: 100 + 20 + 10 (3 given), ₹150 with ₹20 back (2 given), ₹200 with ₹70 back (1 given): all 3 pieces.
    expect(plan(130)).toMatchObject({ give: rs(200), change: rs(70), pieces: 3 })
    // ₹30: 20 + 10 (2 given) or ₹50 with ₹20 back (1 given).
    expect(plan(30)).toMatchObject({ give: rs(50), change: rs(20), pieces: 2 })
  })

  it('rounding is offered only when it moves fewer notes, stays within ₹50 and within a tenth', () => {
    const wrong: number[] = []
    let offered = 0
    for (let r = 1; r <= 2500; r++) {
      const p = plan(r)
      if (!p.round) continue
      offered += 1
      const ok =
        p.round.pieces < p.pieces &&
        p.round.diff > 0 &&
        p.round.diff <= rs(50) &&
        p.round.diff * 10 <= rs(r) &&
        p.round.to % rs(10) === 0 &&
        p.round.up === p.round.to > rs(r)
      if (!ok) wrong.push(r)
    }
    expect(wrong).toEqual([])
    expect(offered).toBeGreaterThan(100)
  })

  it('rounding: examples', () => {
    // ₹45 → ₹50 is ₹5 on ₹45: more than a tenth, so not offered.
    expect(plan(45).round).toBeNull()
    // ₹48 → ₹50: one note instead of a note and a coin back.
    expect(plan(48).round).toMatchObject({ to: rs(50), diff: rs(2), up: true, pieces: 1 })
    // ₹1,020 → ₹1,000: rounding down, the one being paid lets ₹20 go.
    expect(plan(1020).round).toMatchObject({ to: rs(1000), diff: rs(20), up: false, pieces: 2 })
    // Already as simple as it gets.
    expect(plan(1000).round).toBeNull()
    expect(plan(500).round).toBeNull()
    // ₹260 → ₹250 (two notes) rather than ₹300 (too far).
    expect(plan(260).round).toMatchObject({ to: rs(250), diff: rs(10), up: false })
  })

  it('a tie between rounding down and up by the same distance goes down', () => {
    // ₹1,150: ₹1,100 and ₹1,200 are both ₹50 away and both take three notes.
    expect(plan(1100).pieces).toBe(plan(1200).pieces)
    expect(plan(1150).round).toMatchObject({ to: rs(1100), diff: rs(50), up: false })
  })

  it('paise: cash is worked out to the nearest rupee, and says so', () => {
    expect(cashPlan(137050, 'INR')).toMatchObject({ amount: rs(1371), fromPaise: true })
    expect(cashPlan(137049, 'INR')).toMatchObject({ amount: rs(1370), fromPaise: true, give: rs(1500), change: rs(130) })
    expect(cashPlan(50, 'INR')).toMatchObject({ amount: rs(1), fromPaise: true, give: rs(1), change: 0 })
    expect(cashPlan(137000, 'INR')?.fromPaise).toBe(false)
  })

  it('nothing to show: other currencies, zero, under 50 paise, junk', () => {
    expect(cashPlan(137000, 'USD')).toBeNull()
    expect(cashPlan(137000, 'inr')).toBeNull()
    expect(cashPlan(0, 'INR')).toBeNull()
    expect(cashPlan(49, 'INR')).toBeNull()
    expect(cashPlan(-500, 'INR')).toBeNull()
    expect(cashPlan(Number.NaN, 'INR')).toBeNull()
    expect(cashPlan(10.5, 'INR')).toBeNull()
  })

  it('a huge amount is still instant and exact', () => {
    const p = cashPlan(1e12, 'INR')
    expect(p?.give).toBe(1e12)
    expect(p?.change).toBe(0)
    expect(p?.givePiles).toEqual([{ value: 500, count: 2e7 }])
  })
})
