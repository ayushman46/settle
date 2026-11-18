import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components'
import { announceNotified, keyBytes, type PayRequest } from './payRequests'
import { PayRequestsCard } from './PayRequestsCard'

const calls: Array<{ method: string; path: string; body?: unknown }> = []
let requests: PayRequest[] = []
let signedIn = true

vi.mock('./api', () => ({
  cloud: vi.fn(async (method: string, path: string, body?: unknown) => {
    calls.push({ method, path, body })
    if (path === '/requests') return { ok: true, data: { requests } }
    if (path.startsWith('/requests/')) {
      requests = requests.filter((r) => !path.includes(r.id))
      return { ok: true, data: { ok: true } }
    }
    return { ok: true, data: { key: null } }
  }),
}))

vi.mock('./store', () => ({
  useAccountPeek: () => (signedIn ? { status: 'signedIn', me: { id: 'u1' }, message: null } : { status: 'signedOut', me: null, message: null }),
}))

const dinner: PayRequest = {
  id: '11111111-1111-4111-8111-111111111111',
  fromName: 'Ayush',
  title: 'Dinner',
  amount: 80000,
  currency: 'INR',
  createdAt: '2026-11-18T12:00:00Z',
  upiId: 'ayush@okaxis',
  upiUri: 'upi://pay?pa=ayush%40okaxis&pn=Ayush&am=800.00&cu=INR&tn=Settle%20Dinner',
}

const show = () =>
  render(
    <ToastProvider>
      <PayRequestsCard />
    </ToastProvider>,
  )

beforeEach(() => {
  calls.length = 0
  requests = [dinner]
  signedIn = true
})

describe('PayRequestsCard', () => {
  it('shows what a friend on Settle asked for, with Pay opening the UPI app for the amount', async () => {
    show()
    const section = await screen.findByRole('region', { name: 'Asked to pay' })
    expect(within(section).getByText('Ayush split Dinner with you')).toBeInTheDocument()
    expect(within(section).getByText('To ayush@okaxis')).toBeInTheDocument()
    expect(within(section).getByRole('link', { name: 'Pay ₹800' })).toHaveAttribute('href', dinner.upiUri)
  })

  it('marks it paid and takes it off the list', async () => {
    show()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'I’ve paid' }))
    expect(calls.some((c) => c.method === 'POST' && c.path === `/requests/${dinner.id}/paid`)).toBe(true)
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Asked to pay' })).not.toBeInTheDocument())
    expect(await screen.findByText('Marked as paid. Ayush will tick it off.')).toBeInTheDocument()
  })

  it('says how to pay when the friend has no UPI ID', async () => {
    requests = [{ ...dinner, upiId: null, upiUri: null }]
    show()
    expect(await screen.findByText(/Ayush hasn’t added a UPI ID to Settle yet/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Pay/ })).not.toBeInTheDocument()
  })

  it('is nothing when signed out or with nothing waiting', async () => {
    requests = []
    const { container } = show()
    await waitFor(() => expect(calls.some((c) => c.path === '/requests')).toBe(true))
    expect(container).toBeEmptyDOMElement()
    signedIn = false
    calls.length = 0
    show()
    expect(calls).toHaveLength(0)
  })

  it('tells the person splitting that friends on Settle were asked', async () => {
    requests = []
    show()
    act(() => announceNotified(2))
    expect(await screen.findByText('2 of them are on Settle, so they’ve been asked to pay too')).toBeInTheDocument()
  })
})

describe('keyBytes', () => {
  it('reads a base64url key', () => {
    expect(Array.from(keyBytes('AQID_w'))).toEqual([1, 2, 3, 255])
  })
})
