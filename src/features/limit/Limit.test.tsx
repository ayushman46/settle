import { act, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as z from 'zod/mini'
import { addFriend, saveExpense, setPaidBack, updateProfile } from '../../data'
import { draft } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { LimitBadge } from './LimitBadge'
import { LimitNote } from './LimitNote'
import { LimitEveryoneRow, LimitRow } from './LimitRow'
import { LimitScreen } from './LimitScreen'
import { limitSchema, limitStore, MAX_LIMITS, setEveryoneLimit, setFriendLimit } from './store'
import { limitToday } from './index'

vi.setConfig({ testTimeout: 30_000 })

let riya: string
let sam: string
let dinner: string

beforeEach(() => {
  resetProScreens()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya Sharma' }).id
  sam = addFriend({ name: 'Sam' }).id
  // Riya owes ₹5,000.
  dinner = saveExpense(draft({ title: 'Hotel', total: 1_000_000, with: [riya] })).id
})

const chip = (name: string | RegExp) => screen.getByRole('radio', { name })

describe('limitStore', () => {
  it('keeps a limit per friend and one for everyone; undo puts a friend’s setting back exactly', () => {
    expect(limitStore.get()).toEqual({ everyone: null, byFriend: {} })
    setFriendLimit(riya, 500_000)
    const undo = setFriendLimit(riya, 200_000)
    setFriendLimit(sam, 100_000)
    expect(limitStore.get().byFriend).toEqual({ [riya]: 200_000, [sam]: 100_000 })
    undo()
    // Riya is back to ₹5,000; Sam, set after, is untouched.
    expect(limitStore.get().byFriend).toEqual({ [riya]: 500_000, [sam]: 100_000 })
    const undoFirst = setFriendLimit('asha', 100)
    undoFirst()
    expect(Object.hasOwn(limitStore.get().byFriend, 'asha')).toBe(false)
  })

  it('"none" is kept as an exemption only while there is a limit for everyone', () => {
    setFriendLimit(riya, 500_000)
    setFriendLimit(riya, 'none')
    expect(limitStore.get().byFriend).toEqual({})
    setEveryoneLimit(200_000)
    const undo = setFriendLimit(riya, 'none')
    expect(limitStore.get()).toEqual({ everyone: 200_000, byFriend: { [riya]: 0 } })
    undo()
    expect(limitStore.get()).toEqual({ everyone: 200_000, byFriend: {} })
    setFriendLimit(riya, 300_000)
    setFriendLimit(riya, null)
    expect(limitStore.get().byFriend).toEqual({})
  })

  it('taking away the limit for everyone drops the exemptions, and undo brings both back', () => {
    setEveryoneLimit(200_000)
    setFriendLimit(riya, 'none')
    setFriendLimit(sam, 900_000)
    const undo = setEveryoneLimit(null)
    expect(limitStore.get()).toEqual({ everyone: null, byFriend: { [sam]: 900_000 } })
    undo()
    expect(limitStore.get()).toEqual({ everyone: 200_000, byFriend: { [sam]: 900_000, [riya]: 0 } })
  })

  it('ignores yourself, an empty id, and amounts that aren’t whole paise above zero', () => {
    setFriendLimit(ME_ID, 500_000)
    setFriendLimit('', 500_000)
    setFriendLimit(riya, 0)
    setFriendLimit(riya, -100)
    setFriendLimit(riya, 10.5)
    setEveryoneLimit(0)
    setEveryoneLimit(Number.NaN)
    expect(limitStore.get()).toEqual({ everyone: null, byFriend: {} })
  })

  it('setting the same thing again changes nothing (and its undo does nothing)', () => {
    setFriendLimit(riya, 500_000)
    const before = limitStore.get()
    const undo = setFriendLimit(riya, 500_000)
    expect(limitStore.get()).toBe(before)
    undo()
    expect(limitStore.get()).toBe(before)
    setEveryoneLimit(null)
    expect(limitStore.get()).toBe(before)
  })

  it('never grows without end: the newest settings are kept', () => {
    for (let i = 0; i < MAX_LIMITS + 20; i++) setFriendLimit(`f${i}`, 100 + i)
    const kept = Object.keys(limitStore.get().byFriend)
    expect(kept).toHaveLength(MAX_LIMITS)
    expect(kept).toContain(`f${MAX_LIMITS + 19}`)
    expect(kept).not.toContain('f0')
  })

  it('reads junk without losing what is good', () => {
    const read = z.parse(limitSchema, { everyone: 'lots', byFriend: { a: 500_000, b: -1, c: 'x', d: 0, e: 10.5, me: 100, '': 5 }, extra: 1 })
    expect(read).toEqual({ everyone: null, byFriend: { a: 500_000, d: 0 } })
    expect(z.parse(limitSchema, { everyone: 200_000, byFriend: 'nope' })).toEqual({ everyone: 200_000, byFriend: {} })
    expect(z.parse(limitSchema, {})).toEqual({ everyone: null, byFriend: {} })
  })

  it('has nothing for Today', () => {
    expect(limitToday(new Date(2026, 10, 15))).toEqual([])
  })
})

describe('LimitRow', () => {
  it('one tap sets the limit, says where they stand, and Undo takes it back', async () => {
    const { user } = renderAt(`/app/friends/${riya}`, <LimitRow friendId={riya} />)
    expect(screen.getByText('The most you’re comfortable with Riya owing you. Settle tells you before a split crosses it. It never stops you.')).toBeInTheDocument()
    expect(chip('None')).toHaveAttribute('aria-checked', 'true')
    for (const amount of ['₹500', '₹1,000', '₹2,000', '₹5,000']) expect(chip(amount)).toHaveAttribute('aria-checked', 'false')

    await user.click(chip('₹2,000'))
    expect(limitStore.get().byFriend[riya]).toBe(200_000)
    expect(chip('₹2,000')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Limit for Riya: ₹2,000')).toBeInTheDocument()
    expect(screen.getByText('Riya owes you ₹5,000 now: ₹3,000 over the limit.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(limitStore.get().byFriend).toEqual({})
    expect(chip('None')).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByText(/over the limit/)).not.toBeInTheDocument()
  })

  it('under the limit it says how much is left; exactly on it is not over', async () => {
    const { user } = renderAt(`/app/friends/${riya}`, <LimitRow friendId={riya} />)
    await user.click(chip('₹5,000'))
    expect(screen.getByText('Riya owes you ₹5,000 now: right at the limit.')).toBeInTheDocument()
    await user.click(chip('Other'))
    await user.type(screen.getByLabelText('Your own amount'), '6200')
    await user.tab()
    expect(screen.getByText('Riya owes you ₹5,000 now: ₹1,200 to go before the limit.')).toBeInTheDocument()
    setPaidBack(dinner, riya, true)
    await waitFor(() => expect(screen.getByText('Riya owes you nothing right now.')).toBeInTheDocument())
  })

  it('"Other" takes your own amount; leaving the field keeps what was typed', async () => {
    const { user } = renderAt(`/app/friends/${riya}`, <LimitRow friendId={riya} />)
    await user.click(chip('Other'))
    await user.click(screen.getByRole('button', { name: 'Set limit' }))
    expect(screen.getByText('Type an amount above zero.')).toBeInTheDocument()
    expect(limitStore.get().byFriend).toEqual({})

    await user.type(screen.getByLabelText('Your own amount'), '7500')
    await user.click(screen.getByRole('button', { name: 'Set limit' }))
    expect(limitStore.get().byFriend[riya]).toBe(750_000)
    expect(chip('Other: ₹7,500')).toHaveAttribute('aria-checked', 'true')
    // One change, one toast: leaving the field and pressing the button did not set it twice.
    expect(screen.getAllByText('Limit for Riya: ₹7,500')).toHaveLength(1)

    await user.clear(screen.getByLabelText('Your own amount'))
    await user.type(screen.getByLabelText('Your own amount'), '8000')
    await user.tab()
    expect(limitStore.get().byFriend[riya]).toBe(800_000)
  })

  it('with a limit for everyone: follows it until given their own, and "None" exempts them', async () => {
    setEveryoneLimit(100_000)
    const { user } = renderAt(`/app/friends/${riya}`, <LimitRow friendId={riya} />)
    expect(chip('As for everyone: ₹1,000')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Using your limit for everyone, ₹1,000. Riya owes you ₹5,000 now: ₹4,000 over the limit.')).toBeInTheDocument()

    await user.click(chip('None'))
    expect(limitStore.get().byFriend[riya]).toBe(0)
    expect(screen.getByText('No limit for Riya')).toBeInTheDocument()
    expect(screen.queryByText(/over the limit/)).not.toBeInTheDocument()

    await user.click(chip('As for everyone: ₹1,000'))
    expect(limitStore.get().byFriend).toEqual({})
    expect(screen.getByText('Riya follows your limit for everyone')).toBeInTheDocument()
  })

  it('shows nothing for yourself or someone who isn’t in your people', () => {
    expect(renderAt('/app', <LimitRow friendId={ME_ID} />).container).toBeEmptyDOMElement()
    expect(renderAt('/app', <LimitRow friendId="nobody" />).container).toBeEmptyDOMElement()
  })
})

describe('LimitNote', () => {
  it('says who the split takes over a limit, and never blocks', () => {
    setFriendLimit(riya, 500_000)
    renderAt('/app/split/new', <LimitNote friendIds={[ME_ID, riya, sam]} amounts={{ [riya]: 40_000, [sam]: 40_000 }} />)
    expect(screen.getByText('Over a limit you set')).toBeInTheDocument()
    expect(screen.getByText('This takes Riya to ₹5,400 owed to you, over the ₹5,000 you set.')).toBeInTheDocument()
    expect(screen.getByText('You can still save it.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText(/Sam/)).not.toBeInTheDocument()
  })

  it('takes amounts as a list too, tells "already over" apart, and names the limit for everyone', () => {
    setEveryoneLimit(200_000)
    renderAt('/app/split/new', <LimitNote friendIds={[riya, sam]} amounts={[100_000, 250_000]} />)
    expect(screen.getByText('Over limits you set')).toBeInTheDocument()
    expect(screen.getByText('Riya already owes you ₹5,000, over the ₹2,000 you set for everyone. This makes it ₹6,000.')).toBeInTheDocument()
    expect(screen.getByText('This takes Sam to ₹2,500 owed to you, over the ₹2,000 you set for everyone.')).toBeInTheDocument()
  })

  it('names three people and counts the rest', () => {
    setEveryoneLimit(100)
    const ids = ['Asha', 'Dev', 'Gita', 'Hari', 'Isha'].map((name) => addFriend({ name }).id)
    renderAt('/app/split/new', <LimitNote friendIds={ids} amounts={ids.map(() => 5_000)} />)
    expect(screen.getByText(/^This takes Asha to ₹50/)).toBeInTheDocument()
    expect(screen.getByText(/^This takes Gita to ₹50/)).toBeInTheDocument()
    expect(screen.queryByText(/Hari/)).not.toBeInTheDocument()
    expect(screen.getByText('And 2 more people.')).toBeInTheDocument()
  })

  it('shows nothing when no limit is crossed, when none is set, when someone else pays, or for another currency', () => {
    expect(renderAt('/app/split/new', <LimitNote friendIds={[riya]} amounts={{ [riya]: 900_000 }} />).container).toBeEmptyDOMElement()
    setFriendLimit(riya, 600_000)
    expect(renderAt('/app/split/new', <LimitNote friendIds={[riya]} amounts={{ [riya]: 100_000 }} />).container).toBeEmptyDOMElement()
    expect(renderAt('/app/split/new', <LimitNote friendIds={[riya]} amounts={{}} />).container).toBeEmptyDOMElement()
    expect(renderAt('/app/split/new', <LimitNote friendIds={[riya]} amounts={{ [riya]: 900_000 }} currency="USD" />).container).toBeEmptyDOMElement()
  })

  it('editing a saved split doesn’t count it twice', () => {
    setFriendLimit(riya, 600_000)
    // The ₹5,000 she owes IS this split: editing her share to ₹5,500 keeps her under ₹6,000.
    expect(renderAt('/app/split/x/edit', <LimitNote friendIds={[riya]} amounts={{ [riya]: 550_000 }} expenseId={dinner} />).container).toBeEmptyDOMElement()
    renderAt('/app/split/new', <LimitNote friendIds={[riya]} amounts={{ [riya]: 550_000 }} />)
    expect(screen.getByText('This takes Riya to ₹10,500 owed to you, over the ₹6,000 you set.')).toBeInTheDocument()
  })
})

describe('LimitBadge', () => {
  it('“Over your ₹2,000 limit” when what they owe is over it, nothing otherwise', () => {
    const { container } = renderAt('/app/collect', <LimitBadge friendId={riya} />)
    const other = renderAt('/app/collect', <LimitBadge friendId={sam} />)
    // No limit: nothing. A limit she is exactly on: nothing.
    expect(container).toBeEmptyDOMElement()
    act(() => void setFriendLimit(riya, 500_000))
    expect(container).toBeEmptyDOMElement()
    act(() => void setFriendLimit(riya, 200_000))
    expect(container).toHaveTextContent('Over your ₹2,000 limit')
    // Sam owes nothing and has no limit.
    expect(other.container).toBeEmptyDOMElement()
  })

  it('goes away by itself once they pay', async () => {
    setFriendLimit(riya, 200_000)
    renderAt('/app/collect', <LimitBadge friendId={riya} />)
    expect(screen.getByText('Over your ₹2,000 limit')).toBeInTheDocument()
    setPaidBack(dinner, riya, true)
    await waitFor(() => expect(screen.queryByText('Over your ₹2,000 limit')).not.toBeInTheDocument())
  })
})

describe('LimitScreen', () => {
  it('sets a limit for everyone in one tap, lists people with who is over first, and Undo takes it back', async () => {
    const { user } = renderAt('/app/limit', <LimitScreen />)
    expect(screen.getByRole('heading', { name: 'Udhaar limit' })).toBeInTheDocument()
    expect(screen.getByText(/^Udhaar is what friends owe you\./)).toBeInTheDocument()
    const everyone = within(screen.getByRole('region', { name: 'A limit for everyone' }))
    const people = () => within(screen.getByRole('region', { name: 'Your people' })).getAllByRole('button')
    expect(people()[0]).toHaveTextContent('Riya Sharma')
    expect(people()[0]).toHaveTextContent('Owes you ₹5,000 · no limit')
    expect(people()[1]).toHaveTextContent('Owes you nothing · no limit')

    await user.click(everyone.getByRole('radio', { name: '₹1,000' }))
    expect(limitStore.get().everyone).toBe(100_000)
    expect(screen.getByText('Limit for everyone: ₹1,000')).toBeInTheDocument()
    expect(people()[0]).toHaveTextContent('Owes you ₹5,000 · limit ₹1,000, as for everyone')
    expect(people()[0]).toHaveTextContent('Over your ₹1,000 limit')
    expect(people()[1]).not.toHaveTextContent('Over your')

    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(limitStore.get().everyone).toBeNull()
    expect(people()[0]).toHaveTextContent('Owes you ₹5,000 · no limit')
  })

  it('tapping a person opens their own limit', async () => {
    const { user } = renderAt('/app/limit', <LimitScreen />)
    await user.click(screen.getByRole('button', { name: /Riya Sharma/ }))
    const sheet = within(await screen.findByRole('dialog', { name: 'Riya Sharma' }))
    await user.click(sheet.getByRole('radio', { name: '₹5,000' }))
    expect(limitStore.get().byFriend[riya]).toBe(500_000)
    expect(sheet.getByText('Riya owes you ₹5,000 now: right at the limit.')).toBeInTheDocument()
  })

  it('empty: with nobody to set a limit for, says what it does and sends you to add people', async () => {
    resetProScreens()
    const { user } = renderAt('/app/limit', <LimitScreen />)
    expect(screen.getByRole('heading', { name: 'Nobody to set a limit for yet' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add people' }))
    expect(currentUrl()).toBe('/app/friends')
  })
})

describe('LimitEveryoneRow', () => {
  it('"None" takes the limit for everyone away', async () => {
    setEveryoneLimit(200_000)
    const { user } = renderAt('/app/you', <LimitEveryoneRow />)
    expect(chip('₹2,000')).toHaveAttribute('aria-checked', 'true')
    await user.click(chip('None'))
    expect(limitStore.get().everyone).toBeNull()
    expect(screen.getByText('No limit for everyone')).toBeInTheDocument()
  })
})
