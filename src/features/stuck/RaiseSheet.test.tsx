import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../../components'
import { updateProfile } from '../../data'
import { profileStore, stuckStore, type StuckPayment, type StuckStepKind } from '../../data/stores'
import { formatMoney } from '../../lib/money'
import { letterMeStore } from './letterMe'
import { letterFor, ombudsmanFields, withSubject } from './letters'
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
    repliedAt: null,
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

interface Extra {
  compensationOnly?: boolean
  onClose?: () => void
  onNext?: () => void
}

function Harness({ payment, step, compensationOnly, onClose, onNext }: Extra & { payment: StuckPayment; step: StuckStepKind }) {
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
        onNext={onNext}
      />
    </ToastProvider>
  )
}

function show(payment: StuckPayment, step: StuckStepKind, extra: Extra = {}) {
  stuckStore.set([payment])
  const user = userEvent.setup()
  render(<Harness payment={payment} step={step} {...extra} />)
  return { user, sheet: screen.getByRole('dialog') }
}

/** Your mobile number already given: the letters have nothing left to fill in. */
function knownMobile() {
  letterMeStore.set({ mobile: '98200 12345', place: 'Pune, Maharashtra', address: '', emails: {}, revoked: {} })
}

const FULL = { ...ME, mobile: '98200 12345', place: 'Pune, Maharashtra', address: '' }

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
    // The subject once, inside the letter.
    expect(within(sheet).getAllByText(new RegExp(`Subject: ${letter.subject.replace(/[()]/g, '.')}`))).toHaveLength(1)
    expect(within(sheet).getByRole('link', { name: 'UPI help website (opens in a new tab)' })).toHaveAttribute('href', 'https://www.upihelp.npci.org.in/')
  })

  it('says above the English letter, in the app’s words, what it asks for', () => {
    const { sheet } = show(failed(), 'bank')
    expect(within(sheet).getByText(`It asks for ${inr(50_000)} back, and the ${inr(80_000)} owed so far for the delay (₹100 a day).`)).toBeInTheDocument()
    expect(within(sheet).getByText(/^The letter is in English/)).toBeInTheDocument()
    expect(letterBox().closest('[lang]')).toHaveAttribute('lang', 'en')
  })

  it('leaves out the UPI help website once its 45 days are over', () => {
    const { sheet } = show(failed({ date: '2026-09-13' }), 'bank')
    expect(within(sheet).queryByRole('link', { name: /UPI help website/ })).not.toBeInTheDocument()
    expect(within(sheet).getByText(/only takes complaints within 45 days of the payment, and that time has passed/)).toBeInTheDocument()
  })

  it('marks what is left to fill in, and says how much', () => {
    show(failed(), 'bank')
    const blank = within(letterBox()).getByText('[your mobile number]')
    expect(blank.tagName).toBe('MARK')
    expect(screen.getByText('1 part in [brackets] is still to fill in. Fill it in before you send it.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy the letter' })).toHaveAccessibleDescription('1 part in [brackets] is still to fill in. Fill it in before you send it.')
  })

  it('asks once for your details, puts them in the letter, and keeps them for the next one', async () => {
    const { user } = show(failed(), 'bank')
    expect(screen.getByRole('heading', { name: 'Your details' })).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'Mobile number' }), '98200 12345')
    await user.type(screen.getByRole('textbox', { name: 'Address (optional)' }), '12 MG Road, Pune')
    expect(letterBox()).toHaveTextContent('Mobile: 98200 12345 Address: 12 MG Road, Pune', { normalizeWhitespace: true })
    expect(within(letterBox()).queryByText('[your mobile number]')).not.toBeInTheDocument()
    expect(screen.queryByText(/still to fill in/)).not.toBeInTheDocument()
    expect(letterMeStore.get()).toMatchObject({ mobile: '98200 12345', address: '12 MG Road, Pune' })
  })

  it('shows details already given as one line, to change if need be', async () => {
    letterMeStore.set({ mobile: '98200 12345', place: '', address: '', emails: {}, revoked: {} })
    const { user } = show(failed(), 'bank')
    expect(screen.queryByRole('textbox', { name: 'Mobile number' })).not.toBeInTheDocument()
    expect(screen.getByText('98200 12345 · ayush@okaxis')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Change your details' }))
    expect(screen.getByRole('textbox', { name: 'Mobile number' })).toHaveValue('98200 12345')
    expect(screen.getByRole('textbox', { name: 'Your UPI ID (optional)' })).toHaveValue('ayush@okaxis')
  })

  it('copies the letter from the main button, and says so', async () => {
    knownMobile()
    const { user } = show(failed(), 'bank')
    await user.click(screen.getByRole('button', { name: 'Copy the letter' }))
    expect(await navigator.clipboard.readText()).toBe(letterFor('bank', failed(), FULL, TODAY).body)
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'I’ve raised it' })).toBeInTheDocument()
  })

  it('copies a business message with its subject first', async () => {
    knownMobile()
    const { user } = show(refund(), 'merchant')
    await user.click(screen.getByRole('button', { name: 'Copy the message' }))
    const message = letterFor('merchant', refund(), FULL, TODAY)
    expect(await navigator.clipboard.readText()).toBe(withSubject(message))
    expect((await navigator.clipboard.readText()).startsWith(`Subject: ${message.subject}\n\n`)).toBe(true)
  })

  it('shares the letter with its subject on the share sheet', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true })
    try {
      knownMobile()
      const { user } = show(failed(), 'bank')
      const letter = letterFor('bank', failed(), FULL, TODAY)
      await user.click(screen.getByRole('button', { name: 'Share' }))
      expect(share).toHaveBeenCalledWith({ title: letter.subject, text: letter.body })
    } finally {
      delete (navigator as { share?: unknown }).share
    }
  })

  it('falls back to copying when it cannot share', async () => {
    knownMobile()
    const { user } = show(failed(), 'bank')
    await user.click(screen.getByRole('button', { name: 'Share' }))
    expect(await navigator.clipboard.readText()).toBe(letterFor('bank', failed(), FULL, TODAY).body)
    expect(await screen.findByText('Copied. Paste it where you’re sending it.')).toBeInTheDocument()
  })

  it('emails it: subject and text filled in, no recipient until you give one', () => {
    show(failed(), 'bank')
    const letter = letterFor('bank', failed(), ME, TODAY)
    expect(screen.getByRole('link', { name: 'Email' })).toHaveAttribute('href', `mailto:?subject=${encodeURIComponent(letter.subject)}&body=${encodeURIComponent(letter.body)}`)
  })

  it('emails your bank at the address you give, and remembers it for that bank', async () => {
    const { user } = show(failed(), 'bank')
    await user.type(screen.getByRole('textbox', { name: 'Send it to (email)' }), 'grievance@hdfc.example')
    expect(screen.getByRole('link', { name: 'Email' }).getAttribute('href')).toMatch(/^mailto:grievance@hdfc\.example\?subject=/)
    expect(letterMeStore.get().emails).toEqual({ 'bank:hdfc': 'grievance@hdfc.example' })
  })

  it('prints the letter, with a line to sign and a copy for the branch to stamp', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    knownMobile()
    const { user } = show(failed(), 'bank')
    await user.click(screen.getByRole('button', { name: 'Print or save as PDF' }))
    expect(print).toHaveBeenCalledTimes(1)
    const paper = document.body.querySelector(':scope > [lang="en"]')
    expect(paper).toHaveTextContent('ACKNOWLEDGEMENT COPY')
    expect(paper).toHaveTextContent('Signature:')
    print.mockRestore()
  })

  it('has no Print where the phone can’t print (the Android app without its file plugin)', () => {
    vi.stubGlobal('Capacitor', { isNativePlatform: () => true, getPlatform: () => 'android', PluginHeaders: [] })
    show(failed(), 'bank')
    expect(screen.queryByRole('button', { name: 'Print or save as PDF' })).not.toBeInTheDocument()
  })

  it('asks for the compensation when the money came back late', () => {
    const back = failed({ back: { date: '2026-10-30', amount: 50_000, compensation: 0 } })
    const { sheet } = show(back, 'bank', { compensationOnly: true })
    expect(sheet).toHaveAccessibleName(`Ask for the ${inr(50_000)} compensation`)
    expect(letterBox()).toHaveTextContent(`I request you to credit the compensation of ${inr(50_000)} due under the circular.`)
  })
})

describe('RaiseSheet — a NACH debit', () => {
  it('asks whether the mandate was cancelled first, and writes the letter to match', async () => {
    const nach = failed({ rail: 'nach', party: 'Cult Fitness', merchant: null, app: null, date: '2026-10-30' })
    const { user } = show(nach, 'bank')
    const group = screen.getByRole('radiogroup', { name: 'Had you cancelled this mandate with your bank before the debit?' })
    expect(within(group).getByRole('radio', { name: 'No' })).toBeChecked()
    expect(letterBox()).toHaveTextContent('but the transaction failed')
    await user.click(within(group).getByRole('radio', { name: 'Yes, I’d cancelled it' }))
    expect(letterBox()).toHaveTextContent('although I had revoked that mandate with the bank on [date you revoked the mandate]')
    expect(letterBox()).not.toHaveTextContent('transaction failed')
    expect(letterMeStore.get().revoked).toEqual({ s1: '' })
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
    await user.click(screen.getByRole('button', { name: 'Back to the message' }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Raise it with Amazon')
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
    expect(within(sheet).getByText('1 October 2026, complaint number HDFC-88213')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Copy Relief sought' }))
    expect(await navigator.clipboard.readText()).toBe(fields.find((f) => f.id === 'relief')?.value)
    expect(within(sheet).getByRole('button', { name: 'Relief sought copied' })).toBeInTheDocument()
    expect(letterBox()).toHaveTextContent('Reserve Bank - Integrated Ombudsman Scheme, 2026')
    // The RBI's complaint centre takes it by email too.
    expect(within(sheet).getByRole('link', { name: 'Email' }).getAttribute('href')).toMatch(/^mailto:crpc@rbi\.org\.in\?subject=/)
  })

  it('takes a wallet to the RBI Ombudsman as the wallet company, with the registered mobile', () => {
    const paytm = failed({ rail: 'wallet', app: 'paytm', bank: null, account: null, steps: [{ kind: 'bank', date: '2026-10-01', ref: null }] })
    const { sheet } = show(paytm, 'ombudsman')
    expect(within(sheet).getByText('Wallet company')).toBeInTheDocument()
    expect(within(sheet).getByText('Paytm Payments Bank Ltd')).toBeInTheDocument()
    expect(within(sheet).getByText('Registered mobile')).toBeInTheDocument()
  })

  it('raises a wallet payment with the wallet', () => {
    const { sheet } = show(failed({ rail: 'wallet', app: 'paytm', bank: null, account: null }), 'bank')
    expect(sheet).toHaveAccessibleName('Raise it with Paytm')
    expect(letterBox()).toHaveTextContent('Paytm Payments Bank Ltd')
  })

  it('sends the National Consumer Helpline the message on WhatsApp, or calls 1915 or 1800-11-4000', () => {
    const asked = refund({ steps: [{ kind: 'merchant', date: '2026-10-28', ref: 'TKT-55021' }] })
    const { sheet } = show(asked, 'nch')
    expect(sheet).toHaveAccessibleName('Take it to the National Consumer Helpline')
    const message = letterFor('nch', asked, ME, TODAY)
    expect(within(sheet).getByRole('heading', { name: 'The message' })).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: 'Send on WhatsApp (opens in a new tab)' })).toHaveAttribute(
      'href',
      `https://wa.me/918800001915?text=${encodeURIComponent(message.body)}`,
    )
    expect(within(sheet).getByRole('link', { name: 'Call 1915' })).toHaveAttribute('href', 'tel:1915')
    expect(within(sheet).getByRole('link', { name: 'Call 1800-11-4000' })).toHaveAttribute('href', 'tel:1800114000')
    // Email isn't how the helpline takes a complaint; copying still works.
    expect(within(sheet).queryByRole('link', { name: 'Email' })).not.toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Copy the message' })).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: 'consumerhelpline.gov.in (opens in a new tab)' })).toHaveAttribute('href', 'https://consumerhelpline.gov.in')
  })

  it('signs the helpline message with your city once you give it', async () => {
    const { user } = show(refund(), 'nch')
    await user.type(screen.getByRole('textbox', { name: 'City and state' }), 'Pune, Maharashtra')
    const whatsapp = screen.getByRole('link', { name: 'Send on WhatsApp (opens in a new tab)' }).getAttribute('href') ?? ''
    expect(decodeURIComponent(whatsapp)).toContain('Ayush Mishra, Pune, Maharashtra')
    expect(decodeURIComponent(whatsapp)).not.toContain('[your city and state]')
  })

  it('files on AirSewa for an airline, and with a commission on e-Jagriti', () => {
    const flight = refund({ merchant: 'indigo', orderId: 'Q7XK2P' })
    const { sheet } = show(flight, 'airsewa')
    expect(sheet).toHaveAccessibleName('Take it to AirSewa')
    expect(within(sheet).queryByRole('link', { name: 'Email' })).not.toBeInTheDocument()
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
    expect(sheet).toHaveAccessibleName('Raise it with Amazon')
    expect(within(sheet).getByRole('link', { name: 'Open Amazon’s refund help (opens in a new tab)' })).toHaveAttribute(
      'href',
      'https://www.amazon.in/gp/help/customer/display.html?nodeId=202111770',
    )
    expect(letterBox()).toHaveTextContent('Order / booking number: 404-1234567-7654321')
    // The main button copies the message; the help page is one of the links.
    expect(within(sheet).getByRole('button', { name: 'Copy the message' })).toBeInTheDocument()
  })
})

describe('RaiseSheet — nothing goes out with a blank unsaid', () => {
  it('says what is still empty before copying, then fills it in or copies it anyway', async () => {
    const { user } = show(failed(), 'bank')
    await user.click(screen.getByRole('button', { name: 'Copy the letter' }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('1 part is still empty')
    expect(within(screen.getByRole('list', { name: 'Still empty' })).getByText('[your mobile number]')).toBeInTheDocument()
    expect(await navigator.clipboard.readText()).not.toContain('Yours faithfully')

    // Fill it in: back on the letter, in the field it needs.
    await user.click(screen.getByRole('button', { name: 'Fill it in' }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Raise it with your bank')
    expect(screen.getByRole('textbox', { name: 'Mobile number' })).toHaveFocus()

    // Or copy it as it is.
    await user.click(screen.getByRole('button', { name: 'Copy the letter' }))
    await user.click(screen.getByRole('button', { name: 'Copy it anyway' }))
    expect(await navigator.clipboard.readText()).toBe(letterFor('bank', failed(), ME, TODAY).body)
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Raise it with your bank')
    // Asked once: the next copy goes straight through.
    await user.click(screen.getByRole('button', { name: 'Copied' }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Raise it with your bank')
  })

  it('asks before printing or emailing too, and sends it from there', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    const { user } = show(failed(), 'bank')
    await user.click(screen.getByRole('button', { name: 'Print or save as PDF' }))
    expect(print).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Print it anyway' }))
    expect(print).toHaveBeenCalledTimes(1)
    print.mockRestore()
  })

  it('keeps the email link until you say to send it anyway', async () => {
    const { user } = show(failed(), 'bank')
    const letter = letterFor('bank', failed(), ME, TODAY)
    await user.click(screen.getByRole('link', { name: 'Email' }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('1 part is still empty')
    expect(screen.getByRole('link', { name: 'Email it anyway' })).toHaveAttribute('href', `mailto:?subject=${encodeURIComponent(letter.subject)}&body=${encodeURIComponent(letter.body)}`)
  })

  it('puts the helpline’s one detail first, and asks before WhatsApp while it is empty', async () => {
    const { user, sheet } = show(refund({ steps: [{ kind: 'merchant', date: '2026-10-28', ref: 'TKT-55021' }] }), 'nch')
    const headings = within(sheet)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
    expect(headings.slice(0, 2)).toEqual(['Your details', 'Where and how'])
    const city = screen.getByRole('textbox', { name: 'City and state' })
    expect(city).not.toHaveAttribute('placeholder')
    expect(city).toHaveAccessibleDescription('For example: Pune, Maharashtra')
    await user.click(screen.getByRole('link', { name: 'Send on WhatsApp (opens in a new tab)' }))
    expect(screen.getByRole('dialog')).toHaveAccessibleName('1 part is still empty')
    expect(screen.getByText('[your city and state]')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Send it anyway (opens in a new tab)' }).getAttribute('href')).toMatch(/^https:\/\/wa\.me\/918800001915\?text=/)
    await user.click(screen.getByRole('button', { name: 'Fill it in' }))
    expect(screen.getByRole('textbox', { name: 'City and state' })).toHaveFocus()
  })
})

describe('RaiseSheet — your name and UPI ID', () => {
  it('asks for your name when the profile has none, and signs with it', async () => {
    updateProfile({ name: 'You' })
    knownMobile()
    const { user } = show(failed({ rail: 'imps', app: null }), 'bank')
    expect(letterBox()).toHaveTextContent('Yours faithfully, [your name] Mobile', { normalizeWhitespace: true })
    await user.type(screen.getByRole('textbox', { name: 'Your name' }), 'Ishaan Verma')
    expect(letterBox()).toHaveTextContent('Yours faithfully, Ishaan Verma Mobile: 98200 12345', { normalizeWhitespace: true })
    expect(screen.queryByText(/still to fill in/)).not.toBeInTheDocument()
    expect(profileStore.get().name).toBe('Ishaan Verma')
  })

  it('does not ask for a name it already has', () => {
    show(failed(), 'bank')
    expect(screen.queryByRole('textbox', { name: 'Your name' })).not.toBeInTheDocument()
  })

  it('leaves the UPI ID out until you give one, then signs with it and saves it to your profile', async () => {
    updateProfile({ upiId: null })
    knownMobile()
    const { user } = show(failed(), 'bank')
    expect(letterBox()).not.toHaveTextContent('UPI ID')
    expect(screen.queryByText(/still to fill in/)).not.toBeInTheDocument()
    // The letter is complete without it: one tap away, under Change.
    await user.click(screen.getByRole('button', { name: 'Change your details' }))
    const field = screen.getByRole('textbox', { name: 'Your UPI ID (optional)' })
    await user.type(field, 'priya.k@okhdfcbank')
    expect(letterBox()).toHaveTextContent('UPI ID: priya.k@okhdfcbank')
    expect(profileStore.get().upiId).toBe('priya.k@okhdfcbank')
    await user.clear(field)
    await user.type(field, 'not a upi')
    await user.tab()
    expect(field).toHaveAccessibleDescription(/doesn’t look like a UPI ID/)
  })

  it('does not ask for a UPI ID a card payment’s letter never uses', () => {
    knownMobile()
    show(failed({ rail: 'card_online', app: null }), 'bank')
    expect(screen.queryByRole('textbox', { name: /UPI ID/ })).not.toBeInTheDocument()
  })
})

describe('RaiseSheet — a reference that was not saved', () => {
  it('asks for it in the sheet and saves it with the payment', async () => {
    knownMobile()
    const { user } = show(failed({ ref: null }), 'bank')
    expect(within(letterBox()).getByText('[transaction reference]')).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: 'UPI reference (12 digits)' }), '629420113457')
    expect(letterBox()).toHaveTextContent('UPI reference (RRN/UTR): 629420113457')
    expect(stuckStore.get()[0]?.ref).toBe('629420113457')
  })

  it('does not ask when it is there already', () => {
    show(failed(), 'bank')
    expect(screen.queryByRole('textbox', { name: 'UPI reference (12 digits)' })).not.toBeInTheDocument()
  })
})

describe('RaiseSheet — what is still owed, above the title', () => {
  it('shows the rest after a part came back', () => {
    show(failed({ back: { date: '2026-10-30', amount: 30_000, compensation: 0 } }), 'bank')
    expect(screen.getByText(`${inr(20_000)} of ${inr(50_000)} · Swiggy`)).toBeInTheDocument()
  })

  it('shows the compensation alone once the money is back', () => {
    show(failed({ back: { date: '2026-10-30', amount: 50_000, compensation: 0 } }), 'bank', { compensationOnly: true })
    expect(screen.getByText(`${inr(50_000)} for the wait · Swiggy`)).toBeInTheDocument()
  })
})

describe('RaiseSheet — focus and the way on', () => {
  it('moves off the button that changed: "I’ve raised it" never leaves focus on a Back that undoes it', async () => {
    const { user } = show(failed(), 'bank')
    await user.click(screen.getByRole('button', { name: 'I’ve raised it' }))
    expect(document.activeElement).not.toHaveAccessibleName('Back to the letter')
    expect(document.activeElement?.tagName).not.toBe('BODY')
    expect(screen.getByRole('button', { name: 'Back to the letter' })).toBeInTheDocument()
  })

  it('gives the RBI Ombudsman’s last day for this case, and the way to post it', () => {
    const raised = failed({ steps: [{ kind: 'bank', date: '2026-10-01', ref: null }] })
    const { sheet } = show(raised, 'ombudsman')
    expect(within(sheet).getByText(/^File by 29 Jan 2027 at the latest/)).toBeInTheDocument()
    expect(within(sheet).getByText(/Central Vista, Chandigarh 160017/)).toBeInTheDocument()
  })

  it('offers the helpline from the business’s steps when the detail screen says it’s time', async () => {
    const onNext = vi.fn()
    const { user } = show(refund(), 'merchant', { onNext })
    await user.click(screen.getByRole('button', { name: 'Take it to the National Consumer Helpline' }))
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('leaves it out otherwise', () => {
    show(refund(), 'merchant')
    expect(screen.queryByRole('button', { name: 'Take it to the National Consumer Helpline' })).not.toBeInTheDocument()
  })
})
