import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetNavForTests, useLocation } from '../../app/router'
import { ToastProvider } from '../../components'
import { addFriend, friendsStore, profileStore, resetDataForTests, saveExpense, updateProfile } from '../../data'
import { addClaimReply, createClaimRound, setOwnPicks } from '../../data/claims'
import { draft, everyone } from '../../data/testKit'
import { ME_ID, type ClaimRound } from '../../domain/types'
import { claimLinkFromRound, signReply } from '../../share/claim'
import { ClaimRoundScreen } from './ClaimRoundScreen'

// Whole screens with sheets and async link codecs: slow phones (and busy CI) need more than 5 s.
vi.setConfig({ testTimeout: 30_000 })

const ITEMS = [
  { id: 'chicken', name: 'Butter Chicken', amount: 45000, quantity: 1 },
  { id: 'paneer', name: 'Paneer Tikka', amount: 38000, quantity: 1 },
  { id: 'naan', name: 'Butter Naan', amount: 24000, quantity: 4 },
  { id: 'beer', name: 'Kingfisher Beer', amount: 90000, quantity: 3 },
  { id: 'soda', name: 'Fresh Lime Soda', amount: 12000, quantity: 1 },
  { id: 'jamun', name: 'Gulab Jamun', amount: 15000, quantity: 1 },
]

let round: ClaimRound

function Harness() {
  const { path } = useLocation()
  return (
    <ToastProvider>
      <output data-testid="path">{path}</output>
      {path.startsWith('/app/claims/') && <ClaimRoundScreen />}
    </ToastProvider>
  )
}

function send(w: number, n: string, x: Array<[number, number, number]>, pd: number) {
  const { m: _m, ...body } = { v: 1 as const, k: 'reply' as const, r: round.id, h: round.itemsHash, w, n, x, pd, at: 1792748400, m: '' }
  const result = addClaimReply(signReply(round.secret, body))
  expect(result.kind).toBe('added')
}

function open() {
  window.history.replaceState(null, '', `/app/claims/${round.id}`)
  resetNavForTests()
  const user = userEvent.setup()
  render(<Harness />)
  return user
}

beforeEach(() => {
  resetDataForTests()
  updateProfile({ name: 'Ayush', upiId: 'ayush@okicici' })
  const riya = addFriend({ name: 'Riya' }).id
  const sam = addFriend({ name: 'Sam' }).id
  const kabir = addFriend({ name: 'Kabir' }).id
  const e = saveExpense(
    draft({
      kind: 'bill',
      title: 'Toit Brewpub',
      total: 276600,
      date: '2026-10-18',
      mode: 'items',
      participants: everyone(ME_ID, riya, sam, kabir),
      bill: {
        meta: { merchant: 'Toit Brewpub', date: null, subtotal: null, tax: null, serviceCharge: null, discount: null, tip: null, total: 276600 },
        items: ITEMS.map((i) => ({ ...i })),
        assignments: {},
        warnings: [],
      },
    }),
  )
  round = createClaimRound(e.id)
})

afterEach(() => {
  cleanup()
  resetDataForTests()
})

describe('ClaimRoundScreen', () => {
  it('shows the share card and everyone waiting', async () => {
    open()
    expect(screen.getByRole('heading', { level: 1, name: 'Who had what?' })).toBeInTheDocument()
    expect(screen.getByText(/^Toit Brewpub · ₹2,766 · 18 Oct/)).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Share on WhatsApp' })).toHaveAttribute('href', expect.stringContaining('wa.me'))
    const people = screen.getByRole('list', { name: 'People' })
    expect(within(people).getByText('Pick what you had')).toBeInTheDocument()
    expect(within(people).getAllByText('Waiting for picks')).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Update the bill' })).toBeDisabled()
    expect(screen.getByText('Nothing new to add')).toBeInTheDocument()
    // The link it shares carries the bill.
    const link = claimLinkFromRound(round, (await import('../../data')).expensesStore.get()[0]!, Object.fromEntries(friendsStore.get().map((f) => [f.id, f])), profileStore.get())
    expect(link.p).toEqual(['Ayush', 'Riya', 'Sam', 'Kabir'])
  })

  it('shows statuses, takes decisions and updates the bill (spec 01 §4.2)', async () => {
    setOwnPicks(round.id, [
      { item: 0, num: 1, den: 2 },
      { item: 3, num: 1, den: 3 },
    ])
    send(1, 'Riya', [[1, 1, 2], [2, 1, 4], [4, 1, 1], [5, 1, 2]], 54950)
    send(2, 'Sam', [[0, 1, 2], [2, 2, 4], [3, 1, 3]], 79646)
    send(3, 'Kabir', [[1, 1, 2], [2, 1, 4], [3, 2, 3]], 104960)
    round = (await import('../../data')).claimsStore.get()[0]!
    const user = open()

    const people = screen.getByRole('list', { name: 'People' })
    expect(within(people).getByText('2 items · ₹648.28')).toBeInTheDocument()
    expect(within(people).getByText('4 items · ₹549.50')).toBeInTheDocument()
    expect(within(people).getAllByText('Paid')).toHaveLength(3)

    expect(screen.getByText('4 sorted · 2 to check')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Kingfisher Beer.*Claimed 4 of 3.*needs you/ })).toBeInTheDocument()
    expect(screen.getByText(/You 1 · Sam 1 · Kabir 2 \(of 3\)/)).toBeInTheDocument()
    expect(screen.getByText('2 items still open — they stay shared by everyone until you decide')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Kingfisher Beer.*Claimed 4 of 3.*needs you/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Kingfisher Beer — 4 of 3 claimed' })
    expect(within(sheet).getByText('You 1 · Sam 1 · Kabir 2 shares of ₹900')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: /Split it as claimed/ }))
    expect(await screen.findByRole('button', { name: /Kingfisher Beer.*Decided.*Split as claimed/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Gulab Jamun.*½ unclaimed.*needs you/ }))
    const partial = await screen.findByRole('dialog', { name: 'Gulab Jamun — ½ unclaimed' })
    await user.click(within(partial).getByRole('button', { name: /Riya had all of it/ }))

    await user.click(screen.getByRole('button', { name: 'Update the bill' }))
    const done = await screen.findByRole('dialog', { name: 'Bill updated' })
    expect(within(done).getByText('Riya paid ₹549.50 · share now ₹642.11 · ₹92.61 to go')).toBeInTheDocument()
    expect(within(done).getByText('Sam paid ₹796.46 · share now ₹703.85 · you owe ₹92.61 back')).toBeInTheDocument()
    expect(within(done).getByText('Kabir paid ₹1,049.60 · share now ₹864.37 · you owe ₹185.23 back')).toBeInTheDocument()
    expect(within(done).getAllByRole('button', { name: 'Pay back' })).toHaveLength(2)
  })

  it('says when the round isn’t on this phone', () => {
    round = { ...round, id: 'nope' }
    open()
    expect(screen.getByRole('heading', { name: 'These claims aren’t on this phone' })).toBeInTheDocument()
  })
})
