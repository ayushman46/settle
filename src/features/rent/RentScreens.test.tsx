import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, updateProfile } from '../../data'
import { ME_ID } from '../../domain/types'
import type * as ShareLib from '../../lib/share'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { RentDetailScreen } from './RentDetailScreen'
import { RentEditorScreen } from './RentEditorScreen'
import { RentListScreen } from './RentListScreen'
import { RentReceiptsScreen } from './RentReceiptsScreen'
import { rentStore, saveRent, type RentInput } from './store'

const share = vi.hoisted(() => ({ shareResult: vi.fn(async (_text: string, _opts?: unknown) => 'copied' as const) }))
vi.mock('../../lib/share', async (importOriginal) => ({ ...(await importOriginal<typeof ShareLib>()), shareResult: share.shareResult }))

vi.setConfig({ testTimeout: 30_000 })

let riya: string
let sam: string

function flat(extra: Partial<RentInput> = {}): RentInput {
  return {
    name: 'Flat 302, Koramangala',
    address: '302, Sunrise Apartments, Koramangala, Bengaluru 560095',
    landlordName: 'Ramesh Kumar',
    landlordUpi: 'ramesh.kumar@okhdfcbank',
    landlordPan: 'ABCDE1234F',
    monthly: 42_000_00,
    dueDay: 5,
    mode: 'upi',
    tenants: [
      { friendId: ME_ID, share: 16_000_00 },
      { friendId: riya, share: 13_000_00 },
      { friendId: sam, share: 13_000_00 },
    ],
    ...extra,
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 12))
  resetProScreens()
  rentStore.set([])
  updateProfile({ name: 'Ayush' })
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
  share.shareResult.mockClear()
})

afterEach(() => {
  rentStore.set([])
  vi.useRealTimers()
})

describe('RentListScreen', () => {
  it('explains the feature before the first rent, and starts one', async () => {
    const { user } = renderAt('/app/rent', <RentListScreen />)
    expect(screen.getByRole('heading', { name: 'Rent, split right' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Set up your rent' }))
    expect(currentUrl()).toBe('/app/rent/new')
  })

  it('lists the rents with what they cost a month', () => {
    saveRent(flat())
    renderAt('/app/rent', <RentListScreen />)
    expect(screen.getByRole('button', { name: /Flat 302, Koramangala/ })).toHaveTextContent('₹42,000 a month · 3 flatmates')
  })
})

describe('RentEditorScreen', () => {
  it('splits the rent equally, takes custom shares only when they add up, and saves', async () => {
    const { user } = renderAt('/app/rent/new', <RentEditorScreen />)
    await user.type(screen.getByRole('textbox', { name: 'What do you call the flat?' }), 'Flat 302')
    await user.type(screen.getByRole('textbox', { name: 'Rent a month' }), '42000')
    await user.click(screen.getByRole('checkbox', { name: /^Riya/ }))
    await user.click(screen.getByRole('checkbox', { name: /^Sam/ }))
    expect(screen.getByRole('textbox', { name: 'Your share' })).toHaveValue('14,000')
    expect(screen.getByText('Adds up to the rent ✓')).toBeInTheDocument()

    const mine = screen.getByRole('textbox', { name: 'Your share' })
    await user.clear(mine)
    await user.type(mine, '16000')
    expect(screen.getByText('₹2,000 more than the rent')).toBeInTheDocument()
    for (const name of ['Riya’s share', 'Sam’s share']) {
      const field = screen.getByRole('textbox', { name })
      await user.clear(field)
      await user.type(field, '13000')
    }
    expect(screen.getByText('Adds up to the rent ✓')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save rent' }))
    expect(screen.getByText('Add the landlord’s name.')).toBeInTheDocument()
    expect(rentStore.get()).toEqual([])

    await user.type(screen.getByRole('textbox', { name: 'Landlord’s name' }), 'Ramesh Kumar')
    await user.type(screen.getByRole('textbox', { name: 'Landlord’s UPI ID (optional)' }), 'ramesh.kumar@okhdfcbank')
    expect(screen.getByText('Needed: your rent is more than ₹1,00,000 a year.')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Landlord’s PAN (optional)' }), 'abcde1234f')
    await user.click(screen.getByRole('button', { name: 'Save rent' }))

    const [saved] = rentStore.get()
    expect(saved).toMatchObject({ name: 'Flat 302', monthly: 42_000_00, landlordPan: 'ABCDE1234F', landlordUpi: 'ramesh.kumar@okhdfcbank', dueDay: 5, mode: 'upi' })
    expect(saved?.tenants).toEqual([
      { friendId: ME_ID, share: 16_000_00 },
      { friendId: riya, share: 13_000_00 },
      { friendId: sam, share: 13_000_00 },
    ])
    expect(currentUrl()).toBe(`/app/rent/${saved?.id}`)
  })
})

describe('RentDetailScreen', () => {
  it('sends one rent link in which the landlord collects each share', async () => {
    const rent = saveRent(flat())
    const { user } = renderAt(`/app/rent/${rent.id}`, <RentDetailScreen />)
    expect(screen.getByText('Rent for November 2026')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Send rent link' }))
    await waitFor(() => expect(share.shareResult).toHaveBeenCalledTimes(1))
    const [text] = share.shareResult.mock.calls[0] ?? ['']
    expect(text).toContain('Rent for November 2026 — tap your name and pay Ramesh Kumar your share directly')
    expect(text).toMatch(/\/pay#\S{20,}/)
    expect(await screen.findByText('Link copied — paste it in the flat group')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByText('Rent for October 2026')).toBeInTheDocument()
  })

  it('pays your own share to the landlord by UPI ID (rent is over ₹2,000)', async () => {
    const rent = saveRent(flat())
    const { user } = renderAt(`/app/rent/${rent.id}`, <RentDetailScreen />)
    await user.click(screen.getByRole('button', { name: 'Pay my share · ₹16,000' }))
    const sheet = await screen.findByRole('dialog', { name: 'Pay Ramesh Kumar' })
    expect(within(sheet).getByText('ramesh.kumar@okhdfcbank')).toBeInTheDocument()
    expect(within(sheet).getByText('Enter ₹16,000')).toBeInTheDocument()
    expect(within(sheet).getByText(/For more than ₹2,000 to a person/)).toBeInTheDocument()
    expect(sheet.querySelector('a[href^="upi:"], a[href^="intent:"]')).toBeNull()
    // Close it as a person would, so its history entry is settled before the next test.
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Pay Ramesh Kumar' })).not.toBeInTheDocument())
  })

  it('asks for the landlord’s UPI ID before offering links', () => {
    const rent = saveRent(flat({ landlordUpi: null }))
    renderAt(`/app/rent/${rent.id}`, <RentDetailScreen />)
    expect(screen.getByText('Add Ramesh Kumar’s UPI ID')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send rent link' })).not.toBeInTheDocument()
  })
})

describe('RentReceiptsScreen', () => {
  it('makes a receipt a month for the financial year, for your share, ready to sign', () => {
    const rent = saveRent(flat())
    renderAt(`/app/rent/${rent.id}/receipts`, <RentReceiptsScreen />)
    const receipts = screen.getAllByRole('article')
    expect(receipts).toHaveLength(12)
    expect(screen.getByText('12 receipts · ₹1,92,000 in all')).toBeInTheDocument()
    expect(receipts[0]).toHaveTextContent(
      'Received with thanks from Ayush the sum of ₹16,000.00 (Rupees Sixteen Thousand Only) towards the rent of 302, Sunrise Apartments, Koramangala, Bengaluru 560095 for the period April 2026, paid by UPI.',
    )
    expect(receipts[0]).toHaveTextContent('PAN of landlord: ABCDE1234F')
    expect(receipts[0]).toHaveTextContent('Date: 05/04/2026')
    expect(receipts[11]).toHaveTextContent('March 2027')
    expect(screen.queryByText(/Your employer will need/)).not.toBeInTheDocument()
  })

  it('groups by quarter, switches flatmate, stamps cash and warns about a missing PAN', async () => {
    const rent = saveRent(flat({ landlordPan: null }))
    const { user } = renderAt(`/app/rent/${rent.id}/receipts`, <RentReceiptsScreen />)
    expect(screen.getByText('Your employer will need Ramesh Kumar’s PAN')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'a quarter' }))
    expect(screen.getAllByRole('article')).toHaveLength(4)
    await user.click(screen.getByRole('radio', { name: 'Riya' }))
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('Riya the sum of ₹39,000.00 (Rupees Thirty-Nine Thousand Only)')
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('April 2026 – June 2026')
    await user.click(screen.getByRole('radio', { name: 'Cash' }))
    expect(screen.getByText('Add a ₹1 revenue stamp')).toBeInTheDocument()
    expect(screen.getAllByText('Revenue stamp ₹1')).toHaveLength(4)
  })

  it('prints, and remembers the name typed for the receipts', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)
    const rent = saveRent(flat())
    const { user } = renderAt(`/app/rent/${rent.id}/receipts`, <RentReceiptsScreen />)
    const name = screen.getByRole('textbox', { name: 'Name on the receipts' })
    await user.clear(name)
    await user.type(name, 'Ayush Kumar Singh')
    await user.click(screen.getByRole('button', { name: 'Print or save as PDF' }))
    expect(print).toHaveBeenCalledTimes(1)
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('Received with thanks from Ayush Kumar Singh')
    expect(rentStore.get()[0]?.tenants[0]).toEqual({ friendId: ME_ID, share: 16_000_00, legalName: 'Ayush Kumar Singh' })
    vi.unstubAllGlobals()
  })
})
