import { describe, expect, it } from 'vitest'
import { ME_ID } from '../../domain/types'
import {
  buildCommittee,
  currentIndex,
  dueAt,
  dueToday,
  eligibleHands,
  emptyMonth,
  isFinished,
  markHanded,
  markPaid,
  monthCount,
  monthView,
  periodAt,
  pickFair,
  positions,
  potOf,
  recordDraw,
  schedule,
  setupProblem,
  shuffled,
  takerAt,
  type Committee,
  type SetupInput,
} from './engine'

const FRIEND_A = 'fa'
const FRIEND_B = 'fb'
const FRIEND_C = 'fc'

function makeInput(overrides: Partial<SetupInput> = {}): SetupInput {
  return {
    id: 'c1',
    name: 'Test BC',
    currency: 'INR',
    amount: 500_000, // ₹5,000
    firstDate: '2024-11-01',
    organiserId: ME_ID,
    mode: 'order',
    people: [ME_ID, FRIEND_A, FRIEND_B],
    createdAt: 0,
    ...overrides,
  }
}

function makeCommittee(overrides: Partial<SetupInput> = {}): Committee {
  const c = buildCommittee(makeInput(overrides))
  if (!c) throw new Error('buildCommittee returned null')
  return c
}

describe('setupProblem', () => {
  it('null for valid input', () => {
    expect(setupProblem(makeInput())).toBeNull()
  })

  it('members when fewer than 2 people', () => {
    expect(setupProblem(makeInput({ people: [ME_ID] }))).toBe('members')
  })

  it('amount when zero', () => {
    expect(setupProblem(makeInput({ amount: 0 }))).toBe('amount')
  })

  it('rupees when not whole rupees', () => {
    expect(setupProblem(makeInput({ amount: 50 }))).toBe('rupees') // 50 paise = not whole rupee
  })

  it('organiser when organiser not in people', () => {
    expect(setupProblem(makeInput({ organiserId: 'stranger' }))).toBe('organiser')
  })
})

describe('buildCommittee', () => {
  it('creates a committee with the right number of hands and months', () => {
    const c = makeCommittee()
    expect(c.hands).toHaveLength(3)
    expect(c.months).toHaveLength(3)
  })

  it('the pot is hands × amount', () => {
    const c = makeCommittee()
    expect(potOf(c)).toBe(500_000 * 3)
  })

  it('total months equals total hands', () => {
    const c = makeCommittee()
    expect(monthCount(c)).toBe(3)
  })
})

describe('periodAt / dueAt', () => {
  it('first month is the start', () => {
    const c = makeCommittee()
    expect(periodAt(c, 0)).toBe('2024-11')
    expect(periodAt(c, 1)).toBe('2024-12')
    expect(periodAt(c, 2)).toBe('2025-01')
  })

  it('due date uses the firstDate day', () => {
    const c = makeCommittee({ firstDate: '2024-11-05' })
    expect(dueAt(c, 0)).toBe('2024-11-05')
    expect(dueAt(c, 1)).toBe('2024-12-05')
  })
})

describe('takerAt (fixed order)', () => {
  it('gives hands in order for order mode', () => {
    const c = makeCommittee({ mode: 'order' })
    const t0 = takerAt(c, 0)
    expect(t0).not.toBeNull()
    expect(t0!.how).toBe('order')
    const t1 = takerAt(c, 1)
    expect(t1!.hand.id).not.toBe(t0!.hand.id)
  })
})

describe('eligibleHands', () => {
  it('all hands are eligible at the start', () => {
    const c = makeCommittee()
    expect(eligibleHands(c)).toHaveLength(3)
  })

  it('a hand that has taken its pot is no longer eligible', () => {
    // In draw mode, record a draw so month 0 gets a taker.
    let c = makeCommittee({ mode: 'draw' })
    const hand = c.hands[0]!
    c = recordDraw(c, 0, 0, 1000) // pick index 0 from eligible hands
    // After the draw, that hand is no longer eligible.
    expect(eligibleHands(c).map((h) => h.id)).not.toContain(hand.id)
  })
})

describe('markPaid / positions', () => {
  it('a paid hand shows in positions as paid', () => {
    let c = makeCommittee()
    const hand = c.hands[0]!
    c = markPaid(c, 0, hand.id, { on: '2024-11-01', at: 1000 })
    const pos = positions(c)
    const me = pos.find((p) => p.friendId === ME_ID)
    expect(me).toBeDefined()
    expect(me!.paidIn).toBeGreaterThan(0)
  })
})

describe('currentIndex', () => {
  it('0 at the start', () => {
    const c = makeCommittee()
    expect(currentIndex(c)).toBe(0)
  })

  it('advances after a month is fully paid and handed', () => {
    let c = makeCommittee()
    // Pay all hands in month 0.
    for (const hand of c.hands) {
      c = markPaid(c, 0, hand.id, { on: '2024-11-01', at: 1000 })
    }
    c = markHanded(c, 0, { on: '2024-11-01', how: 'cash', at: 1000 })
    expect(currentIndex(c)).toBe(1)
  })
})

describe('isFinished', () => {
  it('false at the start', () => {
    const c = makeCommittee()
    expect(isFinished(c)).toBe(false)
  })
})

describe('pickFair / shuffled', () => {
  it('pickFair returns a value in [0, count)', () => {
    let call = 0
    const rng = () => [0x11_22_33_44, 0x55_66_77_88][call++ % 2]!
    for (let i = 0; i < 20; i++) {
      const p = pickFair(5, rng)
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThan(5)
    }
  })

  it('shuffled returns all items', () => {
    let call = 0
    const rng = () => [0x11_22_33_44, 0x55_66_77_88, 0xaa_bb_cc_dd][call++ % 3]!
    const result = shuffled([1, 2, 3, 4, 5], rng)
    expect(result.sort()).toEqual([1, 2, 3, 4, 5])
  })
})

describe('dueToday', () => {
  it('flags payment due on or after the committee day', () => {
    const c = makeCommittee({ firstDate: '2024-11-10' })
    const due = dueToday(c, '2024-11-10', ME_ID)
    expect(due.pay).not.toBeNull()
    expect(due.pay!.amount).toBeGreaterThan(0)
  })

  it('no payment due before the committee day', () => {
    const c = makeCommittee({ firstDate: '2024-11-10' })
    const due = dueToday(c, '2024-11-09', ME_ID)
    expect(due.pay).toBeNull()
  })
})

describe('schedule', () => {
  it('has one MonthView per hand', () => {
    const c = makeCommittee()
    const s = schedule(c, '2024-11-01')
    expect(s).toHaveLength(3)
  })
})
