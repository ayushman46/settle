import { describe, expect, it } from 'vitest'
import { ME_ID, type DescribedSplit, type Friend } from '../../domain/types'
import { describeView, peopleSummary } from './describeView'

function friend(id: string, name: string, color = 1): Friend {
  return { id, name, color, upiId: null, phone: null, createdAt: 1, lastUsedAt: 1 }
}

const FRIENDS: Friend[] = [friend(ME_ID, 'Ayush', 0), friend('riya', 'Riya', 2), friend('sam', 'Sam Kapoor', 3)]
const CTX = { friends: FRIENDS, meId: ME_ID, currency: 'INR' }

function draft(patch: Partial<DescribedSplit> = {}): DescribedSplit {
  return {
    title: 'Dinner',
    category: 'food',
    amount: 2400,
    currency: null,
    mode: 'equal',
    payer: null,
    people: [{ name: 'Me', value: null }, { name: 'Riya', value: null }, { name: 'Sam', value: null }],
    headcount: null,
    date: null,
    ...patch,
  }
}

describe('describeView', () => {
  it('reads an equal split with known people, the owner paying by default', () => {
    const view = describeView(draft(), CTX)
    expect(view).toMatchObject({
      title: 'Dinner',
      category: 'food',
      currency: 'INR',
      total: 240000,
      date: null,
      mode: 'equal',
      modeLabel: 'Split equally',
      payerId: ME_ID,
      payerName: 'You',
      payerSaid: false,
      missing: 0,
      addsUp: true,
    })
    expect(view.people).toEqual([
      { id: ME_ID, name: 'You', color: 0, isMe: true, isNew: false, share: 80000, detail: null },
      { id: 'riya', name: 'Riya', color: 2, isMe: false, isNew: false, share: 80000, detail: null },
      // "Sam" is the one friend it can mean.
      { id: 'sam', name: 'Sam Kapoor', color: 3, isMe: false, isNew: false, share: 80000, detail: null },
    ])
  })

  it('gives the stray paisa to the payer, as the saved split will', () => {
    const view = describeView(draft({ amount: 1000, payer: 'Riya' }), CTX)
    expect(view.payerName).toBe('Riya')
    expect(view.payerSaid).toBe(true)
    expect(view.people.map((p) => p.share)).toEqual([33333, 33334, 33333])
  })

  it('marks new people without adding them anywhere', () => {
    const view = describeView(draft({ people: [{ name: 'Me', value: null }, { name: 'Neha', value: null }] }), CTX)
    const neha = view.people[1]
    expect(neha).toMatchObject({ name: 'Neha', isNew: true, share: 120000 })
    expect(neha?.id).not.toBe('neha')
    expect(FRIENDS).toHaveLength(3)
  })

  it('names a new payer once, even when they are also in the split', () => {
    const view = describeView(
      draft({ payer: 'Neha', people: [{ name: 'Me', value: null }, { name: 'Neha', value: null }] }),
      CTX,
    )
    expect(view.payerId).toBe(view.people[1]?.id)
    expect(view.payerName).toBe('Neha')
  })

  it('shows percentages with each share', () => {
    const view = describeView(
      draft({
        title: 'Rent',
        category: 'rent',
        amount: 32000,
        mode: 'percent',
        people: [
          { name: 'Me', value: 40 },
          { name: 'Riya', value: 30 },
          { name: 'Sam', value: 30 },
        ],
      }),
      CTX,
    )
    expect(view.modeLabel).toBe('By percentage')
    expect(view.people.map((p) => [p.detail, p.share])).toEqual([
      ['40%', 1280000],
      ['30%', 960000],
      ['30%', 960000],
    ])
  })

  it('shows share weights only when they differ', () => {
    const doubled = describeView(
      draft({ title: 'Cab', amount: 840, mode: 'shares', people: [{ name: 'Me', value: 1 }, { name: 'Riya', value: 1 }, { name: 'Sam', value: 2 }] }),
      CTX,
    )
    expect(doubled.modeLabel).toBe('By shares')
    expect(doubled.people.map((p) => [p.detail, p.share])).toEqual([
      ['×1', 21000],
      ['×1', 21000],
      ['×2', 42000],
    ])

    const even = describeView(draft({ mode: 'shares', people: [{ name: 'Me', value: 1 }, { name: 'Riya', value: 1 }] }), CTX)
    expect(even.people.map((p) => p.detail)).toEqual([null, null])
  })

  it('says when exact amounts don’t add up, without inventing shares', () => {
    const view = describeView(
      draft({ amount: 1000, mode: 'exact', people: [{ name: 'Me', value: 300 }, { name: 'Riya', value: 500 }] }),
      CTX,
    )
    expect(view.modeLabel).toBe('Exact amounts')
    expect(view.addsUp).toBe(false)
    expect(view.people.map((p) => p.share)).toEqual([null, null])
  })

  it('handles a draft with no amount, no people and a headcount', () => {
    const view = describeView(draft({ title: '', category: 'subscription', amount: null, people: [], headcount: 4 }), CTX)
    expect(view).toMatchObject({ title: 'Subscriptions', total: null, missing: 4, addsUp: true, people: [] })
  })

  it('counts the people the text didn’t name', () => {
    const view = describeView(draft({ title: 'Netflix', amount: 649, people: [{ name: 'Me', value: null }], headcount: 4 }), CTX)
    expect(view.missing).toBe(3)
    expect(view.people).toHaveLength(1)
  })

  it('keeps the currency and date the text gave', () => {
    const view = describeView(draft({ currency: 'USD', amount: 30, date: '2026-10-20' }), CTX)
    expect(view.currency).toBe('USD')
    expect(view.total).toBe(3000)
    expect(view.date).toBe('2026-10-20')
  })
})

describe('peopleSummary', () => {
  it('lists people naturally, with anyone unnamed at the end', () => {
    expect(peopleSummary([], 0)).toBe('Pick who’s in on the next screen')
    expect(peopleSummary([{ name: 'You' }], 0)).toBe('You')
    expect(peopleSummary([{ name: 'You' }, { name: 'Riya' }], 0)).toBe('You and Riya')
    expect(peopleSummary([{ name: 'You' }, { name: 'Riya' }, { name: 'Sam' }], 0)).toBe('You, Riya and Sam')
    expect(peopleSummary([{ name: 'You' }], 3)).toBe('You and 3 more')
    expect(peopleSummary([], 4)).toBe('4 more')
  })
})
