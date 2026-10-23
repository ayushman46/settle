/** Reading an `OverallSummary` in words: what the balance card (and anything summing up balances) says. */
import { describePeople } from '../components/helpers'
import type { Minor } from '../domain/types'
import { t } from '../i18n'
import type { OverallSummary } from '../engine/balances'
import { formatMoney } from '../lib/money'

/** True while anyone owes anyone anything, in any currency. */
export function hasOutstanding(summary: OverallSummary): boolean {
  return (
    summary.owedToMe > 0 ||
    summary.iOwe > 0 ||
    Object.values(summary.otherCurrencies).some((t) => t.owedToMe > 0 || t.iOwe > 0)
  )
}

/** The people I'm most out with: largest amount either way first, ties by id (stable). Zero balances are left out. */
export function topBalances(
  summary: Pick<OverallSummary, 'byFriend'>,
  limit = Number.POSITIVE_INFINITY,
): Array<{ friendId: string; amount: Minor }> {
  return Object.entries(summary.byFriend)
    .filter(([, amount]) => Number.isFinite(amount) && amount !== 0)
    .map(([friendId, amount]) => ({ friendId, amount }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount) || (a.friendId < b.friendId ? -1 : a.friendId > b.friendId ? 1 : 0))
    .slice(0, limit)
}

export type BalanceMood = 'owed' | 'owe' | 'even' | 'settled'

export interface BalanceHeadline {
  mood: BalanceMood
  /** "You're owed", "Overall, you owe", "Overall, you're even", "All settled up". */
  label: string
  /** The currency the headline is in: the summary's own, unless only another one has money outstanding. */
  currency: string
  /** The net amount to show big (never negative; 0 when even or settled). */
  amount: Minor
  /** Both directions, in `currency`. */
  owedToMe: Minor
  iOwe: Minor
  /** Money flows both ways: show the two totals as well as the net. */
  mixed: boolean
}

/**
 * What the balance leads with. Normally the summary's currency; when that's all square but money
 * is still out in another currency (a trip abroad), that currency leads instead.
 */
export function balanceHeadline(summary: OverallSummary): BalanceHeadline {
  let currency = summary.currency
  let { owedToMe, iOwe } = summary
  if (owedToMe === 0 && iOwe === 0) {
    const other = Object.entries(summary.otherCurrencies).find(([, t]) => t.owedToMe > 0 || t.iOwe > 0)
    if (other) {
      currency = other[0]
      owedToMe = other[1].owedToMe
      iOwe = other[1].iOwe
    }
  }
  const net = owedToMe - iOwe
  const mixed = owedToMe > 0 && iOwe > 0
  const base = { currency, owedToMe, iOwe, mixed }
  if (owedToMe === 0 && iOwe === 0) return { ...base, mood: 'settled', label: t('kit.balance.settled'), amount: 0 }
  if (net === 0) return { ...base, mood: 'even', label: t('kit.balance.even'), amount: 0 }
  if (net > 0) return { ...base, mood: 'owed', label: mixed ? t('kit.balance.owed.mixed') : t('kit.balance.owed'), amount: net }
  return { ...base, mood: 'owe', label: mixed ? t('kit.balance.owe.mixed') : t('kit.balance.owe'), amount: -net }
}

/**
 * Who the balance is with, from `topBalances` and their first names in the same order:
 * "Riya owes you", "Riya and Sam owe you", "You owe Riya", "With Riya, Sam and 2 others". Null for nobody.
 */
export function peopleLine(top: ReadonlyArray<{ amount: Minor }>, names: readonly string[]): string | null {
  if (top.length === 0 || names.length === 0) return null
  const list = describePeople(names, 2)
  if (top.every((b) => b.amount > 0)) return t('kit.balance.people.oweYou', { names: list, count: names.length })
  if (top.every((b) => b.amount < 0)) return t('kit.balance.people.youOwe', { names: list })
  return t('kit.balance.people.mixed', { names: list })
}

/**
 * Money outstanding in currencies other than `shown` — never converted:
 * "Also $40 owed to you · €12.50 you owe". Null when there's none.
 */
export function otherCurrenciesLine(summary: OverallSummary, shown: string = summary.currency): string | null {
  const totals: Array<[string, { owedToMe: Minor; iOwe: Minor }]> = [
    [summary.currency, { owedToMe: summary.owedToMe, iOwe: summary.iOwe }],
    ...Object.entries(summary.otherCurrencies),
  ]
  const parts: string[] = []
  for (const [code, total] of totals) {
    if (code === shown) continue
    if (total.owedToMe > 0) parts.push(t('kit.balance.other.owedToYou', { amount: formatMoney(total.owedToMe, code, { trimZeros: true }) }))
    if (total.iOwe > 0) parts.push(t('kit.balance.other.youOwe', { amount: formatMoney(total.iOwe, code, { trimZeros: true }) }))
  }
  return parts.length > 0 ? t('kit.balance.other.line', { parts: parts.join(' · ') }) : null
}
