/**
 * What the collection screens show, in words: progress lines, deadline chips, each person's state.
 * Pure (reads nothing from stores) so every string and number is unit-tested.
 */
import { ME_ID, type Contribution, type Friend, type Minor, type Pool } from '../../domain/types'
import { daysBetween } from '../../engine/dates'
import { contributorKey, isIn, paidBy, poolProgress, type PoolProgress } from '../../engine/pools'
import { t, type MessageKey } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { shortDay } from '../../share/poolNudge'

export function money(amount: Minor, currency: string): string {
  return formatMoney(amount, currency, { trimZeros: true })
}

/* ------------------------------------------------------------------ deadline */

export interface DeadlineView {
  label: string
  /** `soon`: within 2 days; `ended`: the day has passed. */
  tone: 'normal' | 'soon' | 'ended'
}

/** `by 30 Oct` (warning within 2 days) or `Ended` once it's past; null without a deadline. */
export function deadlineView(deadline: string | null, today: string): DeadlineView | null {
  if (!deadline) return null
  const days = daysBetween(today, deadline)
  if (days < 0) return { label: t('pools.deadline.ended'), tone: 'ended' }
  return { label: t('pools.deadline.by', { date: shortDay(deadline) }), tone: days <= 2 ? 'soon' : 'normal' }
}

/* ------------------------------------------------------------------ progress */

/** "₹3,500 of ₹5,000 · 7 of 10 in" for a list row. */
export function poolRowSubtitle(pool: Pool, progress: PoolProgress = poolProgress(pool)): string {
  const amount =
    progress.goal !== null
      ? t('pools.list.row.ofGoal', { collected: money(progress.collected, pool.currency), goal: money(progress.goal, pool.currency) })
      : t('pools.list.row.collected', { collected: money(progress.collected, pool.currency) })
  const people =
    progress.expected !== null
      ? t('pools.list.row.inOf', { in: progress.inCount, expected: progress.expected })
      : t('pools.list.row.in', { in: progress.inCount })
  return `${amount} · ${people}`
}

/** "🎁 Riya's farewell · ₹3,500 of ₹5,000 · 3 to go" (Home card, after the title). */
export function poolHomeLine(pool: Pool, progress: PoolProgress = poolProgress(pool)): string {
  const parts: string[] = []
  parts.push(
    progress.goal !== null
      ? t('pools.home.row.ofGoal', { collected: money(progress.collected, pool.currency), goal: money(progress.goal, pool.currency) })
      : t('pools.home.row.in', { collected: money(progress.collected, pool.currency) }),
  )
  if (progress.expected !== null) {
    const left = Math.max(0, progress.expected - progress.inCount)
    if (left > 0) parts.push(t('pools.home.row.toGo', { count: left }))
  }
  return parts.join(' · ')
}

export interface ProgressView {
  /** 0..1 for the ring. */
  fraction: number
  /** "70%" inside the ring, or null without a goal. */
  percentLabel: string | null
  /** "₹3,500". */
  collected: string
  /** "of ₹5,000 goal" / "of ₹5,000 (10 × ₹500)" / "₹500 each · 7 people so far". */
  of: string
  /** "7 of 10 in · 3 to go" or "Everyone’s in 🎉", or null for an open list. */
  people: string | null
  /** "₹500 over the goal 🎉", or null. */
  over: string | null
}

export function progressView(pool: Pool, progress: PoolProgress = poolProgress(pool)): ProgressView {
  const c = pool.currency
  let of: string
  if (pool.mode === 'fixed' && pool.perPerson !== null) {
    of =
      progress.goal !== null && progress.expected !== null
        ? t('pools.detail.ofFixed', { goal: money(progress.goal, c), count: progress.expected, amount: money(pool.perPerson, c) })
        : t('pools.detail.openFixed', { amount: money(pool.perPerson, c), count: progress.inCount })
  } else {
    of = progress.goal !== null ? t('pools.detail.ofGoal', { goal: money(progress.goal, c) }) : t('pools.detail.noGoal', { count: progress.inCount })
  }
  let people: string | null = null
  if (progress.expected !== null) {
    const left = Math.max(0, progress.expected - progress.inCount)
    people = left === 0 ? t('pools.detail.allIn') : t('pools.detail.inLine', { in: progress.inCount, expected: progress.expected, left })
  }
  return {
    fraction: progress.goal !== null && progress.goal > 0 ? Math.min(1, progress.collected / progress.goal) : 0,
    percentLabel: progress.percent !== null ? t('pools.detail.percent', { percent: progress.percent }) : null,
    collected: money(progress.collected, c),
    of,
    people,
    over: progress.over > 0 ? t('pools.detail.over', { amount: money(progress.over, c) }) : null,
  }
}

/* ------------------------------------------------------------------ people */

export type PersonState = 'paid' | 'partly' | 'not_yet'

export interface PersonRow {
  /** friendId for your people; the name key for guests. */
  key: string
  friendId: string | null
  name: string
  state: PersonState
  paid: Minor
  /** What they still owe (fixed mode); 0 otherwise. */
  left: Minor
  /** Their payments, oldest first. */
  contributions: Contribution[]
  /** One line under the name. */
  line: string
}

function methodLabel(method: Contribution['method']): string {
  return t(`pools.method.${method}` as MessageKey)
}

function nameOf(friendId: string | null, fallback: string, friendsById: Readonly<Record<string, Friend>>): string {
  if (!friendId) return fallback
  return friendsById[friendId]?.name || fallback || 'Someone'
}

function personLine(pool: Pool, paid: Minor, list: readonly Contribution[], listed = true): { state: PersonState; left: Minor; line: string } {
  const c = pool.currency
  // Others (not on your list) just show what they gave.
  const part = pool.mode === 'fixed' && listed ? pool.perPerson : null
  if (paid <= 0) return { state: 'not_yet', left: part ?? 0, line: t('pools.detail.notYet') }
  if (part !== null && paid < part) {
    const left = part - paid
    return { state: 'partly', left, line: t('pools.detail.partly', { paid: money(paid, c), part: money(part, c), left: money(left, c) }) }
  }
  const last = list[list.length - 1]
  const twice = pool.mode === 'fixed' && pool.perPerson !== null && paid > pool.perPerson * 1.5
  const amount = twice ? t('pools.detail.paidTwice', { amount: money(paid, c) }) : money(paid, c)
  const line = last ? t('pools.detail.paidLine', { amount, date: shortDay(last.date), method: methodLabel(last.method) }) : amount
  return { state: 'paid', left: 0, line }
}

/**
 * Everyone expected (your people, in your order) and, separately, anyone else who chipped in —
 * each with their state and the line under their name.
 */
export function poolPeople(pool: Pool, friendsById: Readonly<Record<string, Friend>>): { members: PersonRow[]; others: PersonRow[] } {
  const paid = paidBy(pool)
  const byKey = new Map<string, Contribution[]>()
  for (const c of pool.contributions) {
    const key = contributorKey(c)
    const list = byKey.get(key)
    if (list) list.push(c)
    else byKey.set(key, [c])
  }
  const members: PersonRow[] = []
  const seen = new Set<string>()
  for (const id of pool.memberIds) {
    if (id === ME_ID || seen.has(id)) continue
    seen.add(id)
    const list = byKey.get(id) ?? []
    const amount = paid.get(id) ?? 0
    members.push({ key: id, friendId: id, name: nameOf(id, list[0]?.name ?? '', friendsById), paid: amount, contributions: list, ...personLine(pool, amount, list) })
  }
  const others: PersonRow[] = []
  for (const [key, list] of byKey) {
    if (seen.has(key)) continue
    const first = list[0]
    if (!first) continue
    const amount = paid.get(key) ?? 0
    const row = personLine(pool, amount, list, false)
    others.push({ key, friendId: first.friendId, name: nameOf(first.friendId, first.name, friendsById), paid: amount, contributions: list, ...row })
  }
  return { members, others }
}

/** Names of the people still to pay (not "in"), for "Remind all". */
export function stillToPay(pool: Pool, friendsById: Readonly<Record<string, Friend>>): PersonRow[] {
  return poolPeople(pool, friendsById).members.filter((m) => !isIn(pool, m.paid))
}

/* ------------------------------------------------------------------ the editor */

export type PoolFormIssue = 'pools.editor.issue.title' | 'pools.editor.issue.amount' | 'pools.editor.issue.goal'

/** Why the editor can't save yet — the exact hint under its button — or null. */
export function poolFormIssue(form: { title: string; mode: Pool['mode']; amount: Minor | null }): PoolFormIssue | null {
  if (form.title.trim() === '') return 'pools.editor.issue.title'
  if (form.mode === 'fixed' && (form.amount === null || form.amount <= 0)) return 'pools.editor.issue.amount'
  if (form.mode === 'target' && form.amount !== null && form.amount <= 0) return 'pools.editor.issue.goal'
  return null
}
