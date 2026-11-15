import { describe, expect, it } from 'vitest'
import { ME_ID, type Expense, type Group } from '../../domain/types'
import { friendBalance, netIn } from '../friends/friendBalance'
import { isLimitAmount, limitChoices, limitFor, limitStanding, limitWarnings, newlyOwed, overBy, ownChoice, sortStandings, type LimitState } from './engine'

let seq = 0
function expense(p: Partial<Expense> & { payerId: string; shares: Record<string, number> }): Expense {
  seq += 1
  return {
    id: `e${seq}`,
    kind: 'split',
    title: `Bill ${seq}`,
    category: 'food',
    currency: 'INR',
    total: Object.values(p.shares).reduce((a, b) => a + b, 0),
    date: '2026-10-01',
    createdAt: seq,
    updatedAt: seq,
    mode: 'exact',
    participants: Object.keys(p.shares).map((friendId) => ({ friendId, input: p.shares[friendId] ?? 0 })),
    roundedToWhole: false,
    note: null,
    groupId: null,
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
    ...p,
  }
}

function group(p: Partial<Group> & { id: string; memberIds: string[] }): Group {
  return { name: p.id, emoji: '🏖️', kind: 'trip', currency: 'INR', settlements: [], createdAt: 1, updatedAt: 1, archived: false, ...p }
}

const limits = (byFriend: Record<string, number> = {}, everyone: number | null = null): LimitState => ({ everyone, byFriend })
const check = (state: LimitState, amounts: Record<string, number> | number[], expenses: Expense[], extra: Partial<Parameters<typeof limitWarnings>[0]> = {}) =>
  limitWarnings({ state, friendIds: Array.isArray(amounts) ? ['riya', 'sam'] : Object.keys(amounts), amounts, expenses, groups: [], currency: 'INR', ...extra })

describe('the quick picks', () => {
  it('are ₹500, ₹1,000, ₹2,000 and ₹5,000 in paise, and whole yen for a currency without paise', () => {
    expect(limitChoices('INR')).toEqual([50_000, 100_000, 200_000, 500_000])
    expect(limitChoices('JPY')).toEqual([500, 1000, 2000, 5000])
  })

  it('a limit is a whole number of paise above zero', () => {
    expect(isLimitAmount(1)).toBe(true)
    expect(isLimitAmount(500_000)).toBe(true)
    for (const bad of [0, -5, 10.5, Number.NaN, Infinity, 1e13, '500', null, undefined]) expect(isLimitAmount(bad)).toBe(false)
  })
})

describe('limitFor', () => {
  it('a friend’s own limit wins; without one, the limit for everyone applies', () => {
    const state = limits({ riya: 500_000 }, 200_000)
    expect(limitFor(state, 'riya')).toEqual({ amount: 500_000, own: true })
    expect(limitFor(state, 'sam')).toEqual({ amount: 200_000, own: false })
  })

  it('"no limit for them" (0) exempts a friend from the limit for everyone', () => {
    const state = limits({ riya: 0 }, 200_000)
    expect(limitFor(state, 'riya')).toBeNull()
    expect(ownChoice(state, 'riya')).toBe('none')
    expect(ownChoice(state, 'sam')).toBe('everyone')
  })

  it('nothing set: no limit; and never one for yourself', () => {
    expect(limitFor(limits(), 'riya')).toBeNull()
    expect(ownChoice(limits(), 'riya')).toBe('none')
    expect(limitFor(limits({}, 200_000), ME_ID)).toBeNull()
    expect(limitFor(limits({ me: 100 }), ME_ID)).toBeNull()
    expect(ownChoice(limits({ riya: 123_400 }), 'riya')).toBe(123_400)
  })

  it('a friend called "toString" or "constructor" has no limit by accident', () => {
    expect(limitFor(limits(), 'toString')).toBeNull()
    expect(limitFor(limits(), 'constructor')).toBeNull()
  })
})

describe('overBy', () => {
  it('exactly on the limit is not over it; a paisa more is', () => {
    expect(overBy(500_000, 500_000)).toBe(0)
    expect(overBy(500_001, 500_000)).toBe(1)
    expect(overBy(0, 500_000)).toBe(0)
  })
})

describe('newlyOwed', () => {
  it('reads amounts keyed by friend or as a list in the order of the people', () => {
    expect(newlyOwed(['riya', 'sam'], { riya: 40_000, sam: 10_000 })).toEqual({ riya: 40_000, sam: 10_000 })
    expect(newlyOwed(['riya', 'sam'], [40_000, 10_000])).toEqual({ riya: 40_000, sam: 10_000 })
  })

  it('drops yourself, people with no amount, and amounts that aren’t whole paise above zero', () => {
    expect(newlyOwed([ME_ID, 'riya', 'sam', 'asha', 'dev', ''], { me: 500, riya: 0, sam: -5, asha: 10.5, gita: 900 })).toEqual({})
    expect(newlyOwed(['riya', 'riya'], [100, 900])).toEqual({ riya: 100 })
    expect(newlyOwed(['riya', 'sam'], [100])).toEqual({ riya: 100 })
  })
})

describe('limitWarnings: outside groups', () => {
  const owes5000 = () => [expense({ payerId: ME_ID, shares: { me: 500_000, riya: 500_000 } })]

  it('says nothing when no limit is set', () => {
    expect(check(limits(), { riya: 40_000 }, owes5000())).toEqual([])
  })

  it('"This takes Riya to ₹5,400 owed to you, over the ₹5,000 you set"', () => {
    expect(check(limits({ riya: 500_000 }), { riya: 40_000 }, owes5000())).toEqual([{ friendId: 'riya', limit: 500_000, own: true, before: 500_000, after: 540_000, wasOver: false }])
  })

  it('reaching the limit exactly is not over it', () => {
    const expenses = [expense({ payerId: ME_ID, shares: { me: 100, riya: 460_000 } })]
    expect(check(limits({ riya: 500_000 }), { riya: 40_000 }, expenses)).toEqual([])
    expect(check(limits({ riya: 500_000 }), { riya: 40_001 }, expenses)).toHaveLength(1)
  })

  it('someone already over is told apart: "already owes you"', () => {
    const expenses = [expense({ payerId: ME_ID, shares: { me: 100, riya: 540_000 } })]
    expect(check(limits({ riya: 500_000 }), { riya: 60_000 }, expenses)).toEqual([{ friendId: 'riya', limit: 500_000, own: true, before: 540_000, after: 600_000, wasOver: true }])
  })

  it('when you owe them, the split first pays that down: only what they end up owing you counts', () => {
    const expenses = [expense({ payerId: 'riya', shares: { me: 100_000, riya: 100_000 } })]
    // I owe Riya ₹1,000. A split where she owes ₹1,200 leaves her owing ₹200: under a ₹500 limit.
    expect(check(limits({ riya: 50_000 }), { riya: 120_000 }, expenses)).toEqual([])
    // One where she owes ₹2,000 leaves her owing ₹1,000: over it. "Before" is 0, not minus ₹1,000.
    expect(check(limits({ riya: 50_000 }), { riya: 200_000 }, expenses)).toEqual([{ friendId: 'riya', limit: 50_000, own: true, before: 0, after: 100_000, wasOver: false }])
  })

  it('what has been paid back no longer counts', () => {
    const paid = expense({ payerId: ME_ID, shares: { me: 100, riya: 500_000 }, paidBack: { riya: 1 } })
    const part = expense({ payerId: ME_ID, shares: { me: 100, riya: 300_000 }, partPaid: { riya: 100_000 } })
    expect(check(limits({ riya: 250_000 }), { riya: 50_000 }, [paid, part])).toEqual([])
    expect(check(limits({ riya: 250_000 }), { riya: 50_001 }, [paid, part])).toMatchObject([{ before: 200_000, after: 250_001 }])
  })

  it('the limit for everyone covers people without their own, and says it is everyone’s', () => {
    const state = limits({ riya: 1_000_000, asha: 0 }, 100_000)
    const found = limitWarnings({ state, friendIds: ['sam', 'riya', 'asha'], amounts: { sam: 150_000, riya: 150_000, asha: 150_000 }, expenses: [], groups: [], currency: 'INR' })
    expect(found).toEqual([{ friendId: 'sam', limit: 100_000, own: false, before: 0, after: 150_000, wasOver: false }])
  })

  it('warns in the order the people were given, one line each', () => {
    const state = limits({}, 10_000)
    expect(check(state, [20_000, 30_000], []).map((w) => w.friendId)).toEqual(['riya', 'sam'])
    expect(limitWarnings({ state, friendIds: ['sam', 'riya'], amounts: { riya: 20_000, sam: 30_000 }, expenses: [], groups: [], currency: 'INR' }).map((w) => w.friendId)).toEqual(['sam', 'riya'])
  })

  it('money in another currency is kept out of it: limits are in your own currency', () => {
    const dollars = [expense({ payerId: ME_ID, currency: 'USD', shares: { me: 100, riya: 900_000 } })]
    // What Riya owes in dollars is not counted towards a rupee limit…
    expect(check(limits({ riya: 500_000 }), { riya: 40_000 }, dollars)).toEqual([])
    // …and a split in dollars is not warned about.
    expect(check(limits({ riya: 500_000 }), { riya: 900_000 }, [], { splitCurrency: 'USD' })).toEqual([])
    expect(check(limits({ riya: 500_000 }), { riya: 900_000 }, [], { splitCurrency: 'INR' })).toHaveLength(1)
  })

  it('editing a saved split doesn’t count it twice', () => {
    const saved = expense({ payerId: ME_ID, shares: { me: 100, riya: 300_000 } })
    expect(check(limits({ riya: 500_000 }), { riya: 340_000 }, [saved], { expenseId: saved.id })).toEqual([])
    expect(check(limits({ riya: 500_000 }), { riya: 340_000 }, [saved])).toMatchObject([{ before: 300_000, after: 640_000 }])
    // Edited up past the limit: "before" is what she owed without this split at all.
    expect(check(limits({ riya: 500_000 }), { riya: 510_000 }, [saved], { expenseId: saved.id })).toMatchObject([{ before: 0, after: 510_000, wasOver: false }])
  })

  it('when someone else is paying, nobody owes you more: nothing to say', () => {
    expect(check(limits({}, 100), {}, owes5000())).toEqual([])
    expect(check(limits({}, 100), [0, 0], owes5000())).toEqual([])
  })
})

describe('limitWarnings: inside a group', () => {
  // Riya paid ₹3,000 for Sam. If I now pay ₹3,000 for Riya, the group settles as "Sam pays me ₹3,000": Riya owes me nothing.
  const trip = group({ id: 'goa', memberIds: [ME_ID, 'riya', 'sam'] })
  const expenses = [expense({ groupId: 'goa', payerId: 'riya', shares: { sam: 300_000 } })]

  it('counts the group’s fewest-payments settling, so the note says what the person’s page will say', () => {
    const state = limits({ riya: 100_000, sam: 100_000 })
    const found = limitWarnings({ state, friendIds: ['riya'], amounts: { riya: 300_000 }, expenses, groups: [trip], currency: 'INR', groupId: 'goa' })
    // Riya is not warned about (her page will say ₹0); Sam, who now owes me instead, is.
    expect(found).toEqual([{ friendId: 'sam', limit: 100_000, own: true, before: 0, after: 300_000, wasOver: false }])
    // Both numbers match the friend pages once the split exists.
    const after = [...expenses, expense({ groupId: 'goa', payerId: ME_ID, shares: { riya: 300_000 } })]
    expect(netIn(friendBalance('riya', after, [trip], 'INR'), 'INR')).toBe(0)
    expect(netIn(friendBalance('sam', after, [trip], 'INR'), 'INR')).toBe(300_000)
  })

  it('the same split outside the group does take her over', () => {
    const found = limitWarnings({ state: limits({ riya: 100_000 }), friendIds: ['riya'], amounts: { riya: 300_000 }, expenses, groups: [trip], currency: 'INR' })
    expect(found).toEqual([{ friendId: 'riya', limit: 100_000, own: true, before: 0, after: 300_000, wasOver: false }])
  })

  it('whatever it says is the friend page’s number after saving, for every person in the split', () => {
    const flat = group({ id: 'flat', memberIds: [ME_ID, 'riya', 'sam', 'asha'] })
    const before = [
      expense({ groupId: 'flat', payerId: 'sam', shares: { me: 40_000, riya: 40_000, sam: 40_000 } }),
      expense({ groupId: 'flat', payerId: 'asha', shares: { riya: 99_900 } }),
      expense({ payerId: ME_ID, shares: { me: 100, riya: 25_000 } }),
    ]
    const amounts = { riya: 120_000, sam: 70_000, asha: 33_300 }
    const found = limitWarnings({ state: limits({}, 1), friendIds: Object.keys(amounts), amounts, expenses: before, groups: [flat], currency: 'INR', groupId: 'flat' })
    const saved = [...before, expense({ groupId: 'flat', payerId: ME_ID, shares: amounts })]
    expect(found.length).toBeGreaterThan(0)
    for (const w of found) {
      expect(w.after).toBe(netIn(friendBalance(w.friendId, saved, [flat], 'INR'), 'INR'))
      expect(w.before).toBe(Math.max(0, netIn(friendBalance(w.friendId, before, [flat], 'INR'), 'INR')))
    }
  })
})

describe('limitStanding and the people list', () => {
  it('says what they owe, the limit that applies and by how much they are over', () => {
    const state = limits({ riya: 500_000 }, 100_000)
    expect(limitStanding(state, 'riya', { riya: 540_000 })).toEqual({ friendId: 'riya', owed: 540_000, limit: { amount: 500_000, own: true }, over: 40_000 })
    expect(limitStanding(state, 'sam', { sam: -90_000 })).toEqual({ friendId: 'sam', owed: 0, limit: { amount: 100_000, own: false }, over: 0 })
    expect(limitStanding(limits(), 'asha', {})).toEqual({ friendId: 'asha', owed: 0, limit: null, over: 0 })
  })

  it('lists people over their limit first, then who owes most, then own limits, then by name', () => {
    const state = limits({ riya: 100_000, dev: 900_000 })
    const rows = [
      { name: 'Zoya', ...limitStanding(state, 'zoya', {}) },
      { name: 'asha', ...limitStanding(state, 'asha', {}) },
      { name: 'Dev', ...limitStanding(state, 'dev', {}) },
      { name: 'Sam', ...limitStanding(state, 'sam', { sam: 700_000 }) },
      { name: 'Riya', ...limitStanding(state, 'riya', { riya: 150_000 }) },
    ]
    expect(sortStandings(rows).map((r) => r.name)).toEqual(['Riya', 'Sam', 'Dev', 'asha', 'Zoya'])
  })
})
