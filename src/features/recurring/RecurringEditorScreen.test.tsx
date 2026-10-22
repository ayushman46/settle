import { screen, waitFor, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addFriend, expensesStore, recurringStore, saveRecurring, updateProfile, type RecurringDraft } from '../../data'
import { ME_ID, type RecurringTemplate } from '../../domain/types'
import { currentUrl, DAY_SECONDS, installPro, renderAt, resetProScreens, serveBilling, testSigner } from '../pro/testing'
import { RecurringEditorScreen } from './RecurringEditorScreen'

const OCT_22 = new Date(2026, 9, 22, 12)
let riya: string
let sam: string

beforeEach(async () => {
  resetProScreens()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(OCT_22)
  await testSigner()
  serveBilling({ checkout: 'razorpay', keyId: 'rzp' })
  updateProfile({ currency: 'INR', name: 'Ayush' })
  riya = addFriend({ name: 'Riya' }).id
  sam = addFriend({ name: 'Sam' }).id
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  resetProScreens()
})

function seed(patch: Partial<RecurringDraft> = {}): RecurringTemplate {
  vi.setSystemTime(new Date(2026, 8, 1, 12))
  const saved = saveRecurring({
    title: 'Rent',
    category: 'rent',
    currency: 'INR',
    total: 3000000,
    payerId: ME_ID,
    mode: 'equal',
    participants: [ME_ID, riya, sam].map((friendId) => ({ friendId, input: null })),
    dayOfMonth: 25,
    groupId: null,
    active: true,
    ...patch,
  })
  vi.setSystemTime(OCT_22)
  return saved
}

function renderEditor(path: string) {
  return renderAt(path, <RecurringEditorScreen />)
}

async function pickPerson(user: UserEvent, name: string): Promise<void> {
  await user.type(screen.getByRole('textbox', { name: 'Search or add people' }), `${name}{Enter}`)
}

const saveButton = () => screen.getByRole('button', { name: /^Save (recurring split|changes)$/ })
const now = () => Math.floor(Date.now() / 1000)

describe('RecurringEditorScreen — new', () => {
  beforeEach(async () => {
    await installPro()
    serveBilling({ checkout: 'razorpay', keyId: 'rzp' })
  })

  it('sets up a recurring split end to end', async () => {
    const { user } = renderEditor('/app/recurring/new')
    expect(screen.getByRole('heading', { level: 1, name: 'New recurring split' })).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
    expect(screen.getByText('Enter an amount above zero.')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Amount each month'), '1179')
    await user.click(screen.getByLabelText("What's it for?"))
    await user.paste('Airtel wifi')
    expect(screen.getByRole('radio', { name: /Bills & utilities/ })).toHaveAttribute('aria-checked', 'true')

    await user.click(screen.getByRole('button', { name: 'Every month on the 22nd' }))
    const days = await screen.findByRole('dialog', { name: 'Which day each month?' })
    await user.click(within(days).getByRole('radio', { name: 'The 5th' }))
    expect(screen.getByRole('button', { name: 'Every month on the 5th' })).toBeInTheDocument()
    expect(screen.getByText(/^First reminder .*Nov.*, then every month\.$/)).toBeInTheDocument()

    await pickPerson(user, 'Riya')
    await user.click(saveButton())

    const [saved] = recurringStore.get()
    expect(saved).toMatchObject({
      title: 'Airtel wifi',
      category: 'utilities',
      total: 117900,
      currency: 'INR',
      payerId: ME_ID,
      mode: 'equal',
      dayOfMonth: 5,
      active: true,
      participants: [
        { friendId: ME_ID, input: null },
        { friendId: riya, input: null },
      ],
    })
    expect(await screen.findByText('Recurring split saved')).toBeInTheDocument()
    await waitFor(() => expect(currentUrl()).toBe('/app/recurring'))
  }, 15_000)

  it('starts from a quick-start preset', () => {
    renderEditor('/app/recurring/new?preset=rent')
    expect(screen.getByLabelText("What's it for?")).toHaveValue('Rent')
    expect(screen.getByRole('radio', { name: /Rent/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: 'Every month on the 1st' })).toBeInTheDocument()
  })

  it('splits by percentages and checks they add up', async () => {
    const { user } = renderEditor('/app/recurring/new?preset=rent')
    await user.type(screen.getByLabelText('Amount each month'), '30000')
    await pickPerson(user, 'Riya')
    await user.click(screen.getByRole('radio', { name: 'Percentages' }))
    await user.type(screen.getByLabelText('Percentage for you'), '60')
    expect(saveButton()).toBeDisabled()
    expect(screen.getByText("The percentages don't add up to 100% yet.")).toBeInTheDocument()
    await user.type(screen.getByLabelText('Percentage for Riya'), '40')
    expect(saveButton()).toBeEnabled()
    await user.click(saveButton())
    expect(recurringStore.get()[0]).toMatchObject({
      mode: 'percent',
      participants: [
        { friendId: ME_ID, input: 6000 },
        { friendId: riya, input: 4000 },
      ],
    })
  })

  it('records who pays each month', async () => {
    const { user } = renderEditor('/app/recurring/new?preset=netflix')
    await user.type(screen.getByLabelText('Amount each month'), '649')
    await pickPerson(user, 'Sam')
    await user.click(screen.getByRole('button', { name: /Paid by/ }))
    const sheet = await screen.findByRole('dialog', { name: /paid/i })
    await user.click(within(sheet).getByRole('radio', { name: /Sam/ }))
    await user.click(saveButton())
    expect(recurringStore.get()[0]?.payerId).toBe(sam)
  })

  it('hides round-to-whole, which recurring splits can’t keep', async () => {
    const { user } = renderEditor('/app/recurring/new')
    await user.type(screen.getByLabelText('Amount each month'), '1000')
    const editor = screen.getByRole('radiogroup', { name: 'How to split' }).parentElement!
    const round = within(editor).getByRole('switch', { name: /Round to whole/ })
    expect(round.parentElement).toBe(editor)
    expect(editor.className).toMatch(/split/)
  })

  it('asks before throwing away unsaved changes', async () => {
    const { user } = renderEditor('/app/recurring/new')
    await user.type(screen.getByLabelText('Amount each month'), '500')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    const confirm = await screen.findByRole('dialog', { name: 'Discard changes?' })
    await user.click(within(confirm).getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Discard changes?' })).not.toBeInTheDocument())
    expect(currentUrl()).toBe('/app/recurring/new')
    expect(screen.getByLabelText('Amount each month')).toHaveValue('500')

    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Discard changes?' })).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/recurring'))
    expect(recurringStore.get()).toHaveLength(0)
  })

  it('leaves straight away when nothing changed', async () => {
    const { user } = renderEditor('/app/recurring/new')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/recurring'))
    expect(screen.queryByRole('dialog', { name: 'Discard changes?' })).not.toBeInTheDocument()
  })

  it('lets the day grid be driven from the keyboard', async () => {
    const { user } = renderEditor('/app/recurring/new')
    await user.click(screen.getByRole('button', { name: 'Every month on the 22nd' }))
    const grid = within(await screen.findByRole('dialog', { name: 'Which day each month?' })).getByRole('radiogroup')
    within(grid).getByRole('radio', { name: 'The 22nd' }).focus()
    await user.keyboard('{ArrowUp}')
    expect(within(grid).getByRole('radio', { name: 'The 15th' })).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{End}')
    expect(within(grid).getByRole('radio', { name: 'The 28th' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('button', { name: 'Every month on the 28th' })).toBeInTheDocument()
  })
})

describe('RecurringEditorScreen — existing', () => {
  beforeEach(async () => {
    await installPro()
    serveBilling({ checkout: 'razorpay', keyId: 'rzp' })
  })

  it('edits and saves changes', async () => {
    const rent = seed()
    const { user } = renderEditor(`/app/recurring/${rent.id}`)
    expect(screen.getByRole('heading', { level: 1, name: 'Edit Rent' })).toBeInTheDocument()
    const amount = screen.getByLabelText('Amount each month')
    expect(amount).toHaveValue('30,000')
    await user.clear(amount)
    await user.type(amount, '32000')
    await user.click(screen.getByRole('switch', { name: 'Remind me each month' }))
    await user.click(saveButton())
    expect(recurringStore.get()[0]).toMatchObject({ id: rent.id, total: 3200000, active: false, createdAt: rent.createdAt })
    expect(await screen.findByText('Changes saved')).toBeInTheDocument()
  })

  it('shows when it is next due and splits it from here', async () => {
    const rent = seed()
    const { user } = renderEditor(`/app/recurring/${rent.id}`)
    expect(screen.getByText('Due in 3 days')).toBeInTheDocument()
    expect(screen.getByText('For October')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Split now' }))
    await user.click(await screen.findByRole('dialog', { name: 'Rent split' }))
    const [expense] = expensesStore.get()
    await waitFor(() => expect(currentUrl()).toBe(`/app/expense/${expense!.id}`))
  })

  it('asks to save first before splitting with unsaved changes', async () => {
    const rent = seed()
    const { user } = renderEditor(`/app/recurring/${rent.id}`)
    await user.type(screen.getByLabelText("What's it for?"), ' & maintenance')
    expect(screen.queryByRole('button', { name: 'Split now' })).not.toBeInTheDocument()
    expect(screen.getByText('Save first to split with your changes.')).toBeInTheDocument()
  })

  it('deletes with an undo', async () => {
    const rent = seed()
    const { user } = renderEditor(`/app/recurring/${rent.id}`)
    await user.click(screen.getByRole('button', { name: 'Delete Rent' }))
    expect(recurringStore.get()).toHaveLength(0)
    await waitFor(() => expect(currentUrl()).toBe('/app/recurring'))
    await user.click(await screen.findByRole('button', { name: /^Undo: Rent deleted/ }))
    expect(recurringStore.get()).toEqual([rent])
  })

  it('says so when the recurring split is gone', async () => {
    const { user } = renderEditor('/app/recurring/nope')
    expect(screen.getByRole('heading', { level: 1, name: 'This recurring split is gone' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'See recurring splits' }))
    await waitFor(() => expect(currentUrl()).toBe('/app/recurring'))
  })
})

describe('RecurringEditorScreen — without Pro', () => {
  it('locks setting up a new one', () => {
    renderEditor('/app/recurring/new')
    expect(screen.getByRole('heading', { name: 'Recurring splits are part of Pro' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Amount each month')).not.toBeInTheDocument()
  })

  it('still lets an ended pass edit (but not split) what is there', async () => {
    const rent = seed()
    await installPro({ plan: 'pro_monthly', iat: now() - 40 * DAY_SECONDS, exp: now() - 10 * DAY_SECONDS })
    const { user } = renderEditor(`/app/recurring/${rent.id}`)
    expect(screen.getByText('Your Pro pass has ended')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Split now' }))
    expect(await screen.findByRole('dialog', { name: 'Recurring splits are part of Pro' })).toBeInTheDocument()
    expect(expensesStore.get()).toHaveLength(0)
  })

  it('unlocks a new one in place when Pro arrives', async () => {
    const token = await (await testSigner()).token()
    renderEditor('/app/recurring/new')
    const { LICENSE_KEY } = await import('../../pro/store')
    window.localStorage.setItem(LICENSE_KEY, JSON.stringify({ v: 1, token }))
    window.dispatchEvent(new StorageEvent('storage', { key: LICENSE_KEY }))
    expect(await screen.findByLabelText('Amount each month')).toBeInTheDocument()
  })
})
