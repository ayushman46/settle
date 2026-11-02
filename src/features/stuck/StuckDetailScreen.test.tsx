import { act, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The letters sheet is its own piece of work: here it only has to open on the right rung (and offer the next one when asked).
vi.mock('./RaiseSheet', async () => {
  const { createElement } = await import('react')
  return {
    RaiseSheet: ({ open, step, compensationOnly, onNext }: { open: boolean; step: string; compensationOnly?: boolean; onNext?: () => void }) =>
      open
        ? createElement(
            'div',
            { role: 'dialog', 'aria-label': `Raise: ${step}${compensationOnly ? ', compensation only' : ''}` },
            onNext ? createElement('button', { type: 'button', onClick: onNext }, 'Next rung') : null,
          )
        : null,
  }
})

// The calendar file is handed over, not downloaded, in a test.
const shareFile = vi.hoisted(() => vi.fn(async (_blob: Blob, _name: string) => 'downloaded' as const))
vi.mock('../../share/shareFile', () => ({ shareFile }))

import type { StuckPayment } from '../../data/stores'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { StuckDetailScreen } from './StuckDetailScreen'
import { seedStuck, storedStuck, stuckPayment } from './testKit'

const SLOW = { timeout: 30_000 }

beforeEach(() => {
  resetProScreens()
  shareFile.mockClear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 1, 12))
})

afterEach(() => {
  vi.useRealTimers()
})

function open(id = 's1') {
  return renderAt(`/app/stuck/${id}`, <StuckDetailScreen />)
}

const pay = (over: Partial<StuckPayment> = {}): StuckPayment => stuckPayment({ repliedAt: null, ...over })
/** A Flipkart refund of ₹1,299 due 28 Oct, ₹1,000 of it back on 30 Oct. */
const partRefund = (over: Partial<StuckPayment> = {}): StuckPayment =>
  pay({
    kind: 'refund',
    rail: null,
    party: 'Flipkart',
    merchant: 'flipkart',
    amount: 129_900,
    date: '2026-10-20',
    promisedBy: '2026-10-28',
    ref: null,
    back: { date: '2026-10-30', amount: 100_000, compensation: 0 },
    ...over,
  })
/** A refund from a shop Settle doesn't know, 12 days late with nothing raised. */
const lateShopRefund = (over: Partial<StuckPayment> = {}): StuckPayment =>
  pay({ kind: 'refund', rail: null, party: 'keralagadgets.in', merchant: null, amount: 349_900, date: '2026-10-10', promisedBy: '2026-10-20', ref: null, ...over })

const now = () => screen.getByRole('region', { name: 'What to do now' })
const win = () => screen.getByRole('region', { name: 'All back' })
const hero = () => screen.getByRole('heading', { level: 1 }).closest('header') as HTMLElement
/** The day picker in a sheet, by its question (typing a day skips the picker's limits). */
const typeDay = (sheet: HTMLElement, label: RegExp, day: string) => fireEvent.change(within(sheet).getByLabelText(label), { target: { value: day } })

describe('StuckDetailScreen — the page', SLOW, () => {
  it('shows what it is, what’s still owed, the clock and the details', () => {
    seedStuck(pay())
    open()
    expect(screen.getByRole('heading', { level: 1, name: 'Failed payment to Riya Sharma' })).toBeInTheDocument()
    expect(hero()).toHaveTextContent('₹500')
    expect(screen.getByText('UPI to a person · HDFC ••4821 · GPay')).toBeInTheDocument()
    const clock = screen.getByRole('region', { name: 'The clock' })
    expect(within(clock).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'The money left your account28 Oct',
      'Due back by 29 OctUPI to a person: the RBI’s rule says back the next day.',
      '3 days late1 Nov₹300 for the wait so far · ₹100 more each day',
    ])
    const details = screen.getByRole('region', { name: 'Details' })
    expect(details).toHaveTextContent('Reference430112345678')
    expect(within(details).getByRole('button', { name: 'Copy Reference' })).toBeInTheDocument()
    expect(details).toHaveTextContent('Where it came fromAdded by you')
  })

  it('without a name, the eyebrow says what it is', () => {
    seedStuck(pay({ party: null, rail: 'atm' }))
    open()
    expect(screen.getByText('Failed payment')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'ATM, no cash came out' })).toBeInTheDocument()
  })

  it('says what was copied', async () => {
    seedStuck(pay())
    const { user } = open()
    await user.click(within(screen.getByRole('region', { name: 'Details' })).getByRole('button', { name: 'Copy Reference' }))
    expect(await screen.findByText('Reference copied')).toBeInTheDocument()
  })

  it('a payment that’s gone says so', () => {
    open('nope')
    expect(screen.getByRole('heading', { name: 'This one’s gone' })).toBeInTheDocument()
  })

  it('one taken away while it’s open (an Undo of adding it) goes back to the list, not a dead end', () => {
    seedStuck(pay())
    open()
    act(() => seedStuck())
    expect(currentUrl()).toBe('/app/stuck')
  })

  it('keeps a note with it, counting what a note keeps', async () => {
    seedStuck(pay())
    const { user } = open()
    const notes = screen.getByRole('region', { name: 'Notes' })
    await user.click(within(notes).getByRole('button', { name: 'Add a note' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add a note' })
    const field = within(sheet).getByRole('textbox', { name: 'Note' })
    await user.type(field, 'Spoke to Ravi at the Ameerpet branch, said 48 hrs')
    expect(field).toHaveAccessibleDescription('49 of 500 characters')
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(storedStuck('s1')?.note).toBe('Spoke to Ravi at the Ameerpet branch, said 48 hrs')
    expect(screen.getByRole('region', { name: 'Notes' })).toHaveTextContent('Spoke to Ravi at the Ameerpet branch, said 48 hrs')
    expect(within(screen.getByRole('region', { name: 'Notes' })).getByRole('button', { name: 'Edit the note' })).toBeInTheDocument()
  })

  it('a note at its limit says so — a long paste isn’t cut off silently', async () => {
    seedStuck(pay())
    const { user } = open()
    await user.click(within(screen.getByRole('region', { name: 'Notes' })).getByRole('button', { name: 'Add a note' }))
    const sheet = await screen.findByRole('dialog', { name: 'Add a note' })
    fireEvent.change(within(sheet).getByRole('textbox', { name: 'Note' }), { target: { value: 'x'.repeat(500) } })
    expect(sheet).toHaveTextContent('That’s the most a note keeps (500 characters). Anything past that wasn’t added.')
  })
})

describe('StuckDetailScreen — what to do now, stage by stage', SLOW, () => {
  it('check: Yes counts it, No sets it aside — each with Undo', async () => {
    seedStuck(pay({ confirmed: false, date: '2026-10-31' }))
    const { user } = open()
    expect(now()).toHaveTextContent('Did ₹500 leave your account?')
    await user.click(within(now()).getByRole('button', { name: 'Yes, it left my account' }))
    expect(storedStuck('s1')?.confirmed).toBe(true)
    expect(now()).toHaveTextContent('Nothing to do yet')
    await user.click(await screen.findByRole('button', { name: /^Undo/ }))
    expect(storedStuck('s1')?.confirmed).toBe(false)

    await user.click(within(now()).getByRole('button', { name: 'No, it didn’t' }))
    expect(storedStuck('s1')?.dismissedAt).not.toBeNull()
    expect(now()).toHaveTextContent('Set aside')
  })

  it('waiting: nothing to do yet; It’s back ticks it back in time — the win, with Undo', async () => {
    seedStuck(pay({ date: '2026-11-01' }))
    const { user } = open()
    expect(now()).toHaveTextContent('Your bank has till 2 Nov to put it back.')
    await user.click(within(now()).getByRole('button', { name: 'It’s back' }))
    const sheet = await screen.findByRole('dialog', { name: 'It’s back' })
    expect(sheet).toHaveAccessibleDescription('Failed payment to Riya Sharma · ₹500')
    expect(within(sheet).getByRole('textbox', { name: 'How much came back?' })).toHaveValue('500')
    expect(within(sheet).getByText('How much came back?')).not.toHaveClass('visually-hidden')
    expect(within(sheet).getByText('Got less back? Change the amount — Settle keeps chasing the rest.')).toBeInTheDocument()
    expect(within(sheet).getByText('It came back in time, so no compensation is due.')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Mark it back' }))
    expect(storedStuck('s1')?.back).toMatchObject({ date: '2026-11-01', amount: 50_000, compensation: 0 })
    // Back in your account — not "from Riya", who never got it.
    expect(await screen.findByText('Your ₹500 to Riya Sharma is back in your account')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'All back!' })).toBeInTheDocument()
    expect(win()).toHaveTextContent('You got ₹500 back')
    expect(win()).toHaveTextContent('It came back on 1 Nov.')
    expect(screen.queryByRole('region', { name: 'What to do now' })).toBeNull()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(storedStuck('s1')?.back).toBeNull()
  })

  it('It’s back won’t take more than was stuck — the extra can go under compensation', async () => {
    seedStuck(pay())
    const { user } = open()
    await user.click(within(now()).getByRole('button', { name: 'It’s back' }))
    const sheet = await screen.findByRole('dialog', { name: 'It’s back' })
    const field = within(sheet).getByRole('textbox', { name: 'How much came back?' })
    await user.clear(field)
    await user.type(field, '900')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(within(sheet).getByText('That’s more than the ₹500 still to come.')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Mark it back' })).toBeDisabled()
    await user.click(within(sheet).getByRole('button', { name: 'Put the extra ₹400 under compensation' }))
    expect(field).toHaveValue('500')
    expect(within(sheet).getByRole('textbox', { name: 'Compensation paid with it (optional)' })).toHaveValue('400')
    expect(within(sheet).getByRole('button', { name: 'Mark it back' })).toBeEnabled()
  })

  it('It’s back won’t take a day before the money left, or one still to come', async () => {
    seedStuck(pay())
    const { user } = open()
    await user.click(within(now()).getByRole('button', { name: 'It’s back' }))
    const sheet = await screen.findByRole('dialog', { name: 'It’s back' })
    typeDay(sheet, /^When did it come back\?/, '2026-10-01')
    expect(sheet).toHaveTextContent('It can’t have come before 28 Oct. Pick 28 Oct or later.')
    expect(within(sheet).getByRole('button', { name: 'Mark it back' })).toBeDisabled()
    typeDay(sheet, /^When did it come back\?/, '2026-11-11')
    expect(sheet).toHaveTextContent('That day hasn’t come yet. Pick today or earlier.')
    expect(within(sheet).getByRole('button', { name: 'Mark it back' })).toBeDisabled()
    typeDay(sheet, /^When did it come back\?/, '2026-10-30')
    expect(within(sheet).getByRole('button', { name: 'Mark it back' })).toBeEnabled()
    expect(storedStuck('s1')?.back).toBeNull()
  })

  it('waiting: you can ask now, without waiting for the deadline', async () => {
    seedStuck(pay({ rail: 'upi_merchant', party: 'Swiggy', date: '2026-10-30' }))
    const { user } = open()
    expect(now()).toHaveTextContent('Nothing to do yet')
    await user.click(within(now()).getByRole('button', { name: 'Ask your bank now' }))
    expect(screen.getByRole('dialog', { name: 'Raise: bank' })).toBeInTheDocument()
  })

  it('overdue: says what the bank owes under the RBI’s rules, and raises it with the bank', async () => {
    seedStuck(pay())
    const { user } = open()
    expect(within(hero()).getByText('3 days late')).toBeInTheDocument()
    expect(now()).toHaveTextContent('3 days late — your bank owes you ₹300')
    expect(now()).toHaveTextContent('The RBI’s rules say it had to be back by 29 Oct, and that your bank pays ₹100 for each day after, without being asked.')
    await user.click(within(now()).getByRole('button', { name: 'Raise it with your bank' }))
    expect(screen.getByRole('dialog', { name: 'Raise: bank' })).toBeInTheDocument()
  })

  it('an overdue refund is raised with the business', async () => {
    seedStuck(pay({ kind: 'refund', rail: null, party: 'Amazon', merchant: 'amazon', amount: 420_000, date: '2026-10-20', promisedBy: '2026-10-28' }))
    const { user } = open()
    expect(now()).toHaveTextContent('4 days late')
    expect(now()).toHaveTextContent('Amazon said it would be back by 28 Oct.')
    await user.click(within(now()).getByRole('button', { name: 'Raise it with Amazon' }))
    expect(screen.getByRole('dialog', { name: 'Raise: merchant' })).toBeInTheDocument()
  })

  it('raised: waits on them, still counting what the bank owes, with the letter one tap away', async () => {
    seedStuck(pay({ steps: [{ kind: 'bank', date: '2026-10-31', ref: 'CMP-778' }] }))
    const { user } = open()
    expect(now()).toHaveTextContent('Raised with your bank on 31 Oct')
    expect(now()).toHaveTextContent('They have till 30 Nov to sort it out.')
    expect(now()).toHaveTextContent('Your bank owes you ₹300 for the wait so far, and ₹100 more each day.')
    await user.click(within(now()).getByRole('button', { name: 'See the complaint again' }))
    expect(screen.getByRole('dialog', { name: 'Raise: bank' })).toBeInTheDocument()
  })

  it('raised: the bank replied without fixing it — the RBI Ombudsman opens now, with its last day; a later reply can be noted too', async () => {
    seedStuck(pay({ steps: [{ kind: 'bank', date: '2026-10-31', ref: 'CMP-778' }] }))
    const { user } = open()
    await user.click(within(now()).getByRole('button', { name: 'My bank replied or said no' }))
    const sheet = await screen.findByRole('dialog', { name: 'My bank replied or said no' })
    await user.click(within(sheet).getByRole('button', { name: 'Note the reply' }))
    expect(storedStuck('s1')?.repliedAt).toBe('2026-11-01')
    expect(await screen.findByText('Noted — you can take it to the RBI Ombudsman now')).toBeInTheDocument()
    expect(now()).toHaveTextContent('Time to take it to the RBI Ombudsman')
    expect(now()).toHaveTextContent('Your bank replied on 1 Nov and it isn’t sorted.')
    expect(now()).toHaveTextContent(/File with the RBI Ombudsman by 28 Feb 2027 at the latest\./)
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(storedStuck('s1')?.repliedAt).toBeNull()
  })

  it('a later reply from the bank can be noted: the RBI Ombudsman’s 90 days count from it', async () => {
    seedStuck(pay({ date: '2026-09-20', steps: [{ kind: 'bank', date: '2026-09-25', ref: null }], repliedAt: '2026-09-30' }))
    const { user } = open()
    await user.click(within(now()).getByRole('button', { name: 'My bank replied again' }))
    const sheet = await screen.findByRole('dialog', { name: 'My bank replied again' })
    expect(sheet).toHaveAccessibleDescription(/the RBI Ombudsman’s 90 days count from it/)
    await user.click(within(sheet).getByRole('button', { name: 'Note the reply' }))
    expect(storedStuck('s1')?.repliedAt).toBe('2026-11-01')
    expect(now()).toHaveTextContent(/File with the RBI Ombudsman by 30 Jan 2027 at the latest\./)
  })

  it('a reply can’t be dated before the complaint', async () => {
    seedStuck(pay({ steps: [{ kind: 'bank', date: '2026-10-31', ref: null }] }))
    const { user } = open()
    await user.click(within(now()).getByRole('button', { name: 'My bank replied or said no' }))
    const sheet = await screen.findByRole('dialog', { name: 'My bank replied or said no' })
    typeDay(sheet, /^When did it reply\?/, '2026-10-05')
    expect(sheet).toHaveTextContent('You raised it on 31 Oct, so the reply came that day or later.')
    expect(within(sheet).getByRole('button', { name: 'Note the reply' })).toBeDisabled()
    expect(storedStuck('s1')?.repliedAt).toBeNull()
  })

  it('a wallet payment names the wallet company, not “my bank”', () => {
    seedStuck(pay({ rail: 'wallet', app: 'paytm', bank: null, account: null, steps: [{ kind: 'bank', date: '2026-10-31', ref: null }] }))
    open()
    expect(within(now()).getByRole('button', { name: 'Paytm replied or said no' })).toBeInTheDocument()
  })

  it('escalate: after the bank’s 30 days, takes it to the RBI Ombudsman — and its reply can still be noted', async () => {
    seedStuck(pay({ date: '2026-09-20', steps: [{ kind: 'bank', date: '2026-09-25', ref: null }] }))
    const { user } = open()
    expect(now()).toHaveTextContent('Time to take it to the RBI Ombudsman')
    expect(now()).toHaveTextContent(/File with the RBI Ombudsman by 23 Jan 2027 at the latest\./)
    expect(within(now()).getByRole('button', { name: 'My bank replied or said no' })).toBeInTheDocument()
    await user.click(within(now()).getByRole('button', { name: 'Take it to the RBI Ombudsman' }))
    expect(screen.getByRole('dialog', { name: 'Raise: ombudsman' })).toBeInTheDocument()
  })

  it('compensation: back late, claims the ₹100 a day — or notes it was paid, on its own day', async () => {
    seedStuck(pay({ back: { date: '2026-10-31', amount: 50_000, compensation: 0 } }))
    const { user } = open()
    expect(now()).toHaveTextContent('Back, but 2 days late')
    expect(now()).toHaveTextContent('The RBI’s rules say your bank owes you ₹200 for the wait')
    // What's owed now is the ₹200, not the ₹500 that came back.
    expect(hero()).toHaveTextContent('₹200')
    expect(hero()).toHaveTextContent('For the wait · your ₹500 is back')
    await user.click(within(now()).getByRole('button', { name: 'Claim ₹200 from your bank' }))
    expect(screen.getByRole('dialog', { name: 'Raise: bank, compensation only' })).toBeInTheDocument()

    await user.click(within(now()).getByRole('button', { name: 'They’ve paid it' }))
    const sheet = await screen.findByRole('dialog', { name: 'Your bank paid for the wait' })
    expect(sheet).toHaveAccessibleDescription('Failed payment to Riya Sharma · ₹200 still owed for the wait')
    // Only the compensation: the money and its day aren't asked again.
    expect(within(sheet).queryByRole('textbox', { name: 'How much came back?' })).toBeNull()
    const paid = within(sheet).getByRole('textbox', { name: 'How much did they pay?' })
    expect(paid).toHaveValue('200')
    expect(within(sheet).getByText('The RBI’s rules say ₹200: 2 days late at ₹100 a day.')).toBeInTheDocument()
    // More than is owed is likely the money itself: a soft warning, not a block.
    await user.clear(paid)
    await user.type(paid, '700')
    expect(within(sheet).getByText('That’s more than the ₹200 still owed. Check it’s only the compensation, not the money itself.')).toBeInTheDocument()
    await user.clear(paid)
    await user.type(paid, '200')
    await user.click(within(sheet).getByRole('button', { name: 'Mark ₹200 paid' }))
    expect(storedStuck('s1')?.back).toMatchObject({
      date: '2026-10-31',
      amount: 50_000,
      compensation: 20_000,
      parts: [
        { date: '2026-10-31', amount: 50_000, compensation: 0 },
        { date: '2026-11-01', amount: 0, compensation: 20_000 },
      ],
    })
    expect(await screen.findByText('Noted — your bank paid ₹200 for the wait')).toBeInTheDocument()
    expect(win()).toHaveTextContent('You got ₹500 back, plus ₹200 for the wait')
    expect(win()).toHaveTextContent('₹700 in all.')
    expect(win()).toHaveTextContent('It came back on 31 Oct, 2 days late.')
    expect(win()).toHaveTextContent('For the wait: ₹200 on 1 Nov.')
  })

  it('compensation paid in part: says what the rule is, what came and what’s left — and the rest, when it comes, is what’s noted', async () => {
    seedStuck(pay({ back: { date: '2026-10-31', amount: 50_000, compensation: 10_000 } }))
    const { user } = open()
    expect(now()).toHaveTextContent('The RBI’s rules say ₹200 for the wait. ₹100 has come; ₹100 is still to come.')
    await user.click(within(now()).getByRole('button', { name: 'The other ₹100 came too' }))
    const sheet = await screen.findByRole('dialog', { name: 'Your bank paid for the wait' })
    expect(within(sheet).getByRole('textbox', { name: 'How much did they pay?' })).toHaveValue('100')
    await user.click(within(sheet).getByRole('button', { name: 'Mark ₹100 paid' }))
    expect(storedStuck('s1')?.back).toMatchObject({ amount: 50_000, compensation: 20_000 })
    expect(await screen.findByText('Noted — your bank paid ₹100 for the wait')).toBeInTheDocument()
  })

  it('all back, compensation raised with the bank: says it’s back and what’s still owed for the wait', async () => {
    seedStuck(pay({ amount: 450_000, steps: [{ kind: 'bank', date: '2026-10-30', ref: null }], back: { date: '2026-10-31', amount: 450_000, compensation: 0 } }))
    const { user } = open()
    expect(hero()).toHaveTextContent('For the wait · your ₹4,500 is back')
    expect(now()).toHaveTextContent('Your ₹4,500 is back — your bank still owes ₹200 for the wait')
    expect(now()).toHaveTextContent('You raised it on 30 Oct; they have till 29 Nov.')
    expect(within(now()).queryByRole('button', { name: 'It’s back' })).toBeNull()
    await user.click(within(now()).getByRole('button', { name: 'See the complaint again' }))
    expect(screen.getByRole('dialog', { name: 'Raise: bank, compensation only' })).toBeInTheDocument()
    await user.click(within(now()).getByRole('button', { name: 'They’ve paid the ₹200' }))
    expect(await screen.findByRole('dialog', { name: 'Your bank paid for the wait' })).toBeInTheDocument()
  })

  it('all back, the bank’s time for the compensation up: the RBI Ombudsman — or it’s paid', async () => {
    seedStuck(pay({ date: '2026-09-20', steps: [{ kind: 'bank', date: '2026-09-25', ref: null }], back: { date: '2026-09-28', amount: 50_000, compensation: 0 } }))
    const { user } = open()
    expect(now()).toHaveTextContent('Take the ₹700 to the RBI Ombudsman')
    expect(now()).toHaveTextContent('Your ₹500 came back 7 days late, and your bank hasn’t paid the ₹700 for the wait.')
    expect(now()).toHaveTextContent(/File with the RBI Ombudsman by 23 Jan 2027 at the latest\./)
    await user.click(within(now()).getByRole('button', { name: 'Take it to the RBI Ombudsman' }))
    expect(screen.getByRole('dialog', { name: 'Raise: ombudsman, compensation only' })).toBeInTheDocument()
    await user.click(within(now()).getByRole('button', { name: 'They’ve paid the ₹700' }))
    expect(await screen.findByRole('dialog', { name: 'Your bank paid for the wait' })).toBeInTheDocument()
  })
})

describe('StuckDetailScreen — part of it back', SLOW, () => {
  it('stays open: what’s still to come is the amount, and More came back adds a part of its own', async () => {
    seedStuck(partRefund())
    const { user } = open()
    expect(hero()).toHaveTextContent('₹299')
    expect(hero()).toHaveTextContent('Still to come · ₹1,000 of ₹1,299 came back')
    expect(now()).toHaveTextContent('₹1,000 of ₹1,299 came back on 30 Oct. The other ₹299 is still to come.')
    expect(screen.queryByRole('region', { name: 'All back' })).toBeNull()
    await user.click(within(now()).getByRole('button', { name: 'More came back' }))
    const sheet = await screen.findByRole('dialog', { name: 'More came back' })
    expect(sheet).toHaveAccessibleDescription('Flipkart refund · ₹1,000 of ₹1,299 back so far')
    const field = within(sheet).getByRole('textbox', { name: 'How much came back this time?' })
    expect(field).toHaveValue('299')
    await user.clear(field)
    await user.type(field, '100')
    expect(within(sheet).getByText('₹199 still to come')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Mark it back' }))
    expect(storedStuck('s1')?.back).toMatchObject({
      date: '2026-11-01',
      amount: 110_000,
      parts: [
        { date: '2026-10-30', amount: 100_000, compensation: 0 },
        { date: '2026-11-01', amount: 10_000, compensation: 0 },
      ],
    })
    expect(await screen.findByText('₹1,100 of ₹1,299 from Flipkart is back — ₹199 still to come')).toBeInTheDocument()
    expect(now()).toHaveTextContent('The other ₹199 is still to come.')
  })

  it('the rest coming back closes it: the toast says what came now, the win each part with its day', async () => {
    seedStuck(partRefund())
    const { user } = open()
    await user.click(within(now()).getByRole('button', { name: 'More came back' }))
    const sheet = await screen.findByRole('dialog', { name: 'More came back' })
    await user.click(within(sheet).getByRole('button', { name: 'Mark it back' }))
    expect(storedStuck('s1')?.back).toMatchObject({ date: '2026-11-01', amount: 129_900, compensation: 0 })
    expect(await screen.findByText('The last ₹299 from Flipkart is back — all ₹1,299 returned')).toBeInTheDocument()
    expect(win()).toHaveTextContent('You got ₹1,299 back')
    expect(win()).toHaveTextContent('It came back in parts: ₹1,000 on 30 Oct and ₹299 on 1 Nov — the last of it 4 days late.')
  })

  it('a first It’s back for less than all of it keeps chasing the rest', async () => {
    seedStuck(pay({ date: '2026-11-01' }))
    const { user } = open()
    await user.click(within(now()).getByRole('button', { name: 'It’s back' }))
    const sheet = await screen.findByRole('dialog', { name: 'It’s back' })
    const field = within(sheet).getByRole('textbox', { name: 'How much came back?' })
    await user.clear(field)
    await user.type(field, '300')
    expect(within(sheet).getByText('₹200 still to come')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Mark it back' }))
    expect(await screen.findByText('₹300 of your ₹500 to Riya Sharma is back — ₹200 still to come')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'All back!' })).toBeNull()
    expect(within(now()).getByRole('button', { name: 'More came back' })).toBeInTheDocument()
  })

  it('a late payment’s last part: what came now, and the compensation as paid, due and still owed', async () => {
    // ₹2,450 to Ramesh 12 days late (₹1,200 for the wait); ₹2,000 came on 30 Oct.
    seedStuck(pay({ party: 'Ramesh Kumar', amount: 245_000, date: '2026-10-19', back: { date: '2026-10-30', amount: 200_000, compensation: 0 } }))
    const { user } = open()
    await user.click(within(now()).getByRole('button', { name: 'More came back' }))
    const sheet = await screen.findByRole('dialog', { name: 'More came back' })
    await user.type(within(sheet).getByRole('textbox', { name: 'Compensation paid with it (optional)' }), '300')
    await user.click(within(sheet).getByRole('button', { name: 'Mark it back' }))
    expect(
      await screen.findByText('The last ₹450 of your ₹2,450 to Ramesh Kumar is back — all of it returned · ₹300 of the ₹1,200 for the wait paid; ₹900 still to come'),
    ).toBeInTheDocument()
  })

  it('They kept the rest: closed with what came back and the rest written off — not “all back” — with Undo', async () => {
    seedStuck(partRefund())
    const { user } = open()
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Flipkart refund, ₹1,299' })).getByRole('button', { name: /^They kept the rest/ }))
    expect(storedStuck('s1')).toMatchObject({ amount: 129_900, back: { amount: 100_000 } })
    expect(storedStuck('s1')?.dismissedAt).not.toBeNull()
    expect(await screen.findByText('Closed: ₹1,000 came back, the rest written off')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'All back' })).toBeNull()
    expect(now()).toHaveTextContent('Closed with ₹1,000 back')
    expect(now()).toHaveTextContent('Flipkart kept the other ₹299, so Settle has stopped chasing it.')
    expect(hero()).toHaveTextContent('₹1,000 came back · the other ₹299 written off')
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(storedStuck('s1')?.dismissedAt).toBeNull()
  })
})

describe('StuckDetailScreen — a reminder, and the win to share', SLOW, () => {
  it('puts the next date in your calendar: an .ics file, or Google Calendar — and says Google sees it', async () => {
    seedStuck(pay({ date: '2026-11-01' }))
    const { user } = open()
    await user.click(within(now()).getByRole('button', { name: 'Remind me on 3 Nov' }))
    const sheet = await screen.findByRole('dialog', { name: 'Remind me on 3 Nov' })
    expect(sheet).toHaveTextContent('Stuck money: Failed payment to Riya Sharma, ₹500 — if it’s not back, raise it in Settle')
    const google = within(sheet).getByRole('link', { name: 'Open in Google Calendar (opens in a new tab)' })
    expect(google).toHaveAccessibleDescription('Google Calendar opens with the event filled in, so Google gets its title and notes.')
    expect(google.getAttribute('href')).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE')
    expect(google.getAttribute('href')).toContain('&dates=20261103/20261104')

    await user.click(within(sheet).getByRole('button', { name: 'Add to my calendar' }))
    expect(shareFile).toHaveBeenCalledTimes(1)
    const [file, name] = shareFile.mock.calls[0] ?? []
    expect(name).toBe('settle-reminder.ics')
    expect(file?.type).toBe('text/calendar')
    const ics = (await file?.text()) ?? ''
    expect(ics).toContain('DTSTART;VALUE=DATE:20261103')
    expect(ics).toContain('URL:https://settleupi.vercel.app/app/stuck/s1')
    expect(await screen.findByText('Calendar event ready — open it to add the reminder')).toBeInTheDocument()
  })

  it('yours to do now: remind me tomorrow', async () => {
    seedStuck(pay())
    const { user } = open()
    await user.click(within(now()).getByRole('button', { name: 'Remind me tomorrow' }))
    const sheet = await screen.findByRole('dialog', { name: 'Remind me tomorrow' })
    expect(sheet).toHaveTextContent('Stuck money: Failed payment to Riya Sharma, ₹500 — raise it with your bank in Settle')
  })

  it('closed: nothing to remind of', () => {
    seedStuck(pay({ back: { date: '2026-10-29', amount: 50_000, compensation: 0 } }))
    open()
    expect(screen.queryByRole('button', { name: /^Remind me/ })).toBeNull()
  })

  it('shares the win with Settle’s link — no reference, account, bank or the person’s name, and “tracked” when nothing was raised', async () => {
    seedStuck(pay({ back: { date: '2026-10-31', amount: 50_000, compensation: 20_000 } }))
    const { user } = open()
    await user.click(within(win()).getByRole('button', { name: 'Share the win' }))
    expect(await screen.findByText('Copied — paste it anywhere')).toBeInTheDocument()
    const text = await navigator.clipboard.readText()
    expect(text).toBe('My bank paid me ₹200 for the days my money was stuck — the RBI’s ₹100-a-day rule, tracked with Settle.\nhttps://settleupi.vercel.app')
    expect(text).not.toMatch(/Riya|4821|430112345678|HDFC/)
  })

  it('“claimed” once a complaint was raised for it', async () => {
    seedStuck(pay({ steps: [{ kind: 'bank', date: '2026-10-30', ref: null }], back: { date: '2026-10-31', amount: 50_000, compensation: 20_000 } }))
    const { user } = open()
    await user.click(within(win()).getByRole('button', { name: 'Share the win' }))
    await screen.findByText('Copied — paste it anywhere')
    expect(await navigator.clipboard.readText()).toMatch(/^My bank paid me ₹200 .* claimed with Settle\.\nhttps:\/\/settleupi\.vercel\.app$/)
  })
})

describe('StuckDetailScreen — set aside, bring back, delete, skip ahead', SLOW, () => {
  it('sets it aside and brings it back, each with Undo', async () => {
    seedStuck(pay())
    const { user } = open()
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Failed payment to Riya Sharma, ₹500' })).getByRole('button', { name: /^Set aside/ }))
    expect(storedStuck('s1')?.dismissedAt).not.toBeNull()
    expect(now()).toHaveTextContent('It isn’t counted.')
    await user.click(await screen.findByRole('button', { name: /^Undo/ }))
    expect(storedStuck('s1')?.dismissedAt).toBeNull()
  })

  it('deletes it once you say so, with Undo', async () => {
    seedStuck(pay({ steps: [{ kind: 'bank', date: '2026-10-31', ref: 'CMP-778' }] }))
    const { user } = open()
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Failed payment to Riya Sharma, ₹500' })).getByRole('button', { name: 'Delete' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete “Failed payment to Riya Sharma”?' })
    expect(confirm).toHaveTextContent('It goes from this phone for good, along with the complaint you noted.')
    expect(confirm).toHaveTextContent('Just not worth chasing? Set it aside instead')
    expect(storedStuck('s1')).toBeDefined()
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))
    expect(storedStuck('s1')).toBeUndefined()
    expect(currentUrl()).toBe('/app/stuck')
    expect(await screen.findByText('Failed payment to Riya Sharma deleted')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(storedStuck('s1')).toBeDefined()
  })

  it('Keep it leaves it as it was', async () => {
    seedStuck(pay())
    const { user } = open()
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Failed payment to Riya Sharma, ₹500' })).getByRole('button', { name: 'Delete' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Delete “Failed payment to Riya Sharma”?' })).getByRole('button', { name: 'Keep it' }))
    expect(storedStuck('s1')).toEqual(pay())
    expect(currentUrl()).toBe('/app/stuck/s1')
  })

  it('a late refund from a business that doesn’t answer: asks when you tried them, notes it, then the National Consumer Helpline', async () => {
    seedStuck(lateShopRefund())
    const { user } = open()
    // On the card, not only under ⋮.
    await user.click(within(now()).getByRole('button', { name: 'They don’t answer? Take it to the National Consumer Helpline' }))
    const sheet = await screen.findByRole('dialog', { name: 'When did you try keralagadgets.in?' })
    typeDay(sheet, /^The day you tried them/, '2026-10-25')
    await user.click(within(sheet).getByRole('button', { name: 'Take it to the National Consumer Helpline' }))
    expect(storedStuck('s1')?.steps).toEqual([{ kind: 'merchant', date: '2026-10-25', ref: null }])
    expect(await screen.findByText('Noted: you tried keralagadgets.in on 25 Oct')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Raise: nch' })).toBeInTheDocument()
  })

  it('not tried them yet: their own complaint first', async () => {
    seedStuck(lateShopRefund())
    const { user } = open()
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'keralagadgets.in refund, ₹3,499' })).getByRole('button', { name: /^They don’t answer/ }))
    const sheet = await screen.findByRole('dialog', { name: 'When did you try keralagadgets.in?' })
    await user.click(within(sheet).getByRole('button', { name: 'I haven’t tried them yet' }))
    expect(storedStuck('s1')?.steps).toEqual([])
    expect(screen.getByRole('dialog', { name: 'Raise: merchant' })).toBeInTheDocument()
  })

  it('raised with them already: straight on to the helpline, from the card or their complaint', async () => {
    seedStuck(lateShopRefund({ steps: [{ kind: 'merchant', date: '2026-10-30', ref: null }] }))
    const { user } = open()
    await user.click(within(now()).getByRole('button', { name: 'See the complaint again' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Raise: merchant' })).getByRole('button', { name: 'Next rung' }))
    expect(screen.getByRole('dialog', { name: 'Raise: nch' })).toBeInTheDocument()
  })

  it('not due yet, or taken higher: no skipping ahead', async () => {
    seedStuck(pay({ kind: 'refund', rail: null, party: 'Flipkart', merchant: 'flipkart', amount: 89_900, date: '2026-11-01', ref: null }))
    const { user } = open()
    expect(within(now()).queryByRole('button', { name: /^They don’t answer/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'More options' }))
    expect(within(await screen.findByRole('dialog', { name: 'Flipkart refund, ₹899' })).queryByRole('button', { name: /^They don’t answer/ })).toBeNull()
  })
})
