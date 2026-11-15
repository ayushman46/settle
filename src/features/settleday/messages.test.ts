import { describe, expect, it } from 'vitest'
import type { Friend } from '../../domain/types'
import type { Transfer } from '../../engine/balances'
import { settleDayStatus, summarizeOpen } from './engine'
import { chipLabel, dayLabel, everyLabel, openLine, weekdayDate } from './labels'
import { calendarFile, calendarFilename, MAX_TELL_LINES, remindText, tellGroupText } from './messages'

const friend = (id: string, name: string, upiId: string | null = null): Friend => ({ id, name, color: 0, upiId, phone: null, createdAt: 0, lastUsedAt: 0 })
const friendsById: Record<string, Friend> = {
  me: friend('me', 'Ayush'),
  riya: friend('riya', 'Riya Sharma', 'Riya@OkICICI'),
  sam: friend('sam', 'Sam'),
}
const profile = { name: 'Ayush', upiId: 'ayush@upi' }
const group = { id: 'flat', name: 'Flat 4B', currency: 'INR' }
const payments: Transfer[] = [
  { fromId: 'me', toId: 'riya', amount: 50_000 },
  { fromId: 'sam', toId: 'me', amount: 30_050 },
  { fromId: 'sam', toId: 'riya', amount: 12_000 },
]

describe('the day in words', () => {
  it('says the day as people do', () => {
    expect(dayLabel(1)).toBe('the 1st')
    expect(dayLabel(22)).toBe('the 22nd')
    expect(dayLabel(13)).toBe('the 13th')
    expect(dayLabel('last')).toBe('the last day of the month')
    expect(everyLabel(3)).toBe('the 3rd of every month')
    expect(everyLabel('last')).toBe('the last day of every month')
    expect(chipLabel(10)).toBe('10th')
    expect(chipLabel('last')).toBe('Last day')
  })

  it('gives a date its weekday', () => {
    expect(weekdayDate('2026-12-05')).toBe('Sat, 5 Dec')
    expect(weekdayDate('2028-02-29')).toBe('Tue, 29 Feb')
    expect(weekdayDate('someday')).toBe('someday')
  })

  it('the open line is about the owner, and its numbers are the ones it names', () => {
    expect(openLine(summarizeOpen(payments, 'me'), group)).toBe('You pay ₹500. 3 payments clear Flat 4B.')
    expect(openLine(summarizeOpen(payments.slice(1), 'me'), group)).toBe('₹300.50 is coming to you. 2 payments clear Flat 4B.')
    expect(openLine(summarizeOpen(payments.slice(2), 'me'), group)).toBe('1 payment between the others clears Flat 4B.')
  })
})

describe('the message to the group', () => {
  it('before the day: the day and the next date, nothing about who owes what', () => {
    const status = settleDayStatus(5, '2026-11-26', { open: true })
    expect(tellGroupText({ group, day: 5, status, payments, friendsById, profile })).toBe(
      'Our settle day for Flat 4B is the 5th of every month. On that day everyone clears what they owe in the group.\nNext one: Sat, 5 Dec.',
    )
  })

  it('on the day: who pays whom, with the names other people know (never “You”)', () => {
    const status = settleDayStatus(5, '2026-12-05', { open: true })
    expect(tellGroupText({ group, day: 5, status, payments, friendsById, profile })).toBe(
      [
        'Our settle day for Flat 4B is the 5th of every month. On that day everyone clears what they owe in the group.',
        'That’s today.',
        '',
        'To settle today:',
        'Ayush pays Riya Sharma ₹500',
        'Sam pays Ayush ₹300.50',
        'Sam pays Riya Sharma ₹120',
      ].join('\n'),
    )
  })

  it('on the day with nothing open, it says everyone is square', () => {
    const status = settleDayStatus('last', '2026-11-30', { open: false })
    expect(tellGroupText({ group, day: 'last', status, payments: [], friendsById, profile })).toBe(
      'Our settle day for Flat 4B is the last day of every month. On that day everyone clears what they owe in the group.\nThat’s today.\nRight now everyone is square.',
    )
  })

  it('the day after, it says so', () => {
    const status = settleDayStatus(5, '2026-12-06', { open: true })
    const text = tellGroupText({ group, day: 5, status, payments: payments.slice(2), friendsById, profile })
    expect(text).toContain('\n\nIt was yesterday. Still open:\nSam pays Riya Sharma ₹120')
    expect(text).not.toContain('That’s today.')
  })

  it('counts the payments it has no room to list', () => {
    const many: Transfer[] = Array.from({ length: MAX_TELL_LINES + 3 }, (_, i) => ({ fromId: 'sam', toId: 'riya', amount: 1_000 + i }))
    const lines = tellGroupText({ group, day: 5, status: settleDayStatus(5, '2026-12-05', { open: true }), payments: many, friendsById, profile }).split('\n')
    expect(lines.filter((l) => l.startsWith('Sam pays'))).toHaveLength(MAX_TELL_LINES)
    expect(lines[lines.length - 1]).toBe('and 3 more payments')
  })
})

describe('a reminder to one person', () => {
  it('says their part and where it goes, with the receiver’s UPI ID when it is saved', () => {
    expect(remindText({ group, payment: payments[2]!, phase: 'today', friendsById, profile })).toBe(
      'Hi Sam, today is settle day for Flat 4B. Your part: ₹120 to Riya Sharma.\nUPI ID for Riya Sharma: riya@okicici',
    )
  })

  it('money coming to the owner reads “to me”, with the owner’s own UPI ID', () => {
    expect(remindText({ group, payment: payments[1]!, phase: 'yesterday', friendsById, profile })).toBe(
      'Hi Sam, settle day for Flat 4B was yesterday. Your part: ₹300.50 to me.\nMy UPI ID: ayush@upi',
    )
  })

  it('without a settle day (or before it) it doesn’t claim one, and without a UPI ID it doesn’t invent one', () => {
    const toSam: Transfer = { fromId: 'riya', toId: 'sam', amount: 70_000 }
    expect(remindText({ group, payment: toSam, phase: null, friendsById, profile })).toBe('Hi Riya, we’re clearing up Flat 4B. Your part: ₹700 to Sam.')
    expect(remindText({ group, payment: toSam, phase: 'waiting', friendsById, profile })).toBe('Hi Riya, we’re clearing up Flat 4B. Your part: ₹700 to Sam.')
    expect(remindText({ group, payment: payments[1]!, phase: 'today', friendsById, profile: { name: 'Ayush', upiId: null } })).not.toContain('UPI')
  })

  it('leaves UPI out for money that isn’t rupees', () => {
    const text = remindText({ group: { ...group, currency: 'USD' }, payment: payments[2]!, phase: 'today', friendsById, profile })
    expect(text).toBe('Hi Sam, today is settle day for Flat 4B. Your part: $120 to Riya Sharma.')
  })

  it('someone with no name on this phone is greeted plainly, never by a placeholder', () => {
    const text = remindText({ group, payment: { fromId: 'gone', toId: 'riya', amount: 10_000 }, phase: 'today', friendsById, profile })
    expect(text).toBe('Hi there, today is settle day for Flat 4B. Your part: ₹100 to Riya Sharma.\nUPI ID for Riya Sharma: riya@okicici')
  })
})

describe('the calendar file for a group', () => {
  it('names the group and repeats on its day', () => {
    const text = calendarFile(group, 'last', '2026-11-15', new Date(Date.UTC(2026, 10, 15, 4)))
    expect(text).toContain('UID:settle-day-flat@settle\r\n')
    expect(text).toContain('SUMMARY:Settle day: Flat 4B\r\n')
    expect(text).toContain('DTSTART;VALUE=DATE:20261130\r\n')
    expect(text).toContain('RRULE:FREQ=MONTHLY;BYMONTHDAY=-1\r\n')
  })

  it('names the file after the group, always ending .ics', () => {
    expect(calendarFilename({ name: 'Flat 4B' })).toBe('settle-day-Flat 4B.ics')
    expect(calendarFilename({ name: 'Goa v2.0' })).toBe('settle-day-Goa v2 0.ics')
    expect(calendarFilename({ name: '  ' })).toBe('settle-day.ics')
  })
})
