import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, expensesStore, saveExpense, updateProfile } from '../../data'
import { saveLoan } from '../../data/loans'
import { draft, everyone } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import { currentUrl, renderApp, resetScreens, type ScreenTable } from '../groups/testKit'
import { LendScreen } from './LendScreen'

vi.mock('./enabled', () => ({ LEND_ENABLED: true }))
vi.setConfig({ testTimeout: 20_000 })

const SCREENS: ScreenTable = { '/app/lend/:id/edit': LendScreen, '/app/lend': LendScreen }

let riya: string
let sam: string

beforeEach(() => {
  resetScreens()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 22, 12))
  updateProfile({ name: 'Ayush', currency: 'INR' })
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
})

afterEach(() => {
  vi.useRealTimers()
  resetScreens()
})

const amountField = () => screen.getByLabelText('Amount')
const saveButton = () => screen.getByRole('button', { name: 'Save' })

describe('LendScreen', () => {
  it('saves in two taps: a face, then the amount and Enter', async () => {
    const { user } = renderApp('/app/lend', SCREENS)
    expect(screen.getByRole('heading', { level: 1, name: 'Lend or borrow' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'I gave' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Pick who')).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
    const who = screen.getByRole('radiogroup', { name: 'Who?' })
    expect(within(who).queryByRole('radio', { name: 'You' })).not.toBeInTheDocument()

    await user.click(within(who).getByRole('radio', { name: 'Riya' }))
    await waitFor(() => expect(amountField()).toHaveFocus())
    expect(screen.getByText('Enter an amount')).toBeInTheDocument()
    await user.type(amountField(), '500')
    expect(screen.getByText('Riya will owe you ₹500')).toBeInTheDocument()
    await user.keyboard('{Enter}')

    const burst = await screen.findByRole('dialog', { name: 'Noted!' })
    expect(within(burst).getByText('Riya owes you ₹500')).toBeInTheDocument()
    const [saved] = expensesStore.get()
    expect(saved).toMatchObject({ kind: 'loan', title: 'Cash', category: 'other', payerId: ME_ID, shares: { [riya]: 50000 }, date: '2026-10-22' })
  })

  it('records what someone paid for you, with the chip’s category', async () => {
    const { user } = renderApp('/app/lend', SCREENS)
    await user.click(screen.getByRole('radio', { name: 'I got' }))
    await user.click(screen.getByRole('radio', { name: 'Sam' }))
    await user.type(amountField(), '120')
    await user.click(screen.getByRole('radio', { name: 'Auto' }))
    expect(screen.getByText("You'll owe Sam ₹120")).toBeInTheDocument()
    await user.click(saveButton())
    await screen.findByRole('dialog', { name: 'Noted!' })
    expect(expensesStore.get()[0]).toMatchObject({ kind: 'split', title: 'Auto', category: 'transport', payerId: sam, shares: { [ME_ID]: 12000 } })
  })

  it('prefills from a deep link', () => {
    renderApp(`/app/lend?dir=borrowed&friend=${sam}&amount=12000&what=auto`, SCREENS)
    expect(screen.getByRole('radio', { name: 'I got' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Sam' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Auto' })).toHaveAttribute('aria-checked', 'true')
    expect(amountField()).toHaveValue('120')
    expect(screen.getByText("You'll owe Sam ₹120")).toBeInTheDocument()
  })

  it('ignores a deep link to yourself or nobody, and a bad amount', () => {
    renderApp(`/app/lend?friend=${ME_ID}&amount=-5&what=gold`, SCREENS)
    expect(screen.getByRole('radio', { name: 'I gave' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Cash' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('Pick who')).toBeInTheDocument()
    expect(amountField()).toHaveValue('')
  })

  it('needs a title for "Other"', async () => {
    const { user } = renderApp(`/app/lend?friend=${riya}&amount=50000`, SCREENS)
    await user.click(screen.getByRole('radio', { name: 'Other' }))
    expect(screen.getByText('Say what it was')).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
    await user.type(screen.getByLabelText('What was it?'), 'Movie tickets')
    expect(saveButton()).toBeEnabled()
    await user.click(saveButton())
    await screen.findByRole('dialog', { name: 'Noted!' })
    expect(expensesStore.get()[0]).toMatchObject({ kind: 'split', title: 'Movie tickets', category: 'other' })
  })

  it('adds someone new from "Someone else"', async () => {
    const { user } = renderApp('/app/lend', SCREENS)
    await user.click(screen.getByRole('radio', { name: 'Someone else' }))
    const sheet = await screen.findByRole('dialog', { name: 'Someone else' })
    await user.type(within(sheet).getByLabelText('Search or add a person'), 'Kabir{Enter}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Someone else' })).not.toBeInTheDocument())
    expect(screen.getByRole('radio', { name: 'Kabir' })).toHaveAttribute('aria-checked', 'true')
  })

  it('edits a saved entry, and can flip its direction', async () => {
    const loan = saveLoan({ direction: 'lent', friendId: riya, amount: 50000, currency: 'INR', what: 'cash', date: '2026-10-21' })
    const { user } = renderApp(`/app/lend/${loan.id}/edit`, SCREENS)
    expect(screen.getByRole('heading', { level: 1, name: 'Edit udhaar' })).toBeInTheDocument()
    expect(amountField()).toHaveValue('500')
    expect(screen.getByRole('radio', { name: 'Riya' })).toHaveAttribute('aria-checked', 'true')
    await user.click(screen.getByRole('radio', { name: 'I got' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(expensesStore.get()).toHaveLength(1)
    expect(expensesStore.get()[0]).toMatchObject({ id: loan.id, payerId: riya, shares: { [ME_ID]: 50000 }, kind: 'loan', date: '2026-10-21' })
  })

  it('sends anything that isn’t 1:1 to the split editor', async () => {
    const dinner = saveExpense(draft({ with: [riya, sam] }))
    renderApp(`/app/lend/${dinner.id}/edit`, SCREENS)
    await waitFor(() => expect(currentUrl()).toBe(`/app/split/${dinner.id}/edit`))
    const other = saveExpense(draft({ payerId: sam, participants: everyone(riya) }))
    renderApp(`/app/lend/${other.id}/edit`, SCREENS)
    await waitFor(() => expect(currentUrl()).toBe(`/app/split/${other.id}/edit`))
  })
})
