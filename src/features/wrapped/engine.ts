/**
 * A group's story ("Wrapped") and the "this trip looks done" check.
 *
 * Both are worked out from what the group already shares (its expenses and recorded payments),
 * so every phone in a shared group tells the same story. Pure: no clock, no storage. Ties are
 * broken by name (then by the thing itself), never by an id: ids differ from phone to phone.
 *
 * Spending is the group's own-currency expenses that aren't loans (money handed over is not
 * spending). What's still owed uses the group's balances as everywhere else in the app.
 */
import type { CategoryId, Expense, Group, Minor } from '../../domain/types'
import { groupBalances, simplifyDebts } from '../../engine/balances'
import { daysBetween, isIsoDate } from '../../engine/dates'
import { playBoard } from '../play/engine'

/* ------------------------------------------------------------------ the story's rules */

/** Fewer expenses than this and there is no story to tell. */
export const STORY_MIN = 3
/** The weekday slide needs this many expenses, over at least `PATTERN_SPAN` days… */
export const PATTERN_MIN = 8
export const PATTERN_SPAN = 14
/** …with one weekday holding at least this share of the spending and 1.5× the next weekday. */
export const PATTERN_SHARE = 0.35
/** "Chai × 9": a title has to come up at least this often. */
export const REPEAT_MIN = 3

/* ------------------------------------------------------------------ slides */

export interface CategoryShare {
  /** Null: everything outside the top three, together. */
  id: CategoryId | null
  total: Minor
  /** Whole percent; the shares on a slide add up to exactly 100. */
  percent: number
}

export type Slide =
  | { kind: 'headline'; total: Minor; days: number; people: number; count: number; from: string; to: string }
  | { kind: 'perDay'; perDay: Minor; days: number; people: number; perPersonPerDay: Minor | null }
  | { kind: 'bigDay'; date: string; total: Minor; count: number; titles: string[] }
  | { kind: 'bigBill'; title: string; total: Minor; payerId: string; date: string }
  | { kind: 'categories'; shares: CategoryShare[] }
  | { kind: 'fronted'; id: string; amount: Minor }
  | { kind: 'flash'; id: string; days: number }
  | { kind: 'repeat'; title: string; count: number; total: Minor }
  | { kind: 'weekday'; day: number; percent: number }
  | { kind: 'you'; share: Minor; paid: Minor; percent: number }
  | { kind: 'closing'; payments: number; total: Minor }

export type SlideKind = Slide['kind']

export interface StoryInput {
  group: Group
  /** Any expenses: only this group's count. */
  expenses: readonly Expense[]
  nameOf: (id: string) => string
  me: string
}

/* ------------------------------------------------------------------ helpers */

const cleanTitle = (title: string): string => title.trim().replace(/\s+/g, ' ')
const titleKey = (title: string): string => cleanTitle(title).toLowerCase()

/** The group's spending: own currency, not loans, a real date. */
export function storyExpenses(group: Group, expenses: readonly Expense[]): Expense[] {
  return expenses.filter((e) => e.groupId === group.id && e.currency === group.currency && e.kind !== 'loan' && isIsoDate(e.date) && Number.isFinite(e.total) && e.total > 0)
}

/** True when the group has a story to tell (the "Story" entry and "See the story" show only then). */
export function hasStory(group: Group, expenses: readonly Expense[]): boolean {
  return storyExpenses(group, expenses).length >= STORY_MIN
}

/**
 * Whole percents of `parts` that add up to exactly 100 (largest remainder; ties to the earlier
 * part). All zero when there is nothing.
 */
export function percents(parts: readonly number[]): number[] {
  const sum = parts.reduce((a, b) => a + b, 0)
  if (sum <= 0) return parts.map(() => 0)
  const raw = parts.map((p) => (p * 100) / sum)
  const out = raw.map(Math.floor)
  let left = 100 - out.reduce((a, b) => a + b, 0)
  const order = raw.map((r, i) => ({ i, rest: r - Math.floor(r) })).sort((a, b) => b.rest - a.rest || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    out[i] = (out[i] ?? 0) + 1
    left--
  }
  return out
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()
}

/* ------------------------------------------------------------------ the story */

/** The story's slides, in order, each only when the group's data supports it. Empty: no story. */
export function buildStory({ group, expenses: all, nameOf, me }: StoryInput): Slide[] {
  const spending = storyExpenses(group, all)
  if (spending.length < STORY_MIN) return []

  // The Board already knows the totals, the biggest bill and who fronted or paid back fastest: as
  // of the group's latest day, so nothing in its books is left out.
  const latest = [...spending.map((e) => e.date), ...group.settlements.map((s) => s.date).filter(isIsoDate)].sort().at(-1) ?? spending[0]?.date ?? ''
  const board = playBoard({ group, expenses: spending, today: latest, me, nameOf })
  const recap = board.recap
  const total = recap?.total ?? spending.reduce((sum, e) => sum + e.total, 0)

  const dates = spending.map((e) => e.date).sort()
  const from = dates[0] ?? latest
  const to = dates.at(-1) ?? latest
  // Days of the trip itself: first bill to last (a payment a week later doesn't make it longer).
  const days = daysBetween(from, to) + 1
  const people = new Set<string>()
  for (const e of spending) {
    people.add(e.payerId)
    for (const [id, amount] of Object.entries(e.shares)) if (amount > 0) people.add(id)
  }
  const crowd = people.size

  const slides: Slide[] = [{ kind: 'headline', total, days, people: crowd, count: spending.length, from, to }]

  /* ---- a day of it ---- */
  if (days >= 2) {
    const perDay = Math.round(total / days)
    slides.push({ kind: 'perDay', perDay, days, people: crowd, perPersonPerDay: crowd >= 2 ? Math.round(total / days / crowd) : null })
  }

  /* ---- the biggest day ---- */
  const onDay = new Map<string, Expense[]>()
  for (const e of spending) onDay.set(e.date, [...(onDay.get(e.date) ?? []), e])
  const biggest = recap?.biggest ?? null
  if (onDay.size >= 2) {
    const [date, list] = [...onDay.entries()]
      .map(([d, l]) => [d, l, l.reduce((s, e) => s + e.total, 0)] as const)
      .sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0]))[0]!
    const dayTotal = list.reduce((s, e) => s + e.total, 0)
    // One bill that is the whole day says the same thing as the biggest-bill slide.
    if (list.length >= 2) {
      const titles: string[] = []
      for (const e of [...list].sort((a, b) => b.total - a.total || titleKey(a.title).localeCompare(titleKey(b.title)))) {
        const title = cleanTitle(e.title)
        if (title && !titles.some((x) => x.toLowerCase() === title.toLowerCase())) titles.push(title)
        if (titles.length === 3) break
      }
      slides.push({ kind: 'bigDay', date, total: dayTotal, count: list.length, titles })
    }
  }

  /* ---- the biggest bill ---- */
  // Only when one bill stands out (all the same size is no "biggest").
  const runnerUp = [...spending].sort((a, b) => b.total - a.total)[1]?.total ?? 0
  if (biggest && cleanTitle(biggest.title) && biggest.total > runnerUp) {
    const bill = spending.find((e) => e.title === biggest.title && e.total === biggest.total && e.payerId === biggest.payerId)
    slides.push({ kind: 'bigBill', title: cleanTitle(biggest.title), total: biggest.total, payerId: biggest.payerId, date: bill?.date ?? to })
  }

  /* ---- where the money went ---- */
  const byCategory = new Map<CategoryId, Minor>()
  for (const e of spending) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.total)
  if (byCategory.size >= 2) {
    const ranked = [...byCategory.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    const top = ranked.slice(0, 3)
    const rest = ranked.slice(3).reduce((s, [, v]) => s + v, 0)
    const parts = [...top.map(([, v]) => v), ...(rest > 0 ? [rest] : [])]
    const pct = percents(parts)
    const shares: CategoryShare[] = top.map(([id, v], i) => ({ id, total: v, percent: pct[i] ?? 0 }))
    if (rest > 0) shares.push({ id: null, total: rest, percent: pct[top.length] ?? 0 })
    slides.push({ kind: 'categories', shares })
  }

  /* ---- people: who fronted, who paid back fastest ---- */
  if (crowd >= 2) {
    const banker = board.titles.find((x) => x.id === 'banker')
    if (banker && banker.value > 0) slides.push({ kind: 'fronted', id: banker.memberId, amount: banker.value })
    const flash = board.titles.find((x) => x.id === 'flash')
    // Paying back means a recorded payment, not just paying the next bill.
    if (flash && group.settlements.some((x) => x.fromId === flash.memberId)) slides.push({ kind: 'flash', id: flash.memberId, days: Math.max(0, Math.round(flash.value)) })
  }

  /* ---- the thing bought again and again ---- */
  const repeats = new Map<string, { title: string; count: number; total: Minor }>()
  for (const e of spending) {
    const key = titleKey(e.title)
    if (!key) continue
    const had = repeats.get(key)
    repeats.set(key, { title: had?.title ?? cleanTitle(e.title), count: (had?.count ?? 0) + 1, total: (had?.total ?? 0) + e.total })
  }
  const repeat = [...repeats.entries()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))[0]?.[1]
  if (repeat && repeat.count >= REPEAT_MIN) slides.push({ kind: 'repeat', ...repeat })

  /* ---- a weekday, only when it's real ---- */
  if (spending.length >= PATTERN_MIN && days >= PATTERN_SPAN) {
    const spend = [0, 0, 0, 0, 0, 0, 0]
    const count = [0, 0, 0, 0, 0, 0, 0]
    for (const e of spending) {
      const d = weekdayOf(e.date)
      spend[d] = (spend[d] ?? 0) + e.total
      count[d] = (count[d] ?? 0) + 1
    }
    const order = spend.map((v, d) => ({ d, v })).sort((a, b) => b.v - a.v || a.d - b.d)
    const first = order[0]!
    const second = order[1]!
    if (first.v >= total * PATTERN_SHARE && first.v >= second.v * 1.5 && (count[first.d] ?? 0) >= 3) {
      slides.push({ kind: 'weekday', day: first.d, percent: Math.round((first.v * 100) / total) })
    }
  }

  /* ---- you ---- */
  if (crowd >= 2 && people.has(me)) {
    const share = spending.reduce((s, e) => s + (e.shares[me] ?? 0), 0)
    const paid = spending.reduce((s, e) => s + (e.payerId === me ? e.total : 0), 0)
    if (share > 0 || paid > 0) slides.push({ kind: 'you', share, paid, percent: Math.round((share * 100) / total) })
  }

  /* ---- the end: what settles it ---- */
  const transfers = simplifyDebts(groupBalances(group, all))
  slides.push({ kind: 'closing', payments: transfers.length, total: transfers.reduce((s, x) => s + x.amount, 0) })

  return slides
}

/* ------------------------------------------------------------------ "looks done" */

/** A trip looks done this many days after its last bill… */
export const DONE_FROM = 2
/** …until this many (after that it's old news, not a trip that just ended). */
export const DONE_UNTIL = 21
/** A burst: at least this many expenses within any window of this many days. */
export const BURST_COUNT = 3
export const BURST_DAYS = 5

export interface PutAway {
  /** The group's last expense date when the card was put away. */
  last: string
}

export interface LooksDone {
  /** Date of the group's last expense. */
  last: string
  /** Days since it. */
  daysAgo: number
  /** The fewest payments that square everyone up, and the money they move. */
  payments: number
  total: Minor
  /** What the device owner is owed (positive) or owes (negative) in the group. */
  mine: Minor
}

/** At least `BURST_COUNT` dates within any `BURST_DAYS`-day window. */
export function hasBurst(dates: readonly string[]): boolean {
  const sorted = [...dates].sort()
  for (let i = 0; i + BURST_COUNT - 1 < sorted.length; i++) {
    const a = sorted[i]
    const b = sorted[i + BURST_COUNT - 1]
    if (a && b && daysBetween(a, b) < BURST_DAYS) return true
  }
  return false
}

/**
 * Does the group look like a trip that's over with money still owed? Null when not: under three
 * expenses, the last one too recent (under two days) or too old (over 21), no burst of spending
 * before it, archived, all square, or put away with no new burst since.
 */
export function looksDone(group: Group, expenses: readonly Expense[], today: string, me: string, putAway: PutAway | null = null): LooksDone | null {
  if (group.archived || !isIsoDate(today)) return null
  const own = expenses.filter((e) => e.groupId === group.id && e.kind !== 'loan' && isIsoDate(e.date) && e.date <= today)
  if (own.length < BURST_COUNT) return null
  const dates = own.map((e) => e.date)
  const last = [...dates].sort().at(-1)
  if (!last) return null
  const daysAgo = daysBetween(last, today)
  if (daysAgo < DONE_FROM || daysAgo > DONE_UNTIL) return null
  if (!hasBurst(dates)) return null
  // Put away: back only for a new burst of spending since.
  if (putAway && !hasBurst(dates.filter((d) => d > putAway.last))) return null
  const balances = groupBalances(group, expenses)
  const transfers = simplifyDebts(balances)
  if (transfers.length === 0) return null
  return { last, daysAgo, payments: transfers.length, total: transfers.reduce((s, x) => s + x.amount, 0), mine: balances[me] ?? 0 }
}
