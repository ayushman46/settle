import { act, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The letters sheet is its own piece of work: here it only has to open on the right rung.
vi.mock('./RaiseSheet', async () => {
  const { createElement } = await import('react')
  return {
    RaiseSheet: ({ open, step, compensationOnly }: { open: boolean; step: string; compensationOnly?: boolean }) =>
      open ? createElement('div', { role: 'dialog', 'aria-label': `Raise: ${step}${compensationOnly ? ', compensation only' : ''}` }) : null,
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

const now = () => screen.getByRole('region', { name: 'What to do now' })
const win = () => screen.getByRole('region', { name: 'All back' })
const hero = () => screen.getByRole('heading', { level: 1 }).closest('header') as HTMLElement

describe('StuckDetailScreen — the page', SLOW, () => {
  it('shows who owes it, how much, the clock and the details', () => {
    seedStuck(pay())
    open()
    expect(screen.getByRole('heading', { level: 1, name: 'Riya Sharma' })).toBeInTheDocument()
    expect(screen.getByText('Failed payment')).toBeInTheDocument()
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
    expect(details).toHaveTextContent('Found fromAdded by you')
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

  it('keeps a note with it', async () => {
    seedStuck(pay())
    const { user } = open()
    const notes = screen.getByRole('region', { name: 'Notes' })
    await user.click(within(notes).getByRole('button', { name: 'Add a note' }))
    const sheet = await screen.findByRole('dialog', { name: 'Notes' })
    await user.type(within(sheet).getByRole('textbox', { name: 'Note' }), 'Spoke to Ravi at the Ameerpet branch, said 48 hrs')
    await user.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(storedStuck('s1')?.note).toBe('Spoke to Ravi at the Ameerpet branch, said 48 hrs')
    expect(screen.getByRole('region', { name: 'Notes' })).toHaveTextContent('Spoke to Ravi at the Ameerpet branch, said 48 hrs')
    expect(within(screen.getByRole('region', { name: 'Notes' })).getByRole('button', { name: 'Edit the note' })).toBeInTheDocument()
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
    expect(within(sheet).getByRole('textbox', { name: 'How much came back?' })).toHaveValue('500')
    expect(within(sheet).getByText('How much came back?')).not.toHaveClass('visually-hidden')
    expect(within(sheet).getByText('Got less back? Change the amount — Settle keeps chasing the rest.')).toBeInTheDocument()
    expect(within(sheet).getByText('It came back in time, so no compensation is due.')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Mark it back' }))
    expect(storedStuck('s1')?.back).toEqual({ date: '2026-11-01', amount: 50_000, compensation: 0 })
    // Back in your account — not "from Riya", who never got it.
    expect(await screen.findByText('Your ₹500 to Riya Sharma is back in your account')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'All back!' })).toBeInTheDocument()
    expect(win()).toHaveTextContent('You got ₹500 back')
    expect(win()).toHaveTextContent('It came back on 1 Nov.')
    expect(screen.queryByRole('region', { name: 'What to do now' })).toBeNull()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
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

  it('raised: the bank replied without fixing it — the RBI Ombudsman opens now, with its last day', async () => {
    seedStuck(pay({ steps: [{ kind: 'bank', date: '2026-10-31', ref: 'CMP-778' }] }))
    const { user } = open()
    await user.click(within(now()).getByRole('button', { name: 'My bank replied or said no' }))
    const sheet = await screen.findByRole('dialog', { name: 'Your bank replied' })
    await user.click(within(sheet).getByRole('button', { name: 'Note the reply' }))
    expect(storedStuck('s1')?.repliedAt).toBe('2026-11-01')
    expect(await screen.findByText('Noted — you can take it to the RBI Ombudsman now')).toBeInTheDocument()
    expect(now()).toHaveTextContent('Time to take it to the RBI Ombudsman')
    expect(now()).toHaveTextContent('Your bank replied on 1 Nov and it isn’t sorted.')
    expect(now()).toHaveTextContent(/File with the RBI Ombudsman by 30 Jan 2027 at the latest\./)
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(storedStuck('s1')?.repliedAt).toBeNull()
  })

  it('escalate: after the bank’s 30 days, takes it to the RBI Ombudsman', async () => {
    seedStuck(pay({ date: '2026-09-20', steps: [{ kind: 'bank', date: '2026-09-25', ref: null }] }))
    const { user } = open()
    expect(now()).toHaveTextContent('Time to take it to the RBI Ombudsman')
    expect(now()).toHaveTextContent(/File with the RBI Ombudsman by 23 Jan 2027 at the latest\./)
    await user.click(within(now()).getByRole('button', { name: 'Take it to the RBI Ombudsman' }))
    expect(screen.getByRole('dialog', { name: 'Raise: ombudsman' })).toBeInTheDocument()
  })

  it('compensation: back late, claims the ₹100 a day — or notes it was paid', async () => {
    seedStuck(pay({ back: { date: '2026-10-31', amount: 50_000, compensation: 0 } }))
    const { user } = open()
    expect(now()).toHaveTextContent('Back, but 2 days late')
    expect(now()).toHaveTextContent('The RBI’s rules say your bank owes you ₹200 for the wait')
    expect(hero()).toHaveTextContent('Back · your bank still owes ₹200 for the wait')
    await user.click(within(now()).getByRole('button', { name: 'Claim ₹200 from your bank' }))
    expect(screen.getByRole('dialog', { name: 'Raise: bank, compensation only' })).toBeInTheDocument()

    await user.click(within(now()).getByRole('button', { name: 'They’ve paid it' }))
    const sheet = await screen.findByRole('dialog', { name: 'What came back' })
    const paid = within(sheet).getByRole('textbox', { name: 'Compensation paid with it (optional)' })
    expect(paid).toHaveValue('200')
    expect(within(sheet).getByText('The RBI’s rules say ₹200: 2 days late at ₹100 a day.')).toBeInTheDocument()
    // More than the rules say is likely the money itself: a soft warning, not a block.
    await user.clear(paid)
    await user.type(paid, '700')
    expect(within(sheet).getByText('That’s more than the RBI’s rules say (₹200). Check it’s only the compensation, not the money itself.')).toBeInTheDocument()
    await user.clear(paid)
    await user.type(paid, '200')
    await user.click(within(sheet).getByRole('button', { name: 'Mark it back' }))
    expect(storedStuck('s1')?.back).toEqual({ date: '2026-10-31', amount: 50_000, compensation: 20_000 })
    expect(await screen.findByText('Noted — your bank paid ₹200 for the wait')).toBeInTheDocument()
    expect(win()).toHaveTextContent('You got ₹500 back, plus ₹200 for the wait')
    expect(win()).toHaveTextContent('It came back on 31 Oct, 2 days late.')
  })

  it('compensation paid in part: says what the rule is, what came and what’s left', async () => {
    seedStuck(pay({ back: { date: '2026-10-31', amount: 50_000, compensation: 10_000 } }))
    const { user } = open()
    expect(now()).toHaveTextContent('The RBI’s rules say ₹200 for the wait. ₹100 has come; ₹100 is still to come.')
    await user.click(within(now()).getByRole('button', { name: 'The other ₹100 came too' }))
    const sheet = await screen.findByRole('dialog', { name: 'What came back' })
    expect(within(sheet).getByRole('textbox', { name: 'Compensation paid with it (optional)' })).toHaveValue('200')
  })

  it('all back, compensation raised with the bank: says it’s back and what’s still owed for the wait', async () => {
    seedStuck(pay({ amount: 450_000, steps: [{ kind: 'bank', date: '2026-10-30', ref: null }], back: { date: '2026-10-31', amount: 450_000, compensation: 0 } }))
    const { user } = open()
    expect(hero()).toHaveTextContent('Back · your bank still owes ₹200 for the wait')
    expect(now()).toHaveTextContent('Your ₹4,500 is back. Your bank still owes ₹200 for the wait')
    expect(now()).toHaveTextContent('You raised it on 30 Oct; they have till 29 Nov.')
    expect(within(now()).queryByRole('button', { name: 'It’s back' })).toBeNull()
    await user.click(within(now()).getByRole('button', { name: 'See the complaint again' }))
    expect(screen.getByRole('dialog', { name: 'Raise: bank, compensation only' })).toBeInTheDocument()
    await user.click(within(now()).getByRole('button', { name: 'They’ve paid the ₹200' }))
    expect(await screen.findByRole('dialog', { name: 'What came back' })).toBeInTheDocument()
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
    expect(await screen.findByRole('dialog', { name: 'What came back' })).toBeInTheDocument()
  })
})

describe('StuckDetailScreen — part of it back', SLOW, () => {
  it('stays open: says what’s still to come, and More came back adds to what came before', async () => {
    seedStuck(partRefund())
    const { user } = open()
    expect(hero()).toHaveTextContent('₹1,000 back · ₹299 still to come')
    expect(now()).toHaveTextContent('₹1,000 of ₹1,299 came back on 30 Oct. The other ₹299 is still to come.')
    expect(screen.queryByRole('region', { name: 'All back' })).toBeNull()
    await user.click(within(now()).getByRole('button', { name: 'More came back' }))
    const sheet = await screen.findByRole('dialog', { name: 'More came back' })
    const field = within(sheet).getByRole('textbox', { name: 'How much came back this time?' })
    expect(field).toHaveValue('299')
    await user.clear(field)
    await user.type(field, '100')
    expect(within(sheet).getByText('₹199 still to come')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Mark it back' }))
    expect(storedStuck('s1')?.back).toEqual({ date: '2026-11-01', amount: 110_000, compensation: 0 })
    expect(await screen.findByText('₹1,100 of ₹1,299 from Flipkart is back — ₹199 still to come')).toBeInTheDocument()
    expect(now()).toHaveTextContent('The other ₹199 is still to come.')
  })

  it('the rest coming back closes it', async () => {
    seedStuck(partRefund())
    const { user } = open()
    await user.click(within(now()).getByRole('button', { name: 'More came back' }))
    const sheet = await screen.findByRole('dialog', { name: 'More came back' })
    await user.click(within(sheet).getByRole('button', { name: 'Mark it back' }))
    expect(storedStuck('s1')?.back).toEqual({ date: '2026-11-01', amount: 129_900, compensation: 0 })
    expect(await screen.findByText('₹1,299 from Flipkart is back')).toBeInTheDocument()
    expect(win()).toHaveTextContent('You got ₹1,299 back')
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

  it('They kept the rest: closes it at what came back, with Undo', async () => {
    seedStuck(partRefund())
    const { user } = open()
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Flipkart' })).getByRole('button', { name: /^They kept the rest/ }))
    expect(storedStuck('s1')?.amount).toBe(100_000)
    expect(win()).toHaveTextContent('You got ₹1,000 back')
    await user.click(await screen.findByRole('button', { name: /^Undo/ }))
    expect(storedStuck('s1')?.amount).toBe(129_900)
  })
})

describe('StuckDetailScreen — a reminder, and the win to share', SLOW, () => {
  it('puts the next date in your calendar: an .ics file, or Google Calendar', async () => {
    seedStuck(pay({ date: '2026-11-01' }))
    const { user } = open()
    await user.click(within(now()).getByRole('button', { name: 'Remind me on 3 Nov' }))
    const sheet = await screen.findByRole('dialog', { name: 'Remind me on 3 Nov' })
    expect(sheet).toHaveTextContent('Stuck money: ₹500, Riya Sharma — if it’s not back, raise it in Settle')
    const google = within(sheet).getByRole('link', { name: 'Open in Google Calendar (opens in a new tab)' })
    expect(google.getAttribute('href')).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE')
    expect(google.getAttribute('href')).toContain('&dates=20261103/20261104')

    await user.click(within(sheet).getByRole('button', { name: 'Add to my calendar' }))
    expect(shareFile).toHaveBeenCalledTimes(1)
    const [file, name] = shareFile.mock.calls[0] ?? []
    expect(name).toBe('settle-reminder.ics')
    expect(file?.type).toBe('text/calendar')
    expect(await file?.text()).toContain('DTSTART;VALUE=DATE:20261103')
    expect(await screen.findByText('Calendar event ready — open it to add the reminder')).toBeInTheDocument()
  })

  it('nothing to wait for, no reminder: it’s yours to do now', () => {
    seedStuck(pay())
    open()
    expect(within(now()).queryByRole('button', { name: /^Remind me/ })).toBeNull()
  })

  it('shares the win without a reference, an account or the person’s name', async () => {
    seedStuck(pay({ back: { date: '2026-10-31', amount: 50_000, compensation: 20_000 } }))
    const { user } = open()
    await user.click(within(win()).getByRole('button', { name: 'Share the win' }))
    expect(await screen.findByText('Copied — paste it anywhere')).toBeInTheDocument()
    const text = await navigator.clipboard.readText()
    expect(text).toBe('HDFC paid me ₹200 for the days my money was stuck — the RBI’s ₹100-a-day rule, claimed with Settle.')
    expect(text).not.toMatch(/Riya|4821|430112345678/)
  })
})

describe('StuckDetailScreen — set aside, bring back, delete, skip ahead', SLOW, () => {
  it('sets it aside and brings it back, each with Undo', async () => {
    seedStuck(pay())
    const { user } = open()
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Riya Sharma' })).getByRole('button', { name: /^Set aside/ }))
    expect(storedStuck('s1')?.dismissedAt).not.toBeNull()
    expect(now()).toHaveTextContent('It isn’t counted.')
    await user.click(await screen.findByRole('button', { name: /^Undo/ }))
    expect(storedStuck('s1')?.dismissedAt).toBeNull()
  })

  it('deletes it once you say so, with Undo', async () => {
    seedStuck(pay({ steps: [{ kind: 'bank', date: '2026-10-31', ref: 'CMP-778' }] }))
    const { user } = open()
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Riya Sharma' })).getByRole('button', { name: 'Delete' }))
    const confirm = await screen.findByRole('dialog', { name: 'Delete Riya Sharma?' })
    expect(confirm).toHaveTextContent('It goes from this phone for good, along with the complaint you noted.')
    expect(confirm).toHaveTextContent('Just not worth chasing? Set it aside instead')
    expect(storedStuck('s1')).toBeDefined()
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }))
    expect(storedStuck('s1')).toBeUndefined()
    expect(currentUrl()).toBe('/app/stuck')
    expect(await screen.findByText('Riya Sharma deleted')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(storedStuck('s1')).toBeDefined()
  })

  it('Keep it leaves it as it was', async () => {
    seedStuck(pay())
    const { user } = open()
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Riya Sharma' })).getByRole('button', { name: 'Delete' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Delete Riya Sharma?' })).getByRole('button', { name: 'Keep it' }))
    expect(storedStuck('s1')).toEqual(pay())
    expect(currentUrl()).toBe('/app/stuck/s1')
  })

  it('a business that doesn’t answer: straight to the National Consumer Helpline', async () => {
    seedStuck(pay({ kind: 'refund', rail: null, party: 'keralagadgets.in', merchant: null, amount: 349_900, date: '2026-10-10', promisedBy: '2026-10-20' }))
    const { user } = open()
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'keralagadgets.in' })).getByRole('button', { name: /^They don’t answer/ }))
    expect(screen.getByRole('dialog', { name: 'Raise: nch' })).toBeInTheDocument()
  })
})
