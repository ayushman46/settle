import { useState } from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, saveExpense, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import { friendPath } from '../groups/paths'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { shortDate } from '../recurring/recurringLabels'
import { FriendPaydayRow } from './FriendPaydayRow'
import { PaydayCard } from './PaydayCard'
import { PaydayGuessCard } from './PaydayGuessCard'
import { PaydayHint } from './PaydayHint'
import { PaydaySheet } from './PaydaySheet'
import { dismissPaydayCard, friendPaydayOf, noteSalary, paydayStore, setFriendPayday, setMyPayday } from './store'
import { paydayToday } from './today'

vi.setConfig({ testTimeout: 30_000 })

let riya: string
let sam: string
let asha: string

/** Noon on a day of November 2026 (the 7th is a Saturday). */
function onNov(day: number): void {
  vi.setSystemTime(new Date(2026, 10, day, 12))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  onNov(8)
  resetProScreens()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya Sharma' }).id
  sam = addFriend({ name: 'Sam' }).id
  asha = addFriend({ name: 'Asha' }).id
})

afterEach(() => {
  vi.useRealTimers()
})

/** Riya owes you ₹450. */
const riyaOwes = () => saveExpense(draft({ title: 'Dinner', total: 90_000, participants: everyone(ME_ID, riya) }))
/** You owe Sam ₹800. */
const oweSam = () => saveExpense(draft({ title: 'Cab', total: 160_000, payerId: sam, participants: everyone(ME_ID, sam) }))
/** You owe Asha ₹340. */
const oweAsha = () => saveExpense(draft({ title: 'Chai', total: 68_000, payerId: asha, participants: everyone(ME_ID, asha) }))

const chip = (name: string) => screen.getByRole('button', { name })
const undo = () => screen.getByRole('button', { name: /^Undo/ })

describe('FriendPaydayRow', () => {
  it('asks when they get paid, with nothing set until you say', () => {
    renderAt('/app/people/x', <FriendPaydayRow friendId={riya} />)
    expect(screen.getByRole('heading', { name: 'When does Riya get paid?' })).toBeInTheDocument()
    expect(screen.getByText('Settle shows the best day to ask: the day after.')).toBeInTheDocument()
    const chips = within(screen.getByRole('group', { name: 'Riya’s payday' })).getAllByRole('button')
    expect(chips.map((c) => c.textContent)).toEqual(['1st', '5th', '7th', '10th', 'Last day', 'Other', 'Don’t know'])
    expect(chip('Don’t know')).toHaveAttribute('aria-pressed', 'true')
    for (const name of ['1st', '5th', '7th', '10th', 'Last day', 'Other']) expect(chip(name)).toHaveAttribute('aria-pressed', 'false')
    expect(friendPaydayOf(riya)).toBeNull()
  })

  it('one tap saves it, says so, and Undo puts it back', async () => {
    const { user } = renderAt('/app/people/x', <FriendPaydayRow friendId={riya} />)
    await user.click(chip('7th'))
    expect(friendPaydayOf(riya)).toBe(7)
    expect(chip('7th')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('Don’t know')).toHaveAttribute('aria-pressed', 'false')
    // Today is 8 Nov: the next 7th is in December.
    expect(screen.getByText(`Gets paid on the 7th. Next payday: ${shortDate('2026-12-07')}.`)).toBeInTheDocument()
    expect(screen.getByText('Riya gets paid on the 7th')).toBeInTheDocument()

    await user.click(chip('Last day'))
    expect(friendPaydayOf(riya)).toBe('last')
    expect(screen.getByText('Riya gets paid on the last day of the month')).toBeInTheDocument()
    await user.click(undo())
    expect(friendPaydayOf(riya)).toBe(7)
    expect(chip('7th')).toHaveAttribute('aria-pressed', 'true')
  })

  it('tapping the day already picked changes nothing and says nothing', async () => {
    setFriendPayday(riya, 5)
    const { user } = renderAt('/app/people/x', <FriendPaydayRow friendId={riya} />)
    await user.click(chip('5th'))
    expect(friendPaydayOf(riya)).toBe(5)
    expect(screen.queryByRole('button', { name: /^Undo/ })).not.toBeInTheDocument()
  })

  it('"Don’t know" forgets it, with Undo', async () => {
    setFriendPayday(riya, 10)
    const { user } = renderAt('/app/people/x', <FriendPaydayRow friendId={riya} />)
    expect(chip('10th')).toHaveAttribute('aria-pressed', 'true')
    await user.click(chip('Don’t know'))
    expect(friendPaydayOf(riya)).toBeNull()
    expect(screen.getByText('Riya’s payday is forgotten')).toBeInTheDocument()
    await user.click(undo())
    expect(friendPaydayOf(riya)).toBe(10)
  })

  it('"Other" opens every day of the month, and the pick shows on the chip', async () => {
    const { user } = renderAt('/app/people/x', <FriendPaydayRow friendId={riya} />)
    await user.click(chip('Other'))
    const sheet = await screen.findByRole('dialog', { name: 'When does Riya get paid?' })
    expect(within(within(sheet).getByRole('group', { name: 'Day of the month' })).getAllByRole('button')).toHaveLength(31)
    expect(within(sheet).getByText('In a shorter month, the 29th, 30th or 31st means the last day.')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'The 15th' }))
    expect(friendPaydayOf(riya)).toBe(15)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'When does Riya get paid?' })).not.toBeInTheDocument(), { timeout: 4000 })
    expect(chip('15th')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: 'Other' })).not.toBeInTheDocument()

    // The last working day is in there too.
    await user.click(chip('15th'))
    const again = await screen.findByRole('dialog', { name: 'When does Riya get paid?' })
    expect(within(again).getByRole('button', { name: 'The 15th' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(again).getByRole('button', { name: 'Last working day' }))
    expect(friendPaydayOf(riya)).toBe('lastWorking')
    await waitFor(() => expect(chip('Last working day')).toHaveAttribute('aria-pressed', 'true'))
  })

  it('the day grid moves with the arrow keys', async () => {
    const { user } = renderAt('/app/people/x', <FriendPaydayRow friendId={riya} />)
    await user.click(chip('Other'))
    const sheet = await screen.findByRole('dialog', { name: 'When does Riya get paid?' })
    const day = (n: string) => within(sheet).getByRole('button', { name: `The ${n}` })
    day('1st').focus()
    await user.keyboard('{ArrowRight}')
    expect(day('2nd')).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(day('9th')).toHaveFocus()
    await user.keyboard('{End}')
    expect(day('31st')).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(day('31st')).toHaveFocus()
    await user.keyboard('{Home}{ArrowLeft}')
    expect(day('1st')).toHaveFocus()
    await user.keyboard('{ArrowDown}{Enter}')
    expect(friendPaydayOf(riya)).toBe(8)
  })

  it('shows nothing for yourself or for someone who isn’t one of your people', () => {
    const { container } = renderAt('/app/people/x', <FriendPaydayRow friendId={ME_ID} />)
    expect(container).toBeEmptyDOMElement()
    const other = renderAt('/app/people/x', <FriendPaydayRow friendId="nobody" />)
    expect(other.container).toBeEmptyDOMElement()
  })
})

describe('PaydayHint', () => {
  it('payday yesterday: a good day to ask', () => {
    setFriendPayday(riya, 7)
    renderAt('/app/collect', <PaydayHint friendId={riya} />)
    expect(screen.getByText('Payday was yesterday: a good day to ask')).toBeInTheDocument()
  })

  it('payday today: ask tomorrow', () => {
    setFriendPayday(riya, 8)
    renderAt('/app/collect', <PaydayHint friendId={riya} />)
    expect(screen.getByText('Payday is today: best to ask tomorrow')).toBeInTheDocument()
  })

  it('payday coming up: the day, and the day after', () => {
    setFriendPayday(riya, 10)
    renderAt('/app/collect', <PaydayHint friendId={riya} />)
    expect(screen.getByText('Gets paid on the 10th: best to ask on the 11th')).toBeInTheDocument()
  })

  it('the 31st in November is the 30th, and the day to ask is the 1st', () => {
    onNov(25)
    setFriendPayday(riya, 31)
    renderAt('/app/collect', <PaydayHint friendId={riya} />)
    expect(screen.getByText('Gets paid on the 30th: best to ask on the 1st')).toBeInTheDocument()
  })

  it('says nothing when their payday isn’t known, or the day to ask is more than 10 days away', () => {
    const unknown = renderAt('/app/collect', <PaydayHint friendId={riya} />)
    expect(unknown.container).toBeEmptyDOMElement()
    // Paid on the 1st, today is the 8th: the next day to ask is 2 Dec.
    setFriendPayday(sam, 1)
    const far = renderAt('/app/collect', <PaydayHint friendId={sam} />)
    expect(far.container).toBeEmptyDOMElement()
  })
})

describe('PaydayCard', () => {
  it('on your payday, when you owe: the total, how many people, and Clear everything', async () => {
    onNov(7)
    setMyPayday(7)
    oweSam()
    oweAsha()
    riyaOwes()
    const { user } = renderAt('/app', <PaydayCard />)
    const card = screen.getByRole('region', { name: 'Payday' })
    // What Riya owes you is not taken off what you owe.
    expect(within(card).getByRole('heading', { name: 'Payday. You owe ₹1,140 to 2 people' })).toBeInTheDocument()
    expect(within(card).getByText('Go through them one by one, the largest first.')).toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: 'Clear everything' }))
    expect(currentUrl()).toBe('/app/pay-all')
  })

  it('names the person when it is one, and says how long ago payday was', () => {
    setMyPayday(7)
    oweSam()
    renderAt('/app', <PaydayCard />)
    expect(screen.getByRole('heading', { name: 'Payday was yesterday. You owe ₹800 to Sam' })).toBeInTheDocument()
    expect(screen.getByText('One payment clears it.')).toBeInTheDocument()
  })

  it('still there two days after, gone on the third', () => {
    setMyPayday(7)
    oweSam()
    onNov(9)
    const two = renderAt('/app', <PaydayCard />)
    expect(screen.getByRole('heading', { name: 'Payday was 2 days ago. You owe ₹800 to Sam' })).toBeInTheDocument()
    two.unmount()
    onNov(10)
    const three = renderAt('/app', <PaydayCard />)
    expect(three.container).toBeEmptyDOMElement()
  })

  it('"Not this month" puts it away until the next payday, with Undo', async () => {
    onNov(7)
    setMyPayday(7)
    oweSam()
    const { user } = renderAt('/app', <PaydayCard />)
    await user.click(screen.getByRole('button', { name: 'Not this month' }))
    expect(screen.queryByRole('region', { name: 'Payday' })).not.toBeInTheDocument()
    expect(paydayStore.get().dismissed).toBe('2026-11-07')
    expect(screen.getByText('Put away until your next payday')).toBeInTheDocument()
    await user.click(undo())
    expect(screen.getByRole('region', { name: 'Payday' })).toBeInTheDocument()
    expect(paydayStore.get().dismissed).toBeNull()
  })

  it('shows nothing when you owe nobody, when it isn’t payday, or when no payday is set', () => {
    onNov(7)
    oweSam()
    const unset = renderAt('/app', <PaydayCard />)
    expect(unset.container).toBeEmptyDOMElement()
    unset.unmount()

    setMyPayday(20)
    const notToday = renderAt('/app', <PaydayCard />)
    expect(notToday.container).toBeEmptyDOMElement()
  })

  it('shows nothing on payday when you owe nothing', () => {
    onNov(7)
    setMyPayday(7)
    riyaOwes()
    const { container } = renderAt('/app', <PaydayCard />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('PaydayGuessCard', () => {
  const guess = () => {
    noteSalary('2026-09-30')
    noteSalary('2026-10-30')
  }

  it('shows nothing until salary alerts in two months agree', () => {
    noteSalary('2026-10-30')
    const { container } = renderAt('/app', <PaydayGuessCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('offers the payday and sets nothing by itself; one tap remembers it, and Undo forgets it again', async () => {
    guess()
    const { user } = renderAt('/app', <PaydayGuessCard />)
    const card = screen.getByRole('region', { name: 'Is this your payday?' })
    expect(within(card).getByRole('heading', { name: 'Looks like you get paid on the 30th. Remember it?' })).toBeInTheDocument()
    expect(within(card).getByText(`Salary alerts came on ${shortDate('2026-09-30')} and ${shortDate('2026-10-30')}. Settle kept only the dates, not the amounts.`)).toBeInTheDocument()
    expect(paydayStore.get().mine).toBeNull()

    await user.click(within(card).getByRole('button', { name: 'Remember it' }))
    expect(paydayStore.get().mine).toBe(30)
    expect(screen.queryByRole('region', { name: 'Is this your payday?' })).not.toBeInTheDocument()
    expect(screen.getByText('Your payday: the 30th')).toBeInTheDocument()
    await user.click(undo())
    expect(paydayStore.get().mine).toBeNull()
    expect(screen.getByRole('region', { name: 'Is this your payday?' })).toBeInTheDocument()
  })

  it('"Not now" puts the guess away without saving anything, with Undo', async () => {
    guess()
    const { user } = renderAt('/app', <PaydayGuessCard />)
    await user.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByRole('region', { name: 'Is this your payday?' })).not.toBeInTheDocument()
    expect(paydayStore.get().mine).toBeNull()
    expect(paydayStore.get().declined).toEqual(['30'])
    expect(screen.getByText('Okay, not saved')).toBeInTheDocument()
    await user.click(undo())
    expect(screen.getByRole('region', { name: 'Is this your payday?' })).toBeInTheDocument()
    expect(paydayStore.get().declined).toEqual([])
  })

  it('"Another day" opens the picker', async () => {
    guess()
    const { user } = renderAt('/app', <PaydayGuessCard />)
    await user.click(screen.getByRole('button', { name: 'Another day' }))
    const sheet = await screen.findByRole('dialog', { name: 'When do you get paid?' })
    await user.click(within(sheet).getByRole('button', { name: 'The 28th' }))
    expect(paydayStore.get().mine).toBe(28)
    expect(screen.queryByRole('region', { name: 'Is this your payday?' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'When do you get paid?' })).not.toBeInTheDocument(), { timeout: 4000 })
  })

  it('shows nothing once you have a payday', () => {
    guess()
    setMyPayday(1)
    const { container } = renderAt('/app', <PaydayGuessCard />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('PaydaySheet', () => {
  function Harness() {
    const [open, setOpen] = useState(true)
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        <PaydaySheet open={open} onClose={() => setOpen(false)} />
      </>
    )
  }
  const gone = () => waitFor(() => expect(screen.queryByRole('dialog', { name: 'When do you get paid?' })).not.toBeInTheDocument(), { timeout: 4000 })

  it('sets your payday in one tap, shows it picked next time, and "Don’t know" forgets it', async () => {
    const { user } = renderAt('/app/payday', <Harness />)
    const sheet = await screen.findByRole('dialog', { name: 'When do you get paid?' })
    expect(within(sheet).getByText('Pick the day of the month. It’s saved to your account.')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Last day of the month' }))
    expect(paydayStore.get().mine).toBe('last')
    expect(screen.getByText('Your payday: the last day of the month')).toBeInTheDocument()
    await gone()

    await user.click(screen.getByRole('button', { name: 'Open' }))
    const again = await screen.findByRole('dialog', { name: 'When do you get paid?' })
    expect(within(again).getByRole('button', { name: 'Last day of the month' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(again).getByRole('button', { name: 'Don’t know' }))
    expect(paydayStore.get().mine).toBeNull()
    expect(screen.getByText('Your payday is forgotten')).toBeInTheDocument()
    await gone()
    await user.click(undo())
    expect(paydayStore.get().mine).toBe('last')
  })

  it('renders nothing while closed', () => {
    renderAt('/app/payday', <PaydaySheet open={false} onClose={() => undefined} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('paydayToday', () => {
  const now = () => new Date()

  it('is empty when no payday is known', () => {
    oweSam()
    riyaOwes()
    expect(paydayToday(now())).toEqual([])
  })

  it('on your payday, when you owe: one item with the total, straight to Clear everything', () => {
    onNov(7)
    setMyPayday(7)
    oweSam()
    oweAsha()
    expect(paydayToday(now())).toEqual([
      { id: 'payday:mine:2026-11-07', title: 'Payday: clear what you owe', body: 'You owe 2 people', path: '/app/pay-all', amount: 114_000, currency: 'INR' },
    ])
    onNov(8)
    expect(paydayToday(now())[0]).toMatchObject({ id: 'payday:mine:2026-11-07', title: 'Payday was yesterday: clear what you owe' })
    onNov(10)
    expect(paydayToday(now())).toEqual([])
  })

  it('names the one person you owe, and stays away once the card was put away or you owe nothing', () => {
    onNov(7)
    setMyPayday(7)
    oweSam()
    expect(paydayToday(now())[0]).toMatchObject({ body: 'You owe Sam', amount: 80_000 })
    const undoDismiss = dismissPaydayCard('2026-11-07')
    expect(paydayToday(now())).toEqual([])
    undoDismiss()
    expect(paydayToday(now())).toHaveLength(1)
  })

  it('friends whose payday was yesterday and who owe you: a good day to ask', () => {
    riyaOwes()
    oweSam()
    setFriendPayday(riya, 7)
    // Sam's payday was yesterday too, but Sam owes you nothing. Asha's is days away.
    setFriendPayday(sam, 7)
    setFriendPayday(asha, 20)
    expect(paydayToday(now())).toEqual([
      { id: `payday:ask:${riya}:2026-11-07`, title: 'A good day to ask Riya', body: 'Their payday was yesterday', path: friendPath(riya), amount: 45_000, currency: 'INR' },
    ])
    onNov(9)
    expect(paydayToday(now())).toEqual([])
  })
})
