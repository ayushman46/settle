import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, expensesStore, groupsStore, saveExpense, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID, type Group } from '../../domain/types'
import { groupBalances } from '../../engine/balances'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import type { GroupUnits } from './engine'
import { HouseholdsScreen } from './HouseholdsScreen'
import { getGroupUnits, getUnitPayments, setGroupUnits } from './store'
import { unitsToday } from './today'
import { UnitsCard } from './UnitsCard'
import { UnitsSheet } from './UnitsSheet'

vi.setConfig({ testTimeout: 30_000 })

let rahul: string
let priya: string
let anu: string
let imran: string
let sana: string
let sam: string
let groupId: string

const group = (): Group => groupsStore.get().find((g) => g.id === groupId)!
const balances = () => groupBalances(group(), expensesStore.get())
const path = () => `/app/groups/${groupId}/households`

/** The Sharmas (Rahul, Priya and their child Anu) and the Khans (Imran and Sana); you and Sam are on your own. */
const households = (more: Partial<GroupUnits> = {}): GroupUnits => ({
  households: [
    { id: 'h-sharma', name: '', memberIds: [rahul, priya, anu], childIds: [anu], payerId: null },
    { id: 'h-khan', name: '', memberIds: [imran, sana], childIds: [], payerId: null },
  ],
  basis: 'head',
  children: 'full',
  auto: true,
  ...more,
})

/** Imran paid ₹7,000 of hotel for all seven: ₹1,000 each. */
const hotel = () => saveExpense(draft({ title: 'Hotel', total: 700_000, payerId: imran, groupId, participants: everyone(ME_ID, rahul, priya, anu, imran, sana, sam) }))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 15, 12))
  resetProScreens()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  rahul = addFriend({ name: 'Rahul Sharma' }).id
  priya = addFriend({ name: 'Priya Sharma' }).id
  anu = addFriend({ name: 'Anu Sharma' }).id
  imran = addFriend({ name: 'Imran Khan', upiId: 'imran@okhdfc' }).id
  sana = addFriend({ name: 'Sana Khan' }).id
  sam = addFriend({ name: 'Sam' }).id
  groupId = createGroup({ name: 'Manali', emoji: '🏔️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, rahul, priya, anu, imran, sana, sam] }).id
})

afterEach(() => {
  vi.useRealTimers()
})

describe('HouseholdsScreen', () => {
  it('shows one payment per household, and Mark paid leaves every member of both square', async () => {
    setGroupUnits(groupId, households())
    hotel()
    const { user } = renderAt(path(), <HouseholdsScreen />)
    expect(screen.getByRole('heading', { name: 'Households', level: 1 })).toBeInTheDocument()
    expect(screen.getByText('Each household pays as one. One person pays, and everyone else in it shows as settled.')).toBeInTheDocument()

    // Largest first; Sam and you owe the same, so by name.
    const payments = within(screen.getByRole('region', { name: 'Payments' }))
    expect(payments.getAllByRole('group').map((row) => row.getAttribute('aria-label'))).toEqual([
      'The Sharmas pay the Khans ₹3,000',
      'Sam pays the Khans ₹1,000',
      'You pay the Khans ₹1,000',
    ])
    const sharmas = within(payments.getByRole('group', { name: 'The Sharmas pay the Khans ₹3,000' }))
    expect(sharmas.getByText('Rahul Sharma pays Imran Khan.')).toBeInTheDocument()
    expect(sharmas.getByText('Also settles Priya Sharma, Anu Sharma, Sana Khan.')).toBeInTheDocument()
    // Only your own payment can be paid from here.
    expect(sharmas.queryByRole('button', { name: /^Pay / })).not.toBeInTheDocument()

    const each = within(screen.getByRole('region', { name: 'Each household' }))
    expect(each.getByText('The Sharmas').parentElement).toHaveTextContent('Rahul Sharma, Priya Sharma, Anu Sharma (child)')
    expect(each.getByText('The Sharmas').parentElement).toHaveTextContent('Rahul Sharma pays')
    expect(each.getByText('The Sharmas').closest('li')).toHaveTextContent('Owes ₹3,000')
    expect(each.getByText('The Khans').closest('li')).toHaveTextContent('Gets back ₹5,000')
    expect(each.getByText('Sam').closest('li')).toHaveTextContent('Owes ₹1,000')

    await user.click(sharmas.getByRole('button', { name: 'Mark as paid: The Sharmas pay the Khans ₹3,000' }))
    // One payment between the payers, and the entries inside each family.
    expect(group().settlements).toHaveLength(4)
    expect(group().settlements[0]).toMatchObject({ fromId: rahul, toId: imran, amount: 300_000 })
    for (const id of [rahul, priya, anu, sana]) expect(balances()[id]).toBe(0)
    // The Khans are still owed by Sam and you: that sits with Imran, who is paid for them.
    expect(balances()[imran]).toBe(200_000)
    expect(payments.queryByRole('group', { name: /The Sharmas/ })).not.toBeInTheDocument()
    expect(each.getByText('The Sharmas').closest('li')).toHaveTextContent('Settled')

    const done = within(screen.getByRole('region', { name: 'Household payments recorded here' }))
    expect(done.getByText('The Sharmas paid the Khans ₹3,000')).toBeInTheDocument()
    expect(done.getByText('Today')).toBeInTheDocument()
    expect(done.getByText('Includes 3 entries within the family, so the others in each household show as settled.')).toBeInTheDocument()
  })

  it('Undo takes the household payment and everything it recorded back', async () => {
    setGroupUnits(groupId, households())
    hotel()
    const before = balances()
    const { user } = renderAt(path(), <HouseholdsScreen />)
    await user.click(screen.getByRole('button', { name: 'Mark as paid: The Sharmas pay the Khans ₹3,000' }))
    expect(group().settlements).toHaveLength(4)
    await user.click(screen.getByRole('button', { name: 'Undo: The Sharmas paid the Khans ₹3,000' }))
    expect(group().settlements).toEqual([])
    expect(balances()).toEqual(before)
    expect(getUnitPayments(groupId)).toEqual([])
    expect(screen.getByRole('group', { name: 'The Sharmas pay the Khans ₹3,000' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Household payments recorded here' })).not.toBeInTheDocument()
  })

  it('a payment recorded earlier can be taken back from the list, and put back', async () => {
    setGroupUnits(groupId, households())
    hotel()
    const { user } = renderAt(path(), <HouseholdsScreen />)
    await user.click(screen.getByRole('button', { name: 'Mark as paid: Sam pays the Khans ₹1,000' }))
    expect(group().settlements).toEqual([expect.objectContaining({ fromId: sam, toId: imran, amount: 100_000 }), expect.objectContaining({ fromId: sana, toId: imran, amount: 100_000 })])
    await user.click(screen.getByRole('button', { name: 'Take back: Sam paid the Khans ₹1,000' }))
    expect(group().settlements).toEqual([])
    await user.click(screen.getByRole('button', { name: 'Put back: Taken back: Sam paid the Khans ₹1,000' }))
    expect(group().settlements).toHaveLength(2)
    expect(balances()[sam]).toBe(0)
    expect(getUnitPayments(groupId)).toHaveLength(1)
  })

  it('Pay opens the UPI sheet to the receiving household’s payer, and “I’ve paid” records it', async () => {
    setGroupUnits(groupId, households())
    hotel()
    const { user } = renderAt(path(), <HouseholdsScreen />)
    const mine = within(screen.getByRole('group', { name: 'You pay the Khans ₹1,000' }))
    expect(mine.getByText('You pay Imran Khan.')).toBeInTheDocument()
    await user.click(mine.getByRole('button', { name: 'Pay ₹1,000' }))
    const pay = await screen.findByRole('dialog', { name: /Imran/ })
    await user.click(within(pay).getByRole('button', { name: /I’ve paid/ }))
    await waitFor(() => expect(group().settlements).toContainEqual(expect.objectContaining({ fromId: ME_ID, toId: imran, amount: 100_000, method: 'upi' })))
    expect(balances()[ME_ID]).toBe(0)
    expect(balances()[sana]).toBe(0)
  })

  it('once every household has paid, everyone in the group is at zero and the screen says so', async () => {
    setGroupUnits(groupId, households())
    hotel()
    const { user } = renderAt(path(), <HouseholdsScreen />)
    for (const name of ['The Sharmas pay the Khans ₹3,000', 'Sam pays the Khans ₹1,000', 'You pay the Khans ₹1,000']) {
      await user.click(screen.getByRole('button', { name: `Mark as paid: ${name}` }))
    }
    expect(Object.values(balances()).every((v) => v === 0)).toBe(true)
    expect(screen.getByRole('heading', { name: 'Every household is square' })).toBeInTheDocument()
    expect(screen.getByText('Nobody in Manali owes anything.')).toBeInTheDocument()
  })

  it('with households but no expenses, says there is nothing to settle yet', () => {
    setGroupUnits(groupId, households())
    renderAt(path(), <HouseholdsScreen />)
    expect(screen.getByRole('heading', { name: 'Nothing to settle yet' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Payments' })).not.toBeInTheDocument()
  })

  it('with no households, sells the idea in a sentence and opens the sheet', async () => {
    hotel()
    const { user } = renderAt(path(), <HouseholdsScreen />)
    expect(screen.getByRole('heading', { name: 'Families and couples pay as one' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Payments' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Set up households' }))
    expect(await screen.findByRole('dialog', { name: 'Households' })).toBeInTheDocument()
  })

  it('a household whose payer left the group pays through its first adult', () => {
    setGroupUnits(groupId, households({ households: [{ id: 'h-sharma', name: '', memberIds: [priya, rahul, anu], childIds: [anu], payerId: priya }, households().households[1]!] }))
    // Hotel for everyone but Priya, who then leaves.
    saveExpense(draft({ title: 'Hotel', total: 600_000, payerId: imran, groupId, participants: everyone(ME_ID, rahul, anu, imran, sana, sam) }))
    groupsStore.update((list) => list.map((g) => (g.id === groupId ? { ...g, memberIds: g.memberIds.filter((id) => id !== priya) } : g)))
    renderAt(path(), <HouseholdsScreen />)
    const row = within(screen.getByRole('group', { name: 'The Sharmas pay the Khans ₹2,000' }))
    expect(row.getByText('Rahul Sharma pays Imran Khan.')).toBeInTheDocument()
    expect(row.getByText('Also settles Anu Sharma, Sana Khan.')).toBeInTheDocument()
  })

  it('shows the group-gone page for a group that no longer exists', () => {
    renderAt('/app/groups/nope/households', <HouseholdsScreen />)
    expect(screen.queryByRole('heading', { name: 'Households' })).not.toBeInTheDocument()
  })
})

describe('UnitsSheet', () => {
  const open = async () => {
    const utils = renderAt('/app/groups/x', <UnitsSheet group={group()} open onClose={() => undefined} />)
    const sheet = await screen.findByRole('dialog', { name: 'Households' })
    return { ...utils, sheet }
  }

  it('makes a household by tapping two people, then more people into it', async () => {
    const { user, sheet } = await open()
    const loose = () => within(within(sheet).getByRole('group', { name: 'People not in a household' }))
    expect(within(sheet).getByText('Tap two or more people who pay together, like a couple or a family.')).toBeInTheDocument()
    await user.click(loose().getByRole('button', { name: /Rahul Sharma/ }))
    expect(within(sheet).getByText('Tap one more person to go with Rahul Sharma.')).toBeInTheDocument()
    expect(getGroupUnits(groupId)).toBeNull()
    await user.click(loose().getByRole('button', { name: /Priya Sharma/ }))
    expect(getGroupUnits(groupId)?.households).toEqual([expect.objectContaining({ memberIds: [rahul, priya], childIds: [], payerId: null, name: '' })])
    expect(screen.getByText('Household made: The Sharmas')).toBeInTheDocument()

    // It is named after the people in it until someone names it.
    const card = within(within(sheet).getByRole('region', { name: 'Household: The Sharmas' }))
    expect(card.getByLabelText('Household name')).toHaveAttribute('placeholder', 'The Sharmas')
    const members = within(card.getByRole('group', { name: 'Who’s in it' }))
    expect(members.getByRole('button', { name: /Rahul Sharma/, pressed: true })).toBeInTheDocument()
    await user.click(members.getByRole('button', { name: /Anu Sharma/, pressed: false }))
    expect(getGroupUnits(groupId)?.households[0]?.memberIds).toEqual([rahul, priya, anu])
    expect(screen.getByText('Added Anu Sharma to The Sharmas')).toBeInTheDocument()
  })

  it('marks children, keeps one adult, chooses who pays and how new expenses are shared', async () => {
    setGroupUnits(groupId, households({ households: [{ id: 'h-sharma', name: '', memberIds: [rahul, priya, anu], childIds: [], payerId: null }] }))
    const { user, sheet } = await open()
    const card = within(within(sheet).getByRole('region', { name: 'Household: The Sharmas' }))
    const children = within(card.getByRole('group', { name: 'Children' }))
    await user.click(children.getByRole('button', { name: /Anu Sharma/ }))
    await user.click(children.getByRole('button', { name: /Priya Sharma/ }))
    expect(getGroupUnits(groupId)?.households[0]?.childIds).toEqual([anu, priya])
    // Rahul is the last adult: he can't be marked.
    expect(children.getByRole('button', { name: /Rahul Sharma/ })).toBeDisabled()
    await user.click(children.getByRole('button', { name: /Priya Sharma/ }))
    expect(getGroupUnits(groupId)?.households[0]?.childIds).toEqual([anu])

    const payer = within(card.getByRole('group', { name: 'Who pays for them' }))
    expect(payer.getByRole('button', { name: /Rahul Sharma/, pressed: true })).toBeInTheDocument()
    expect(payer.queryByRole('button', { name: /Anu Sharma/ })).not.toBeInTheDocument()
    await user.click(payer.getByRole('button', { name: /Priya Sharma/ }))
    expect(getGroupUnits(groupId)?.households[0]?.payerId).toBe(priya)
    expect(screen.getByText('Payer for The Sharmas: Priya Sharma')).toBeInTheDocument()

    await user.click(within(sheet).getByRole('radio', { name: 'Per family' }))
    expect(getGroupUnits(groupId)?.basis).toBe('family')
    expect(within(sheet).getByText(/Every household pays one equal part/)).toBeInTheDocument()
    await user.click(within(sheet).getByRole('radio', { name: 'Half' }))
    expect(getGroupUnits(groupId)?.children).toBe('half')
    // You, the Sharmas, Imran, Sana and Sam: five parts.
    expect(within(sheet).getByText('Per family: 5 equal parts. The Sharmas: one part between 3 people. Children count as half.')).toBeInTheDocument()
    const auto = within(sheet).getByRole('switch', { name: 'Start new expenses this way' })
    expect(auto).toHaveAttribute('aria-checked', 'true')
    await user.click(auto)
    expect(getGroupUnits(groupId)?.auto).toBe(false)
  })

  it('Undo puts every change back exactly', async () => {
    const start = households({ basis: 'family', children: 'half' })
    setGroupUnits(groupId, start)
    const { user, sheet } = await open()
    const undo = () => user.click(screen.getByRole('button', { name: /^Undo: / }))

    // Taking one of two out removes the household; Undo brings it back with its settings.
    const khans = within(within(sheet).getByRole('region', { name: 'Household: The Khans' }))
    await user.click(within(khans.getByRole('group', { name: 'Who’s in it' })).getByRole('button', { name: /Sana Khan/ }))
    expect(getGroupUnits(groupId)?.households.map((h) => h.id)).toEqual(['h-sharma'])
    expect(screen.getByText('Household removed: The Khans')).toBeInTheDocument()
    await undo()
    expect(getGroupUnits(groupId)).toEqual(start)

    // Removing the last household clears the settings too; Undo restores them.
    await user.click(within(within(sheet).getByRole('region', { name: 'Household: The Khans' })).getByRole('button', { name: 'Remove this household' }))
    await user.click(within(within(sheet).getByRole('region', { name: 'Household: The Sharmas' })).getByRole('button', { name: 'Remove this household' }))
    expect(getGroupUnits(groupId)).toBeNull()
    await undo()
    expect(getGroupUnits(groupId)).toEqual({ ...start, households: [start.households[0]!] })

    await user.click(within(sheet).getByRole('radio', { name: 'Free' }))
    expect(getGroupUnits(groupId)?.children).toBe('free')
    await undo()
    expect(getGroupUnits(groupId)?.children).toBe('half')
  })

  it('a typed name is saved on blur, and never lost when the sheet closes', async () => {
    setGroupUnits(groupId, households())
    const onClose = vi.fn()
    const { user } = renderAt('/app/groups/x', <UnitsSheet group={group()} open onClose={onClose} />)
    const sheet = await screen.findByRole('dialog', { name: 'Households' })
    const sharmas = within(within(sheet).getByRole('region', { name: 'Household: The Sharmas' })).getByLabelText('Household name')
    await user.type(sharmas, 'Sharma parivaar')
    await user.tab()
    expect(getGroupUnits(groupId)?.households[0]?.name).toBe('Sharma parivaar')
    expect(screen.getByText('Renamed to Sharma parivaar')).toBeInTheDocument()

    // Typed, then straight to Done: still saved.
    const khans = within(within(sheet).getByRole('region', { name: 'Household: The Khans' })).getByLabelText('Household name')
    await user.type(khans, 'Khan sahab')
    await user.click(within(sheet).getByRole('button', { name: 'Done' }))
    expect(getGroupUnits(groupId)?.households[1]?.name).toBe('Khan sahab')
    expect(onClose).toHaveBeenCalled()
  })

  it('links to the households page, and shows nothing for a group of one', async () => {
    setGroupUnits(groupId, households())
    const { user, sheet, unmount } = await open()
    await user.click(within(sheet).getByRole('button', { name: 'See what each household owes' }))
    expect(currentUrl()).toBe(path())
    unmount()

    const solo = createGroup({ name: 'Just me', emoji: '🙂', kind: 'other', currency: 'INR', memberIds: [ME_ID] })
    const { container } = renderAt('/app/groups/x', <UnitsSheet group={solo} open onClose={() => undefined} />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('dialog', { name: 'Households' })).not.toBeInTheDocument()
  })
})

describe('UnitsCard', () => {
  it('shows the households and the next payment, and opens the page', async () => {
    setGroupUnits(groupId, households())
    hotel()
    const { user } = renderAt('/app/groups/x', <UnitsCard group={group()} />)
    const card = screen.getByRole('button', { name: /Open households/ })
    expect(card).toHaveTextContent('The Sharmas (3) · The Khans (2)')
    expect(card).toHaveTextContent('The Sharmas pay the Khans ₹3,000, and 2 more payments')
    await user.click(card)
    expect(currentUrl()).toBe(path())
  })

  it('says when every household is square', () => {
    setGroupUnits(groupId, households())
    renderAt('/app/groups/x', <UnitsCard group={group()} />)
    expect(screen.getByRole('button', { name: /Open households/ })).toHaveTextContent('Every household is square')
  })

  it('shows nothing when the group has no households', () => {
    hotel()
    const { container } = renderAt('/app/groups/x', <UnitsCard group={group()} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('unitsToday', () => {
  it('never has anything due', () => {
    setGroupUnits(groupId, households())
    hotel()
    expect(unitsToday(new Date(2026, 10, 15, 12))).toEqual([])
  })
})
