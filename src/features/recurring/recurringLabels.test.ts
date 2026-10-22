import { describe, expect, it } from 'vitest'
import { ME_ID, type RecurringTemplate } from '../../domain/types'
import {
  dueLabel,
  firstDueDate,
  monthName,
  nextLabel,
  ordinal,
  repeatsLabel,
  shortDate,
  standingFromShares,
  standingLine,
  templateStanding,
} from './recurringLabels'

function template(patch: Partial<RecurringTemplate> = {}): RecurringTemplate {
  return {
    id: 't1',
    title: 'Rent',
    category: 'rent',
    currency: 'INR',
    total: 3200000,
    payerId: ME_ID,
    mode: 'equal',
    participants: [
      { friendId: ME_ID, input: null },
      { friendId: 'riya', input: null },
      { friendId: 'sam', input: null },
    ],
    dayOfMonth: 1,
    groupId: null,
    lastCreatedPeriod: null,
    active: true,
    createdAt: new Date(2026, 0, 1).getTime(),
    ...patch,
  }
}

describe('ordinal', () => {
  it('writes English ordinals, teens included', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 28].map(ordinal)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '28th',
    ])
  })

  it('says when it repeats', () => {
    expect(repeatsLabel(1)).toBe('Every month on the 1st')
    expect(repeatsLabel(22)).toBe('Every month on the 22nd')
  })
})

describe('dates', () => {
  it('writes short dates and month names (with the year only when it differs)', () => {
    expect(shortDate('2026-11-01')).toMatch(/1.*Nov|Nov.*1/)
    expect(shortDate('nope')).toBe('nope')
    expect(monthName('2026-11', '2026-10-22')).toBe('November')
    expect(monthName('2027-01', '2026-12-30')).toBe('January 2027')
  })

  it('works out the first due date for a new recurring split', () => {
    expect(firstDueDate(25, '2026-10-22')).toBe('2026-10-25')
    expect(firstDueDate(22, '2026-10-22')).toBe('2026-10-22')
    expect(firstDueDate(1, '2026-10-22')).toBe('2026-11-01')
    expect(firstDueDate(5, '2026-12-20')).toBe('2027-01-05')
  })

  it('labels how soon it is due', () => {
    expect(dueLabel({ dueDate: '2026-10-05', daysUntil: -17, overdue: true })).toMatch(/^Overdue since .*5/)
    expect(dueLabel({ dueDate: '2026-10-22', daysUntil: 0, overdue: false })).toBe('Due today')
    expect(dueLabel({ dueDate: '2026-10-23', daysUntil: 1, overdue: false })).toBe('Due tomorrow')
    expect(dueLabel({ dueDate: '2026-10-25', daysUntil: 3, overdue: false })).toBe('Due in 3 days')
  })

  it('names the next split of a template', () => {
    expect(nextLabel(template({ lastCreatedPeriod: '2026-10' }), '2026-10-22')).toMatch(/^Next: .*Nov/)
  })
})

describe('standing', () => {
  it('is what the others owe me when I pay', () => {
    expect(standingFromShares(ME_ID, 3000, { [ME_ID]: 1000, riya: 1000, sam: 1000 })).toEqual({ kind: 'owed', amount: 2000 })
  })

  it('is my share when someone else pays', () => {
    expect(standingFromShares('riya', 3000, { [ME_ID]: 1000, riya: 2000 })).toEqual({ kind: 'owe', amount: 1000 })
  })

  it('is nothing when it is all on one person', () => {
    expect(standingFromShares(ME_ID, 3000, { [ME_ID]: 3000 })).toEqual({ kind: 'none', amount: 0 })
    expect(standingFromShares('riya', 3000, { riya: 3000 })).toEqual({ kind: 'none', amount: 0 })
  })

  it('works out a template’s monthly standing with the engine', () => {
    expect(templateStanding(template())).toEqual({ kind: 'owed', amount: 2133333 })
    const broken = template({ mode: 'exact', participants: [{ friendId: ME_ID, input: 100 }] })
    expect(templateStanding(broken)).toBeNull()
  })

  it('reads it out', () => {
    expect(standingLine({ kind: 'owed', amount: 2133333 }, 'INR', 'You')).toBe("You'll be owed ₹21,333.33")
    expect(standingLine({ kind: 'owe', amount: 100000 }, 'INR', 'Riya')).toBe("You'll owe Riya ₹1,000")
    expect(standingLine({ kind: 'owe', amount: 100000 }, 'INR', 'Riya', 'now')).toBe('You owe Riya ₹1,000')
    expect(standingLine({ kind: 'owed', amount: 100000 }, 'INR', 'You', 'now')).toBe("You're owed ₹1,000")
    expect(standingLine({ kind: 'none', amount: 0 }, 'INR', 'You')).toBeNull()
    expect(standingLine(null, 'INR', 'You')).toBeNull()
  })
})
