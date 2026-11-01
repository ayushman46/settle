import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The letters sheet is its own piece of work: here it only has to open on the right rung.
vi.mock('./RaiseSheet', async () => {
  const { createElement } = await import('react')
  return {
    RaiseSheet: ({ open, step, compensationOnly }: { open: boolean; step: string; compensationOnly?: boolean }) =>
      open ? createElement('div', { role: 'dialog', 'aria-label': `Raise: ${step}${compensationOnly ? ', compensation only' : ''}` }) : null,
  }
})

import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { StuckDetailScreen } from './StuckDetailScreen'
import { seedStuck, storedStuck, stuckPayment } from './testKit'

const SLOW = { timeout: 30_000 }

beforeEach(() => {
  resetProScreens()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 1, 12))
})

afterEach(() => {
  vi.useRealTimers()
})

function open(id = 's1') {
  return renderAt(`/app/stuck/${id}`, <StuckDetailScreen />)
}

const now = () => screen.getByRole('region', { name: 'What to do now' })

describe('StuckDetailScreen — the page', SLOW, () => {
  it('shows who owes it, how much, the clock and the details', () => {
    seedStuck(stuckPayment())
    open()
    expect(screen.getByRole('heading', { level: 1, name: 'Riya Sharma' })).toBeInTheDocument()
    expect(screen.getByText('Failed payment')).toBeInTheDocument()
    expect(screen.getByText('UPI to a person · HDFC ••4821 · GPay')).toBeInTheDocument()
    const clock = screen.getByRole('region', { name: 'The clock' })
    expect(within(clock).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'The money left your account28 Oct',
      'Due back by 29 OctThe RBI’s rule for UPI to a person: back the next day.',
      '3 days late₹300 for the wait so far · ₹100 more each day',
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
})

describe('StuckDetailScreen — what to do now, stage by stage', SLOW, () => {
  it('check: Yes counts it, No sets it aside — each with Undo', async () => {
    seedStuck(stuckPayment({ confirmed: false, date: '2026-10-31' }))
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

  it('waiting: nothing to do yet; It’s back ticks it back in time, with Undo', async () => {
    seedStuck(stuckPayment({ date: '2026-11-01' }))
    const { user } = open()
    expect(now()).toHaveTextContent('Your bank has till 2 Nov to put it back.')
    await user.click(within(now()).getByRole('button', { name: 'It’s back' }))
    const sheet = await screen.findByRole('dialog', { name: 'It’s back' })
    expect(within(sheet).getByRole('textbox', { name: 'How much came back?' })).toHaveValue('500')
    expect(within(sheet).getByText('It came back in time, so no compensation is due.')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Mark it back' }))
    expect(storedStuck('s1')?.back).toEqual({ date: '2026-11-01', amount: 50_000, compensation: 0 })
    expect(await screen.findByText('₹500 from Riya Sharma is back')).toBeInTheDocument()
    expect(now()).toHaveTextContent('All back₹500 came back on 1 Nov.')
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(storedStuck('s1')?.back).toBeNull()
  })

  it('overdue: says what the bank owes under the RBI’s rules, and raises it with the bank', async () => {
    seedStuck(stuckPayment())
    const { user } = open()
    const hero = screen.getByRole('heading', { level: 1 }).closest('header') as HTMLElement
    expect(within(hero).getByText('3 days late')).toBeInTheDocument()
    expect(now()).toHaveTextContent('3 days late — your bank owes you ₹300')
    expect(now()).toHaveTextContent('The RBI’s rules say it had to be back by 29 Oct, and that your bank pays ₹100 for each day after, without being asked.')
    await user.click(within(now()).getByRole('button', { name: 'Raise it with your bank' }))
    expect(screen.getByRole('dialog', { name: 'Raise: bank' })).toBeInTheDocument()
  })

  it('an overdue refund is raised with the business', async () => {
    seedStuck(stuckPayment({ kind: 'refund', rail: null, party: 'Amazon', merchant: 'amazon', amount: 420_000, date: '2026-10-20', promisedBy: '2026-10-28' }))
    const { user } = open()
    expect(now()).toHaveTextContent('4 days late')
    expect(now()).toHaveTextContent('Amazon said it would be back by 28 Oct.')
    await user.click(within(now()).getByRole('button', { name: 'Raise it with Amazon' }))
    expect(screen.getByRole('dialog', { name: 'Raise: merchant' })).toBeInTheDocument()
  })

  it('raised: waits on them, with the letter one tap away', async () => {
    seedStuck(stuckPayment({ steps: [{ kind: 'bank', date: '2026-10-31', ref: 'CMP-778' }] }))
    const { user } = open()
    expect(now()).toHaveTextContent('Raised with your bank on 31 Oct')
    expect(now()).toHaveTextContent('They have till 30 Nov to sort it out.')
    await user.click(within(now()).getByRole('button', { name: 'See the complaint again' }))
    expect(screen.getByRole('dialog', { name: 'Raise: bank' })).toBeInTheDocument()
  })

  it('escalate: after the bank’s 30 days, takes it to the RBI Ombudsman', async () => {
    seedStuck(stuckPayment({ date: '2026-09-20', steps: [{ kind: 'bank', date: '2026-09-25', ref: null }] }))
    const { user } = open()
    expect(now()).toHaveTextContent('Time to take it to the RBI Ombudsman')
    await user.click(within(now()).getByRole('button', { name: 'Take it to the RBI Ombudsman' }))
    expect(screen.getByRole('dialog', { name: 'Raise: ombudsman' })).toBeInTheDocument()
  })

  it('compensation: back late, claims the ₹100 a day — or notes it was paid', async () => {
    seedStuck(stuckPayment({ back: { date: '2026-10-31', amount: 50_000, compensation: 0 } }))
    const { user } = open()
    expect(now()).toHaveTextContent('Back, but 2 days late')
    expect(now()).toHaveTextContent('The RBI’s rules say your bank owes you ₹200 for the wait')
    await user.click(within(now()).getByRole('button', { name: 'Claim ₹200 from your bank' }))
    expect(screen.getByRole('dialog', { name: 'Raise: bank, compensation only' })).toBeInTheDocument()

    await user.click(within(now()).getByRole('button', { name: 'They’ve paid it' }))
    const sheet = await screen.findByRole('dialog', { name: 'What came back' })
    expect(within(sheet).getByRole('textbox', { name: 'Compensation paid with it (optional)' })).toHaveValue('200')
    expect(within(sheet).getByText('The RBI’s rules say ₹200: 2 days late at ₹100 a day.')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Mark it back' }))
    expect(storedStuck('s1')?.back).toEqual({ date: '2026-10-31', amount: 50_000, compensation: 20_000 })
    expect(now()).toHaveTextContent('₹500 came back on 31 Oct, with ₹200 for the wait.')
  })
})

describe('StuckDetailScreen — set aside, bring back, delete', SLOW, () => {
  it('sets it aside and brings it back, each with Undo', async () => {
    seedStuck(stuckPayment())
    const { user } = open()
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Riya Sharma' })).getByRole('button', { name: /^Set aside/ }))
    expect(storedStuck('s1')?.dismissedAt).not.toBeNull()
    expect(now()).toHaveTextContent('It isn’t counted.')
    await user.click(await screen.findByRole('button', { name: /^Undo/ }))
    expect(storedStuck('s1')?.dismissedAt).toBeNull()
  })

  it('deletes it with Undo', async () => {
    seedStuck(stuckPayment())
    const { user } = open()
    await user.click(screen.getByRole('button', { name: 'More options' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Riya Sharma' })).getByRole('button', { name: 'Delete' }))
    expect(storedStuck('s1')).toBeUndefined()
    expect(currentUrl()).toBe('/app/stuck')
    expect(await screen.findByText('Riya Sharma deleted')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Undo/ }))
    expect(storedStuck('s1')).toBeDefined()
  })
})
