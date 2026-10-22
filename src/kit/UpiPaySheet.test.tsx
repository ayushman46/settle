import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components'
import { friendsStore, profileStore, resetDataForTests } from '../data'
import { ME_ID } from '../domain/types'
import { seedPeople } from './testPeople'
import { UpiPaySheet, type UpiPaySheetProps } from './UpiPaySheet'

beforeEach(() => {
  resetDataForTests()
  seedPeople()
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetDataForTests()
})

const DINNER = { amount: 69_150, currency: 'INR', note: 'Dinner at Toit' }

/** Sam pays me back: the sheet I show Sam (or send him as a request). */
const collecting: Omit<UpiPaySheetProps, 'open' | 'onClose'> = {
  ...DINNER,
  payee: { id: ME_ID, name: 'You', upiId: null },
  payer: { id: 'sam', name: 'Sam', color: 1 },
}

function Harness(props: Omit<UpiPaySheetProps, 'open' | 'onClose'>) {
  const [open, setOpen] = useState(true)
  return (
    <ToastProvider>
      <UpiPaySheet {...props} open={open} onClose={() => setOpen(false)} />
    </ToastProvider>
  )
}

function computerPointer(): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('pointer: fine'),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
}

describe('UpiPaySheet', () => {
  it('collects from a friend with a QR of your UPI ID, under your real name', () => {
    render(<Harness {...collecting} />)
    const sheet = screen.getByRole('dialog', { name: 'Collect from Sam' })
    expect(within(sheet).getByText('Sam owes you')).toBeInTheDocument()
    expect(within(sheet).getByText('₹691.50')).toBeInTheDocument()
    // The profile's UPI ID is live, even though the caller passed none.
    expect(within(sheet).getByRole('img', { name: 'UPI QR code to pay ₹691.50 to Ayush' })).toBeInTheDocument()
    expect(within(sheet).getByText('ayush@okaxis')).toBeInTheDocument()
    expect(within(sheet).getByText('Works with GPay, PhonePe, Paytm, BHIM and every UPI app.')).toBeInTheDocument()
    expect(within(sheet).queryByRole('link')).not.toBeInTheDocument()
  })

  it('sends a ready-to-paste request (copied where there is no share sheet)', async () => {
    const user = userEvent.setup()
    render(<Harness {...collecting} />)
    await user.click(screen.getByRole('button', { name: 'Send request' }))
    expect(await screen.findByText('Payment request copied')).toBeInTheDocument()
    const text = await navigator.clipboard.readText()
    expect(text).toContain('Hi Sam, your share for Dinner at Toit is ₹691.50.')
    expect(text).toContain('Pay Ayush on UPI: ayush@okaxis')
    expect(text).toContain('upi://pay?pa=ayush%40okaxis&pn=Ayush&am=691.50&cu=INR&tn=Dinner%20at%20Toit')
  })

  it('copies the UPI ID', async () => {
    const user = userEvent.setup()
    render(<Harness {...collecting} />)
    await user.click(screen.getByRole('button', { name: 'Copy UPI ID' }))
    expect(await screen.findByText('UPI ID copied')).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).toBe('ayush@okaxis')
  })

  it('hands over to your UPI app when you are the one paying', () => {
    render(<Harness {...DINNER} payee={{ id: 'riya', name: 'Riya', upiId: null }} payer={{ id: ME_ID, name: 'You', color: 2 }} />)
    const sheet = screen.getByRole('dialog', { name: 'Pay Riya' })
    // What it's for leads, as on a payments app's pay screen.
    expect(within(sheet).getByText('Dinner at Toit')).toBeInTheDocument()
    const app = within(sheet).getByRole('link', { name: 'Pay ₹691.50 in your UPI app' })
    expect(app).toHaveAttribute('href', 'upi://pay?pa=riya%40okicici&pn=Riya&am=691.50&cu=INR&tn=Dinner%20at%20Toit')
    expect(within(sheet).queryByRole('button', { name: 'Send request' })).not.toBeInTheDocument()
  })

  it('on a computer, asks you to scan with your phone instead of opening an app', () => {
    computerPointer()
    render(<Harness {...DINNER} payee={{ id: 'riya', name: 'Riya', upiId: null }} payer={{ id: ME_ID, name: 'You', color: 2 }} />)
    const sheet = screen.getByRole('dialog', { name: 'Pay Riya' })
    expect(within(sheet).queryByRole('link')).not.toBeInTheDocument()
    expect(within(sheet).getByText('Scan this with the UPI app on your phone.')).toBeInTheDocument()
    expect(within(sheet).getByRole('img', { name: 'UPI QR code to pay ₹691.50 to Riya' })).toBeInTheDocument()
  })

  it('describes a payment between two friends', () => {
    render(<Harness {...DINNER} payee={{ id: 'riya', name: 'Riya', upiId: null }} payer={{ id: 'sam', name: 'Sam', color: 1 }} />)
    const sheet = screen.getByRole('dialog', { name: 'Sam pays Riya' })
    expect(within(sheet).getByText('Sam owes Riya')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Send request' })).toBeInTheDocument()
  })

  it('adds a missing UPI ID for a friend and saves it to them', async () => {
    const user = userEvent.setup()
    render(<Harness {...DINNER} payee={{ id: 'sam', name: 'Sam', upiId: null }} payer={{ id: ME_ID, name: 'You', color: 2 }} />)
    const sheet = screen.getByRole('dialog', { name: 'Pay Sam' })
    expect(within(sheet).getByText('Sam hasn’t added a UPI ID yet. Add it to get a QR code.')).toBeInTheDocument()
    expect(within(sheet).queryByRole('img', { name: /UPI QR/ })).not.toBeInTheDocument()

    const field = within(sheet).getByRole('textbox', { name: 'UPI ID for Sam' })
    const save = within(sheet).getByRole('button', { name: 'Save UPI ID' })
    expect(save).toBeDisabled()
    await user.type(field, 'sam at ybl')
    await user.click(save)
    expect(within(sheet).getByText('That doesn’t look like a UPI ID. It’s like name@bank.')).toBeInTheDocument()

    await user.clear(field)
    await user.type(field, ' Sam@YBL ')
    await user.click(save)
    expect(friendsStore.get().find((f) => f.id === 'sam')?.upiId).toBe('sam@ybl')
    expect(await screen.findByText('UPI ID saved')).toBeInTheDocument()
    expect(within(sheet).getByRole('img', { name: 'UPI QR code to pay ₹691.50 to Sam' })).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: 'Pay ₹691.50 in your UPI app' })).toHaveAttribute(
      'href',
      expect.stringContaining('pa=sam%40ybl'),
    )
  })

  it('adds your own UPI ID to your profile when you have none', async () => {
    const user = userEvent.setup()
    seedPeople({ upiId: null })
    render(<Harness {...collecting} />)
    const sheet = screen.getByRole('dialog', { name: 'Collect from Sam' })
    expect(within(sheet).getByText('Add your UPI ID to get paid in a tap.')).toBeInTheDocument()
    expect(within(sheet).getByText('Friends pay you here. It stays on this phone.')).toBeInTheDocument()
    await user.type(within(sheet).getByRole('textbox', { name: 'Your UPI ID' }), 'ayush@oksbi')
    await user.click(within(sheet).getByRole('button', { name: 'Save UPI ID' }))
    expect(profileStore.get().upiId).toBe('ayush@oksbi')
    expect(within(sheet).getByRole('img', { name: 'UPI QR code to pay ₹691.50 to Ayush' })).toBeInTheDocument()
  })

  it('uses a typed UPI ID for someone who is not one of your people, without saving it', async () => {
    const user = userEvent.setup()
    render(<Harness {...DINNER} payee={{ name: 'Kabir', upiId: null }} payer={{ id: ME_ID, name: 'You', color: 2 }} />)
    await user.type(screen.getByRole('textbox', { name: 'UPI ID for Kabir' }), 'kabir@okhdfc')
    await user.click(screen.getByRole('button', { name: 'Use this UPI ID' }))
    expect(screen.getByRole('img', { name: 'UPI QR code to pay ₹691.50 to Kabir' })).toBeInTheDocument()
    expect(friendsStore.get().some((f) => f.upiId === 'kabir@okhdfc')).toBe(false)
  })

  it('is honest that UPI only moves rupees', () => {
    render(<Harness {...collecting} amount={4_000} currency="USD" />)
    const sheet = screen.getByRole('dialog', { name: 'Collect from Sam' })
    expect(within(sheet).getByText('$40')).toBeInTheDocument()
    expect(within(sheet).getByText('UPI works in rupees only')).toBeInTheDocument()
    expect(within(sheet).queryByRole('img', { name: /UPI QR/ })).not.toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: 'Send request' })).not.toBeInTheDocument()
  })

  it('closes', async () => {
    const user = userEvent.setup()
    render(<Harness {...collecting} />)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('says "Your share" when there is no note', () => {
    render(<Harness {...DINNER} note={null} payee={{ id: 'riya', name: 'Riya', upiId: null }} payer={{ id: ME_ID, name: 'You', color: 2 }} />)
    expect(within(screen.getByRole('dialog', { name: 'Pay Riya' })).getByText('Your share')).toBeInTheDocument()
  })

  it('never offers an ID typed for one person to the next', async () => {
    const user = userEvent.setup()
    const payer = { id: ME_ID, name: 'You', color: 2 }
    const { rerender } = render(
      <ToastProvider>
        <UpiPaySheet open onClose={() => {}} {...DINNER} payee={{ name: 'Kabir', upiId: null }} payer={payer} />
      </ToastProvider>,
    )
    await user.type(screen.getByRole('textbox', { name: 'UPI ID for Kabir' }), 'kabir@okhdfc')
    await user.click(screen.getByRole('button', { name: 'Use this UPI ID' }))
    expect(screen.getByText('kabir@okhdfc')).toBeInTheDocument()

    // The same sheet, now for someone else: asks again, with an empty field.
    rerender(
      <ToastProvider>
        <UpiPaySheet open onClose={() => {}} {...DINNER} payee={{ name: 'Meera', upiId: null }} payer={payer} />
      </ToastProvider>,
    )
    expect(screen.queryByText('kabir@okhdfc')).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /UPI QR/ })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'UPI ID for Meera' })).toHaveValue('')
  })

  it('lets you type an ID when the one it was given is not valid', async () => {
    const user = userEvent.setup()
    render(<Harness {...DINNER} payee={{ name: 'Kabir', upiId: 'not an id' }} payer={{ id: ME_ID, name: 'You', color: 2 }} />)
    await user.type(screen.getByRole('textbox', { name: 'UPI ID for Kabir' }), 'kabir@okhdfc')
    await user.click(screen.getByRole('button', { name: 'Use this UPI ID' }))
    expect(screen.getByRole('img', { name: 'UPI QR code to pay ₹691.50 to Kabir' })).toBeInTheDocument()
  })

  it('uses, without saving, an ID for someone who was removed', async () => {
    const user = userEvent.setup()
    render(<Harness {...DINNER} payee={{ id: 'gone', name: 'Someone', upiId: null }} payer={{ id: ME_ID, name: 'You', color: 2 }} />)
    expect(screen.queryByText(/Saved to/)).not.toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'UPI ID for Someone' }), 'old@ybl')
    await user.click(screen.getByRole('button', { name: 'Use this UPI ID' }))
    expect(await screen.findByText('UPI ID added')).toBeInTheDocument()
    expect(screen.getByText('old@ybl')).toBeInTheDocument()
  })

  it('marks it paid once you have paid, then closes', async () => {
    const user = userEvent.setup()
    const onMarkPaid = vi.fn()
    render(
      <Harness {...DINNER} payee={{ id: 'riya', name: 'Riya', upiId: null }} payer={{ id: ME_ID, name: 'You', color: 2 }} onMarkPaid={onMarkPaid} />,
    )
    // The UPI app comes first; "I've paid" is the quieter follow-up.
    const app = screen.getByRole('link', { name: 'Pay ₹691.50 in your UPI app' })
    const paid = screen.getByRole('button', { name: 'I’ve paid' })
    expect(app.compareDocumentPosition(paid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.click(paid)
    expect(onMarkPaid).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('marks a collected payment paid, even where UPI cannot take it', async () => {
    const user = userEvent.setup()
    const onMarkPaid = vi.fn()
    render(<Harness {...collecting} amount={4_000} currency="USD" onMarkPaid={onMarkPaid} />)
    expect(screen.queryByRole('button', { name: 'Send request' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mark as paid' }))
    expect(onMarkPaid).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
