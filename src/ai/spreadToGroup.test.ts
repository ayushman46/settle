import { describe, expect, it } from 'vitest'
import type { DescribedSplit } from '../domain/types'
import { spreadToGroup } from './prefill'

const GROUP = ['Me', 'Riya', 'Kabir', 'Meera']
const draft = (over: Partial<DescribedSplit>): DescribedSplit => ({
  title: 'Cab', category: 'transport', amount: 1800, currency: null, mode: 'equal', payer: null,
  people: [{ name: 'Me', value: null }], headcount: null, date: null, ...over,
})
const names = (d: DescribedSplit) => d.people.map((p) => p.name)

describe('spreadToGroup', () => {
  it('"split between everyone" means the whole group', () => {
    const d = spreadToGroup(draft({ payer: 'Riya', people: [{ name: 'Me', value: null }, { name: 'Riya', value: null }], headcount: 4 }), 'Riya paid 1800 for the cab, split between everyone', GROUP)
    expect(names(d)).toEqual(['Me', 'Riya', 'Kabir', 'Meera'])
    expect(d.headcount).toBeNull()
    expect(d.payer).toBe('Riya')
  })

  it('Hinglish "sab mein baant do" and a headcount larger than the names', () => {
    expect(names(spreadToGroup(draft({ people: [{ name: 'Meera', value: null }, { name: 'Me', value: null }] }), 'Meera ne 900 diye, sab mein baant do', GROUP))).toHaveLength(4)
    expect(names(spreadToGroup(draft({ people: [{ name: 'Me', value: null }, { name: 'Kabir', value: null }], headcount: 4 }), 'Hotel 12000 Kabir paid all four of us', GROUP))).toHaveLength(4)
  })

  it('leaves a sentence that names its people alone', () => {
    const d = draft({ people: [{ name: 'Me', value: null }, { name: 'Riya', value: null }] })
    expect(spreadToGroup(d, 'Dinner 1500 me and Riya', GROUP)).toBe(d)
  })

  it('"everyone except me" leaves the speaker out', () => {
    expect(names(spreadToGroup(draft({ people: [{ name: 'Me', value: null }] }), 'Cake 900 for everyone except me', GROUP))).toEqual(['Riya', 'Kabir', 'Meera'])
  })

  it('shares: newcomers take one share, "pays double" stays', () => {
    const d = spreadToGroup(draft({ mode: 'shares', people: [{ name: 'Me', value: 1 }, { name: 'Kabir', value: 2 }] }), 'Petrol 3200 everyone, Kabir pays double', GROUP)
    expect(d.people).toEqual([{ name: 'Me', value: 1 }, { name: 'Kabir', value: 2 }, { name: 'Riya', value: 1 }, { name: 'Meera', value: 1 }])
  })

  it('exact amounts and percentages are kept as said', () => {
    const d = draft({ mode: 'percent', people: [{ name: 'Me', value: 50 }, { name: 'Riya', value: 50 }] })
    expect(spreadToGroup(d, 'Rent everyone me 50 Riya 50 percent', GROUP)).toBe(d)
  })

  it('"Riya" said for "Riya Sharma" is not added twice', () => {
    expect(names(spreadToGroup(draft({ people: [{ name: 'Me', value: null }, { name: 'Riya', value: null }] }), 'split with everyone', ['Me', 'Riya Sharma', 'Kabir']))).toEqual(['Me', 'Riya', 'Kabir'])
  })
})
