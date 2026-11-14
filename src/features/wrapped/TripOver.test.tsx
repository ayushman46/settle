import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, createGroup, groupsStore, saveExpense, updateProfile } from '../../data'
import { draft, everyone } from '../../data/testKit'
import { ME_ID, type Group } from '../../domain/types'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { wrappedStore } from './store'
import { TripOverCard, TripOverHome } from './TripOver'

vi.setConfig({ testTimeout: 30_000 })

let riya: string
let sam: string

function trip(name: string, emoji: string, dates: string[]): Group {
  const group = createGroup({ name, emoji, kind: 'trip', currency: 'INR', memberIds: [ME_ID, riya, sam] })
  dates.forEach((date, i) => saveExpense(draft({ title: `Bill ${i}`, total: 90_000, date, payerId: i === 0 ? riya : ME_ID, groupId: group.id, participants: everyone(ME_ID, riya, sam) })))
  return group
}
const fresh = (id: string): Group => groupsStore.get().find((g) => g.id === id)!

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 14, 12))
  resetProScreens()
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
})

afterEach(() => {
  vi.useRealTimers()
})

describe('TripOverCard', () => {
  it('says the trip looks done, how many payments settle it and where you stand; Settle up goes there', async () => {
    const goa = trip('Goa', '🏖️', ['2026-11-08', '2026-11-09', '2026-11-10'])
    const { user } = renderAt(`/app/groups/${goa.id}`, <TripOverCard group={fresh(goa.id)} />)
    const card = screen.getByRole('region', { name: 'Goa looks done' })
    // Riya paid ₹900, Ayush ₹1,800; each share ₹900: Sam pays Ayush ₹900.
    expect(card).toHaveTextContent('1 payment settles it: ₹900 in all. You’re owed ₹900.')
    await user.click(within(card).getByRole('button', { name: 'Settle up' }))
    expect(currentUrl()).toBe(`/app/groups/${goa.id}/settle`)
  })

  it('See the story opens the story', async () => {
    const goa = trip('Goa', '🏖️', ['2026-11-08', '2026-11-09', '2026-11-10'])
    const { user } = renderAt(`/app/groups/${goa.id}`, <TripOverCard group={fresh(goa.id)} />)
    await user.click(screen.getByRole('button', { name: 'See the story' }))
    expect(currentUrl()).toBe(`/app/groups/${goa.id}/wrapped`)
  })

  it('Not yet puts it away, with Undo', async () => {
    const goa = trip('Goa', '🏖️', ['2026-11-08', '2026-11-09', '2026-11-10'])
    const { user } = renderAt(`/app/groups/${goa.id}`, <TripOverCard group={fresh(goa.id)} />)
    await user.click(screen.getByRole('button', { name: 'Not yet' }))
    expect(screen.queryByRole('region', { name: 'Goa looks done' })).not.toBeInTheDocument()
    expect(wrappedStore.get().putAway[goa.id]).toEqual({ at: '2026-11-14', last: '2026-11-10' })
    expect(screen.getByText('Put away. It comes back if Goa gets busy again.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(screen.getByRole('region', { name: 'Goa looks done' })).toBeInTheDocument()
    expect(wrappedStore.get().putAway[goa.id]).toBeUndefined()
  })

  it('shows nothing while the trip is still on, or for a group with nothing in it', () => {
    const on = trip('Ooty', '⛰️', ['2026-11-12', '2026-11-13', '2026-11-13'])
    const empty = createGroup({ name: 'Flat', emoji: '🏠', kind: 'home', currency: 'INR', memberIds: [ME_ID, riya] })
    const { container } = renderAt('/', (
      <>
        <TripOverCard group={fresh(on.id)} />
        <TripOverCard group={fresh(empty.id)} />
      </>
    ))
    expect(container).toBeEmptyDOMElement()
  })
})

describe('TripOverHome', () => {
  it('picks the group that most recently looks done', () => {
    trip('Goa', '🏖️', ['2026-11-01', '2026-11-02', '2026-11-03'])
    trip('Pondy', '🌊', ['2026-11-08', '2026-11-09', '2026-11-10'])
    renderAt('/app', <TripOverHome />)
    expect(screen.getByRole('region', { name: 'Pondy looks done' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Goa looks done' })).not.toBeInTheDocument()
  })

  it('is empty when no group looks done', () => {
    trip('Ooty', '⛰️', ['2026-11-13', '2026-11-13', '2026-11-13'])
    const { container } = renderAt('/app', <TripOverHome />)
    expect(container).toBeEmptyDOMElement()
  })
})
