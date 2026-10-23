import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetNavForTests, useLocation } from '../../app/router'
import { ToastProvider } from '../../components'
import { addFriend, claimsStore, expensesStore, resetDataForTests, saveExpense } from '../../data'
import { createClaimRound } from '../../data/claims'
import { draft, everyone } from '../../data/testKit'
import { ME_ID, type ClaimRound } from '../../domain/types'
import { encodeClaimReply, signReply, type ClaimReplyPayload } from '../../share/claim'
import { ClaimReplyScreen } from './ClaimReplyScreen'

// Whole screens with sheets and async link codecs: slow phones (and busy CI) need more than 5 s.
vi.setConfig({ testTimeout: 30_000 })

let riya: string
let round: ClaimRound

function Harness() {
  const { path } = useLocation()
  return (
    <ToastProvider>
      <output data-testid="path">{path}</output>
      {path === '/app/claims/in' && <ClaimReplyScreen />}
    </ToastProvider>
  )
}

function reply(extra: Partial<ClaimReplyPayload> = {}): ClaimReplyPayload {
  const { m: _m, ...body } = {
    v: 1 as const,
    k: 'reply' as const,
    r: round.id,
    h: round.itemsHash,
    w: 1,
    n: 'Riya',
    x: [[0, 1, 2]] as Array<[number, number, number]>,
    pd: 30000,
    at: 1792748400,
    m: '',
    ...extra,
  }
  return signReply(round.secret, body)
}

async function open(payload: ClaimReplyPayload | string) {
  const url = typeof payload === 'string' ? payload : await encodeClaimReply(payload, '')
  window.history.replaceState(null, '', url.startsWith('/') ? url : `/app/claims/in${url}`)
  resetNavForTests()
  const user = userEvent.setup()
  render(<Harness />)
  return user
}

beforeEach(() => {
  resetDataForTests()
  riya = addFriend({ name: 'Riya' }).id
  const e = saveExpense(
    draft({
      kind: 'bill',
      title: 'Toit Brewpub',
      total: 60000,
      mode: 'items',
      participants: everyone(ME_ID, riya),
      bill: {
        meta: { merchant: 'Toit Brewpub', date: null, subtotal: null, tax: null, serviceCharge: null, discount: null, tip: null, total: 60000 },
        items: [
          { id: 'a', name: 'Paneer Tikka', amount: 40000, quantity: 1 },
          { id: 'b', name: 'Naan', amount: 20000, quantity: 4 },
        ],
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

describe('ClaimReplyScreen', () => {
  it('shows a new reply and adds it to the round', async () => {
    const user = await open(reply())
    expect(await screen.findByRole('heading', { name: 'Riya’s picks' })).toBeInTheDocument()
    expect(screen.getByText('Paneer Tikka (shared by 2)')).toBeInTheDocument()
    expect(screen.getByText('Says they’ve paid ₹300')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add to the bill' }))
    expect(screen.getByTestId('path')).toHaveTextContent(`/app/claims/${round.id}`)
    expect(claimsStore.get()[0]!.replies).toHaveLength(1)
    // Nothing changes in the bill until "Update the bill".
    expect(expensesStore.get()[0]!.bill!.assignments).toEqual({})
  })

  it('says when it was already added', async () => {
    const r = reply()
    const { addClaimReply } = await import('../../data/claims')
    addClaimReply(r)
    await open(r)
    expect(await screen.findByRole('heading', { name: 'Already added' })).toBeInTheDocument()
    expect(screen.getByText('Nothing new from Riya.')).toBeInTheDocument()
  })

  it('asks before using newer picks', async () => {
    const { addClaimReply } = await import('../../data/claims')
    addClaimReply(reply())
    const user = await open(reply({ at: 1792748500, x: [[0, 1, 1]] }))
    expect(await screen.findByRole('heading', { name: 'Riya changed their picks' })).toBeInTheDocument()
    expect(screen.getByText('₹200 → ₹400')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Use the new picks' }))
    expect(claimsStore.get()[0]!.replies.map((r) => r.state)).toEqual(['replaced', 'active'])
  })

  it('says an older reply is older', async () => {
    const { addClaimReply } = await import('../../data/claims')
    addClaimReply(reply())
    await open(reply({ at: 1792748300 }))
    expect(await screen.findByRole('heading', { name: 'This is an older reply' })).toBeInTheDocument()
  })

  it('refuses a reply changed by hand', async () => {
    await open({ ...reply(), pd: 1 })
    expect(await screen.findByRole('heading', { name: 'This reply doesn’t look right' })).toBeInTheDocument()
    expect(screen.getByText('It may have been cut short or changed. Ask Riya to send it again.')).toBeInTheDocument()
  })

  it('refuses a garbled link', async () => {
    await open('/app/claims/in#AAAAgarbled')
    expect(await screen.findByRole('heading', { name: 'This reply doesn’t look right' })).toBeInTheDocument()
  })

  it('knows a reply for another phone', async () => {
    await open(reply({ r: 'Zzzzzzzzzz' }))
    expect(await screen.findByRole('heading', { name: 'This reply isn’t for a bill on this phone' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument()
  })

  it('knows the bill was deleted', async () => {
    const r = reply()
    expensesStore.set([])
    const user = await open(r)
    expect(await screen.findByRole('heading', { name: 'This bill was deleted' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Go Home' }))
    expect(claimsStore.get()).toEqual([])
  })

  it('adds a new name to your people', async () => {
    const user = await open(reply({ w: null, n: 'Priya' }))
    expect(await screen.findByText('Priya isn’t in your people yet — they’ll be added.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add to the bill' }))
    expect(claimsStore.get()[0]!.replies[0]!.name).toBe('Priya')
  })

  it('matches a typed name to someone you know', async () => {
    await open(reply({ w: null, n: 'riya' }))
    expect(await screen.findByText('Added to Riya')).toBeInTheDocument()
  })
})
