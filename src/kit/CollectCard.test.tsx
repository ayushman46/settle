import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetDataForTests } from '../data'
import { ME_ID, type Expense } from '../domain/types'
import { makeExpense } from '../share/testing'
import { CollectCard } from './CollectCard'
import { paidCountLabel, pendingIds, waitingOnLabel } from './collectLabels'
import { seedGroup, seedPeople } from './testPeople'

beforeEach(() => {
  resetDataForTests()
  seedPeople()
})

afterEach(() => {
  resetDataForTests()
})

/** ₹2,766 dinner paid by me, split 4 ways (₹691.50 each); Riya paid me back. */
const dinner = (extra: Partial<Expense> = {}) => makeExpense(extra)

function card(): HTMLElement {
  return screen.getByRole('region')
}

describe('collect labels', () => {
  it('lists who still owes the payer, in split order', () => {
    expect(pendingIds(dinner())).toEqual(['sam', 'neha'])
    expect(pendingIds(dinner({ paidBack: { riya: 1, sam: 1, neha: 1 } }))).toEqual([])
    // Someone else paid: I owe them too; zero shares owe nothing.
    expect(pendingIds(dinner({ payerId: 'riya', paidBack: {}, shares: { [ME_ID]: 100, riya: 100, sam: 0, neha: 100 } }))).toEqual([
      ME_ID,
      'neha',
    ])
  })

  it('counts who paid', () => {
    expect(paidCountLabel(1, 3)).toBe('1 of 3 paid')
    expect(paidCountLabel(0, 3)).toBe("Nobody's paid yet")
    expect(paidCountLabel(0, 1)).toBe('Not paid yet')
    expect(paidCountLabel(3, 3)).toBe('All 3 paid')
    expect(paidCountLabel(1, 1)).toBe('Paid')
  })

  it('says who it is waiting on, by first name', () => {
    expect(waitingOnLabel([])).toBeNull()
    expect(waitingOnLabel(['Sam'])).toBe('Waiting on Sam')
    expect(waitingOnLabel(['you', 'Neha Sharma'])).toBe('Waiting on you and Neha')
    expect(waitingOnLabel(['A', 'B', 'C', 'D'])).toBe('Waiting on A, B and 2 others')
  })
})

describe('CollectCard', () => {
  it('shows what has come back to me, with a ring and who it is waiting on', () => {
    render(<CollectCard expense={dinner()} />)
    expect(card()).toHaveAttribute('data-state', 'collecting')
    expect(screen.getByRole('heading', { name: '₹691.50 collected' })).toBeInTheDocument()
    expect(screen.getByText('of ₹2,074.50 · 1 of 3 paid')).toBeInTheDocument()
    expect(screen.getByText('Waiting on Sam and Neha')).toBeInTheDocument()
    const ring = screen.getByRole('progressbar', { name: 'Collected' })
    expect(ring).toHaveAttribute('aria-valuenow', '33')
    expect(within(ring).getByText('1/3')).toBeInTheDocument()
  })

  it('celebrates when everyone has paid', () => {
    render(<CollectCard expense={dinner({ paidBack: { riya: 1, sam: 2, neha: 3 } })} />)
    expect(card()).toHaveAttribute('data-state', 'done')
    expect(screen.getByRole('heading', { name: 'All ₹2,074.50 collected' })).toBeInTheDocument()
    expect(screen.getByText('All 3 paid')).toBeInTheDocument()
    expect(screen.queryByText(/Waiting on/)).not.toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Collected' })).toHaveAttribute('aria-valuenow', '100')
  })

  it('tells the story from the payer’s side when someone else paid', () => {
    render(<CollectCard expense={dinner({ payerId: 'riya', paidBack: { sam: 1 } })} />)
    expect(screen.getByRole('heading', { name: '₹691.50 back to Riya' })).toBeInTheDocument()
    expect(screen.getByText('of ₹2,074.50 · 1 of 3 paid')).toBeInTheDocument()
    expect(screen.getByText('Waiting on you and Neha')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Paid back' })).toBeInTheDocument()
  })

  it('says when the payer got everything back', () => {
    render(<CollectCard expense={dinner({ payerId: 'riya', paidBack: { [ME_ID]: 1, sam: 1, neha: 1 } })} />)
    expect(screen.getByRole('heading', { name: 'Riya got back all ₹2,074.50' })).toBeInTheDocument()
  })

  it('has nothing to collect when it is just me', () => {
    render(<CollectCard expense={dinner({ participants: [{ friendId: ME_ID, input: null }], shares: { [ME_ID]: 276_600 }, paidBack: {} })} />)
    expect(card()).toHaveAttribute('data-state', 'none')
    expect(screen.getByRole('heading', { name: 'Nothing to collect' })).toBeInTheDocument()
    expect(screen.getByText('It’s just you on this one.')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('has nothing to pay back when someone covered only themselves', () => {
    render(<CollectCard expense={dinner({ payerId: 'sam', participants: [{ friendId: 'sam', input: null }], shares: { sam: 1_000 }, paidBack: {} })} />)
    expect(screen.getByRole('heading', { name: 'Nothing to pay back' })).toBeInTheDocument()
    expect(screen.getByText('Sam covered only themselves.')).toBeInTheDocument()
  })

  it('points group expenses to the group’s settle up', () => {
    const group = seedGroup()
    render(<CollectCard expense={dinner({ groupId: group.id })} />)
    expect(card()).toHaveAttribute('data-state', 'group')
    expect(screen.getByRole('heading', { name: 'Settles in Goa 2026' })).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('tracks a group expense in another currency person to person', () => {
    const group = seedGroup()
    render(<CollectCard expense={dinner({ groupId: group.id, currency: 'USD' })} />)
    expect(card()).toHaveAttribute('data-state', 'collecting')
    expect(screen.getByRole('heading', { name: '$691.50 collected' })).toBeInTheDocument()
    expect(screen.getByText('of $2,074.50 · 1 of 3 paid')).toBeInTheDocument()
  })

  it('names people who were removed "Someone"', () => {
    render(<CollectCard expense={dinner({ paidBack: {}, participants: [ME_ID, 'gone'].map((friendId) => ({ friendId, input: null })), shares: { [ME_ID]: 100, gone: 100 } })} />)
    expect(screen.getByRole('heading', { name: '₹1 to collect' })).toBeInTheDocument()
    expect(screen.getByText('Not paid yet')).toBeInTheDocument()
    expect(screen.getByText('Waiting on Someone')).toBeInTheDocument()
  })

  it('leads with what is still to come back before anyone has paid', () => {
    render(<CollectCard expense={dinner({ paidBack: {} })} />)
    expect(screen.getByRole('heading', { name: '₹2,074.50 to collect' })).toBeInTheDocument()
    expect(screen.getByText("Nobody's paid yet")).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Collected' })).toHaveAttribute('aria-valuenow', '0')
  })

  it('says what someone else is still owed before anyone has paid them', () => {
    render(<CollectCard expense={dinner({ payerId: 'riya', paidBack: {} })} />)
    expect(screen.getByRole('heading', { name: '₹2,074.50 owed to Riya' })).toBeInTheDocument()
    expect(screen.getByText('Waiting on you, Sam and Neha')).toBeInTheDocument()
  })
})
