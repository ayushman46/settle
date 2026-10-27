import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, expensesStore, saveExpense, updateProfile } from '../../data'
import { remindersStore } from '../../data/stores'
import { draft, everyone } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { CollectScreen } from './CollectScreen'

vi.setConfig({ testTimeout: 30_000 })

let riya: string
let sam: string
let dinner: string

function at(hour: number): void {
  vi.setSystemTime(new Date(2026, 9, 27, hour))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  at(12)
  resetProScreens()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
  dinner = saveExpense(draft({ title: 'Dinner', total: 90_000, date: '2026-10-20', participants: everyone(ME_ID, riya, sam) })).id
  saveExpense(draft({ title: 'Cab', total: 40_000, date: '2026-10-25', participants: everyone(ME_ID, sam) }))
})

afterEach(() => {
  vi.useRealTimers()
})

const row = (name: string) => screen.getByRole('button', { name: `Remind ${name}` }).closest('li') as HTMLElement

describe('CollectScreen', () => {
  it('lists who owes you, the longest wait first, with how long and whether you’ve asked', () => {
    renderAt('/app/collect', <CollectScreen />)
    expect(screen.getByRole('heading', { level: 1, name: 'To collect' })).toBeInTheDocument()
    expect(screen.getByText(/₹800 from 2 people/)).toBeInTheDocument()
    const items = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(items.map((li) => within(li).getByRole('button', { name: /^Remind / }).getAttribute('aria-label'))).toEqual(['Remind Sam', 'Remind Riya'])
    expect(row('Sam')).toHaveTextContent('Our splits · 7 days waiting')
    expect(row('Sam')).toHaveTextContent('₹500')
    expect(row('Riya')).toHaveTextContent('Dinner · 7 days waiting')
    expect(row('Riya')).toHaveTextContent('Not reminded yet')
    expect(screen.queryByText('It’s late')).not.toBeInTheDocument()
  })

  it('a reminder opens friendly, is remembered once sent, and the next one says to wait', async () => {
    const { user } = renderAt('/app/collect', <CollectScreen />)
    await user.click(screen.getByRole('button', { name: 'Remind Riya' }))
    const sheet = await screen.findByRole('dialog', { name: 'Nudge Riya' })
    expect(within(sheet).getByRole('radio', { name: /Friendly/ })).toHaveAttribute('aria-checked', 'true')
    await user.click(within(sheet).getByRole('button', { name: 'Copy' }))
    expect(remindersStore.get()).toEqual([expect.objectContaining({ friendId: riya, tone: 'friendly' })])
    await waitFor(() => expect(row('Riya')).toHaveTextContent('Reminded today · give it a day'))
  })

  it('after a reminder days ago, the next one opens funny', async () => {
    remindersStore.set([{ friendId: riya, at: new Date(2026, 9, 24, 19).getTime(), tone: 'friendly' }])
    const { user } = renderAt('/app/collect', <CollectScreen />)
    expect(row('Riya')).toHaveTextContent('Reminded 3 days ago · next: funny')
    await user.click(screen.getByRole('button', { name: 'Remind Riya' }))
    const sheet = await screen.findByRole('dialog', { name: 'Nudge Riya' })
    expect(within(sheet).getByRole('radio', { name: /Funny/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('Paid ticks someone off, with Undo', async () => {
    const { user } = renderAt('/app/collect', <CollectScreen />)
    await user.click(screen.getByRole('button', { name: 'Riya paid you' }))
    expect(expensesStore.get().find((e) => e.id === dinner)?.paidBack[riya]).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Remind Riya' })).not.toBeInTheDocument()
    expect(screen.getByText(/₹500 from 1 person/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(expensesStore.get().find((e) => e.id === dinner)?.paidBack[riya]).toBeUndefined()
    expect(screen.getByRole('button', { name: 'Remind Riya' })).toBeInTheDocument()
  })

  it('late at night, says a reminder can wait', () => {
    at(23)
    renderAt('/app/collect', <CollectScreen />)
    expect(screen.getByText('It’s late')).toBeInTheDocument()
    expect(screen.getByText('A reminder sent now lands at night. It can wait till the morning.')).toBeInTheDocument()
  })

  it('links to Who’s paid? and to each person', async () => {
    const { user } = renderAt('/app/collect', <CollectScreen />)
    await user.click(screen.getByRole('button', { name: /^Who’s paid. Tick off who paid/ }))
    expect(currentUrl()).toBe('/app/whos-paid')
  })

  it('nobody owes you: nothing to collect', () => {
    expensesStore.set([])
    renderAt('/app/collect', <CollectScreen />)
    expect(screen.getByRole('heading', { name: 'Nothing to collect' })).toBeInTheDocument()
  })
})
