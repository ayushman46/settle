/**
 * The words a collection sends: the share message for the group chat, reminders (one person, in
 * three tones, or everyone still to pay in one message) and the contributor's "I've chipped in"
 * note. Copy lives in the `pools` i18n namespace; amounts are exact (`formatMoney`, trimmed zeros).
 */
import type { Minor } from '../domain/types'
import { t } from '../i18n'
import { formatMoney } from '../lib/money'
import type { NudgeTone } from './nudge'
import { cleanText } from './text'

/** "30 Oct" for `2026-10-30` (Indian English, Latin digits); '' for anything else. */
export function shortDay(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return ''
  try {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(date)
  } catch {
    return iso
  }
}

function money(amount: Minor, currency: string): string {
  return formatMoney(amount, currency, { trimZeros: true })
}

/** The message, then the link after a space (links always go last, never shortened). */
function withLink(text: string, link: string | null | undefined): string {
  const url = link?.trim() ?? ''
  return url ? `${text} ${url}` : text
}

/* ------------------------------------------------------------------ the share message */

export interface PoolShareInput {
  title: string
  emoji: string
  currency: string
  mode: 'fixed' | 'target'
  perPerson: Minor | null
  goal: Minor | null
  collected: Minor
  deadline: string | null
  link: string
}

/**
 * ```
 * 👋 Riya's farewell — ₹500 each · by 30 Oct
 * ₹3,500 of ₹5,000 in so far. Chip in here (any UPI app):
 * https://…/pool#…
 * ```
 */
export function poolShareText(input: PoolShareInput): string {
  const vars = { emoji: input.emoji, title: cleanText(input.title, 60) }
  let head =
    input.mode === 'fixed' && input.perPerson !== null
      ? t('pools.share.fixed', { ...vars, amount: money(input.perPerson, input.currency) })
      : input.goal !== null
        ? t('pools.share.targetGoal', { ...vars, goal: money(input.goal, input.currency) })
        : t('pools.share.target', vars)
  const by = shortDay(input.deadline)
  if (by) head += t('pools.share.by', { date: by })
  const progress =
    input.collected <= 0
      ? t('pools.share.progress.none')
      : input.goal !== null
        ? t('pools.share.progress.goal', { collected: money(input.collected, input.currency), goal: money(input.goal, input.currency) })
        : t('pools.share.progress.some', { collected: money(input.collected, input.currency) })
  return `${head}\n${progress}\n${input.link}`
}

/* ------------------------------------------------------------------ reminders */

export interface PoolReminderInput {
  tone: NudgeTone
  /** Who's being reminded ("Sam"). */
  toName: string
  /** What they still owe (fixed), or null for "pay what you want". */
  amount: Minor | null
  currency: string
  title: string
  emoji: string
  /** Who it's for ("Riya"), when the title came from a gift template — for the funny tone. */
  forName: string | null
  inCount: number
  expected: number | null
  deadline: string | null
  link: string | null
}

function progressWords(inCount: number, expected: number | null): string {
  if (expected !== null) return t('pools.remind.progress.of', { in: inCount, expected })
  return inCount > 0 ? t('pools.remind.progress.count', { in: inCount }) : t('pools.remind.progress.start')
}

/** One person's reminder in the chosen tone (spec 05 §2.4). */
export function poolReminderText(input: PoolReminderInput): string {
  const to = cleanText(input.toName, 24) || t('pools.remind.there')
  const title = cleanText(input.title, 60)
  const amount = input.amount !== null && input.amount > 0 ? money(input.amount, input.currency) : null
  const by = shortDay(input.deadline)
  let text: string
  if (input.tone === 'funny') {
    const what = amount ?? t('pools.remind.yourShare')
    const forName = input.forName ? cleanText(input.forName, 24) : ''
    text = forName
      ? t('pools.remind.funny.gift', { to, name: forName, amount: what })
      : t('pools.remind.funny.plain', { to, title, emoji: input.emoji, amount: what })
  } else if (input.tone === 'firm') {
    const what = amount ?? t('pools.remind.whatYouLike')
    text = by ? t('pools.remind.firm.deadline', { to, amount: what, title, deadline: by }) : t('pools.remind.firm', { to, amount: what, title })
  } else {
    const what = amount ?? t('pools.remind.whatYouLike')
    text = t('pools.remind.friendly', { to, amount: what, title, emoji: input.emoji, progress: progressWords(input.inCount, input.expected) })
  }
  return withLink(text, input.link)
}

/** Most names "Remind all" lists before "and N more". */
export const REMIND_ALL_MAX_NAMES = 12

export interface PoolRemindAllInput {
  title: string
  emoji: string
  names: readonly string[]
  inCount: number
  expected: number | null
  link: string | null
}

/** One group message: `Riya's farewell 👋 — 7 of 10 in! Still to chip in: Sam, Kabir, Neha. <link>`. */
export function poolRemindAllText(input: PoolRemindAllInput): string {
  const shown = input.names.slice(0, REMIND_ALL_MAX_NAMES).map((n) => cleanText(n, 24))
  const extra = input.names.length - shown.length
  const names = extra > 0 ? t('pools.remind.all.more', { names: shown.join(', '), count: extra }) : shown.join(', ')
  const progress =
    input.expected !== null
      ? t('pools.remind.all.of', { in: input.inCount, expected: input.expected })
      : t('pools.remind.all.count', { in: input.inCount })
  const text = t('pools.remind.all', { title: cleanText(input.title, 60), emoji: input.emoji, progress, names })
  return withLink(text, input.link)
}

/* ------------------------------------------------------------------ the contributor's reply */

/**
 * ```
 * Chipped in ₹500 for Riya's farewell 👋 — Sam
 * Tick me off: https://…/app/pools/in#…
 * ```
 */
export function poolTellText(input: { amount: Minor; currency: string; title: string; emoji: string; name: string; link: string }): string {
  const text = t('pools.tell.text', {
    amount: money(input.amount, input.currency),
    title: cleanText(input.title, 60),
    emoji: input.emoji,
    name: cleanText(input.name, 24),
  })
  return withLink(text, input.link)
}
