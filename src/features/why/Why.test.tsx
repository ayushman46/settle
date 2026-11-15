import { render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, groupsStore, saveExpense, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID, type Group } from '../../domain/types'
import { t } from '../../i18n'
import { renderApp, resetScreens } from '../groups/testKit'
import { DirectSwitch } from './DirectSwitch'
import { settlePlan } from './engine'
import { isDirectMode, setDirectMode } from './store'
import { whyToday } from './today'
import { WhyLine } from './WhyLine'

const OCT_22 = new Date(2026, 9, 22, 12)
let riya: string
let sam: string
let goa: Group

// Whole journeys through the real Settle up screen: give them room on a busy machine.
vi.setConfig({ testTimeout: 30_000 })

beforeEach(() => {
  resetScreens()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(OCT_22)
  updateProfile({ name: 'Ayush', currency: 'INR', upiId: 'ayush@okaxis' })
  riya = addFriend({ name: 'Riya', upiId: 'riya@okaxis' }).id
  sam = addFriend({ name: 'Sam' }).id
  goa = createGroup({ name: 'Goa', emoji: '🏖️', kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya, sam] })
})

afterEach(() => {
  vi.useRealTimers()
  resetScreens()
})

const path = () => `/app/groups/${goa.id}/settle`
const settlements = () => groupsStore.get().find((g) => g.id === goa.id)?.settlements ?? []
/** `payer` paid ₹`rupees` for something that was all `forId`'s. */
const owes = (forId: string, payer: string, rupees: number, title: string) =>
  saveExpense(draft({ title, total: rupees * 100, groupId: goa.id, payerId: payer, participants: everyone(forId) }))
/** I owe Riya ₹500 and Riya owes Sam ₹500: the fewest payments is me paying Sam. */
function chain() {
  owes(ME_ID, riya, 500, 'Dinner')
  owes(riya, sam, 500, 'Scooter')
}
const toggle = () => screen.getByRole('switch', { name: 'Pay only people I actually owe' })

describe('Why? under a Settle up payment', () => {
  it('explains a payment to someone I never owed, with the real chain', async () => {
    chain()
    const { user } = renderApp(path())
    expect(screen.getByRole('group', { name: 'You pay Sam ₹500' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Why you pay Sam ₹500' }))
    const sheet = await screen.findByRole('dialog', { name: 'Why you pay Sam ₹500' })
    expect(within(sheet).getByText('Goa')).toBeInTheDocument()
    expect(within(sheet).getByRole('heading', { name: 'Why you owe' })).toBeInTheDocument()
    expect(within(sheet).getByText('In this group you’ve had ₹500 of things and haven’t paid any of the bills, so you’re ₹500 short.')).toBeInTheDocument()
    expect(within(sheet).getByRole('heading', { name: 'Why Sam is owed' })).toBeInTheDocument()
    expect(within(sheet).getByText('In this group Sam has paid ₹500 of bills, all for other people, so Sam is owed ₹500.')).toBeInTheDocument()
    expect(within(sheet).getByRole('heading', { name: 'Why it goes to Sam' })).toBeInTheDocument()
    expect(within(sheet).getByText('You owe Riya ₹500. Riya owes Sam ₹500. So ₹500 goes straight from you to Sam, skipping Riya: two payments become one.')).toBeInTheDocument()
    expect(within(sheet).getByText('Settled this way, the group needs 1 payment instead of 2.')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('has a Why? for every line, with each side’s own numbers', async () => {
    // Riya paid ₹1,200 for her and me; I paid ₹600 for Sam and me; Riya paid ₹300 that was Sam’s.
    saveExpense(draft({ title: 'Villa', total: 120000, groupId: goa.id, payerId: riya, participants: everyone(ME_ID, riya) }))
    saveExpense(draft({ title: 'Boat', total: 60000, groupId: goa.id, participants: everyone(ME_ID, sam) }))
    owes(sam, riya, 300, 'Chai')
    const { user } = renderApp(path())
    // Me: had 600 + 300 = ₹900, paid ₹600: ₹300 short. Sam: had 300 + 300: ₹600 short. Riya: paid ₹1,500, had ₹600: owed ₹900.
    expect(screen.getAllByRole('button', { name: /^Why / })).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Why Sam pays Riya ₹600' }))
    const sheet = await screen.findByRole('dialog', { name: 'Why Sam pays Riya ₹600' })
    expect(within(sheet).getByText('In this group Sam has had ₹600 of things and hasn’t paid any of the bills, so Sam is ₹600 short.')).toBeInTheDocument()
    expect(within(sheet).getByText('In this group Riya has paid ₹1,500 of bills and had ₹600 of things, so Riya is owed ₹900.')).toBeInTheDocument()
    expect(within(sheet).getByText('₹600 of that comes from Sam.')).toBeInTheDocument()
    // Sam owes Riya ₹300 directly, and owes me ₹300 while I owe Riya ₹600.
    expect(within(sheet).getByText('Between just the two of them, Sam owes Riya ₹300.')).toBeInTheDocument()
    expect(within(sheet).getByText('Sam owes you ₹300. You owe Riya ₹600. So ₹300 goes straight from Sam to Riya, skipping you.')).toBeInTheDocument()
  })

  it('shows nothing when nobody owes anything', () => {
    renderApp(path())
    expect(screen.getByRole('heading', { name: 'Nothing to settle yet' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Why/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('on its own, is nothing for a line that is not in the list', () => {
    const plan = settlePlan(goa, [], () => '')
    const { container } = render(<WhyLine plan={plan} transfer={{ fromId: ME_ID, toId: sam, amount: 50000 }} mode="simple" currency="INR" />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('Pay only people I actually owe', () => {
  it('lists what each two people owe, says how many payments that is, and remembers it', async () => {
    chain()
    const { user, unmount } = renderApp(path())
    expect(screen.getByText('1 payment squares everyone up — the fewest possible.')).toBeInTheDocument()
    expect(toggle()).toHaveAttribute('aria-checked', 'false')
    expect(toggle()).toHaveAccessibleDescription('Turn on so nobody pays someone they don’t directly owe: 2 payments instead of 1.')

    await user.click(toggle())
    expect(isDirectMode(goa.id)).toBe(true)
    expect(toggle()).toHaveAttribute('aria-checked', 'true')
    expect(toggle()).toHaveAccessibleDescription('Each payment goes to someone the payer directly owes: 2 payments instead of 1. Nobody ends up paying more or getting less overall.')
    expect(screen.getByText('2 payments square everyone up, each to someone directly owed.')).toBeInTheDocument()
    const pay = screen.getByRole('region', { name: 'You pay' })
    expect(within(pay).getByRole('group', { name: 'You pay Riya ₹500, to riya@okaxis' })).toBeInTheDocument()
    expect(within(pay).getByRole('button', { name: 'Pay Riya ₹500 via UPI' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Between others' })).getByRole('group', { name: 'Riya pays Sam ₹500' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'You pay Sam ₹500' })).not.toBeInTheDocument()

    // Its own Why: only what is between the two of us, with the bill named.
    await user.click(screen.getByRole('button', { name: 'Why you pay Riya ₹500' }))
    const sheet = await screen.findByRole('dialog', { name: 'Why you pay Riya ₹500' })
    expect(within(sheet).getByRole('heading', { name: 'Between the two of you' })).toBeInTheDocument()
    expect(within(sheet).getByText('Riya paid ₹500 for things you had.')).toBeInTheDocument()
    expect(within(sheet).getByText('So you owe Riya ₹500.')).toBeInTheDocument()
    expect(within(sheet).getByRole('heading', { name: 'Where the ₹500 comes from' })).toBeInTheDocument()
    expect(within(sheet).getByText('Dinner')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Close' }))
    unmount()

    // Still on when the screen is opened again; off brings the fewest payments back.
    const again = renderApp(path())
    expect(toggle()).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('group', { name: 'You pay Riya ₹500, to riya@okaxis' })).toBeInTheDocument()
    await again.user.click(toggle())
    expect(isDirectMode(goa.id)).toBe(false)
    expect(screen.getByRole('group', { name: 'You pay Sam ₹500' })).toBeInTheDocument()
    expect(screen.getByText('1 payment squares everyone up — the fewest possible.')).toBeInTheDocument()
  })

  it('records a payment the same way, and the rest stays', async () => {
    chain()
    setDirectMode(goa.id, true)
    const { user } = renderApp(path())
    await user.click(screen.getByRole('button', { name: 'Record ₹500 from you to Riya' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Record a payment' })).getByRole('button', { name: 'Record ₹500' }))
    expect(settlements()).toEqual([expect.objectContaining({ fromId: ME_ID, toId: riya, amount: 50000 })])
    const burst = await screen.findByRole('dialog', { name: 'Payment recorded' })
    expect(within(burst).getByText('You paid Riya · UPI')).toBeInTheDocument()
    await user.click(burst)
    await waitFor(() => expect(screen.queryByRole('region', { name: 'You pay' })).not.toBeInTheDocument())
    expect(screen.getByRole('group', { name: 'Riya pays Sam ₹500' })).toBeInTheDocument()
    // One payment left, and it is the same one either way now.
    expect(toggle()).toHaveAccessibleDescription('Each payment goes to someone the payer directly owes. Right now that’s the same payments either way.')
  })

  it('the last payment squares the group in this list too', async () => {
    owes(ME_ID, riya, 300, 'Chai')
    setDirectMode(goa.id, true)
    const { user } = renderApp(path())
    await user.click(screen.getByRole('button', { name: 'Record ₹300 from you to Riya' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Record a payment' })).getByRole('button', { name: 'Record ₹300' }))
    await user.click(await screen.findByRole('dialog', { name: 'All settled up!' }))
    expect(await screen.findByRole('heading', { name: 'Everyone’s square' })).toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('a payment that skipped someone leaves nothing behind once the group is square', async () => {
    chain()
    const { user } = renderApp(path())
    await user.click(screen.getByRole('button', { name: 'Record ₹500 from you to Sam' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Record a payment' })).getByRole('button', { name: 'Record ₹500' }))
    await user.click(await screen.findByRole('dialog', { name: 'All settled up!' }))
    expect(await screen.findByRole('heading', { name: 'Everyone’s square' })).toBeInTheDocument()
    setDirectMode(goa.id, true)
    expect(await screen.findByRole('heading', { name: 'Everyone’s square' })).toBeInTheDocument()
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
  })

  it('is not offered when both ways are the same payments', () => {
    // Riya paid ₹1,200 for her and me, and ₹600 for her and Sam: everyone already pays who they owe.
    saveExpense(draft({ title: 'Villa', total: 120000, groupId: goa.id, payerId: riya, participants: everyone(ME_ID, riya) }))
    saveExpense(draft({ title: 'Boat', total: 60000, groupId: goa.id, payerId: riya, participants: everyone(riya, sam) }))
    renderApp(path())
    expect(screen.getByRole('group', { name: 'You pay Riya ₹600, to riya@okaxis' })).toBeInTheDocument()
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Why / })).toHaveLength(2)
  })

  it('on its own, is nothing for a group with nothing owed', () => {
    const { container } = render(<DirectSwitch groupId={goa.id} plan={settlePlan(goa, [], () => '')} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('what the feature gives the rest of the app', () => {
  it('has its Tools hub copy, and never has anything due today', () => {
    expect(t('why.tool.title')).toBe('Why this payment?')
    expect(t('why.tool.body').length).toBeLessThan(90)
    expect(whyToday(OCT_22)).toEqual([])
  })
})
