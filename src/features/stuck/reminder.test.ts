import { describe, expect, it } from 'vitest'
import type { StuckPayment } from '../../data/stores'
import { googleCalendarUrl, icsFor, reminderFor } from './reminder'
import { nextStep } from './rules'
import { stuckPayment } from './testKit'

const pay = (over: Partial<StuckPayment> = {}): StuckPayment => stuckPayment({ repliedAt: null, ...over })
const remind = (s: StuckPayment, today: string) => reminderFor(s, nextStep(s, today), today)

/** The .ics text with its folded lines joined back up (RFC 5545 §3.1). */
const unfold = (ics: string): string[] => ics.replace(/\r\n /g, '').split('\r\n')

describe('reminderFor — the next date worth a calendar reminder', () => {
  it('waiting: the day after it was due back, to raise it if it isn’t', () => {
    expect(remind(pay({ date: '2026-11-01' }), '2026-11-01')).toEqual({
      kind: 'due',
      date: '2026-11-03',
      title: 'Stuck money: ₹500, Riya Sharma — if it’s not back, raise it in Settle',
      details: 'Open Settle and go to Stuck money: the next step and the complaint are ready there.',
    })
  })

  it('raised: the day the complaint’s time is up and the next place opens', () => {
    const reminder = remind(pay({ steps: [{ kind: 'bank', date: '2026-10-31', ref: null }] }), '2026-11-01')
    expect(reminder?.kind).toBe('next')
    expect(reminder?.date).toBe('2026-12-01')
    expect(reminder?.title).toBe('Stuck money: ₹500, Riya Sharma — their time is up, take it higher in Settle')
  })

  it('a refund raised with the business: a week on, the National Consumer Helpline', () => {
    const s = pay({ kind: 'refund', rail: null, party: 'Flipkart', merchant: 'flipkart', amount: 129_900, date: '2026-10-10', promisedBy: '2026-10-20', steps: [{ kind: 'merchant', date: '2026-10-30', ref: null }] })
    expect(remind(s, '2026-11-01')).toMatchObject({ kind: 'next', date: '2026-11-07', title: 'Stuck money: ₹1,299, Flipkart — their time is up, take it higher in Settle' })
  })

  it('the RBI Ombudsman: a week before its last day, or on the day once that week has begun', () => {
    const s = pay({ date: '2026-09-20', steps: [{ kind: 'bank', date: '2026-09-25', ref: null }] })
    expect(remind(s, '2026-11-01')).toMatchObject({ kind: 'lastDay', date: '2027-01-16', title: 'Stuck money: ₹500, Riya Sharma — file with the RBI Ombudsman by 23 Jan 2027' })
    expect(remind(s, '2027-01-20')).toMatchObject({ kind: 'lastDay', date: '2027-01-23' })
  })

  it('the bank replied: the last day runs from its reply', () => {
    const s = pay({ steps: [{ kind: 'bank', date: '2026-10-29', ref: null }], repliedAt: '2026-10-31' })
    expect(remind(s, '2026-11-01')).toMatchObject({ kind: 'lastDay', date: '2027-01-22' })
  })

  it('all back but the compensation raised: when the bank’s time for it is up', () => {
    const s = pay({ steps: [{ kind: 'bank', date: '2026-10-30', ref: null }], back: { date: '2026-10-31', amount: 50_000, compensation: 0 } })
    expect(remind(s, '2026-11-01')).toMatchObject({ kind: 'next', date: '2026-11-30' })
  })

  it('nothing to remind of: it’s yours to do now, or it’s closed', () => {
    expect(remind(pay(), '2026-11-01')).toBeNull()
    expect(remind(pay({ back: { date: '2026-10-29', amount: 50_000, compensation: 0 } }), '2026-11-01')).toBeNull()
    expect(remind(pay({ dismissedAt: 1 }), '2026-11-01')).toBeNull()
    expect(remind(pay({ confirmed: false }), '2026-11-01')).toBeNull()
  })
})

describe('the calendar event', () => {
  const reminder = reminderFor(pay({ date: '2026-11-01' }), nextStep(pay({ date: '2026-11-01' }), '2026-11-01'), '2026-11-01')
  if (!reminder) throw new Error('expected a reminder')

  it('is an all-day .ics event on its day, with an alert that morning', () => {
    const ics = icsFor(reminder, 's1', new Date(Date.UTC(2026, 10, 1, 6, 30, 15, 120)))
    expect(ics.endsWith('\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '').includes('\n')).toBe(false)
    const lines = unfold(ics)
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines).toContain('UID:stuck-s1-due-20261103@settle')
    expect(lines).toContain('DTSTAMP:20261101T063015Z')
    expect(lines).toContain('DTSTART;VALUE=DATE:20261103')
    expect(lines).toContain('DTEND;VALUE=DATE:20261104')
    expect(lines).toContain('SUMMARY:Stuck money: ₹500\\, Riya Sharma — if it’s not back\\, raise it in Settle')
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

  it('opens in Google Calendar as a filled-in new event', () => {
    const url = new URL(googleCalendarUrl(reminder))
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(url.searchParams.get('action')).toBe('TEMPLATE')
    expect(url.searchParams.get('dates')).toBe('20261103/20261104')
    expect(url.searchParams.get('text')).toBe(reminder.title)
    expect(url.searchParams.get('details')).toBe(reminder.details)
  })
})
