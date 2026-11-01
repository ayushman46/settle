import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components'
import { updateProfile } from '../../data'
import { stuckStore, type StuckPayment, type StuckStepKind } from '../../data/stores'
import { formatMoney } from '../../lib/money'
import { letterFor, ombudsmanFields } from './letters'
import { RaiseSheet } from './RaiseSheet'

const TODAY = '2026-11-02'
const ME = { name: 'Ayush Mishra', upiId: 'ayush@okaxis' }
const inr = (paise: number) => formatMoney(paise, 'INR', { trimZeros: true })

/** ₹500 to Swiggy by UPI on 20 Oct, in Google Pay: due back 25 Oct, 8 days late on 2 Nov. */
function failed(over: Partial<StuckPayment> = {}): StuckPayment {
  return {
    id: 's1',
    kind: 'failed',
    rail: 'upi_merchant',
    party: 'Swiggy',
    merchant: 'swiggy',
    amount: 50_000,
    date: '2026-10-20',
    promisedBy: null,
    ref: '629420113457',
    orderId: null,
    bank: 'hdfc',
    account: 'XX4821',
    app: 'gpay',
    source: 'sms',
    confirmed: true,
    steps: [],
    back: null,
    dismissedAt: null,
    note: null,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  }
}

function refund(over: Partial<StuckPayment> = {}): StuckPayment {
  return failed({ id: 'r1', kind: 'refund', rail: null, party: null, merchant: 'amazon', amount: 129_900, ref: null, orderId: '404-1234567-7654321', bank: null, account: null, app: null, ...over })
}

/** Links open other apps; in tests nothing navigates. */
const stopNavigation = (event: MouseEvent) => event.preventDefault()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 2, 12))
  updateProfile(ME)
  window.addEventListener('click', stopNavigation)
})

afterEach(() => {
  window.removeEventListener('click', stopNavigation)
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function Harness({ payment, step, compensationOnly, onClose }: { payment: StuckPayment; step: StuckStepKind; compensationOnly?: boolean; onClose?: () => void }) {
  const [open, setOpen] = useState(true)
  return (
    <ToastProvider>
      <RaiseSheet
        open={open}
        onClose={() => {
          onClose?.()
          setOpen(false)
        }}
        payment={payment}
        step={step}
        compensationOnly={compensationOnly}
      />
    </ToastProvider>
  )
}

function show(payment: StuckPayment, step: StuckStepKind, extra: { compensationOnly?: boolean; onClose?: () => void } = {}) {
  stuckStore.set([payment])
  const user = userEvent.setup()
  render(<Harness payment={payment} step={step} {...extra} />)
  return { user, sheet: screen.getByRole('dialog') }
}

const letterBox = () => screen.getByTestId('stuck-letter')

describe('RaiseSheet — the bank', () => {
  it('says where and how in Google Pay, and shows the letter with what is owed so far', () => {
    const { sheet } = show(failed(), 'bank')
    expect(sheet).toHaveAccessibleName('Raise it with your bank')
    expect(within(sheet).getByText(`${inr(50_000)} · Swiggy`)).toBeInTheDocument()
    const steps = within(sheet).getByRole('list', { name: 'Where and how' })
    expect(within(steps).getAllByRole('listitem')[0]).toHaveTextContent('In Google Pay, open this payment from your transaction history, tap Having issues')
    expect(within(sheet).getByRole('heading', { name: 'The letter' })).toBeInTheDocument()
    const letter = letterFor('bank', failed(), ME, TODAY)
    expect(letterBox()).toHaveTextContent(letter.body.replace(/\s+/g, ' '), { normalizeWhitespace: true })
    expect(letterBox()).toHaveTextContent(`compensation due so far is ${inr(80_000)}`)
    expect(within(sheet).getByText(letter.subject)).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: 'NPCI’s MyUPI (opens in a new tab)' })).toHaveAttribute('href', 'https://www.upihelp.npci.org.in/')
  })

  it('marks what is left to fill in', () => {
    show(failed(), 'bank')
    const blank = within(letterBox()).getByText('[your mobile number]')
    expect(blank.tagName).toBe('MARK')
    expect(screen.getByText('Fill in the parts in [brackets] before you send it.')).toBeInTheDocument()
  })

  it('copies the letter and says so', async () => {
    const { user } = show(failed(), 'bank')
    await user.click(screen.getByRole('button', { name: 'Copy' }))
    expect(await navigator.clipboard.readText()).toBe(letterFor('bank', failed(), ME, TODAY).body)
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('shares the letter with its subject on the share sheet', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true })
    try {
      const { user } = show(failed(), 'bank')
      const letter = letterFor('bank', failed(), ME, TODAY)
      await user.click(screen.getByRole('button', { name: 'Share' }))
      expect(share).toHaveBeenCalledWith({ title: letter.subject, text: letter.body })
    } finally {
      delete (navigator as { share?: unknown }).share
    }
  })

  it('falls back to copying when it cannot share', async () => {
    const { user } = show(failed(), 'bank')
    await user.click(screen.getByRole('button', { name: 'Share' }))
    expect(await navigator.clipboard.readText()).toBe(letterFor('bank', failed(), ME, TODAY).body)
    expect(await screen.findByText('Copied. Paste it where you’re sending it.')).toBeInTheDocument()
  })

  it('emails it: subject and text filled in, no recipient', () => {
    show(failed(), 'bank')
    const letter = letterFor('bank', failed(), ME, TODAY)
    expect(screen.getByRole('link', { name: 'Email' })).toHaveAttribute('href', `mailto:?subject=${encodeURIComponent(letter.subject)}&body=${encodeURIComponent(letter.body)}`)
  })

  it('asks for the compensation when the money came back late', () => {
    const back = failed({ back: { date: '2026-10-30', amount: 50_000, compensation: 0 } })
    const { sheet } = show(back, 'bank', { compensationOnly: true })
    expect(sheet).toHaveAccessibleName(`Ask for the ${inr(50_000)} compensation`)
    expect(letterBox()).toHaveTextContent(`I request you to credit the compensation of ${inr(50_000)} due under the circular.`)
  })
})

describe('RaiseSheet — "I’ve raised it"', () => {
  it('notes the day and the complaint number, with Undo', async () => {
    const onClose = vi.fn()
    const { user } = show(failed(), 'bank', { onClose })
    await user.click(screen.getByRole('button', { name: 'I’ve raised it' }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('When did you raise it?')
    const date = screen.getByLabelText(/Raised on/)
    expect(date).toHaveValue(TODAY)
    await user.type(screen.getByRole('textbox', { name: 'Complaint number' }), 'HDFC-88213')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(stuckStore.get()[0]?.steps).toEqual([{ kind: 'bank', date: TODAY, ref: 'HDFC-88213' }])
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/Noted: raised with your bank on 2 Nov/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(stuckStore.get()[0]?.steps).toEqual([])
  })

  it('saves without a number, and goes back to the letter', async () => {
    const { user } = show(refund(), 'merchant')
    await user.click(screen.getByRole('button', { name: 'I’ve raised it' }))
    expect(screen.getByRole('textbox', { name: 'Ticket number' })).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Ask Amazon for the refund')
    await user.click(screen.getByRole('button', { name: 'I’ve raised it' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(stuckStore.get()[0]?.steps).toEqual([{ kind: 'merchant', date: TODAY, ref: null }])
    expect(await screen.findByText(/Noted: raised with Amazon on 2 Nov/)).toBeInTheDocument()
  })
})

describe('RaiseSheet — further up', () => {
  it('takes the RBI Ombudsman to cms.rbi.org.in, with the form’s values to copy', async () => {
    const raised = failed({ steps: [{ kind: 'bank', date: '2026-10-01', ref: 'HDFC-88213' }] })
    const { user, sheet } = show(raised, 'ombudsman')
    expect(sheet).toHaveAccessibleName('Take it to the RBI Ombudsman')
    expect(within(sheet).getByRole('link', { name: 'Open cms.rbi.org.in (opens in a new tab)' })).toHaveAttribute('href', 'https://cms.rbi.org.in')
    expect(within(sheet).getByRole('link', { name: 'Call 14448' })).toHaveAttribute('href', 'tel:14448')
    expect(within(sheet).getByRole('heading', { name: 'For the form' })).toBeInTheDocument()
    const fields = ombudsmanFields(raised, ME, TODAY)
    expect(within(sheet).getByText('HDFC Bank')).toBeInTheDocument()
    expect(within(sheet).getByText('1 Oct 2026, complaint number HDFC-88213')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Copy Relief sought' }))
    expect(await navigator.clipboard.readText()).toBe(fields.find((f) => f.id === 'relief')?.value)
    expect(within(sheet).getByRole('button', { name: 'Relief sought copied' })).toBeInTheDocument()
    expect(letterBox()).toHaveTextContent('Reserve Bank - Integrated Ombudsman Scheme, 2026')
  })

  it('sends the National Consumer Helpline the message on WhatsApp, or calls 1915', () => {
    const asked = refund({ steps: [{ kind: 'merchant', date: '2026-10-28', ref: 'TKT-55021' }] })
    const { sheet } = show(asked, 'nch')
    expect(sheet).toHaveAccessibleName('National Consumer Helpline')
    const message = letterFor('nch', asked, ME, TODAY)
    expect(within(sheet).getByRole('heading', { name: 'The message' })).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: 'Send on WhatsApp (opens in a new tab)' })).toHaveAttribute(
      'href',
      `https://wa.me/918800001915?text=${encodeURIComponent(message.body)}`,
    )
    expect(within(sheet).getByRole('link', { name: 'Call 1915' })).toHaveAttribute('href', 'tel:1915')
    expect(within(sheet).getByRole('link', { name: 'consumerhelpline.gov.in (opens in a new tab)' })).toHaveAttribute('href', 'https://consumerhelpline.gov.in')
  })

  it('files on AirSewa for an airline, and with a commission on e-Jagriti', () => {
    const flight = refund({ merchant: 'indigo', orderId: 'Q7XK2P' })
    const { sheet } = show(flight, 'airsewa')
    expect(sheet).toHaveAccessibleName('Complain on AirSewa')
    expect(within(sheet).getByRole('link', { name: 'Open AirSewa (opens in a new tab)' })).toHaveAttribute('href', 'https://airsewa.gov.in')
    expect(letterBox()).toHaveTextContent('PNR / booking reference: Q7XK2P')
  })

  it('files with a consumer commission on e-Jagriti, from a summary', () => {
    const { sheet } = show(refund(), 'commission')
    expect(sheet).toHaveAccessibleName('Take it to a consumer commission')
    expect(within(sheet).getByRole('heading', { name: 'The summary' })).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: 'Open e-Jagriti (opens in a new tab)' })).toHaveAttribute('href', 'https://e-jagriti.gov.in')
  })

  it('opens the business’s own help when Settle knows it', () => {
    const { sheet } = show(refund(), 'merchant')
    expect(sheet).toHaveAccessibleName('Ask Amazon for the refund')
    expect(within(sheet).getByRole('link', { name: 'Amazon on refunds (opens in a new tab)' })).toHaveAttribute(
      'href',
      'https://www.amazon.in/gp/help/customer/display.html?nodeId=202111770',
    )
    expect(letterBox()).toHaveTextContent('Order / booking number: 404-1234567-7654321')
  })
})
