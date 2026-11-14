import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, groupsStore, recordSettlement, saveExpense, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID, type Group } from '../../domain/types'
import { renderAt, resetProScreens } from '../pro/testing'
import { KittyCard } from './KittyCard'
import { KittySheet } from './KittySheet'
import { kittyConfigFor, setKitty } from './store'

vi.setConfig({ testTimeout: 30_000 })

let riya: string
let sam: string
let groupId: string

const group = (): Group => groupsStore.get().find((g) => g.id === groupId)!

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 14, 12))
  resetProScreens()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya', upiId: 'riya@okaxis' }).id
  sam = addFriend({ name: 'Sam' }).id
  groupId = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya, sam] }).id
})

afterEach(() => {
  vi.useRealTimers()
})

describe('KittySheet', () => {
  it('starts a kitty with whoever has paid most holding it, ₹2,000 each by default', async () => {
    saveExpense(draft({ title: 'Cab', total: 90_000, date: '2026-11-13', payerId: riya, groupId, participants: everyone(ME_ID, riya, sam) }))
    const { user } = renderAt('/app/groups/x', <KittySheet group={group()} open onClose={() => undefined} />)
    const sheet = await screen.findByRole('dialog', { name: 'Trip kitty' })
    expect(within(sheet).getByRole('button', { name: /Riya/, pressed: true })).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: '₹5,000' }))
    await user.click(within(sheet).getByRole('button', { name: 'Start the kitty: ₹5,000 each' }))
    expect(kittyConfigFor(groupId)).toEqual({ holderId: riya, perHead: 500_000, startedOn: '2026-11-14' })
    expect(screen.getByText('Kitty started with Riya')).toBeInTheDocument()
  })

  it('defaults to you holding it when nobody has paid yet, and refuses an empty amount', async () => {
    const { user } = renderAt('/app/groups/x', <KittySheet group={group()} open onClose={() => undefined} />)
    const sheet = await screen.findByRole('dialog', { name: 'Trip kitty' })
    expect(within(sheet).getByRole('button', { name: /You/, pressed: true })).toBeInTheDocument()
    const field = within(sheet).getByLabelText('Amount each')
    await user.clear(field)
    expect(within(sheet).getByRole('button', { name: 'Enter how much each person puts in' })).toBeDisabled()
  })

  it('as the holder: shows who has put in, and Got it records their payment with Undo', async () => {
    setKitty(groupId, { holderId: ME_ID, perHead: 200_000, startedOn: '2026-11-14' })
    recordSettlement(groupId, { fromId: riya, toId: ME_ID, amount: 200_000, date: '2026-11-14', method: 'upi' })
    const { user } = renderAt('/app/groups/x', <KittySheet group={group()} open onClose={() => undefined} />)
    const sheet = await screen.findByRole('dialog', { name: 'Trip kitty' })
    const people = within(sheet).getByRole('list', { name: 'Who has put in' })
    expect(people).toHaveTextContent('Holds the kitty')
    expect(people).toHaveTextContent('Put in ₹2,000')
    expect(people).toHaveTextContent('Still to put in ₹2,000')
    expect(people).not.toHaveTextContent('of theirs left')
    // Riya's ₹2,000 is all that's been put in, and nothing is spent yet.
    expect(within(sheet).getByLabelText('The kitty so far').textContent).toBe('Put in₹2,000Spent₹0Left₹2,000Lasts tillNo spending yet')

    await user.click(within(sheet).getByRole('button', { name: 'Sam gave you ₹2,000' }))
    expect(group().settlements).toHaveLength(2)
    expect(group().settlements[1]).toMatchObject({ fromId: sam, toId: ME_ID, amount: 200_000, method: 'upi' })
    expect(within(sheet).queryByRole('button', { name: 'Sam gave you ₹2,000' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(group().settlements).toHaveLength(1)
  })

  it('as a member: Pay opens the UPI sheet to the holder, and “I’ve paid” records it', async () => {
    setKitty(groupId, { holderId: riya, perHead: 200_000, startedOn: '2026-11-14' })
    const { user } = renderAt('/app/groups/x', <KittySheet group={group()} open onClose={() => undefined} />)
    const sheet = await screen.findByRole('dialog', { name: 'Trip kitty' })
    expect(within(sheet).queryByRole('button', { name: /gave you/ })).not.toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Pay ₹2,000 to Riya' }))
    const pay = await screen.findByRole('dialog', { name: /Riya/ })
    await user.click(within(pay).getByRole('button', { name: /I’ve paid/ }))
    await waitFor(() => expect(group().settlements).toEqual([expect.objectContaining({ fromId: ME_ID, toId: riya, amount: 200_000, method: 'upi' })]))
  })

  it('Ask everyone shares one message with the holder’s UPI ID and who is still to put in', async () => {
    setKitty(groupId, { holderId: riya, perHead: 200_000, startedOn: '2026-11-14' })
    const { user } = renderAt('/app/groups/x', <KittySheet group={group()} open onClose={() => undefined} />)
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const sheet = await screen.findByRole('dialog', { name: 'Trip kitty' })
    await user.click(within(sheet).getByRole('button', { name: 'Ask everyone' }))
    await waitFor(() => expect(writeText).toHaveBeenCalled())
    const text = writeText.mock.calls[0]![0] as string
    expect(text).toContain('Trip kitty for Goa: ₹2,000 each, to Riya.')
    expect(text).toContain('UPI ID: riya@okaxis')
    expect(text).toContain('Still to put in: You (₹2,000), Sam (₹2,000)')
  })

  it('suggests a top-up when it is about to run out, and End clears only the setting', async () => {
    setKitty(groupId, { holderId: ME_ID, perHead: 100_000, startedOn: '2026-11-14' })
    recordSettlement(groupId, { fromId: riya, toId: ME_ID, amount: 100_000, date: '2026-11-14', method: 'upi' })
    recordSettlement(groupId, { fromId: sam, toId: ME_ID, amount: 100_000, date: '2026-11-14', method: 'upi' })
    saveExpense(draft({ title: 'Boat', total: 270_000, date: '2026-11-14', payerId: ME_ID, groupId, participants: everyone(ME_ID, riya, sam) }))
    const { user } = renderAt('/app/groups/x', <KittySheet group={group()} open onClose={() => undefined} />)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true })
    const sheet = await screen.findByRole('dialog', { name: 'Trip kitty' })
    // Others' share ₹1,800 today; ₹200 left; two days need ₹3,600 − ₹200 = ₹3,400 → ₹1,700 each.
    await user.click(within(sheet).getByRole('button', { name: 'Ask ₹1,700 more each' }))
    expect(kittyConfigFor(groupId)?.perHead).toBe(270_000)
    await user.click(within(sheet).getByRole('button', { name: 'End the kitty' }))
    expect(kittyConfigFor(groupId)).toBeNull()
    expect(group().settlements).toHaveLength(2)
  })

  it('started on a trip with old bills and debts: zeros, nobody short, nothing “of theirs left”', async () => {
    saveExpense(draft({ title: 'Hotel', total: 600_000, date: '2026-11-10', payerId: ME_ID, groupId, participants: everyone(ME_ID, riya, sam) }))
    saveExpense(draft({ title: 'Cab', total: 69_000, date: '2026-11-11', payerId: riya, groupId, participants: everyone(ME_ID, riya, sam) }))
    recordSettlement(groupId, { fromId: sam, toId: ME_ID, amount: 50_000, date: '2026-11-12', method: 'upi' })
    setKitty(groupId, { holderId: ME_ID, perHead: 200_000, startedOn: '2026-11-14' })
    renderAt('/app/groups/x', <KittySheet group={group()} open onClose={() => undefined} />)
    const sheet = await screen.findByRole('dialog', { name: 'Trip kitty' })
    expect(within(sheet).getByLabelText('The kitty so far').textContent).toBe('Put in₹0Spent₹0Left₹0Lasts tillNo spending yet')
    const people = within(sheet).getByRole('list', { name: 'Who has put in' })
    expect(people).not.toHaveTextContent('Short')
    expect(people).not.toHaveTextContent('left')
    expect(within(people).getAllByText('Still to put in ₹2,000')).toHaveLength(2)
  })

  it('is nothing for a group of one', () => {
    const solo = createGroup({ name: 'Me', emoji: '🙂', kind: 'other', currency: 'INR', memberIds: [ME_ID] })
    const { container } = renderAt('/app/groups/x', <KittySheet group={solo} open onClose={() => undefined} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('KittyCard', () => {
  it('is nothing when the group has no kitty', () => {
    const { container } = renderAt('/app/groups/x', <KittyCard group={group()} onOpen={() => undefined} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('while collecting, says how many have put in', () => {
    setKitty(groupId, { holderId: riya, perHead: 200_000, startedOn: '2026-11-14' })
    renderAt('/app/groups/x', <KittyCard group={group()} onOpen={() => undefined} />)
    expect(screen.getByRole('button', { name: /Kitty with Riya: 0 of 2 have put in ₹2,000/ })).toBeInTheDocument()
  })

  it('shows what is left and how long it lasts, warning when nearly out, and opens the kitty', async () => {
    setKitty(groupId, { holderId: riya, perHead: 200_000, startedOn: '2026-11-12' })
    recordSettlement(groupId, { fromId: ME_ID, toId: riya, amount: 200_000, date: '2026-11-12', method: 'upi' })
    recordSettlement(groupId, { fromId: sam, toId: riya, amount: 200_000, date: '2026-11-12', method: 'upi' })
    // ₹900 over 3 days for three: others' share ₹600 → ₹200 a day; ₹3,400 left → 17 days.
    saveExpense(draft({ title: 'Dinner', total: 90_000, date: '2026-11-13', payerId: riya, groupId, participants: everyone(ME_ID, riya, sam) }))
    const onOpen = vi.fn()
    const { user } = renderAt('/app/groups/x', <KittyCard group={group()} onOpen={onOpen} />)
    const card = screen.getByRole('button', { name: /Kitty with Riya/ })
    expect(card).toHaveTextContent(/₹3,400 left of ₹4,000 · lasts till (1 Dec|Dec 1)/)
    expect(card).not.toHaveAttribute('data-low')
    await user.click(card)
    expect(onOpen).toHaveBeenCalled()
  })

  it('warns when it has run out', () => {
    setKitty(groupId, { holderId: riya, perHead: 100_000, startedOn: '2026-11-14' })
    recordSettlement(groupId, { fromId: sam, toId: riya, amount: 50_000, date: '2026-11-14', method: 'upi' })
    saveExpense(draft({ title: 'Boat', total: 300_000, date: '2026-11-14', payerId: riya, groupId, participants: everyone(ME_ID, riya, sam) }))
    renderAt('/app/groups/x', <KittyCard group={group()} onOpen={() => undefined} />)
    const card = screen.getByRole('button', { name: /Kitty with Riya/ })
    expect(card).toHaveTextContent('₹0 left of ₹500 · run out')
    expect(card).toHaveAttribute('data-low')
  })
})
