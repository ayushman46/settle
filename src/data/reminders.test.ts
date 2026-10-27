import { beforeEach, describe, expect, it } from 'vitest'
import { daysSince, isQuietHour, MAX_REMINDERS, nextTone, noteReminder, remindersFor, tooSoon } from './reminders'
import { remindersStore, type Reminder } from './stores'
import { resetDataForTests } from './testing'

beforeEach(() => {
  resetDataForTests()
})

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime()
const sent = (...times: number[]): Reminder[] => times.map((time) => ({ friendId: 'riya', at: time, tone: 'friendly' }))

describe('reminders', () => {
  it('notes each reminder, keeping the newest few hundred', () => {
    noteReminder('riya', 'friendly', 1)
    noteReminder('sam', 'firm', 2)
    expect(remindersStore.get()).toEqual([
      { friendId: 'riya', at: 1, tone: 'friendly' },
      { friendId: 'sam', at: 2, tone: 'firm' },
    ])
    for (let i = 0; i < MAX_REMINDERS; i++) noteReminder('riya', 'funny', 10 + i)
    expect(remindersStore.get()).toHaveLength(MAX_REMINDERS)
    expect(remindersStore.get()[0]?.at).toBe(10)
  })

  it('lists one person’s since a time, oldest first', () => {
    const all: Reminder[] = [
      { friendId: 'riya', at: 30, tone: 'funny' },
      { friendId: 'sam', at: 20, tone: 'friendly' },
      { friendId: 'riya', at: 10, tone: 'friendly' },
      { friendId: 'riya', at: 5, tone: 'firm' },
    ]
    expect(remindersFor(all, 'riya', 10).map((r) => r.at)).toEqual([10, 30])
  })

  it('climbs the tone: friendly, then funny, then firm', () => {
    expect(nextTone([])).toBe('friendly')
    expect(nextTone(sent(1))).toBe('funny')
    expect(nextTone(sent(1, 2))).toBe('firm')
    expect(nextTone(sent(1, 2, 3, 4))).toBe('firm')
  })

  it('counts calendar days, and holds back a second ask within two days', () => {
    const now = at(2026, 10, 27, 9)
    expect(daysSince(at(2026, 10, 27, 1), now)).toBe(0)
    expect(daysSince(at(2026, 10, 26, 23), now)).toBe(1)
    expect(daysSince(at(2026, 10, 20), now)).toBe(7)
    expect(daysSince(now + 1000, now)).toBe(0)
    expect(tooSoon([], now)).toBe(false)
    expect(tooSoon(sent(at(2026, 10, 26, 23)), now)).toBe(true)
    expect(tooSoon(sent(at(2026, 10, 25, 9)), now)).toBe(false)
  })

  it('late night and early morning are quiet hours', () => {
    expect(isQuietHour(new Date(2026, 9, 27, 22))).toBe(true)
    expect(isQuietHour(new Date(2026, 9, 27, 7, 59))).toBe(true)
    expect(isQuietHour(new Date(2026, 9, 27, 8))).toBe(false)
    expect(isQuietHour(new Date(2026, 9, 27, 21, 59))).toBe(false)
  })
})
