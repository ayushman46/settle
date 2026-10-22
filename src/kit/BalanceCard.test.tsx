import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, resetDataForTests } from '../data'
import type { OverallSummary } from '../engine/balances'
import { BalanceCard } from './BalanceCard'
import { balanceHeadline, hasOutstanding, otherCurrenciesLine, peopleLine, topBalances } from './balanceLabels'
import { allowMotion, type FrameQueue } from './testMotion'

beforeEach(() => {
  resetDataForTests()
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetDataForTests()
})

function summary(byFriend: Record<string, number>, otherCurrencies: OverallSummary['otherCurrencies'] = {}): OverallSummary {
  let owedToMe = 0
  let iOwe = 0
  for (const v of Object.values(byFriend)) {
    if (v > 0) owedToMe += v
    else iOwe -= v
  }
  return { currency: 'INR', owedToMe, iOwe, byFriend, otherCurrencies }
}

describe('balance labels', () => {
  it('knows when anything is outstanding, in any currency', () => {
    expect(hasOutstanding(summary({}))).toBe(false)
    expect(hasOutstanding(summary({ a: 100 }))).toBe(true)
    expect(hasOutstanding(summary({ a: -100 }))).toBe(true)
    expect(hasOutstanding(summary({}, { USD: { owedToMe: 0, iOwe: 500 } }))).toBe(true)
    expect(hasOutstanding(summary({}, { USD: { owedToMe: 0, iOwe: 0 } }))).toBe(false)
  })

  it('ranks people by how much is at stake, either way, then by id', () => {
    const s = summary({ c: 500, a: -900, b: 500, d: 0 })
    expect(topBalances(s)).toEqual([
      { friendId: 'a', amount: -900 },
      { friendId: 'b', amount: 500 },
      { friendId: 'c', amount: 500 },
    ])
    expect(topBalances(s, 1)).toEqual([{ friendId: 'a', amount: -900 }])
    expect(topBalances({ byFriend: { x: Number.NaN } })).toEqual([])
  })

  it('leads with the net amount and says which way it goes', () => {
    expect(balanceHeadline(summary({ a: 300_000 }))).toEqual({
      mood: 'owed',
      label: "You're owed",
      currency: 'INR',
      amount: 300_000,
      owedToMe: 300_000,
      iOwe: 0,
      mixed: false,
    })
    expect(balanceHeadline(summary({ a: -55_000 }))).toMatchObject({ mood: 'owe', label: 'You owe', amount: 55_000, mixed: false })
    expect(balanceHeadline(summary({ a: 300_000, b: -55_000 }))).toMatchObject({
      mood: 'owed',
      label: "Overall, you're owed",
      amount: 245_000,
      owedToMe: 300_000,
      iOwe: 55_000,
      mixed: true,
    })
    expect(balanceHeadline(summary({ a: 100, b: -300 }))).toMatchObject({ mood: 'owe', label: 'Overall, you owe', amount: 200 })
    expect(balanceHeadline(summary({ a: 100, b: -100 }))).toMatchObject({ mood: 'even', label: "Overall, you're even", amount: 0, mixed: true })
    expect(balanceHeadline(summary({}))).toMatchObject({ mood: 'settled', label: 'All settled up', amount: 0, currency: 'INR' })
  })

  it('leads with another currency when only that one has money out', () => {
    const s = summary({}, { EUR: { owedToMe: 0, iOwe: 0 }, USD: { owedToMe: 4_000, iOwe: 1_000 } })
    expect(balanceHeadline(s)).toMatchObject({ mood: 'owed', currency: 'USD', amount: 3_000, mixed: true })
    expect(otherCurrenciesLine(s, 'USD')).toBeNull()
  })

  it('says who the balance is with', () => {
    expect(peopleLine([{ amount: 5 }], ['Riya'])).toBe('Riya owes you')
    expect(peopleLine([{ amount: 5 }, { amount: 3 }], ['Riya', 'Sam'])).toBe('Riya and Sam owe you')
    expect(peopleLine([{ amount: -5 }], ['Riya'])).toBe('You owe Riya')
    expect(peopleLine([{ amount: -5 }, { amount: -1 }], ['Riya', 'Sam'])).toBe('You owe Riya and Sam')
    expect(peopleLine([{ amount: -5 }, { amount: 1 }, { amount: 1 }, { amount: 1 }], ['A', 'B', 'C', 'D'])).toBe('With A, B and 2 others')
    expect(peopleLine([], [])).toBeNull()
  })

  it('lists other currencies without converting them', () => {
    expect(otherCurrenciesLine(summary({}))).toBeNull()
    expect(otherCurrenciesLine(summary({}, { USD: { owedToMe: 4_000, iOwe: 0 }, EUR: { owedToMe: 0, iOwe: 1_250 } }))).toBe(
      'Also $40 owed to you · €12.50 you owe',
    )
    // When another currency leads, the summary's own one is listed with the rest.
    expect(otherCurrenciesLine(summary({ a: 50_000 }), 'USD')).toBe('Also ₹500 owed to you')
  })
})

describe('BalanceCard', () => {
  it('shows what you are owed, by whom, with a lime Settle up', async () => {
    const riya = addFriend({ name: 'Riya Sharma' })
    const sam = addFriend({ name: 'Sam' })
    const onSettle = vi.fn()
    render(<BalanceCard summary={summary({ [riya.id]: 120_000, [sam.id]: 125_000 })} onSettle={onSettle} />)

    const card = screen.getByRole('region', { name: 'Your balance' })
    expect(within(card).getByText("You're owed")).toBeInTheDocument()
    expect(within(card).getByText('₹2,450')).toBeInTheDocument()
    expect(within(card).getByText('Sam and Riya owe you')).toBeInTheDocument()
    expect(within(card).getByRole('img', { name: 'Sam and Riya Sharma' })).toBeInTheDocument()
    expect(card).toHaveAttribute('data-mood', 'owed')
    // One direction only: no separate totals.
    expect(within(card).queryByRole('term')).not.toBeInTheDocument()

    await userEvent.click(within(card).getByRole('button', { name: 'Settle up' }))
    expect(onSettle).toHaveBeenCalledOnce()
  })

  it('shows both totals when money goes both ways', () => {
    const riya = addFriend({ name: 'Riya' })
    const sam = addFriend({ name: 'Sam' })
    render(<BalanceCard summary={summary({ [riya.id]: 300_000, [sam.id]: -55_000 })} onSettle={() => {}} settleLabel="See people" />)
    const card = screen.getByRole('region', { name: 'Your balance' })
    expect(within(card).getByText("Overall, you're owed")).toBeInTheDocument()
    expect(within(card).getByText('₹2,450')).toBeInTheDocument()
    expect(within(card).getAllByRole('term').map((t) => t.textContent)).toEqual(["You're owed", 'You owe'])
    expect(within(card).getAllByRole('definition').map((d) => d.textContent)).toEqual(['₹3,000', '₹550'])
    expect(within(card).getByText('With Riya and Sam')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'See people' })).toBeInTheDocument()
  })

  it('says what you owe, without the lime', () => {
    const riya = addFriend({ name: 'Riya' })
    render(<BalanceCard summary={summary({ [riya.id]: -54_000 })} onSettle={() => {}} />)
    const card = screen.getByRole('region', { name: 'Your balance' })
    expect(within(card).getByText('You owe')).toBeInTheDocument()
    expect(within(card).getByText('₹540')).toBeInTheDocument()
    expect(within(card).getByText('You owe Riya')).toBeInTheDocument()
    expect(card).toHaveAttribute('data-mood', 'owe')
  })

  it('shows the two totals and no big number when you are even overall', () => {
    const riya = addFriend({ name: 'Riya' })
    const sam = addFriend({ name: 'Sam' })
    render(<BalanceCard summary={summary({ [riya.id]: 10_000, [sam.id]: -10_000 })} onSettle={() => {}} />)
    const card = screen.getByRole('region', { name: 'Your balance' })
    expect(card).toHaveAttribute('data-mood', 'even')
    expect(within(card).getByText("Overall, you're even")).toBeInTheDocument()
    expect(within(card).getAllByRole('definition').map((d) => d.textContent)).toEqual(['₹100', '₹100'])
    expect(within(card).queryByText('₹0')).not.toBeInTheDocument()
  })

  it('caps the faces and names the rest', () => {
    const ids = ['Aarav', 'Bela', 'Chirag', 'Divya', 'Esha', 'Farhan'].map((name, i) => [addFriend({ name }).id, 1000 * (i + 1)])
    render(<BalanceCard summary={summary(Object.fromEntries(ids))} onSettle={() => {}} />)
    expect(screen.getByText('Farhan, Esha and 4 others owe you')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Farhan, Esha, Divya and 3 others' })).toBeInTheDocument()
    expect(screen.getByText('+3')).toBeInTheDocument()
  })

  it('uses first names on the line and full names for the faces', () => {
    const neha = addFriend({ name: 'Neha Sharma' })
    render(<BalanceCard summary={summary({ [neha.id]: 5_000 })} onSettle={() => {}} />)
    expect(screen.getByText('Neha owes you')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Neha Sharma' })).toBeInTheDocument()
  })

  it('names people who were removed "Someone"', () => {
    render(<BalanceCard summary={summary({ gone: 5_000 })} onSettle={() => {}} />)
    expect(screen.getByText('Someone owes you')).toBeInTheDocument()
  })

  it('mentions money in other currencies', () => {
    render(<BalanceCard summary={summary({ x: 100 }, { USD: { owedToMe: 4_000, iOwe: 0 } })} onSettle={() => {}} />)
    expect(screen.getByText('Also $40 owed to you')).toBeInTheDocument()
  })

  it('leads with another currency when only that one is outstanding', () => {
    render(<BalanceCard summary={summary({}, { USD: { owedToMe: 0, iOwe: 900 } })} onSettle={() => {}} />)
    const card = screen.getByRole('region', { name: 'Your balance' })
    expect(within(card).getByText('You owe')).toBeInTheDocument()
    expect(within(card).getByText('$9')).toBeInTheDocument()
    // Per-person balances are in rupees only, so no faces for dollars.
    expect(within(card).queryByRole('img')).not.toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Settle up' })).toBeInTheDocument()
  })

  it('turns into a calm "All settled up" when nothing is outstanding', () => {
    render(<BalanceCard summary={summary({})} onSettle={() => {}} />)
    const card = screen.getByRole('region', { name: 'All settled up' })
    expect(card).toHaveAttribute('data-mood', 'settled')
    expect(within(card).getByText('No one owes anyone right now.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('glides to a new balance, telling screen readers only the final amount', () => {
    const frames: FrameQueue = allowMotion()
    const riya = addFriend({ name: 'Riya' })
    const { rerender } = render(<BalanceCard summary={summary({ [riya.id]: 100_000 })} onSettle={() => {}} />)
    const card = screen.getByRole('region', { name: 'Your balance' })
    // An earlier card already played the intro this visit, so it starts at the amount.
    act(() => frames.flush(0))
    expect(amounts(card)).toEqual({ spoken: ['₹1,000'], drawn: null })

    rerender(<BalanceCard summary={summary({ [riya.id]: 200_000 })} onSettle={() => {}} />)
    act(() => frames.flush(0))
    act(() => frames.flush(100))
    // Mid-way: the drawn number is between the two; the spoken one is already final.
    const mid = amounts(card)
    expect(mid.spoken).toEqual(['₹2,000'])
    expect(mid.drawn).toMatch(/^₹1,\d{3}$/)
    act(() => frames.flush(1_000))
    expect(amounts(card)).toEqual({ spoken: ['₹2,000'], drawn: null })
  })
})

/**
 * The amounts screen readers get (outside anything aria-hidden) and, while it counts, the
 * amount drawn on screen (inside the hidden copy).
 */
function amounts(root: HTMLElement): { spoken: string[]; drawn: string | null } {
  const texts = [...root.querySelectorAll('.visually-hidden')].filter((el) => /\d/.test(el.textContent))
  return {
    spoken: texts.filter((el) => !el.closest('[aria-hidden="true"]')).map((el) => el.textContent),
    drawn: texts.find((el) => el.closest('[aria-hidden="true"]'))?.textContent ?? null,
  }
}

describe('BalanceCard intro', () => {
  it('counts up from zero the first time it shows in a visit', async () => {
    vi.resetModules()
    const frames = allowMotion()
    const fresh = await import('./BalanceCard')
    const { unmount } = render(<fresh.BalanceCard summary={summary({ x: 90_000 })} onSettle={() => {}} />)
    const card = screen.getByRole('region', { name: 'Your balance' })
    expect(amounts(card)).toEqual({ spoken: ['₹900'], drawn: '₹0' })
    act(() => frames.flush(0))
    act(() => frames.flush(2_000))
    expect(amounts(card)).toEqual({ spoken: ['₹900'], drawn: null })
    unmount()

    // Back on Home later: no second intro.
    render(<fresh.BalanceCard summary={summary({ x: 90_000 })} onSettle={() => {}} />)
    expect(amounts(screen.getByRole('region', { name: 'Your balance' }))).toEqual({ spoken: ['₹900'], drawn: null })
  })
})
