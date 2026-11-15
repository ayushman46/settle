import { useMemo } from 'react'
import { Banner } from '../../components'
import { useExpenses, useFriendsById, useGroups, useProfile } from '../../data'
import type { Minor } from '../../domain/types'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { formatMoney } from '../../lib/money'
import { firstName } from '../../share/text'
import { limitWarnings, newlyOwed, type Amounts, type LimitWarning } from './engine'
import { useLimitState } from './store'
import styles from './Limit.module.css'

export interface LimitNoteProps {
  /** The people in the split (you are ignored). */
  friendIds: readonly string[]
  /**
   * What each of them would newly owe you from this split, in paise: their share when you are
   * paying. Keyed by friend id, or a list in the order of `friendIds`. Pass nothing (or zeros)
   * when someone else is paying: nobody then owes you more.
   */
  amounts: Amounts
  /** The split's currency. Limits are in your own currency: a split in another one is not warned about. Default: your currency. */
  currency?: string
  /** The group the split is going into, so the group's fewest-payments settling is counted. */
  groupId?: string | null
  /** When editing a saved split: its id, so it isn't counted twice. */
  expenseId?: string | null
}

/** People named one by one before "and 2 more people". */
const MAX_LINES = 3

/**
 * For the new-expense screen: "This takes Riya to ₹5,400 owed to you, over the ₹5,000 you set."
 * A note, never a block: saving stays exactly as it was. Shows nothing when no limit is crossed.
 */
export function LimitNote({ friendIds, amounts, currency, groupId = null, expenseId = null }: LimitNoteProps) {
  const t = useT()
  const profile = useProfile()
  const expenses = useExpenses()
  const groups = useGroups()
  const friendsById = useFriendsById()
  const state = useLimitState()
  // The screen hands over fresh arrays on every keystroke: the sums are redone only when what is owed changes.
  const owedKey = JSON.stringify(newlyOwed(friendIds, amounts))
  const warnings = useMemo(() => {
    const owed = JSON.parse(owedKey) as Record<string, number>
    return limitWarnings({ state, friendIds: Object.keys(owed), amounts: owed, expenses, groups, currency: profile.currency, splitCurrency: currency ?? profile.currency, groupId, expenseId })
  }, [state, owedKey, expenses, groups, profile.currency, currency, groupId, expenseId])
  if (warnings.length === 0) return null

  const money = (minor: Minor): string => formatMoney(minor, profile.currency, { trimZeros: true })
  const line = (w: LimitWarning): string => {
    const vars = { name: firstName(friendLabel(w.friendId, friendsById[w.friendId] ?? null)), before: money(w.before), after: money(w.after), limit: money(w.limit) }
    if (w.wasOver) return t(w.own ? 'limit.note.already' : 'limit.note.already.everyone', vars)
    return t(w.own ? 'limit.note.crosses' : 'limit.note.crosses.everyone', vars)
  }
  const shown = warnings.slice(0, MAX_LINES)
  const more = warnings.length - shown.length

  return (
    <Banner tone="warning" title={t('limit.note.title', { count: warnings.length })}>
      <span className={styles.noteLines}>
        {shown.map((w) => (
          <span key={w.friendId}>{line(w)}</span>
        ))}
        {more > 0 && <span>{t('limit.note.more', { count: more })}</span>}
        <span>{t('limit.note.fine')}</span>
      </span>
    </Banner>
  )
}
