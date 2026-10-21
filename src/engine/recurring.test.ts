import { describe, expect, it } from 'vitest'
import type { RecurringTemplate } from '../domain/types'
import { dueRecurring, nextRecurringPeriod } from './recurring'

function template(partial: Partial<RecurringTemplate> = {}): RecurringTemplate {
  return {
    id: 'r1',
    title: 'Rent',
    category: 'rent',
    currency: 'INR',
    total: 3200000,
    payerId: 'me',
    mode: 'equal',
    participants: [{ friendId: 'me', input: null }],
    dayOfMonth: 1,
    groupId: null,
    lastCreatedPeriod: null,
    active: true,
    // Local 2026-01-01 00:00 — before every due date below.
    createdAt: new Date(2026, 0, 1).getTime(),
    ...partial,
  }
}

describe('nextRecurringPeriod', () => {
  it('asks for this month until it has been split', () => {
    expect(nextRecurringPeriod(template({ dayOfMonth: 5 }), '2026-10-21')).toEqual({ period: '2026-10', dueDate: '2026-10-05' })
  })

  it('moves on to next month once this month is done', () => {
    expect(nextRecurringPeriod(template({ dayOfMonth: 5, lastCreatedPeriod: '2026-10' }), '2026-10-21')).toEqual({
      period: '2026-11',
      dueDate: '2026-11-05',
    })
    expect(nextRecurringPeriod(template({ lastCreatedPeriod: '2026-12' }), '2026-10-21').period).toBe('2027-01')
  })

  it('does not nag about months skipped long ago', () => {
    expect(nextRecurringPeriod(template({ lastCreatedPeriod: '2026-06' }), '2026-10-21').period).toBe('2026-10')
  })

  it('starts after the due day that had already passed when it was set up', () => {
    const created = new Date(2026, 9, 21, 12).getTime()
    expect(nextRecurringPeriod(template({ dayOfMonth: 1, createdAt: created }), '2026-10-21').period).toBe('2026-11')
    expect(nextRecurringPeriod(template({ dayOfMonth: 25, createdAt: created }), '2026-10-21').period).toBe('2026-10')
    expect(nextRecurringPeriod(template({ dayOfMonth: 21, createdAt: created }), '2026-10-21').period).toBe('2026-10')
  })
})

describe('dueRecurring', () => {
  it('lists overdue and soon-due templates, soonest first', () => {
    const list = [
      template({ id: 'wifi', title: 'Wi-Fi', dayOfMonth: 25 }),
      template({ id: 'rent', title: 'Rent', dayOfMonth: 1 }),
      template({ id: 'netflix', title: 'Netflix', dayOfMonth: 28, lastCreatedPeriod: '2026-10' }),
      template({ id: 'off', title: 'Paused', active: false }),
    ]
    const due = dueRecurring(list, '2026-10-21')
    expect(due.map((d) => [d.template.id, d.period, d.dueDate, d.overdue, d.daysUntil])).toEqual([
      ['rent', '2026-10', '2026-10-01', true, -20],
      ['wifi', '2026-10', '2026-10-25', false, 4],
    ])
  })

  it('includes next month when it is within the window', () => {
    const due = dueRecurring([template({ dayOfMonth: 2, lastCreatedPeriod: '2026-10' })], '2026-10-28')
    expect(due).toHaveLength(1)
    expect(due[0]).toMatchObject({ period: '2026-11', dueDate: '2026-11-02', overdue: false, daysUntil: 5 })
  })

  it('takes a custom window and treats the due day itself as not overdue', () => {
    const t = template({ dayOfMonth: 21 })
    expect(dueRecurring([t], '2026-10-21')[0]).toMatchObject({ overdue: false, daysUntil: 0 })
    expect(dueRecurring([template({ dayOfMonth: 28 })], '2026-10-21', { withinDays: 3 })).toEqual([])
    expect(dueRecurring([template({ dayOfMonth: 28 })], '2026-10-21', { withinDays: 30 })).toHaveLength(1)
  })

  it('breaks same-day ties by title and ignores a bad date', () => {
    const due = dueRecurring([template({ id: 'b', title: 'Wi-Fi' }), template({ id: 'a', title: 'Gym' })], '2026-10-02')
    expect(due.map((d) => d.template.title)).toEqual(['Gym', 'Wi-Fi'])
    expect(dueRecurring([template()], 'today')).toEqual([])
  })
})
