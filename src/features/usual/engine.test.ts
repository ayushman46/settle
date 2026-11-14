import { describe, expect, it } from 'vitest'
import {
  applyUsual,
  formFromStaleUsual,
  formFromUsual,
  groupUsualSplit,
  isValidUsual,
  matchesUsual,
  samePeople,
  usualFits,
  usualFromForm,
  usualLabel,
  usualParts,
  type UsualSplit,
} from './engine'

const COUPLE = ['me', 'riya']
const FLAT = ['me', 'riya', 'sam']
const DAY = '2026-11-14'
const p = (friendId: string, input: number | null) => ({ friendId, input })
const sixtyForty: UsualSplit = { mode: 'percent', inputs: { me: 6000, riya: 4000 }, set: DAY }
const rooms: UsualSplit = { mode: 'shares', inputs: { me: 2, riya: 1, sam: 1 }, set: DAY }

describe('samePeople', () => {
  it('ignores order but not repeats', () => {
    expect(samePeople(['a', 'b'], ['b', 'a'])).toBe(true)
    expect(samePeople(['a', 'b'], ['a'])).toBe(false)
    expect(samePeople(['a', 'a'], ['a'])).toBe(false)
    expect(samePeople([], [])).toBe(true)
  })
})

describe('usualFromForm', () => {
  it('takes percentages that add up to 100% for exactly the group', () => {
    expect(usualFromForm({ mode: 'percent', participants: [p('me', 6000), p('riya', 4000)] }, COUPLE, DAY)).toEqual(sixtyForty)
  })

  it('takes shares, reading a blank as one share', () => {
    expect(usualFromForm({ mode: 'shares', participants: [p('me', 2), p('riya', null), p('sam', 1)] }, FLAT, DAY)).toEqual(rooms)
  })

  it('keeps a member on 0% or no shares (they’re in the group, not in its bills)', () => {
    expect(usualFromForm({ mode: 'shares', participants: [p('me', 1), p('riya', 1), p('sam', 0)] }, FLAT, DAY)?.inputs).toEqual({ me: 1, riya: 1, sam: 0 })
  })

  it('is null for other modes, other people, or a split that doesn’t add up', () => {
    expect(usualFromForm({ mode: 'equal', participants: [p('me', null), p('riya', null)] }, COUPLE, DAY)).toBeNull()
    expect(usualFromForm({ mode: 'exact', participants: [p('me', 600), p('riya', 400)] }, COUPLE, DAY)).toBeNull()
    expect(usualFromForm({ mode: 'percent', participants: [p('me', 6000), p('riya', 3000)] }, COUPLE, DAY)).toBeNull()
    expect(usualFromForm({ mode: 'percent', participants: [p('me', 10000)] }, COUPLE, DAY)).toBeNull()
    expect(usualFromForm({ mode: 'percent', participants: [p('me', 6000), p('sam', 4000)] }, COUPLE, DAY)).toBeNull()
    expect(usualFromForm({ mode: 'shares', participants: [p('me', 0), p('riya', 0)] }, COUPLE, DAY)).toBeNull()
    expect(usualFromForm({ mode: 'shares', participants: [p('me', 1.5), p('riya', 1)] }, COUPLE, DAY)).toBeNull()
  })

  it('is null for a group of one', () => {
    expect(usualFromForm({ mode: 'percent', participants: [p('me', 10000)] }, ['me'], DAY)).toBeNull()
  })
})

describe('fitting the group', () => {
  it('fits exactly the same members', () => {
    expect(usualFits(sixtyForty, ['riya', 'me'])).toBe(true)
    expect(usualFits(sixtyForty, ['me', 'riya', 'sam'])).toBe(false)
    expect(usualFits(rooms, ['me', 'riya'])).toBe(false)
  })

  it('builds the form in the group’s order, or nothing when it doesn’t fit', () => {
    expect(formFromUsual(rooms, ['sam', 'me', 'riya'])).toEqual({ mode: 'shares', participants: [p('sam', 1), p('me', 2), p('riya', 1)] })
    expect(formFromUsual(rooms, COUPLE)).toBeNull()
  })

  it('starts again from a split made for other people, keeping who is still here', () => {
    expect(formFromStaleUsual(sixtyForty, ['me', 'riya', 'sam'])).toEqual({ mode: 'percent', participants: [p('me', 6000), p('riya', 4000), p('sam', null)] })
    expect(formFromStaleUsual(rooms, ['me', 'neha'])).toEqual({ mode: 'shares', participants: [p('me', 2), p('neha', null)] })
  })
})

describe('matchesUsual', () => {
  it('matches the same mode, people and numbers', () => {
    expect(matchesUsual({ mode: 'percent', participants: [p('riya', 4000), p('me', 6000)] }, sixtyForty)).toBe(true)
    expect(matchesUsual({ mode: 'shares', participants: [p('me', 2), p('riya', null), p('sam', 1)] }, rooms)).toBe(true)
  })

  it('does not match once anything differs', () => {
    expect(matchesUsual({ mode: 'percent', participants: [p('me', 5000), p('riya', 5000)] }, sixtyForty)).toBe(false)
    expect(matchesUsual({ mode: 'shares', participants: [p('me', 6000), p('riya', 4000)] }, sixtyForty)).toBe(false)
    expect(matchesUsual({ mode: 'percent', participants: [p('me', 6000)] }, sixtyForty)).toBe(false)
    expect(matchesUsual({ mode: 'percent', participants: [p('me', 6000), p('riya', null)] }, sixtyForty)).toBe(false)
  })
})

describe('applyUsual', () => {
  const fresh = { mode: 'equal', participants: [p('me', null), p('riya', null)], title: 'Groceries' }

  it('sets an untouched form to the usual split, keeping everything else', () => {
    expect(applyUsual(fresh, sixtyForty, COUPLE)).toEqual({ mode: 'percent', participants: [p('me', 6000), p('riya', 4000)], title: 'Groceries' })
  })

  it('leaves the form alone otherwise', () => {
    expect(applyUsual(fresh, null, COUPLE)).toBe(fresh)
    expect(applyUsual({ ...fresh, mode: 'exact' }, sixtyForty, COUPLE).mode).toBe('exact')
    expect(applyUsual({ ...fresh, participants: [p('me', null)] }, sixtyForty, COUPLE).mode).toBe('equal')
    expect(applyUsual(fresh, sixtyForty, FLAT)).toBe(fresh) // the group has changed since
    expect(applyUsual({ ...fresh, participants: [p('me', null), p('riya', 500)] }, sixtyForty, COUPLE).mode).toBe('equal')
  })
})

describe('labels', () => {
  it('reads percentages and shares the way people write them', () => {
    expect(usualLabel(sixtyForty, COUPLE)).toBe('60 / 40')
    expect(usualLabel(sixtyForty, ['riya', 'me'])).toBe('40 / 60')
    expect(usualLabel(rooms, FLAT)).toBe('2 : 1 : 1')
    expect(usualLabel({ mode: 'percent', inputs: { a: 3333, b: 3333, c: 3334 } })).toBe('33.33 / 33.33 / 33.34')
    expect(usualLabel({ mode: 'percent', inputs: { a: 1250, b: 8705, c: 45 } })).toBe('12.5 / 87.05 / 0.45')
  })

  it('names each part', () => {
    expect(usualParts(sixtyForty, COUPLE)).toEqual([
      { friendId: 'me', value: '60' },
      { friendId: 'riya', value: '40' },
    ])
  })

  it('knows a well-formed split', () => {
    expect(isValidUsual(sixtyForty)).toBe(true)
    expect(isValidUsual(rooms)).toBe(true)
    expect(isValidUsual({ mode: 'percent', inputs: { a: 5000 } })).toBe(false)
    expect(isValidUsual({ mode: 'shares', inputs: {} })).toBe(false)
    expect(isValidUsual({ mode: 'shares', inputs: { a: -1, b: 2 } })).toBe(false)
  })
})

describe('groupUsualSplit (for other features’ sums)', () => {
  it('is null with no usual split, or one made for other people', () => {
    expect(groupUsualSplit(null, COUPLE)).toBeNull()
    expect(groupUsualSplit(sixtyForty, FLAT)).toBeNull()
  })

  it('gives each member’s fraction and whether everyone’s part is the same', () => {
    expect(groupUsualSplit(sixtyForty, COUPLE)).toEqual({ ...sixtyForty, fractions: { me: 0.6, riya: 0.4 }, equal: false })
    expect(groupUsualSplit(rooms, FLAT)?.fractions).toEqual({ me: 0.5, riya: 0.25, sam: 0.25 })
    expect(groupUsualSplit({ mode: 'percent', inputs: { me: 5000, riya: 5000 }, set: DAY }, COUPLE)?.equal).toBe(true)
    expect(groupUsualSplit({ mode: 'shares', inputs: { me: 1, riya: 1, sam: 1 }, set: DAY }, FLAT)?.equal).toBe(true)
    expect(groupUsualSplit({ mode: 'shares', inputs: { me: 1, riya: 1, sam: 0 }, set: DAY }, FLAT)).toMatchObject({ equal: false, fractions: { sam: 0 } })
  })
})
