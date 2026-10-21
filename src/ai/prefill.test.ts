import { describe, expect, it, vi } from 'vitest'
import { setSplitPrefill, takeSplitPrefill } from '../data/handoff'
import { addDays, today } from '../engine/dates'
import type { DescribedSplit, Friend } from '../domain/types'
import { nameKey } from '../lib/people'
import { describedToPrefill, missingPeople, resolveDescribedPeople, type DescribeContext } from './prefill'

function friend(id: string, name: string): Friend {
  return { id, name, color: 0, upiId: null, phone: null, createdAt: 1, lastUsedAt: 1 }
}

const FRIENDS: Friend[] = [
  friend('me', 'Ayush'),
  friend('riya', 'Riya Sharma'),
  friend('sam', 'Sam'),
  friend('jose', 'José'),
  friend('aditya', 'Aditya'),
  friend('neha', 'Neha'),
]

/** A data-layer stand-in: finds by name or adds, like `addFriend`. */
function context(friends: Friend[] = FRIENDS, currency = 'INR') {
  const added: Friend[] = []
  const addFriend = vi.fn((name: string): Friend => {
    const existing = [...friends, ...added].find((f) => f.id !== 'me' && nameKey(f.name) === nameKey(name))
    if (existing) return existing
    const created = friend(`new-${added.length + 1}`, name)
    added.push(created)
    return created
  })
  const ctx: DescribeContext = { friends, meId: 'me', currency, addFriend }
  return { ctx, added, addFriend }
}

function draft(patch: Partial<DescribedSplit> = {}): DescribedSplit {
  return {
    title: 'Cab',
    category: 'transport',
    amount: 840,
    currency: null,
    mode: 'equal',
    payer: null,
    people: [
      { name: 'Me', value: null },
      { name: 'Riya', value: null },
      { name: 'Sam', value: null },
    ],
    ...patch,
  }
}

describe('describedToPrefill — people', () => {
  it('maps "Cab 840 with Riya and Sam" onto the friends you have', () => {
    const { ctx, addFriend } = context()
    expect(describedToPrefill(draft(), ctx)).toEqual({
      source: 'describe',
      mode: 'equal',
      currency: 'INR',
      title: 'Cab',
      category: 'transport',
      total: 84000,
      participants: [
        { friendId: 'me', input: null },
        { friendId: 'riya', input: null },
        { friendId: 'sam', input: null },
      ],
    })
    expect(addFriend).not.toHaveBeenCalled()
  })

  it.each(['Me', 'me', 'I', 'myself', 'Mine', 'ME.', 'Ayush', 'ayush'])('reads "%s" as you', (name) => {
    const { ctx } = context()
    const prefill = describedToPrefill(draft({ people: [{ name, value: null }] }), ctx)
    expect(prefill.participants).toEqual([{ friendId: 'me', input: null }])
  })

  it('prefers a friend who shares your name', () => {
    const { ctx } = context([...FRIENDS, friend('other-ayush', 'Ayush')])
    const prefill = describedToPrefill(draft({ people: [{ name: 'Ayush', value: null }] }), ctx)
    expect(prefill.participants?.[0]?.friendId).toBe('other-ayush')
  })

  it('ignores case, accents and stray punctuation', () => {
    const { ctx } = context()
    const prefill = describedToPrefill(
      draft({ people: [{ name: 'jose', value: null }, { name: 'SAM!', value: null }, { name: ' riya  sharma ', value: null }] }),
      ctx,
    )
    expect(prefill.participants?.map((p) => p.friendId)).toEqual(['jose', 'sam', 'riya'])
  })

  it('adds people it has never seen as friends', () => {
    const { ctx, addFriend } = context()
    const prefill = describedToPrefill(draft({ people: [{ name: 'Me', value: null }, { name: '  Priya   K ', value: null }] }), ctx)
    expect(addFriend).toHaveBeenCalledWith('Priya K')
    expect(prefill.participants?.map((p) => p.friendId)).toEqual(['me', 'new-1'])
  })

  it('only matches a lone first name when exactly one friend could be meant', () => {
    const { ctx, addFriend } = context([...FRIENDS, friend('riya-k', 'Riya Kapoor')])
    const prefill = describedToPrefill(draft({ people: [{ name: 'Riya', value: null }] }), ctx)
    expect(addFriend).toHaveBeenCalledWith('Riya')
    expect(prefill.participants?.[0]?.friendId).toBe('new-1')
  })

  it('never matches a full name to a friend with just the first name', () => {
    const { ctx, addFriend } = context()
    describedToPrefill(draft({ people: [{ name: 'Sam Kurian', value: null }] }), ctx)
    expect(addFriend).toHaveBeenCalledWith('Sam Kurian')
  })

  it('lists one person once, adding up their parts', () => {
    const { ctx } = context()
    const prefill = describedToPrefill(
      draft({
        mode: 'exact',
        amount: 900,
        people: [
          { name: 'Riya', value: 300 },
          { name: 'Riya Sharma', value: 200 },
          { name: 'Me', value: 400 },
          { name: 'I', value: null },
        ],
      }),
      ctx,
    )
    expect(prefill.participants).toEqual([
      { friendId: 'riya', input: 50000 },
      { friendId: 'me', input: 40000 },
    ])
  })

  it('skips blank names and anyone who cannot be added', () => {
    const { ctx } = context()
    ctx.addFriend = () => {
      throw new Error('limit')
    }
    const prefill = describedToPrefill(
      draft({ people: [{ name: '  ', value: null }, { name: 'Sam', value: null }, { name: 'Stranger', value: null }] }),
      ctx,
    )
    expect(prefill.participants).toEqual([{ friendId: 'sam', input: null }])
  })

  it('leaves the people to the split screen when the text named nobody', () => {
    const { ctx } = context()
    expect(describedToPrefill(draft({ people: [] }), ctx).participants).toBeUndefined()
  })
})

describe('describedToPrefill — who paid', () => {
  it.each([
    ['Sam', 'sam'],
    ['Me', 'me'],
    ['i', 'me'],
    ['riya', 'riya'],
  ])('maps %s to their friend', (payer, id) => {
    const { ctx } = context()
    expect(describedToPrefill(draft({ payer }), ctx).payerId).toBe(id)
  })

  it('leaves it to the screen (you) when the text didn’t say', () => {
    const { ctx } = context()
    expect(describedToPrefill(draft({ payer: null }), ctx).payerId).toBeUndefined()
    expect(describedToPrefill(draft({ payer: '  ' }), ctx).payerId).toBeUndefined()
  })

  it('uses the same new friend when a newcomer paid', () => {
    const { ctx, added } = context()
    const prefill = describedToPrefill(
      draft({ payer: 'Kabir', people: [{ name: 'Me', value: null }, { name: 'Kabir', value: null }] }),
      ctx,
    )
    expect(added).toHaveLength(1)
    expect(prefill.payerId).toBe('new-1')
    expect(prefill.participants?.[1]?.friendId).toBe('new-1')
  })

  it('handles a payer outside the split ("I paid for Riya and Sam")', () => {
    const { ctx } = context()
    const prefill = describedToPrefill(draft({ payer: 'Me', people: [{ name: 'Riya', value: null }, { name: 'Sam', value: null }] }), ctx)
    expect(prefill.payerId).toBe('me')
    expect(prefill.participants?.map((p) => p.friendId)).toEqual(['riya', 'sam'])
  })
})

describe('describedToPrefill — amounts', () => {
  it('turns rupees into paise and other currencies into their own minor units', () => {
    const { ctx } = context()
    expect(describedToPrefill(draft({ amount: 1234.5 }), ctx)).toMatchObject({ total: 123450, currency: 'INR' })
    expect(describedToPrefill(draft({ amount: 1200, currency: 'JPY' }), ctx)).toMatchObject({ total: 1200, currency: 'JPY' })
    expect(describedToPrefill(draft({ amount: 12.34, currency: 'USD' }), ctx)).toMatchObject({ total: 1234, currency: 'USD' })
  })

  it('falls back to your currency when the text named none (or a made-up one)', () => {
    expect(describedToPrefill(draft({ currency: null }), context(FRIENDS, 'EUR').ctx).currency).toBe('EUR')
    expect(describedToPrefill(draft({ currency: 'XYZ' }), context(FRIENDS, 'GBP').ctx).currency).toBe('GBP')
  })

  it('leaves the amount blank when the text had none', () => {
    const { ctx } = context()
    expect(describedToPrefill(draft({ amount: null }), ctx).total).toBeUndefined()
    expect(describedToPrefill(draft({ amount: 0 }), ctx).total).toBeUndefined()
    expect(describedToPrefill(draft({ amount: -5 }), ctx).total).toBeUndefined()
  })

  it('caps absurd amounts', () => {
    const { ctx } = context()
    expect(describedToPrefill(draft({ amount: 1e20 }), ctx).total).toBe(1e12)
  })

  it('exact: amounts per person, the rest shared by the blanks', () => {
    const { ctx } = context()
    const prefill = describedToPrefill(
      draft({
        mode: 'exact',
        amount: 2400,
        people: [
          { name: 'Sam', value: 600 },
          { name: 'Me', value: null },
          { name: 'Riya', value: null },
        ],
      }),
      ctx,
    )
    expect(prefill.participants?.map((p) => p.input)).toEqual([60000, 90000, 90000])
  })

  it('exact: the total is the sum when only the parts were given', () => {
    const { ctx } = context()
    const prefill = describedToPrefill(
      draft({ mode: 'exact', amount: null, people: [{ name: 'Sam', value: 250.5 }, { name: 'Me', value: 100 }] }),
      ctx,
    )
    expect(prefill.total).toBe(35050)
    expect(prefill.participants?.map((p) => p.input)).toEqual([25050, 10000])
  })

  it('exact: keeps a mismatch for the split screen to point out', () => {
    const { ctx } = context()
    const prefill = describedToPrefill(
      draft({ mode: 'exact', amount: 1000, people: [{ name: 'Sam', value: 700 }, { name: 'Me', value: 700 }, { name: 'Riya', value: null }] }),
      ctx,
    )
    expect(prefill.total).toBe(100000)
    expect(prefill.participants?.map((p) => p.input)).toEqual([70000, 70000, null])
  })

  it('percent: "Rent 32000 me 40% Aditya 30% Neha 30%" → basis points', () => {
    const { ctx } = context()
    const prefill = describedToPrefill(
      draft({
        title: 'Rent',
        category: 'rent',
        amount: 32000,
        mode: 'percent',
        people: [
          { name: 'Me', value: 40 },
          { name: 'Aditya', value: 30 },
          { name: 'Neha', value: 30 },
        ],
      }),
      ctx,
    )
    expect(prefill).toMatchObject({ mode: 'percent', total: 3200000, category: 'rent' })
    expect(prefill.participants).toEqual([
      { friendId: 'me', input: 4000 },
      { friendId: 'aditya', input: 3000 },
      { friendId: 'neha', input: 3000 },
    ])
  })

  it.each([
    [[33.33, 33.33, 33.34]],
    [[100 / 3, 100 / 3, 100 / 3]],
    [[33.3, 33.3, 33.3]],
    [[33, 33, 33]],
    [[16.67, 16.67, 16.67, 16.67, 16.66, 16.66]],
    [[12.5, 12.5, 25, 50]],
  ])('percent: thirds and friends add up to exactly 100%% (%j)', (values) => {
    const { ctx } = context()
    const names = ['Me', 'Sam', 'Riya', 'Neha', 'Aditya', 'José']
    const prefill = describedToPrefill(
      draft({ mode: 'percent', people: values.map((value, i) => ({ name: names[i] ?? 'x', value })) }),
      ctx,
    )
    const bps = prefill.participants?.map((p) => p.input ?? 0) ?? []
    expect(bps.reduce((a, b) => a + b, 0)).toBe(10_000)
  })

  it('percent: the rest is shared by the people without a number', () => {
    const { ctx } = context()
    const prefill = describedToPrefill(
      draft({ mode: 'percent', people: [{ name: 'Me', value: 40 }, { name: 'Aditya', value: null }, { name: 'Neha', value: null }] }),
      ctx,
    )
    expect(prefill.participants?.map((p) => p.input)).toEqual([4000, 3000, 3000])
  })

  it('percent: never quietly rescales numbers that do not add up (a typo stays visible)', () => {
    const { ctx } = context()
    const prefill = describedToPrefill(
      draft({ mode: 'percent', people: [{ name: 'Me', value: 40 }, { name: 'Sam', value: 30 }, { name: 'Riya', value: 29 }] }),
      ctx,
    )
    expect(prefill.participants?.map((p) => p.input)).toEqual([4000, 3000, 2900])
  })

  it('percent: keeps a mismatch (90%) for the split screen to point out', () => {
    const { ctx } = context()
    const prefill = describedToPrefill(
      draft({ mode: 'percent', people: [{ name: 'Me', value: 40 }, { name: 'Sam', value: 30 }, { name: 'Riya', value: 20 }] }),
      ctx,
    )
    expect(prefill.participants?.map((p) => p.input)).toEqual([4000, 3000, 2000])
  })

  it('percent: an impossible number becomes a blank', () => {
    const { ctx } = context()
    const prefill = describedToPrefill(
      draft({ mode: 'percent', people: [{ name: 'Me', value: 150 }, { name: 'Sam', value: 60 }] }),
      ctx,
    )
    expect(prefill.participants?.map((p) => p.input)).toEqual([4000, 6000])
  })

  it('shares: "Sam pays double" and friends', () => {
    const { ctx } = context()
    const shares = (values: Array<number | null>) =>
      describedToPrefill(
        draft({ mode: 'shares', people: values.map((value, i) => ({ name: ['Me', 'Sam', 'Riya'][i] ?? 'x', value })) }),
        ctx,
      ).participants?.map((p) => p.input)
    expect(shares([1, 2, 1])).toEqual([1, 2, 1])
    expect(shares([null, 2, null])).toEqual([1, 2, 1])
    expect(shares([1, 1.5])).toEqual([2, 3])
    expect(shares([1, 0, -2])).toEqual([1, 1, 1])
    expect(shares([1, 1.2345678])).toEqual([1, 1])
    expect(shares([1, 5000])).toEqual([1, 1000])
  })

  it('equal: never carries values', () => {
    const { ctx } = context()
    const prefill = describedToPrefill(draft({ mode: 'equal', people: [{ name: 'Me', value: 12 }] }), ctx)
    expect(prefill.participants).toEqual([{ friendId: 'me', input: null }])
  })
})

describe('describedToPrefill — the rest', () => {
  it('tidies the title and keeps it within the limit', () => {
    const { ctx } = context()
    expect(describedToPrefill(draft({ title: '  Goa   trip   cab ' }), ctx).title).toBe('Goa trip cab')
    expect(describedToPrefill(draft({ title: 'x'.repeat(200) }), ctx).title).toHaveLength(80)
    expect(describedToPrefill(draft({ title: '   ' }), ctx).title).toBeUndefined()
  })

  it('guesses a category from the title when the AI said "other"', () => {
    const { ctx } = context()
    expect(describedToPrefill(draft({ title: 'Swiggy order', category: 'other' }), ctx).category).toBe('food')
    expect(describedToPrefill(draft({ title: 'Stuff', category: 'other' }), ctx).category).toBe('other')
    expect(describedToPrefill(draft({ title: 'Swiggy order', category: 'gift' }), ctx).category).toBe('gift')
  })

  it('keeps a past date and drops a future or invalid one', () => {
    const { ctx } = context()
    const yesterday = addDays(today(), -1)
    expect(describedToPrefill(draft({ date: yesterday }), ctx).date).toBe(yesterday)
    expect(describedToPrefill(draft({ date: today() }), ctx).date).toBe(today())
    expect(describedToPrefill(draft({ date: addDays(today(), 2) }), ctx).date).toBeUndefined()
    expect(describedToPrefill(draft({ date: '2026-02-30' }), ctx).date).toBeUndefined()
    expect(describedToPrefill(draft({ date: null }), ctx).date).toBeUndefined()
  })

  it('treats an unknown mode as equal', () => {
    const { ctx } = context()
    expect(describedToPrefill(draft({ mode: 'items' as never }), ctx).mode).toBe('equal')
  })

  it('survives the hand-off to the split screen unchanged', () => {
    const { ctx } = context()
    const prefill = describedToPrefill(
      draft({ mode: 'percent', payer: 'Sam', date: addDays(today(), -1), people: [{ name: 'Me', value: 50 }, { name: 'Sam', value: 50 }] }),
      ctx,
    )
    setSplitPrefill(prefill)
    expect(takeSplitPrefill()).toEqual(prefill)
  })
})

describe('resolveDescribedPeople', () => {
  it('says who is who without adding anyone', () => {
    const { ctx, addFriend } = context()
    const people = resolveDescribedPeople(
      draft({ people: [{ name: 'I', value: 2 }, { name: 'riya', value: null }, { name: 'Kabir', value: 1 }, { name: 'kabir', value: 1 }] }),
      ctx,
    )
    expect(people).toEqual([
      { name: 'I', friendId: 'me', isMe: true, value: 2 },
      { name: 'riya', friendId: 'riya', isMe: false, value: null },
      { name: 'Kabir', friendId: null, isMe: false, value: 2 },
    ])
    expect(addFriend).not.toHaveBeenCalled()
  })

  it('drops non-numeric values', () => {
    const { ctx } = context()
    const people = resolveDescribedPeople(draft({ people: [{ name: 'Sam', value: Number.NaN }] }), ctx)
    expect(people[0]?.value).toBeNull()
  })
})

describe('missingPeople', () => {
  it('counts the people the text counted but did not name', () => {
    expect(missingPeople(draft({ headcount: 4, people: [{ name: 'Me', value: null }] }))).toBe(3)
    expect(missingPeople(draft({ headcount: 3 }))).toBe(0)
    expect(missingPeople(draft({ headcount: 2 }))).toBe(0)
    expect(missingPeople(draft({ headcount: null }))).toBe(0)
    expect(missingPeople(draft())).toBe(0)
  })
})
