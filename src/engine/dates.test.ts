import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  dateInPeriod,
  daysBetween,
  daysInMonth,
  isIsoDate,
  isPeriod,
  periodOf,
  periodsBetween,
  toIsoDate,
  today,
} from './dates'

describe('dates', () => {
  it('formats local dates', () => {
    expect(toIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(today(new Date(2026, 9, 21, 0, 1))).toBe('2026-10-21')
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('validates real calendar dates and months', () => {
    expect(isIsoDate('2026-02-28')).toBe(true)
    expect(isIsoDate('2028-02-29')).toBe(true)
    expect(isIsoDate('2026-02-29')).toBe(false)
    expect(isIsoDate('2026-13-01')).toBe(false)
    expect(isIsoDate('2026-1-01')).toBe(false)
    expect(isIsoDate(20261021)).toBe(false)
    expect(isPeriod('2026-10')).toBe(true)
    expect(isPeriod('2026-00')).toBe(false)
    expect(isPeriod('2026-10-01')).toBe(false)
    expect(isPeriod(null)).toBe(false)
  })

  it('knows month lengths', () => {
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(2026, 12)).toBe(31)
    expect(daysInMonth(2026, 4)).toBe(30)
  })

  it('adds days across months, years and DST changes', () => {
    expect(addDays('2026-10-21', 11)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addDays('nope', 3)).toBe('nope')
    expect(daysBetween('2026-10-21', '2026-11-01')).toBe(11)
    expect(daysBetween('2026-11-01', '2026-10-21')).toBe(-11)
    expect(daysBetween('bad', '2026-11-01')).toBe(0)
  })

  it('works with months', () => {
    expect(periodOf('2026-10-21')).toBe('2026-10')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-05', 14)).toBe('2027-07')
    expect(addMonths('bad', 1)).toBe('bad')
    expect(periodsBetween('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
    expect(periodsBetween('2026-11', '2026-10')).toEqual([])
    expect(periodsBetween('x', '2026-10')).toEqual([])
    expect(dateInPeriod('2026-02', 31)).toBe('2026-02-28')
    expect(dateInPeriod('2026-10', 5)).toBe('2026-10-05')
    expect(dateInPeriod('2026-10', 0)).toBe('2026-10-01')
  })
})
