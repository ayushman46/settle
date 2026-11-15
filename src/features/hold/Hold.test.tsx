import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addFriend,
  createGroup,
  deleteGroup,
  expensesStore,
  flushAllStores,
  groupsStore,
  reloadAllStores,
  saveExpense,
  setPaidBack,
  STORAGE_KEYS,
  updateProfile,
} from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID, type Expense, type Group } from '../../domain/types'
import { groupBalances, overallSummary } from '../../engine/balances'
import { putShared } from '../groupsync/store'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { MAX_HELD } from './engine'
import { HoldButton } from './HoldButton'
import { HoldCard, HoldHome } from './HoldCard'
import { heldById, holdExpense, holdStore, releaseHold } from './store'
import { holdToday } from './today'

vi.setConfig({ testTimeout: 30_000 })

const DAY = 86_400_000
let riya: string
let sam: string
let groupId: string
let dinner: Expense
let cab: Expense

const group = (): Group => groupsStore.get().find((g) => g.id === groupId)!
const stored = (): string => JSON.stringify(expensesStore.get())
const balances = () => groupBalances(group(), expensesStore.get())

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 14, 12))
  resetProScreens()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
  groupId = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya, sam] }).id
  cab = saveExpense(draft({ title: 'Cab', total: 90_000, date: '2026-11-12', payerId: riya, groupId, participants: everyone(ME_ID, riya, sam) }))
  dinner = saveExpense(draft({ title: 'Dinner', total: 240_000, date: '2026-11-13', payerId: sam, groupId, participants: everyone(ME_ID, riya, sam) }))
  saveExpense(draft({ title: 'Chai', total: 6000, date: '2026-11-14', payerId: ME_ID, groupId, participants: everyone(ME_ID, riya, sam) }))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('HoldButton', () => {
  it('renders nothing for an expense that does not exist', () => {
    const { container } = renderAt('/app/expense/nope', <HoldButton expenseId="nope" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('takes the expense out of every balance with the default reason; Undo puts it back byte for byte', async () => {
    const before = stored()
    const withDinner = balances()
    const holding = vi.fn()
    const { user } = renderAt(`/app/expense/${dinner.id}`, <HoldButton expenseId={dinner.id} onHolding={holding} />)
    await user.click(screen.getByRole('button', { name: 'Put on hold' }))
    const sheet = await screen.findByRole('dialog', { name: 'Put this on hold?' })
    expect(sheet).toHaveTextContent('Dinner · ₹2,400')
    expect(sheet).toHaveTextContent('Nothing is deleted: put it back any time, exactly as it was.')
    // Not a shared group: nobody else is affected, so it doesn't say so.
    expect(sheet).not.toHaveTextContent('Everyone in the group')
    expect(within(sheet).getByRole('button', { name: 'Checking the bill' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(within(sheet).getByRole('button', { name: 'Put it on hold' }))
    expect(holding).toHaveBeenCalledWith(expect.objectContaining({ id: dinner.id }))
    expect(expensesStore.get().map((e) => e.title)).toEqual(['Chai', 'Cab'])
    expect(heldById(dinner.id)).toMatchObject({ reason: 'checking', note: null, heldAt: new Date(2026, 10, 14, 12).getTime() })
    // The balances are those of a group that never had the dinner.
    expect(balances()).not.toEqual(withDinner)
    expect(balances()[sam]).toBe(withDinner[sam]! - 160_000)
    expect(Object.values(balances()).reduce((a, b) => a + b, 0)).toBe(0)
    expect(screen.getByText('Dinner is on hold. It’s out of the balances.')).toBeInTheDocument()
    // Its own page has nothing left to show: back to the group.
    expect(currentUrl()).toBe(`/app/groups/${groupId}`)

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(stored()).toBe(before)
    expect(holdStore.get().held).toEqual([])
    expect(balances()).toEqual(withDinner)
  })

  it('keeps the reason picked, and what was typed for “Something else”', async () => {
    const { user } = renderAt('/app/groups/x', <HoldButton expenseId={dinner.id} />)
    await user.click(screen.getByRole('button', { name: 'Put on hold' }))
    const sheet = await screen.findByRole('dialog', { name: 'Put this on hold?' })
    expect(within(sheet).getAllByRole('button', { pressed: false }).map((b) => b.textContent)).toEqual(['Wrong amount', 'I wasn’t there', 'Paid twice', 'Something else'])
    expect(within(sheet).queryByLabelText('What is it?')).not.toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Something else' }))
    await user.type(within(sheet).getByLabelText('What is it?'), '  Sam is finding   the bill ')
    await user.click(within(sheet).getByRole('button', { name: 'Put it on hold' }))
    expect(heldById(dinner.id)).toMatchObject({ reason: 'other', note: 'Sam is finding the bill' })
    // Not on the expense's own page: it stays where it is.
    expect(currentUrl()).toBe('/app/groups/x')
  })

  it('in a shared group, says everyone stops seeing it', async () => {
    putShared({
      groupId,
      id: 'shared-1',
      key: 'k'.repeat(22),
      me: 'm-me',
      members: {},
      seen: {},
      meta: { n: 'Goa', e: '🏖️', k: 'trip', u: 1 },
      gone: {},
      revived: {},
      known: [],
      by: {},
      createdAt: 1,
      sent: null,
      synced: null,
    })
    const { user } = renderAt('/app/groups/x', <HoldButton expenseId={dinner.id} />)
    await user.click(screen.getByRole('button', { name: 'Put on hold' }))
    const sheet = await screen.findByRole('dialog', { name: 'Put this on hold?' })
    expect(sheet).toHaveTextContent('This group is shared. Everyone in the group stops seeing it until you put it back.')
  })
})

describe('HoldCard', () => {
  it('renders nothing when the group has nothing on hold', () => {
    const { container } = renderAt('/app/groups/x', <HoldCard group={group()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('lists what is on hold with why, and “Put it back” restores it exactly; Undo holds it again', async () => {
    const before = stored()
    holdExpense(dinner.id, 'amount', null)
    const { user } = renderAt('/app/groups/x', <HoldCard group={group()} />)
    const card = screen.getByRole('region', { name: '1 expense on hold' })
    expect(within(card).getByRole('listitem', { name: 'Dinner, ₹2,400' })).toHaveTextContent('Wrong amount')
    expect(card).toHaveTextContent('On hold since today')
    expect(card).toHaveTextContent('Left out of the balances until you sort it out.')

    await user.click(within(card).getByRole('button', { name: 'Put Dinner back' }))
    expect(stored()).toBe(before)
    const back = expensesStore.get().find((e) => e.id === dinner.id)!
    expect(back).toEqual(dinner)
    expect(back).toMatchObject({ id: dinner.id, date: '2026-11-13', shares: dinner.shares, createdAt: dinner.createdAt, updatedAt: dinner.updatedAt })
    expect(screen.queryByRole('region', { name: /on hold/ })).not.toBeInTheDocument()
    expect(screen.getByText('Dinner is back in the balances, as it was')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(expensesStore.get().some((e) => e.id === dinner.id)).toBe(false)
    expect(heldById(dinner.id)).toMatchObject({ reason: 'amount' })
    expect(screen.getByRole('region', { name: '1 expense on hold' })).toBeInTheDocument()
  })

  it('“Change it” puts it back and opens its editor', async () => {
    holdExpense(dinner.id, 'absent', null)
    const { user } = renderAt('/app/groups/x', <HoldCard group={group()} />)
    await user.click(screen.getByRole('button', { name: 'Put Dinner back and change it' }))
    expect(expensesStore.get().find((e) => e.id === dinner.id)).toEqual(dinner)
    expect(holdStore.get().held).toEqual([])
    expect(currentUrl()).toBe(`/app/split/${dinner.id}/edit`)
  })

  it('“Delete for good” removes it, and Undo brings the hold back where it was', async () => {
    holdExpense(cab.id, 'twice', null)
    vi.setSystemTime(new Date(2026, 10, 17, 12))
    holdExpense(dinner.id, 'amount', null)
    const { user } = renderAt('/app/groups/x', <HoldCard group={group()} />)
    const card = screen.getByRole('region', { name: '2 expenses on hold' })
    expect(within(card).getAllByRole('listitem').map((li) => li.getAttribute('aria-label'))).toEqual(['Dinner, ₹2,400', 'Cab, ₹900'])
    // Cab was held three days ago.
    expect(within(card).getByRole('listitem', { name: 'Cab, ₹900' })).toHaveTextContent('Paid twice On hold for 3 days')
    const heldBefore = JSON.stringify(holdStore.get())

    await user.click(within(card).getByRole('button', { name: 'Delete Cab for good' }))
    expect(holdStore.get().held.map((h) => h.expense.title)).toEqual(['Dinner'])
    expect(expensesStore.get().some((e) => e.id === cab.id)).toBe(false)
    expect(screen.getByText('Deleted Cab')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(JSON.stringify(holdStore.get())).toBe(heldBefore)
  })

  it('shows only its own group’s holds; loose ones go to HoldHome', () => {
    const loose = saveExpense(draft({ title: 'Movie', total: 50_000, payerId: ME_ID, participants: everyone(ME_ID, riya) }))
    holdExpense(loose.id, 'checking', null)
    const inGroup = renderAt('/app/groups/x', <HoldCard group={group()} />)
    expect(inGroup.container).toBeEmptyDOMElement()
    inGroup.unmount()
    renderAt('/app', <HoldHome />)
    expect(screen.getByRole('listitem', { name: 'Movie, ₹500' })).toBeInTheDocument()
  })
})

describe('HoldHome', () => {
  it('renders nothing when nothing loose is on hold', () => {
    holdExpense(dinner.id, 'amount', null)
    const { container } = renderAt('/app', <HoldHome />)
    expect(container).toBeEmptyDOMElement()
  })

  it('a loose expense put back counts between the two of you again, exactly as before', async () => {
    const movie = saveExpense(draft({ title: 'Movie', total: 50_000, payerId: ME_ID, participants: everyone(ME_ID, riya) }))
    setPaidBack(movie.id, riya, true)
    setPaidBack(movie.id, riya, false)
    const before = stored()
    const net = () => overallSummary(expensesStore.get(), groupsStore.get(), ME_ID, 'INR').byFriend[riya] ?? 0
    const owed = net()
    holdExpense(movie.id, 'checking', null)
    expect(net()).toBe(owed - 25_000)
    const { user } = renderAt('/app', <HoldHome />)
    await user.click(screen.getByRole('button', { name: 'Put Movie back' }))
    expect(stored()).toBe(before)
    expect(net()).toBe(owed)
  })

  it('keeps a held expense whose group was deleted, so it is never lost', () => {
    holdExpense(dinner.id, 'amount', null)
    deleteGroup(groupId)
    renderAt('/app', <HoldHome />)
    expect(screen.getByRole('listitem', { name: 'Dinner, ₹2,400' })).toBeInTheDocument()
  })
})

describe('the store', () => {
  it('a held expense survives a reload whole, and goes back identical to the one taken out', () => {
    const bill = saveExpense(
      draft({
        kind: 'bill',
        mode: 'items',
        title: 'Thali',
        total: 105_000,
        payerId: ME_ID,
        groupId,
        participants: everyone(ME_ID, riya, sam),
        bill: {
          meta: { merchant: 'Cafe', date: null, subtotal: 100_000, tax: 5000, serviceCharge: null, discount: null, tip: null, total: 105_000 },
          items: [
            { id: 'i1', name: 'Thali', quantity: 2, amount: 70_000 },
            { id: 'i2', name: 'Lassi', quantity: 1, amount: 30_000 },
          ],
          assignments: { i1: { [ME_ID]: 1, [riya]: 1 }, i2: { [sam]: 1 } },
          warnings: [],
        },
      }),
    )
    const before = stored()
    const one = JSON.stringify(expensesStore.get().find((e) => e.id === bill.id))
    holdExpense(bill.id, 'twice', null)
    flushAllStores()
    reloadAllStores()
    expect(expensesStore.get().some((e) => e.id === bill.id)).toBe(false)
    expect(JSON.stringify(heldById(bill.id)!.expense)).toBe(one)
    releaseHold(bill.id)
    expect(stored()).toBe(before)
    flushAllStores()
    reloadAllStores()
    expect(stored()).toBe(before)
    expect(holdStore.get().held).toEqual([])
  })

  it('drops junk entries one by one and keeps the readable ones', () => {
    holdExpense(dinner.id, 'amount', null)
    flushAllStores()
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEYS.hold)!) as { v: number; data: { held: unknown[] } }
    raw.data.held = ['junk', { expense: { id: 'x' }, reason: 'amount' }, { ...(raw.data.held[0] as object), reason: 'made-up', heldAt: 'never' }, null]
    window.localStorage.setItem(STORAGE_KEYS.hold, JSON.stringify(raw))
    reloadAllStores()
    expect(holdStore.get().held).toHaveLength(1)
    expect(holdStore.get().held[0]).toMatchObject({ reason: 'other', heldAt: dinner.updatedAt })
    expect(holdStore.get().held[0]!.expense).toEqual(dinner)
  })

  it('refuses to hold more than the cap, and changes nothing then', () => {
    holdStore.set({ held: Array.from({ length: MAX_HELD }, (_, i) => ({ expense: { ...dinner, id: `h${i}` }, reason: 'amount' as const, note: null, heldAt: 1, afterId: null })) })
    const before = stored()
    expect(holdExpense(dinner.id, 'amount', null)).toBeNull()
    expect(stored()).toBe(before)
    expect(holdStore.get().held).toHaveLength(MAX_HELD)
  })

  it('holding something that is not there does nothing', () => {
    expect(holdExpense('nope', 'amount', null)).toBeNull()
    expect(releaseHold('nope')).toBeNull()
    expect(holdStore.get().held).toEqual([])
  })
})

describe('holdToday', () => {
  it('says nothing until a hold is a full week old, counted from the moment', () => {
    const heldAt = new Date(2026, 10, 14, 12).getTime()
    holdExpense(dinner.id, 'amount', null)
    expect(holdToday(new Date(heldAt))).toEqual([])
    expect(holdToday(new Date(heldAt + 7 * DAY - 1))).toEqual([])
    expect(holdToday(new Date(heldAt + 7 * DAY))).toEqual([
      {
        id: `hold:${dinner.id}`,
        title: 'Dinner has been on hold for a week',
        body: '₹2,400 in Goa is out of the balances. Put it back, change it or delete it.',
        path: `/app/groups/${groupId}`,
        amount: 240_000,
        currency: 'INR',
      },
    ])
    expect(holdToday(new Date(heldAt + 15 * DAY))[0]!.title).toBe('Dinner has been on hold for 2 weeks')
  })

  it('a loose hold points home, and nothing on hold means nothing due', () => {
    expect(holdToday(new Date(2026, 11, 1))).toEqual([])
    const movie = saveExpense(draft({ title: 'Movie', total: 50_000, payerId: ME_ID, participants: everyone(ME_ID, riya) }))
    holdExpense(movie.id, 'checking', null)
    const items = holdToday(new Date(2026, 10, 30, 12))
    expect(items).toEqual([expect.objectContaining({ title: 'Movie has been on hold for 2 weeks', body: '₹500 is out of the balances. Put it back, change it or delete it.', path: '/app' })])
  })
})
