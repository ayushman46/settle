import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { STORAGE_KEYS } from '../../data/stores'
import { ToastProvider } from '../../components'
import { resetFlowHistory } from '../../state/backStack'
import type { Session } from '../../types'
import { AssignScreen } from '../bill/AssignScreen'
import { AISHA, assignAll, BEN, CHEN, historyIdle, renderScreen, sampleSession } from '../bill/screenTestKit'
import { DietToggles } from './DietToggles'
import { dietStore, setDiet } from './store'

const BEER = { id: 'beer', name: 'Kingfisher Pitcher', quantity: 1, amount: 90_000 }

/** The sample bill (Butter Chicken on it) plus a pitcher, three people, everyone on everything unless `shares` says. */
function session(overrides: Partial<Session> = {}, everyoneOn = true): Session {
  const base = sampleSession('assign', { people: [AISHA, BEN, CHEN] })
  const withBeer = { ...base, items: [...base.items, BEER], ...overrides }
  return { ...withBeer, assignments: everyoneOn ? assignAll(withBeer, { a: 1, b: 1, c: 1 }) : {} }
}

const chickenId = (s: Session) => s.items.find((i) => i.name === 'Butter Chicken')?.id ?? ''

function resetDiet(): void {
  localStorage.removeItem(STORAGE_KEYS.diet)
  dietStore.reload()
}

beforeEach(() => {
  resetFlowHistory()
  window.history.replaceState(null, '')
  resetDiet()
})

afterEach(async () => {
  await historyIdle()
  resetDiet()
})

describe('Assign step — doesn’t drink, vegetarian', () => {
  it('takes a remembered non-drinker off the drinks as soon as the step opens, with undo', async () => {
    setDiet('b', 'alcohol', true)
    const { user, probe } = renderScreen(<AssignScreen />, session())

    expect(probe.current.assignments.beer).toEqual({ a: 1, c: 1 })
    expect(screen.getByText('Ben doesn’t drink: taken off 1 drink (₹900).')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No alcohol for Ben' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(probe.current.assignments.beer).toEqual({ a: 1, b: 1, c: 1 })
    expect(screen.queryByText(/Ben doesn’t drink/)).not.toBeInTheDocument()
  })

  it('a toggle applies at once, is remembered, and switching it off puts them back', async () => {
    const first = session()
    const { user, probe, unmount } = renderScreen(<AssignScreen />, first)
    expect(screen.getByText('Anyone not drinking, or vegetarian?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Veg only for Chen' }))
    expect(probe.current.assignments[chickenId(first)]).toEqual({ a: 1, b: 1 })
    expect(screen.getByText('Chen is vegetarian: taken off 1 dish (₹495).')).toBeInTheDocument()
    expect(dietStore.get().people.c).toEqual({ veg: true })

    await user.click(screen.getByRole('button', { name: 'Veg only for Chen' }))
    expect(probe.current.assignments[chickenId(first)]).toEqual({ a: 1, b: 1, c: 1 })
    expect(screen.queryByText(/Chen is vegetarian/)).not.toBeInTheDocument()

    // Next bill: on again, and nothing to tap.
    await user.click(screen.getByRole('button', { name: 'Veg only for Chen' }))
    unmount()
    await historyIdle()
    const next = { ...session(), id: 'next-bill' }
    const second = renderScreen(<AssignScreen />, next)
    expect(second.probe.current.assignments[chickenId(next)]).toEqual({ a: 1, b: 1 })
  })

  it('keeps a person put back by hand, even when another toggle changes', async () => {
    setDiet('b', 'alcohol', true)
    const { user, probe } = renderScreen(<AssignScreen />, session())
    expect(probe.current.assignments.beer).toEqual({ a: 1, c: 1 })

    await user.click(screen.getByRole('button', { name: /^Kingfisher Pitcher/ }))
    const dialog = screen.getByRole('dialog', { name: 'Kingfisher Pitcher' })
    await user.click(within(dialog).getByRole('button', { name: /^Ben\b/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))
    await historyIdle()
    expect(probe.current.assignments.beer).toEqual({ a: 1, b: 1, c: 1 })

    await user.click(screen.getByRole('button', { name: 'Veg only for Aisha' }))
    expect(probe.current.assignments.beer).toEqual({ a: 1, b: 1, c: 1 })
    expect(probe.current.assignments[chickenId(probe.current)]).toEqual({ b: 1, c: 1 })
  })

  it('takes them off while items get their people, and says so over the pop-up', async () => {
    setDiet('b', 'alcohol', true)
    const s = session()
    const { user, probe } = renderScreen(<AssignScreen />, { ...s, assignments: { ...s.assignments, beer: {} } })
    const dialog = screen.getByRole('dialog', { name: 'Kingfisher Pitcher' })
    await user.click(within(dialog).getByRole('button', { name: 'Everyone' }))
    expect(probe.current.assignments.beer).toEqual({ a: 1, c: 1 })
    expect(await screen.findByText('Taken off Kingfisher Pitcher: Ben (no alcohol)')).toBeInTheDocument()
  })

  it('never leaves an item with nobody on it', () => {
    setDiet('b', 'alcohol', true)
    const s = session()
    const { probe } = renderScreen(<AssignScreen />, { ...s, assignments: { ...s.assignments, beer: { b: 1 } } })
    expect(probe.current.assignments.beer).toEqual({ b: 1 })
    expect(screen.getByText('Nobody else is on Kingfisher Pitcher, so it stays with Ben.')).toBeInTheDocument()
  })

  it('leaves a saved bill as it was until a toggle changes', () => {
    setDiet('b', 'alcohol', true)
    const { probe } = renderScreen(<AssignScreen />, session({ expenseId: 'saved-1' }))
    expect(probe.current.assignments.beer).toEqual({ a: 1, b: 1, c: 1 })
    expect(screen.queryByText(/Ben doesn’t drink/)).not.toBeInTheDocument()
  })

  it('shows nothing for a bill with no drinks or meat', () => {
    const base = sampleSession('assign', { people: [AISHA, BEN, CHEN] })
    const veg = { ...base, items: base.items.filter((i) => i.name !== 'Butter Chicken') }
    renderScreen(<AssignScreen />, { ...veg, assignments: assignAll(veg, { a: 1 }) })
    expect(screen.queryByText(/not drinking|vegetarian/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Veg only for/ })).not.toBeInTheDocument()
  })

  it('asks only about what the bill has', () => {
    const base = sampleSession('assign', { people: [AISHA, BEN, CHEN] })
    renderScreen(<AssignScreen />, { ...base, assignments: assignAll(base, { a: 1 }) })
    expect(screen.getByText('Anyone vegetarian?')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /No alcohol for/ })).not.toBeInTheDocument()
  })
})

describe('DietToggles', () => {
  it('remembers both for a person', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <DietToggles friendId="riya" />
      </ToastProvider>,
    )
    await user.click(screen.getByRole('switch', { name: 'Doesn’t drink' }))
    await user.click(screen.getByRole('switch', { name: 'Vegetarian' }))
    expect(dietStore.get().people.riya).toEqual({ noAlcohol: true, veg: true })
    expect(screen.getByRole('switch', { name: 'Vegetarian' })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('switch', { name: 'Doesn’t drink' }))
    expect(dietStore.get().people.riya).toEqual({ veg: true })
  })

  it('is nothing without a person', () => {
    const { container } = render(<DietToggles friendId="" />)
    expect(container).toBeEmptyDOMElement()
  })
})
