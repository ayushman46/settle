import { screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useLocation, useRoute } from '../../app/router'
import { expensesStore } from '../../data'
import { ME_ID } from '../../domain/types'
import { encodePaidReply, type PaidReplyPayload } from '../../share/paidReply'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { seedExpense, seedPeople } from '../split/testing'
import { ExpenseDetailScreen } from './ExpenseDetailScreen'
import { PaidReplyScreen } from './PaidReplyScreen'

const ROUTES = ['/app/paid', '/app/expense/:id'] as const

function TestApp() {
  const { pattern } = useRoute(ROUTES)
  const { path } = useLocation()
  if (pattern === '/app/paid') return <PaidReplyScreen />
  if (pattern === '/app/expense/:id') return <ExpenseDetailScreen key={path} />
  return <p data-testid="elsewhere">{path}</p>
}

function reply(extra: Partial<PaidReplyPayload> = {}): PaidReplyPayload {
  return { v: 1, k: 'paid', e: 'e1', i: 2, n: 'Sam', a: 69_150, c: 'INR', t: 'Dinner at Toit', h: 'upi', ...extra }
}

async function openReply(r: PaidReplyPayload) {
  const url = await encodePaidReply(r, 'https://settle.example')
  return renderAt(`/app/paid${url.slice(url.indexOf('#'))}`, <TestApp />)
}

beforeEach(() => {
  resetProScreens()
  seedPeople()
})

afterEach(() => {
  resetProScreens()
})

describe('PaidReplyScreen', () => {
  it('ticks off the friend who says they paid, with the UPI reference to check', async () => {
    seedExpense()
    const { user } = await openReply(reply({ r: '432156789012' }))
    expect(await screen.findByRole('heading', { name: 'Sam says they’ve paid ₹691.50' })).toBeInTheDocument()
    expect(screen.getByText('For Dinner at Toit')).toBeInTheDocument()
    expect(screen.getByText(/By UPI · ref 4321 5678 9012/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mark Sam as paid' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/expense/e1'))
    expect(expensesStore.get()[0]?.paidBack.sam).toEqual(expect.any(Number))
    expect(await screen.findByText('Sam is marked as paid')).toBeInTheDocument()
  })

  it('takes cash too, and says when the amount isn’t their share', async () => {
    seedExpense()
    await openReply(reply({ h: 'cash', a: 50_000 }))
    expect(await screen.findByRole('heading', { name: 'Sam says they’ve paid ₹500' })).toBeInTheDocument()
    expect(screen.getByText('In cash — tick them off once you have it.')).toBeInTheDocument()
    expect(screen.getByText('Their share is ₹691.50.')).toBeInTheDocument()
  })

  it('"Not yet" opens the split without ticking anyone', async () => {
    seedExpense()
    const { user } = await openReply(reply())
    await user.click(await screen.findByRole('button', { name: 'Not yet' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/expense/e1'))
    expect(expensesStore.get()[0]?.paidBack.sam).toBeUndefined()
  })

  it('finds them by name when the split changed since the link went out', async () => {
    seedExpense({ participants: [ME_ID, 'sam', 'riya', 'neha'].map((friendId) => ({ friendId, input: null })) })
    await openReply(reply({ i: 3 }))
    expect(await screen.findByRole('button', { name: 'Mark Sam as paid' })).toBeInTheDocument()
  })

  it('says so when they are already ticked off', async () => {
    seedExpense({ paidBack: { riya: 1, sam: 2 } })
    await openReply(reply())
    expect(await screen.findByRole('heading', { name: 'Sam is already marked as paid' })).toBeInTheDocument()
  })

  it('says so when the split is not on this phone, and offers to copy the link', async () => {
    await openReply(reply())
    expect(await screen.findByRole('heading', { name: 'This split isn’t on this phone' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy this link' })).toBeInTheDocument()
  })

  it('never ticks off the payer, or someone who is not in the split', async () => {
    seedExpense()
    await openReply(reply({ i: 0, n: 'Ayush' }))
    expect(await screen.findByRole('heading', { name: 'Who’s this from?' })).toBeInTheDocument()
  })

  it('says a broken reply is broken', async () => {
    renderAt('/app/paid#j.not-json', <TestApp />)
    expect(await screen.findByRole('heading', { name: 'This reply looks garbled' })).toBeInTheDocument()
  })
})
