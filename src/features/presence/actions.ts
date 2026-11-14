/** Changing expenses for "who was there when", with an exact Undo, and a stay in a few words. */
import { restoreExpense, saveExpense } from '../../data'
import { daysBetween, isIsoDate, today as todayIso } from '../../engine/dates'
import type { Expense, Group, Participant } from '../../domain/types'
import { t } from '../../i18n'
import { relativeDateLabel } from '../../kit/dateLabel'
import { formatMoney } from '../../lib/money'
import { usableStay, withoutPerson, type NightsRange, type Stay } from './engine'
import { presenceStore, setAnchor } from './store'

/**
 * Saves `e` with other people (and optionally another split), keeping everything else. Paid-back
 * ticks and part payments carry over as `saveExpense` carries them over any edit.
 */
function resave(e: Expense, participants: Participant[], mode: Expense['mode'] = e.mode): Expense {
  const { createdAt: _c, updatedAt: _u, shares: _s, paidBack: _p, partPaid: _pp, ...rest } = e
  return saveExpense({ ...rest, mode, participants })
}

export interface Change {
  /** How many expenses changed. */
  count: number
  /** The expenses that changed, as they were before. */
  changed: Expense[]
  /** Puts every changed expense back exactly as it was (paid-back ticks included). */
  undo: () => void
}

/** Takes `friendId` off each expense (only these: the engine decides which are safe). */
export function takeOff(expenses: readonly Expense[], friendId: string): Change {
  const before: Expense[] = []
  for (const e of expenses) {
    try {
      resave(e, withoutPerson(e, friendId))
      before.push(e)
    } catch {
      // Left as it was: the banner keeps listing it.
    }
  }
  return { count: before.length, changed: before, undo: () => before.forEach(restoreExpense) }
}

/**
 * Re-splits `e` by these weights (`mode: 'shares'`) and remembers the nights range they came from,
 * so the stay keeps the same nights when a later expense moves the trip's last day.
 */
export function splitByNights(e: Expense, participants: Participant[], range?: NightsRange): Change {
  const hadAnchor = presenceStore.get().anchors?.[e.id] ?? null
  resave(e, participants, 'shares')
  if (range) setAnchor(e.id, range)
  return {
    count: 1,
    changed: [e],
    undo: () => {
      restoreExpense(e)
      setAnchor(e.id, hadAnchor)
    },
  }
}

/** "Villa (₹12,000)": an expense by name and amount, for lists in the banner and its toast. */
export function expenseItem(e: Pick<Expense, 'title' | 'total' | 'currency'>): string {
  return t('presence.list.item', {
    title: e.title.trim() || t('presence.list.untitled'),
    amount: formatMoney(e.total, e.currency, { trimZeros: true }),
  })
}

/** "A", "A and B", "A, B and C", or the first `max` and "and N more". */
export function listText(items: readonly string[], max = 3): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length > max) return t('presence.list.more', { list: items.slice(0, max).join(', '), count: items.length - max })
  return t('presence.list.and', { list: items.slice(0, -1).join(', '), last: items[items.length - 1] ?? '' })
}

/** "12 Nov": a short date, never "Today" (it reads oddly in "joined on …"). */
export function dayLabel(iso: string, today: string = todayIso()): string {
  if (!isIsoDate(iso) || !isIsoDate(today)) return relativeDateLabel(iso, today)
  if (Math.abs(daysBetween(today, iso)) > 1) return relativeDateLabel(iso, today)
  // Same year, but far enough from `iso` that no "Today"/"Yesterday"/"Tomorrow" applies.
  const year = today.slice(0, 4)
  const away = iso.slice(5) < '07-01' ? `${year}-12-31` : `${year}-01-01`
  return relativeDateLabel(iso, away)
}

/** "Whole trip", "From 12 Nov", "Until 14 Nov", "12 Nov to 14 Nov". */
export function stayText(stay: Stay | null | undefined): string {
  const s = usableStay(stay)
  if (!s) return t('presence.stay.whole')
  if (s.from && s.to)
    return t('presence.stay.both', {
      from: dayLabel(s.from),
      to: dayLabel(s.to),
    })
  if (s.from) return t('presence.stay.from', { date: dayLabel(s.from) })
  return t('presence.stay.to', { date: dayLabel(s.to ?? '') })
}

/** Someone's days in a group, in a few words, or null when none are set (they were there throughout). */
export function stayLabel(group: Pick<Group, 'id'>, friendId: string): string | null {
  const s = usableStay(presenceStore.get().stays[group.id]?.[friendId])
  return s ? stayText(s) : null
}
