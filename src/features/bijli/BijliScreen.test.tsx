import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, expensesStore, updateProfile } from '../../data'
import { ME_ID } from '../../domain/types'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { rentStore, saveRent } from '../rent/store'
import { BijliScreen } from './BijliScreen'

vi.setConfig({ testTimeout: 30_000 })

let riya: string
let sam: string
let rentId: string

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 27, 12))
  resetProScreens()
  rentStore.set([])
  updateProfile({ name: 'Ayush' })
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
  rentId = saveRent({
    name: 'Flat 4B, Lajpat Nagar',
    address: '',
    landlordName: 'Mr Khanna',
    landlordUpi: null,
    landlordPan: null,
    monthly: 45_000_00,
    dueDay: 5,
    mode: 'upi',
    tenants: [
      { friendId: ME_ID, share: 15_000_00 },
      { friendId: riya, share: 15_000_00 },
      { friendId: sam, share: 15_000_00 },
    ],
  }).id
})

afterEach(() => {
  rentStore.set([])
  vi.useRealTimers()
})

describe('BijliScreen', () => {
  it('splits a Delhi bill fairly: the AC user pays their units and the subsidy the flat lost', async () => {
    const { user } = renderAt(`/app/bijli?rent=${rentId}`, <BijliScreen />)
    expect(screen.getByRole('heading', { level: 1, name: 'Split the electricity bill fairly' })).toBeInTheDocument()
    // The flat's people are already in.
    for (const name of ['Riya', 'Sam']) expect(screen.getByRole('group', { name: `AC nights for ${name}` })).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'Units on the bill' }), '450')
    await user.type(screen.getByRole('textbox', { name: /^Amount on the bill/ }), '2592.19')
    await user.click(screen.getByRole('button', { name: 'Increase your AC nights' }))
    await user.keyboard('{ArrowUp>29/}')
    expect(within(screen.getByRole('group', { name: 'Your AC nights' })).getByText('30')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Everyday units for the flat' }), '270')

    const result = screen.getByRole('region', { name: 'The fair split' })
    const rows = within(result).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('₹2,193.65')
    expect(rows[0]).toHaveTextContent('Everyday ₹199.27 · AC units ₹1,194.38 · Subsidy lost ₹800')
    expect(rows[0]).toHaveTextContent('₹1,329.58 more than an equal split')
    expect(rows[1]).toHaveTextContent('₹199.27')
    expect(rows[1]).toHaveTextContent('₹664.79 less than an equal split')
    expect(within(result).getByText('Without the extra units, the bill would have been about ₹597.81.')).toBeInTheDocument()
    expect(within(result).getByText('Matched to the bill: ₹2,592.19')).toBeInTheDocument()

    // House rule: share the lost subsidy.
    await user.click(within(result).getByRole('radio', { name: 'Everyone, by days home' }))
    expect(within(result).getAllByRole('listitem')[1]).toHaveTextContent(/₹465\.9[34]/)

    await user.click(screen.getByRole('button', { name: 'Save split' }))
    expect(currentUrl()).toMatch(/^\/app\/expense\//)
    const saved = expensesStore.get().at(-1)
    expect(saved).toMatchObject({ title: 'Electricity · October', category: 'utilities', total: 259219, mode: 'exact', payerId: ME_ID })
    expect(Object.values(saved?.shares ?? {}).reduce((a, b) => a + b, 0)).toBe(259219)
    expect(saved?.note).toContain('Split fairly with Settle: BSES Rajdhani, BSES Yamuna or Tata Power-DDL, 450 units, AC nights.')
  })

  it('Bengaluru has one rate for every unit: a fair split is paying for your units', async () => {
    const { user } = renderAt(`/app/bijli?rent=${rentId}`, <BijliScreen />)
    await user.click(screen.getByRole('button', { name: /Electricity company/ }))
    await user.click(await screen.findByRole('radio', { name: /^BESCOM/ }))
    await user.type(screen.getByRole('textbox', { name: 'Units on the bill' }), '300')
    await user.type(screen.getByRole('textbox', { name: /^Amount on the bill/ }), '2295')
    await user.click(screen.getByRole('radio', { name: 'Equally by days' }))
    expect(screen.getByText('BESCOM charges every unit the same, so everyone pays for their own units.')).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: /Delhi subsidy/ })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Gruha Jyothi free units' })).toBeInTheDocument()
  })

  it('asks for the bill and two people before saving', async () => {
    const { user } = renderAt('/app/bijli', <BijliScreen />)
    await user.click(screen.getByRole('button', { name: 'Save split' }))
    expect(screen.getByText('Add at least two people who live here.')).toBeInTheDocument()
    expect(currentUrl()).toBe('/app/bijli')
  })
})
