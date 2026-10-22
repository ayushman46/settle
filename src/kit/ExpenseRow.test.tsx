import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { List } from '../components'
import { addFriend, createGroup, resetDataForTests } from '../data'
import { ME_ID, type Expense } from '../domain/types'
import { today } from '../engine/dates'
import { makeExpense, makeGroup } from '../share/testing'
import { ExpenseRow } from './ExpenseRow'
import { expenseRowView, plural, splitPeopleIds } from './expenseLabels'

beforeEach(() => {
  resetDataForTests()
})

afterEach(() => {
  resetDataForTests()
})

/** ₹2,766 dinner paid by me, split 4 ways; Riya paid back (from the share-kit fixtures). */
const dinner = (extra: Partial<Expense> = {}) => makeExpense(extra)

describe('plural', () => {
  it('counts in words', () => {
    expect(plural(1, 'person', 'people')).toBe('1 person')
    expect(plural(4, 'person', 'people')).toBe('4 people')
    expect(plural(0, 'item')).toBe('0 items')
  })
})

describe('splitPeopleIds', () => {
  it('puts the payer first, then participants, then anyone else with a share', () => {
    const e = dinner({ payerId: 'sam' })
    expect(splitPeopleIds(e)).toEqual(['sam', ME_ID, 'riya', 'neha'])
  })

  it('keeps a payer who only holds a share (round-to-whole) and drops one with neither', () => {
    const base = dinner({ participants: [{ friendId: 'riya', input: null }, { friendId: 'sam', input: null }] })
    expect(splitPeopleIds({ ...base, shares: { riya: 100, sam: 100, [ME_ID]: 3 } })).toEqual([ME_ID, 'riya', 'sam'])
    expect(splitPeopleIds({ ...base, shares: { riya: 100, sam: 100 } })).toEqual(['riya', 'sam'])
  })

  it('lists each person once', () => {
    const e = dinner({ participants: [ME_ID, 'riya', 'riya'].map((friendId) => ({ friendId, input: null })) })
    expect(splitPeopleIds({ ...e, shares: { [ME_ID]: 1, riya: 1 } })).toEqual([ME_ID, 'riya'])
  })
})

describe('expenseRowView', () => {
  const view = (e: Expense, extra: Partial<Parameters<typeof expenseRowView>[1]> = {}) =>
    expenseRowView(e, { payerName: 'Riya', group: null, ...extra })

  it('shows what I paid for and what is still owed to me', () => {
    const v = view(dinner())
    expect(v.subtitle).toBe('You paid ₹2,766 · 4 people')
    // Sam and Neha still owe ₹691.50 each.
    expect(v.amount).toBe(138_300)
    expect(v.tone).toBe('positive')
    expect(v.status).toEqual({ tone: 'warning', label: '2 pending' })
    expect(v.caption).toBeNull()
    expect(v.spoken).toBe("You paid ₹2,766 · 4 people, you're owed ₹1,383, 2 pending")
  })

  it('calls it settled once everyone paid me back, showing what I got back', () => {
    const v = view(dinner({ paidBack: { riya: 1, sam: 2, neha: 3 } }))
    expect(v.amount).toBe(207_450)
    expect(v.tone).toBe('muted')
    expect(v.status).toEqual({ tone: 'positive', label: 'Settled' })
    expect(v.spoken).toContain('you got back ₹2,074.50, settled')
  })

  it('treats a split with only me as nothing to collect', () => {
    const v = view(dinner({ participants: [{ friendId: ME_ID, input: null }], shares: { [ME_ID]: 276_600 }, paidBack: {} }))
    expect(v.subtitle).toBe('You paid ₹2,766 · just you')
    expect(v.amount).toBe(276_600)
    expect(v.tone).toBe('muted')
    expect(v.status).toBeNull()
    expect(v.caption).toBeNull()
  })

  it('says what I owe when someone else paid', () => {
    const v = view(dinner({ payerId: 'riya', paidBack: {} }))
    expect(v.subtitle).toBe('Riya paid ₹2,766 · 4 people')
    expect(v.amount).toBe(-69_150)
    expect(v.tone).toBe('negative')
    expect(v.caption).toBe('you owe')
    expect(v.status).toBeNull()
    expect(v.spoken).toBe('Riya paid ₹2,766 · 4 people, you owe ₹691.50')
  })

  it('marks my share settled once I paid it back', () => {
    const v = view(dinner({ payerId: 'riya', paidBack: { [ME_ID]: 5 } }))
    expect(v.amount).toBe(69_150)
    expect(v.tone).toBe('muted')
    expect(v.status).toEqual({ tone: 'positive', label: 'Settled' })
  })

  it('shows the total, muted, for a split I am not part of', () => {
    const e = dinner({
      payerId: 'riya',
      participants: [{ friendId: 'riya', input: null }, { friendId: 'sam', input: null }],
      shares: { riya: 138_300, sam: 138_300 },
      paidBack: {},
    })
    const v = view(e)
    expect(v.subtitle).toBe('Riya paid ₹2,766 · 2 people')
    expect(v.amount).toBe(276_600)
    expect(v.tone).toBe('muted')
    expect(v.caption).toBe('not involved')
  })

  it('shows lent / borrowed for group expenses, settled through the group', () => {
    const group = makeGroup()
    const mine = view(dinner({ groupId: group.id }), { group })
    expect(mine.subtitle).toBe('You paid ₹2,766 · Goa 2026')
    expect(mine.amount).toBe(207_450)
    expect(mine.tone).toBe('positive')
    expect(mine.caption).toBe('you lent')
    expect(mine.status).toBeNull()

    const theirs = view(dinner({ groupId: group.id, payerId: 'riya' }), { group })
    expect(theirs.amount).toBe(-69_150)
    expect(theirs.caption).toBe('you borrowed')
    expect(theirs.spoken).toContain('you borrowed ₹691.50')
  })

  it('counts people instead of naming the group when asked', () => {
    const group = makeGroup()
    expect(view(dinner({ groupId: group.id }), { group, showGroup: false }).subtitle).toBe('You paid ₹2,766 · 4 people')
  })

  it('settles a group expense in another currency person to person', () => {
    const group = makeGroup({ currency: 'USD' })
    const v = view(dinner({ groupId: group.id }), { group })
    expect(v.status).toEqual({ tone: 'warning', label: '2 pending' })
  })

  it('uses the currency of the expense', () => {
    const v = view(dinner({ currency: 'USD', total: 12_000, shares: { [ME_ID]: 3_000, riya: 3_000, sam: 3_000, neha: 3_000 } }))
    expect(v.subtitle).toBe('You paid $120 · 4 people')
  })
})

describe('ExpenseRow', () => {
  it('renders the title, who paid and where I stand', () => {
    const riya = addFriend({ name: 'Riya' })
    const e = dinner({
      payerId: riya.id,
      participants: [ME_ID, riya.id].map((friendId) => ({ friendId, input: null })),
      shares: { [ME_ID]: 54_000, [riya.id]: 54_000 },
      total: 108_000,
      paidBack: {},
    })
    render(
      <List>
        <ExpenseRow expense={e} />
      </List>,
    )
    expect(screen.getByText('Dinner at Toit')).toBeInTheDocument()
    expect(screen.getByText('Riya paid ₹1,080 · 2 people')).toBeInTheDocument()
    expect(screen.getByText('-₹540')).toBeInTheDocument()
    expect(screen.getByText('you owe')).toBeInTheDocument()
    expect(screen.getByRole('listitem')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('is one button named with everything it shows', async () => {
    const onClick = vi.fn()
    render(<ExpenseRow expense={dinner()} onClick={onClick} />)
    const row = screen.getByRole('button', {
      name: "Dinner at Toit, You paid ₹2,766 · 4 people, you're owed ₹1,383, 2 pending",
    })
    expect(screen.getByText('+₹1,383')).toBeInTheDocument()
    expect(screen.getByText('2 pending')).toBeInTheDocument()
    await userEvent.click(row)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('names a removed payer "Someone"', () => {
    render(<ExpenseRow expense={dinner({ payerId: 'gone', paidBack: {} })} />)
    expect(screen.getByText('Someone paid ₹2,766 · 4 people')).toBeInTheDocument()
  })

  it('names the group it belongs to, unless told not to', () => {
    const group = createGroup({ name: 'Flat 4B', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [ME_ID] })
    const e = dinner({ groupId: group.id })
    const { rerender } = render(<ExpenseRow expense={e} />)
    expect(screen.getByText('You paid ₹2,766 · Flat 4B')).toBeInTheDocument()
    expect(screen.getByText('you lent')).toBeInTheDocument()
    rerender(<ExpenseRow expense={e} hideGroup />)
    expect(screen.getByText('You paid ₹2,766 · 4 people')).toBeInTheDocument()
  })

  it('can lead with the date', () => {
    render(<ExpenseRow expense={dinner({ date: today() })} showDate onClick={() => {}} />)
    expect(screen.getByText('Today · You paid ₹2,766 · 4 people')).toBeInTheDocument()
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(/^Dinner at Toit, \w+day, /)
  })

  it('shows a settled pill', () => {
    render(<ExpenseRow expense={dinner({ paidBack: { riya: 1, sam: 1, neha: 1 } })} />)
    expect(screen.getByText('Settled')).toBeInTheDocument()
    expect(screen.getByText('₹2,074.50')).toBeInTheDocument()
  })

  it('marks recurring splits with a small repeat glyph, glued to the last word', () => {
    const { container } = render(<ExpenseRow expense={dinner({ recurringId: 'r1', title: 'October rent' })} />)
    expect(container.querySelector('svg.lucide-repeat')).not.toBeNull()
    // The glyph wraps with "rent", never onto a line of its own.
    expect(screen.getByText('rent').querySelector('svg.lucide-repeat')).not.toBeNull()
    expect(container.textContent).toContain('October rent')
  })

  it('keeps a one-word recurring title whole', () => {
    render(<ExpenseRow expense={dinner({ recurringId: 'r1', title: 'Netflix' })} />)
    expect(screen.getByText('Netflix').querySelector('svg.lucide-repeat')).not.toBeNull()
  })
})
