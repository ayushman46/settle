import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components'
import { addFriend, expensesStore, resetDataForTests, saveExpense, updateProfile, useExpense } from '../../data'
import { saveLoan } from '../../data/loans'
import { draft } from '../../data/testKit'
import { ME_ID } from '../../domain/types'
import { LoanCard } from './LoanCard'

vi.setConfig({ testTimeout: 20_000 })

let riya: string
let kabir: string

function Live({ id }: { id: string }) {
  const expense = useExpense(id)
  return expense ? <LoanCard expense={expense} /> : null
}

function renderCard(id: string) {
  const user = userEvent.setup()
  render(
    <ToastProvider>
      <Live id={id} />
    </ToastProvider>,
  )
  return user
}

beforeEach(() => {
  resetDataForTests()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 22, 12))
  updateProfile({ name: 'Ayush', currency: 'INR', upiId: 'ayush@okaxis' })
  riya = addFriend({ name: 'Riya' }).id
  kabir = addFriend({ name: 'Kabir' }).id
})

afterEach(() => {
  vi.useRealTimers()
  resetDataForTests()
})

const lendRiya = () => saveLoan({ direction: 'lent', friendId: riya, amount: 50000, currency: 'INR', what: 'cash', date: '2026-10-21' })

describe('LoanCard', () => {
  it('says what was lent and what is still to come; all back, with undo', async () => {
    const loan = lendRiya()
    const user = renderCard(loan.id)
    expect(screen.getByRole('heading', { name: 'Cash · You lent Riya ₹500 on 21 Oct' })).toBeInTheDocument()
    expect(screen.getByText('₹500 still to come')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Got it all back from Riya' }))
    expect(await screen.findByText("Riya's ₹500 is back")).toBeInTheDocument()
    expect(screen.getByText('Settled on 22 Oct ✓')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Got some back from Riya' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    await waitFor(() => expect(screen.getByText('₹500 still to come')).toBeInTheDocument())
    expect(expensesStore.get()[0]?.paidBack).toEqual({})
  })

  it('takes some back, keeps the rest open, and undoes both records', async () => {
    const loan = lendRiya()
    const user = renderCard(loan.id)
    await user.click(screen.getByRole('button', { name: 'Got some back from Riya' }))
    const sheet = await screen.findByRole('dialog', { name: 'How much did Riya return?' })
    const field = within(sheet).getByLabelText('Amount returned')
    await user.type(field, '500')
    expect(within(sheet).getByText('For all ₹500, use “Got it all back”.')).toBeInTheDocument()
    await user.clear(field)
    await user.type(field, '200{Enter}')
    expect(await screen.findByText('₹200 back · ₹300 still to come')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('₹300 still to come')).toBeInTheDocument())
    expect(expensesStore.get()).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    await waitFor(() => expect(screen.getByText('₹500 still to come')).toBeInTheDocument())
    expect(expensesStore.get()).toHaveLength(1)
  })

  it('reminds Riya in udhaar words', async () => {
    const loan = lendRiya()
    const user = renderCard(loan.id)
    await user.click(screen.getByRole('button', { name: 'Remind Riya' }))
    const sheet = await screen.findByRole('dialog', { name: 'Nudge Riya' })
    await user.click(within(sheet).getByRole('radio', { name: /Firm/ }))
    expect(within(sheet).getByRole('figure', { name: 'Message to Riya' })).toHaveTextContent('Hi Riya, please return the ₹500 I lent you on 21 Oct.')
  })

  it('mirrors it for what you borrowed', async () => {
    const loan = saveLoan({ direction: 'borrowed', friendId: kabir, amount: 200000, currency: 'INR', what: 'cash', date: '2026-10-21' })
    const user = renderCard(loan.id)
    expect(screen.getByRole('heading', { name: 'Cash · Kabir lent you ₹2,000 on 21 Oct' })).toBeInTheDocument()
    expect(screen.getByText('₹2,000 still to pay back')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remind/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Paid Kabir some back' }))
    const sheet = await screen.findByRole('dialog', { name: 'How much did you pay back?' })
    await user.type(within(sheet).getByLabelText('Amount returned'), '500{Enter}')
    expect(await screen.findByText('₹500 paid back · ₹1,500 still to pay')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: "I've paid Kabir back" }))
    expect(await screen.findByText('₹1,500 paid back to Kabir')).toBeInTheDocument()
    expect(expensesStore.get().find((e) => e.id === loan.id)?.paidBack[ME_ID]).toBeTypeOf('number')
  })

  it('words 1:1 "paid for" entries, and stays away from everything else', () => {
    const auto = saveLoan({ direction: 'borrowed', friendId: riya, amount: 12000, currency: 'INR', what: 'auto', date: '2026-10-21' })
    const { unmount } = render(
      <ToastProvider>
        <Live id={auto.id} />
      </ToastProvider>,
    )
    expect(screen.getByRole('heading', { name: 'Auto · Riya paid ₹120 for you on 21 Oct' })).toBeInTheDocument()
    unmount()
    const dinner = saveExpense(draft({ with: [riya, kabir] }))
    const { container } = render(
      <ToastProvider>
        <Live id={dinner.id} />
      </ToastProvider>,
    )
    expect(container.querySelector('section')).toBeNull()
  })
})
