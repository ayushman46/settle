import { describe, expect, it } from 'vitest'
import type { StuckPayment } from '../../data/stores'
import { googleCalendarUrl, icsFor, reminderFor, remindLabel } from './reminder'
import { nextStep } from './rules'
import { stuckPayment } from './testKit'

const pay = (over: Partial<StuckPayment> = {}): StuckPayment => stuckPayment({ repliedAt: null, ...over })
const remind = (s: StuckPayment, today: string) => reminderFor(s, nextStep(s, today), today)

/** The .ics text with its folded lines joined back up (RFC 5545 §3.1). */
const unfold = (ics: string): string[] => ics.replace(/\r\n /g, '').split('\r\n')

const DETAILS = 'Open Settle and go to Stuck money: the next step and the complaint are ready there.\nhttps://settleupi.vercel.app/app/stuck/s1'

describe('reminderFor — the next date worth a calendar reminder', () => {
  it('waiting: the day after it was due back, to raise it if it isn’t — named as the list names it', () => {
    expect(remind(pay({ date: '2026-11-01' }), '2026-11-01')).toEqual({
      kind: 'due',
      date: '2026-11-03',
      title: 'Stuck money: Failed payment to Riya Sharma, ₹500 — if it’s not back, raise it in Settle',
      details: DETAILS,
    })
  })

  it('raised: the day the complaint’s time is up, saying where it goes next', () => {
    const reminder = remind(pay({ steps: [{ kind: 'bank', date: '2026-10-31', ref: null }] }), '2026-11-01')
    expect(reminder?.kind).toBe('next')
    expect(reminder?.date).toBe('2026-12-01')
    expect(reminder?.title).toBe('Stuck money: Failed payment to Riya Sharma, ₹500 — not sorted? Take it to the RBI Ombudsman in Settle')
  })

  it('a refund raised with the business: a week on, the National Consumer Helpline', () => {
    const s = pay({ kind: 'refund', rail: null, party: 'Flipkart', merchant: 'flipkart', amount: 129_900, date: '2026-10-10', promisedBy: '2026-10-20', steps: [{ kind: 'merchant', date: '2026-10-30', ref: null }] })
    expect(remind(s, '2026-11-01')).toMatchObject({ kind: 'next', date: '2026-11-07', title: 'Stuck money: Flipkart refund, ₹1,299 — not sorted? Take it to the National Consumer Helpline in Settle' })
  })

  it('part of it back: what’s still to come, of what it was', () => {
    const s = pay({
      kind: 'refund',
      rail: null,
      party: 'Flipkart',
      merchant: 'flipkart',
      amount: 129_900,
      date: '2026-10-10',
      promisedBy: '2026-10-20',
      steps: [{ kind: 'merchant', date: '2026-11-02', ref: null }],
      back: { date: '2026-11-02', amount: 100_000, compensation: 0 },
    })
    expect(remind(s, '2026-11-02')).toMatchObject({ kind: 'next', date: '2026-11-10', title: 'Stuck money: Flipkart refund, ₹299 of ₹1,299 — not sorted? Take it to the National Consumer Helpline in Settle' })
  })

  it('all back but the compensation raised: the bank owes the ₹200 — not the payee the ₹14,000', () => {
    const s = pay({ party: 'Neha', amount: 1_400_000, steps: [{ kind: 'bank', date: '2026-10-30', ref: null }], back: { date: '2026-10-31', amount: 1_400_000, compensation: 0 } })
    expect(remind(s, '2026-11-01')).toMatchObject({
      kind: 'next',
      date: '2026-11-30',
      title: 'Stuck money: your bank owes you ₹200 for the wait (Failed payment to Neha) — not paid? Take it to the RBI Ombudsman in Settle',
    })
  })

  it('a wallet’s compensation is owed by the wallet company', () => {
    const s = pay({ rail: 'wallet', app: 'paytm', bank: null, steps: [{ kind: 'bank', date: '2026-10-30', ref: null }], back: { date: '2026-10-31', amount: 50_000, compensation: 0 } })
    expect(remind(s, '2026-11-01')?.title).toMatch(/^Stuck money: Paytm owes you ₹200 for the wait/)
  })

  it('yours to do now: tomorrow, saying what to do', () => {
    expect(remind(pay(), '2026-11-01')).toMatchObject({ kind: 'act', date: '2026-11-02', title: 'Stuck money: Failed payment to Riya Sharma, ₹500 — raise it with your bank in Settle' })
    expect(remind(pay({ back: { date: '2026-10-31', amount: 50_000, compensation: 0 } }), '2026-11-01')).toMatchObject({
      kind: 'act',
      date: '2026-11-02',
      title: 'Stuck money: your bank owes you ₹200 for the wait (Failed payment to Riya Sharma) — claim it in Settle',
    })
  })

  it('the RBI Ombudsman: tomorrow, with its last day — none once that day is gone', () => {
    const s = pay({ date: '2026-09-20', steps: [{ kind: 'bank', date: '2026-09-25', ref: null }] })
    expect(remind(s, '2026-11-01')).toMatchObject({ kind: 'act', date: '2026-11-02', title: 'Stuck money: Failed payment to Riya Sharma, ₹500 — file with the RBI Ombudsman by 23 Jan 2027' })
    expect(remind(s, '2027-01-22')).toMatchObject({ date: '2027-01-23' })
    expect(remind(s, '2027-01-23')).toBeNull()
  })

  it('the bank replied early: the last day still runs from the end of its 30 days', () => {
    const s = pay({ steps: [{ kind: 'bank', date: '2026-10-29', ref: null }], repliedAt: '2026-10-31' })
    expect(remind(s, '2026-11-01')?.title).toBe('Stuck money: Failed payment to Riya Sharma, ₹500 — file with the RBI Ombudsman by 26 Feb 2027')
  })

  it('a refund past the business: tomorrow, to take it to the helpline', () => {
    const s = pay({ kind: 'refund', rail: null, party: 'Flipkart', merchant: 'flipkart', amount: 129_900, date: '2026-10-01', promisedBy: '2026-10-10', steps: [{ kind: 'merchant', date: '2026-10-12', ref: null }] })
    expect(remind(s, '2026-11-01')).toMatchObject({ kind: 'act', date: '2026-11-02', title: 'Stuck money: Flipkart refund, ₹1,299 — take it to the National Consumer Helpline in Settle' })
  })

  it('nothing to remind of: it’s closed, set aside, still to check, or with them', () => {
    expect(remind(pay({ back: { date: '2026-10-29', amount: 50_000, compensation: 0 } }), '2026-11-01')).toBeNull()
    expect(remind(pay({ dismissedAt: 1 }), '2026-11-01')).toBeNull()
    expect(remind(pay({ confirmed: false }), '2026-11-01')).toBeNull()
    expect(remind(pay({ steps: [{ kind: 'bank', date: '2026-09-25', ref: null }, { kind: 'ombudsman', date: '2026-10-30', ref: null }] }), '2026-11-01')).toBeNull()
  })

  it('the button and its sheet: tomorrow, or the day', () => {
    const tomorrow = remind(pay(), '2026-11-01')
    const later = remind(pay({ date: '2026-11-01' }), '2026-11-01')
    if (!tomorrow || !later) throw new Error('expected reminders')
    expect(remindLabel(tomorrow, '2026-11-01')).toBe('Remind me tomorrow')
    expect(remindLabel(later, '2026-11-01')).toBe('Remind me on 3 Nov')
  })
})

describe('the calendar event', () => {
  const reminder = reminderFor(pay({ date: '2026-11-01' }), nextStep(pay({ date: '2026-11-01' }), '2026-11-01'), '2026-11-01')
  if (!reminder) throw new Error('expected a reminder')

  it('is an all-day .ics event on its day, with an alert that morning and a link to the payment', () => {
    const ics = icsFor(reminder, 's1', new Date(Date.UTC(2026, 10, 1, 6, 30, 15, 120)))
    expect(ics.endsWith('\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '').includes('\n')).toBe(false)
    const lines = unfold(ics)
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines).toContain('UID:stuck-s1-due-20261103@settle')
    expect(lines).toContain('DTSTAMP:20261101T063015Z')
    expect(lines).toContain('DTSTART;VALUE=DATE:20261103')
    expect(lines).toContain('DTEND;VALUE=DATE:20261104')
    expect(lines).toContain('SUMMARY:Stuck money: Failed payment to Riya Sharma\\, ₹500 — if it’s not back\\, raise it in Settle')
    expect(lines).toContain('DESCRIPTION:Open Settle and go to Stuck money: the next step and the complaint are ready there.\\nhttps://settleupi.vercel.app/app/stuck/s1')
    expect(lines).toContain('URL:https://settleupi.vercel.app/app/stuck/s1')
    expect(lines).toContain('TRIGGER:PT9H')
    expect(lines.at(-2)).toBe('END:VCALENDAR')
  })

  it('folds long lines at 75 bytes without splitting a character', () => {
    const long = { ...reminder, title: 'अटका पैसा: ₹12,000, राजेश कुमार — अगर वापस नहीं आया, तो Settle में शिकायत करें'.repeat(2) }
    const ics = icsFor(long, 's1', new Date(0))
    const encoder = new TextEncoder()
    for (const line of ics.split('\r\n')) expect(encoder.encode(line).length).toBeLessThanOrEqual(75)
    expect(unfold(ics)).toContain(`SUMMARY:${long.title.replace(/,/g, '\\,')}`)
  })

  it('opens in Google Calendar as a filled-in new event, the link in its notes', () => {
    const url = new URL(googleCalendarUrl(reminder))
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('dates')).toBe('20261103/20261104')
    expect(url.searchParams.get('text')).toBe(reminder.title)
    expect(url.searchParams.get('details')).toBe(DETAILS)
  })
})
