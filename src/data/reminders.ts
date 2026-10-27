/**
 * Reminders you've sent people who owe you — who, when, and in what tone — so "To collect"
 * (src/features/collect) can say when you last asked, suggest the next tone (friendly first, then
 * light-hearted, then firm) and hold you back from asking twice in a day. Recorded by the reminder
 * sheet whenever a message goes out; kept on this phone and backed up.
 */
import { remindersStore, type Reminder, type ReminderTone } from './stores'

/** Enough history for anyone; the oldest fall off after this. */
export const MAX_REMINDERS = 500
/** Asking again sooner than this reads as nagging. */
export const REMINDER_GAP_DAYS = 2

const DAY_MS = 86_400_000

/** Notes a reminder that just went out. */
export function noteReminder(friendId: string, tone: ReminderTone, now: number = Date.now()): void {
  remindersStore.set([...remindersStore.get(), { friendId, at: now, tone }].slice(-MAX_REMINDERS))
}

/** The reminders sent to `friendId` at or after `since` (epoch ms), oldest first. */
export function remindersFor(all: readonly Reminder[], friendId: string, since = 0): Reminder[] {
  return all.filter((r) => r.friendId === friendId && r.at >= since).sort((a, b) => a.at - b.at)
}

/** The tone for the next reminder: friendly the first time, light-hearted the second, firm after that. */
export function nextTone(sent: readonly Reminder[]): ReminderTone {
  if (sent.length === 0) return 'friendly'
  return sent.length === 1 ? 'funny' : 'firm'
}

/** Whole days since `at` by the calendar (0 = today), on this phone's clock. */
export function daysSince(at: number, now: number = Date.now()): number {
  const day = (ms: number) => {
    const d = new Date(ms)
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS
  }
  return Math.max(0, day(now) - day(at))
}

/** The last reminder went out less than `REMINDER_GAP_DAYS` ago. */
export function tooSoon(sent: readonly Reminder[], now: number = Date.now()): boolean {
  const last = sent.at(-1)
  return last !== undefined && daysSince(last.at, now) < REMINDER_GAP_DAYS
}

/** Late at night or early in the morning (10 pm – 8 am): a reminder can wait. */
export function isQuietHour(date: Date = new Date()): boolean {
  const hour = date.getHours()
  return hour >= 22 || hour < 8
}
