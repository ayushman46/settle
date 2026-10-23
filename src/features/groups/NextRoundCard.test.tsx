import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, groupsStore, peekSplitPrefill, recordSettlement, saveExpense, setGroupArchived, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID, type Group } from '../../domain/types'
import { currentUrl, renderApp, resetScreens } from './testKit'
import { forgetTimelineLimits } from './timelineMemory'

// The card and sheet are behind the feature flag: these tests look at them switched on.
vi.mock('./rotation.enabled', () => ({ ROTATION_ENABLED: true }))

vi.setConfig({ testTimeout: 20_000 })

let riya: string
let sam: string
let kabir: string
let gang: Group

beforeEach(() => {
  resetScreens()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 22, 12))
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
  kabir = addFriend({ name: 'Kabir' }).id
  gang = createGroup({ name: 'Friday gang', emoji: '🍕', kind: 'other', currency: 'INR', memberIds: [ME_ID, riya, sam, kabir] })
})

afterEach(() => {
  vi.useRealTimers()
  resetScreens()
  forgetTimelineLimits()
})

const path = () => `/app/groups/${gang.id}`
const group = () => groupsStore.get().find((g) => g.id === gang.id) as Group

/** Spec 04 example A: me +₹1,200, Riya +₹300, Sam −₹1,200, Kabir −₹300, after three ₹2,400 dinners. */
function seedExampleA(): void {
  const all = everyone(ME_ID, riya, sam, kabir)
  saveExpense(draft({ title: 'Dinner', total: 240000, groupId: gang.id, date: '2026-10-02', participants: all }))
  saveExpense(draft({ title: 'Dinner', total: 240000, groupId: gang.id, date: '2026-10-09', payerId: riya, participants: all }))
  saveExpense(
    draft({
      title: 'Dinner',
      total: 240000,
      groupId: gang.id,
      date: '2026-10-16',
      payerId: kabir,
      mode: 'exact',
      participants: [
        { friendId: riya, input: 90000 },
        { friendId: kabir, input: 150000 },
      ],
    }),
  )
}

const card = () => screen.getByRole('region', { name: "Next round's on Sam" })

describe('NextRoundCard on a group', () => {
  it('says who should pay next, and exactly when they are square', () => {
    seedExampleA()
    renderApp(path())
    const section = card()
    expect(within(section).getByText("Sam's ₹1,200 behind. If Sam pays the next ₹1,600 for all 4 of you, Sam's square.")).toBeInTheDocument()
    expect(within(section).getByText('A usual round here is ₹2,400 — that settles ₹300 of the ₹1,500 the group is out.')).toBeInTheDocument()
    // It sits between where I stand and the tabs.
    const tabs = screen.getByRole('radiogroup', { name: 'Show' })
    expect(section.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('logs the next round: Sam pays, the whole group, with the banner', async () => {
    seedExampleA()
    const { user } = renderApp(path())
    await user.click(within(card()).getByRole('button', { name: 'Log the next round' }))
    expect(currentUrl()).toBe(`/app/split/new?from=rotation&group=${encodeURIComponent(gang.id)}`)
    expect(peekSplitPrefill()).toEqual({
      groupId: gang.id,
      payerId: sam,
      mode: 'equal',
      currency: 'INR',
      participants: everyone(ME_ID, riya, sam, kabir),
      source: 'manual',
      banner: { icon: 'rotate', title: "Sam's round", body: 'Up to ₹1,600 squares Sam up. More than that and Sam is ahead.' },
    })
  })

  it('is hidden when everyone is square, when archived, or with one member', () => {
    const { unmount } = renderApp(path())
    expect(screen.queryByRole('button', { name: 'Log the next round' })).not.toBeInTheDocument()
    unmount()

    seedExampleA()
    recordSettlement(gang.id, { fromId: sam, toId: ME_ID, amount: 120000, date: '2026-10-20', method: 'upi' })
    recordSettlement(gang.id, { fromId: kabir, toId: riya, amount: 30000, date: '2026-10-20', method: 'cash' })
    const again = renderApp(path())
    expect(screen.queryByRole('button', { name: 'Log the next round' })).not.toBeInTheDocument()
    again.unmount()

    saveExpense(draft({ title: 'Snacks', total: 40000, groupId: gang.id, participants: everyone(ME_ID, riya, sam, kabir) }))
    setGroupArchived(gang.id, true)
    const archived = renderApp(path())
    expect(screen.queryByRole('button', { name: 'Log the next round' })).not.toBeInTheDocument()
    archived.unmount()

    const solo = createGroup({ name: 'Solo', emoji: '👤', kind: 'other', currency: 'INR', memberIds: [ME_ID] })
    saveExpense(draft({ title: 'Cab', total: 30000, groupId: solo.id, participants: everyone(riya) }))
    renderApp(`/app/groups/${solo.id}`)
    expect(screen.queryByRole('button', { name: 'Log the next round' })).not.toBeInTheDocument()
  })
})

describe('RotationSheet', () => {
  it('plans two rounds, then Riya pays Kabir ₹900', async () => {
    seedExampleA()
    const { user } = renderApp(path())
    await user.click(within(card()).getByRole('button', { name: 'See the rotation' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pay it forward' })
    expect(within(sheet).getByText('Take turns paying for everyone instead of paying each other back. Each round is split equally between all 4 of you.')).toBeInTheDocument()
    expect(within(sheet).getByLabelText('Each round, about')).toHaveValue('2,400')
    const rounds = within(sheet).getByRole('list', { name: 'Rounds' })
    expect(within(rounds).getAllByRole('listitem').map((li) => li.getAttribute('aria-label'))).toEqual([
      'Round 1, Sam pays, group out ₹1,500 to ₹1,200, settles ₹300',
      'Round 2, Kabir pays, group out ₹1,200 to ₹900, settles ₹300',
    ])
    expect(within(sheet).getByText('Then settle the last ₹900:')).toBeInTheDocument()
    expect(within(sheet).getByRole('group', { name: /Riya pays Kabir/ })).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Log round 1 with Sam paying' })).toBeInTheDocument()
  })

  it('saves the round size on leaving the field, and Reset goes back to automatic', async () => {
    seedExampleA()
    const { user } = renderApp(path())
    await user.click(within(card()).getByRole('button', { name: 'See the rotation' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pay it forward' })
    const field = within(sheet).getByLabelText('Each round, about')
    await user.clear(field)
    await user.type(field, '1600')
    expect(within(sheet).getAllByRole('listitem')[0]).toHaveAttribute('aria-label', 'Round 1, Sam pays, group out ₹1,500 to ₹800, settles ₹700')
    expect(group().roundSize).toBeNull()
    await user.tab()
    expect(group().roundSize).toBe(160000)
    await user.click(within(sheet).getByRole('button', { name: 'Reset to the usual round' }))
    expect(group().roundSize).toBeNull()
    expect(field).toHaveValue('2,400')
  })

  it('says when a round is too big, and asks for an amount when there is none', async () => {
    seedExampleA()
    const { user } = renderApp(path())
    await user.click(within(card()).getByRole('button', { name: 'See the rotation' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pay it forward' })
    const field = within(sheet).getByLabelText('Each round, about')
    await user.clear(field)
    expect(within(sheet).getByText('Enter an amount')).toBeInTheDocument()
    await user.type(field, '10000')
    expect(within(sheet).getByText("A ₹10,000 round is bigger than anyone's behind")).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Settle up' }))
    expect(currentUrl()).toBe(`/app/groups/${gang.id}/settle`)
  })
})
