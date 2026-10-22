import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetDataForTests } from '../data'
import { ME_ID, type Expense } from '../domain/types'
import { makeExpense } from '../share/testing'
import { ShareList } from './ShareList'
import { extrasLabel, shareActions, shareLines } from './shareLines'
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

/**
 * A ₹1,254 bill paid by me: paneer ₹345 (me + Riya), butter chicken ₹495 (Sam), naan ₹300
 * (nobody ticked → everyone). Items ₹1,140; the 10% extra is shared in proportion.
 */
function bill(extra: Partial<Expense> = {}): Expense {
  return makeExpense({
    kind: 'bill',
    title: 'Saffron Table',
    mode: 'items',
    total: 125_400,
    participants: [ME_ID, 'riya', 'sam'].map((friendId) => ({ friendId, input: null })),
    shares: { [ME_ID]: 29_975, riya: 29_975, sam: 65_450 },
    paidBack: {},
    bill: {
      meta: { merchant: 'Saffron Table', date: null, subtotal: null, tax: 11_400, serviceCharge: null, discount: null, tip: null, total: 125_400 },
      items: [
        { id: 'p1', name: 'Paneer Tikka', quantity: 1, amount: 34_500 },
        { id: 'p2', name: 'Butter Chicken', quantity: 1, amount: 49_500 },
        { id: 'p3', name: 'Garlic Naan', quantity: 4, amount: 30_000 },
      ],
      assignments: { p1: { [ME_ID]: 1, riya: 1 }, p2: { sam: 1 } },
      warnings: [],
    },
    ...extra,
  })
}

describe('shareLines', () => {
  it('lists everyone, payer first, with where their share stands', () => {
    const lines = shareLines(dinner({ shares: { [ME_ID]: 69_150, riya: 69_150, sam: 69_150, neha: 0 }, paidBack: { riya: 1 } }))
    expect(lines.map((l) => [l.friendId, l.share, l.state])).toEqual([
      [ME_ID, 69_150, 'payer'],
      ['riya', 69_150, 'paid'],
      ['sam', 69_150, 'owes'],
      ['neha', 0, 'zero'],
    ])
    expect(lines.every((l) => l.items.length === 0 && l.extras === 0)).toBe(true)
  })

  it('marks group expenses as settled through the group', () => {
    expect(shareLines(dinner(), { settledInGroup: true }).map((l) => l.state)).toEqual(['payer', 'group', 'group', 'group'])
  })

  it("gives each person their items on a bill, and their part of what's on top", () => {
    const [me, riya, sam] = shareLines(bill())
    expect(me?.items).toEqual([
      { itemId: 'p1', name: 'Paneer Tikka', amount: 17_250, portion: '½', everyone: false },
      { itemId: 'p3', name: 'Garlic Naan', amount: 10_000, portion: '⅓', everyone: true },
    ])
    expect(me?.extras).toBe(2_725)
    expect(riya?.extras).toBe(2_725)
    expect(sam?.items.map((i) => [i.name, i.amount, i.portion])).toEqual([
      ['Butter Chicken', 49_500, null],
      ['Garlic Naan', 10_000, '⅓'],
    ])
    expect(sam?.extras).toBe(5_950)
  })

  it('names the extras line', () => {
    expect(extrasLabel(2_725, 'INR')).toBe('Tax & charges')
    expect(extrasLabel(-5_000, 'INR')).toBe('Discounts')
    expect(extrasLabel(-40, 'INR')).toBe('Round-off')
    expect(extrasLabel(100, 'INR')).toBe('Round-off')
    // Yen has no minor unit: ¥2 is more than a round-off.
    expect(extrasLabel(2, 'JPY')).toBe('Tax & charges')
  })

  it('offers ticks on open and paid shares, UPI and nudges only between you and the payer', () => {
    const lines = shareLines(dinner())
    const [me, riya, sam] = lines.map((l) => shareActions(l, dinner()))
    expect(me).toEqual({ toggle: false, upi: false, nudge: false })
    expect(riya).toEqual({ toggle: true, upi: false, nudge: false })
    expect(sam).toEqual({ toggle: true, upi: true, nudge: true })
    // Not rupees: no UPI.
    expect(shareActions(lines[2]!, dinner({ currency: 'USD' }))).toEqual({ toggle: true, upi: false, nudge: true })

    const riyaPaid = dinner({ payerId: 'riya', paidBack: {} })
    const byId = Object.fromEntries(shareLines(riyaPaid).map((l) => [l.friendId, shareActions(l, riyaPaid)]))
    expect(byId[ME_ID]).toEqual({ toggle: true, upi: true, nudge: false })
    expect(byId.sam).toEqual({ toggle: true, upi: false, nudge: false })
  })
})

describe('ShareList', () => {
  function rows(): HTMLElement[] {
    return within(screen.getByRole('list', { name: 'Shares' })).getAllByRole('listitem')
  }

  it('shows each person, their share and where it stands', () => {
    render(<ShareList expense={dinner()} />)
    const [me, riya, sam, neha] = rows()
    expect(me).toHaveTextContent('You')
    expect(me).toHaveTextContent('Paid the bill')
    expect(me).toHaveTextContent('₹691.50')
    expect(riya).toHaveTextContent('RiyaPaid you back₹691.50')
    expect(sam).toHaveTextContent('SamOwes you₹691.50')
    expect(neha).toHaveTextContent('Neha Sharma')
    // Read-only without handlers.
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('ticks people off as paid, and back', async () => {
    const onTogglePaid = vi.fn()
    render(<ShareList expense={dinner()} onTogglePaid={onTogglePaid} />)
    const riya = screen.getByRole('button', { name: 'Riya paid you back' })
    const sam = screen.getByRole('button', { name: 'Sam paid you back' })
    expect(riya).toHaveAttribute('aria-pressed', 'true')
    expect(sam).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('button', { name: 'You paid you back' })).not.toBeInTheDocument()
    await userEvent.click(sam)
    expect(onTogglePaid).toHaveBeenLastCalledWith('sam', true)
    await userEvent.click(riya)
    expect(onTogglePaid).toHaveBeenLastCalledWith('riya', false)
  })

  it('offers a UPI QR and a nudge for each open share when you paid', async () => {
    const onPayUpi = vi.fn()
    const onNudge = vi.fn()
    render(<ShareList expense={dinner()} onPayUpi={onPayUpi} onNudge={onNudge} />)
    await userEvent.click(screen.getByRole('button', { name: 'Show a UPI QR for Sam to pay ₹691.50' }))
    expect(onPayUpi).toHaveBeenCalledWith('sam')
    await userEvent.click(screen.getByRole('button', { name: 'Nudge Neha Sharma about ₹691.50' }))
    expect(onNudge).toHaveBeenCalledWith('neha')
    // Riya has paid: nothing to chase.
    expect(within(rows()[1]!).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /UPI QR/ })).toHaveLength(2)
  })

  it('leaves UPI out for other currencies', () => {
    render(<ShareList expense={dinner({ currency: 'USD' })} onPayUpi={() => {}} onNudge={() => {}} />)
    expect(screen.queryByRole('button', { name: /UPI/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Nudge/ })).toHaveLength(2)
  })

  it('lets you pay whoever paid, and keeps out of what others owe them', async () => {
    const onPayUpi = vi.fn()
    render(<ShareList expense={dinner({ payerId: 'riya', paidBack: {} })} onPayUpi={onPayUpi} onNudge={() => {}} onTogglePaid={() => {}} />)
    const [riya, me] = rows()
    expect(riya).toHaveTextContent('RiyaPaid the bill')
    expect(me).toHaveTextContent('YouYou owe Riya')
    expect(rows()[2]).toHaveTextContent('Owes Riya')
    const pay = screen.getByRole('button', { name: 'Pay Riya ₹691.50 via UPI' })
    expect(pay).toHaveTextContent('Pay Riya')
    await userEvent.click(pay)
    expect(onPayUpi).toHaveBeenCalledWith(ME_ID)
    expect(screen.queryByRole('button', { name: /^Nudge/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'You paid Riya back' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sam paid Riya back' })).toBeInTheDocument()
  })

  it('lists group expenses read-only: they settle in the group', () => {
    const group = seedGroup()
    render(<ShareList expense={dinner({ groupId: group.id })} onTogglePaid={() => {}} onPayUpi={() => {}} onNudge={() => {}} />)
    expect(rows()[2]).toHaveTextContent('Settles in Goa 2026')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it("folds out each person's items on a bill", async () => {
    render(<ShareList expense={bill()} />)
    const toggle = screen.getByRole('button', { name: '2 items Sam had' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list', { name: 'Sam’s items' })).not.toBeInTheDocument()
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const items = within(screen.getByRole('list', { name: 'Sam’s items' })).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual([
      'Butter Chicken₹495',
      'Garlic Naan · ⅓, shared by all₹100',
      'Tax & charges+₹59.50',
    ])
    expect(screen.getByRole('button', { name: '2 items you had' })).toHaveAttribute('aria-expanded', 'false')
  })
})
