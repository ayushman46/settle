import { useMemo } from 'react'
import { Coins } from 'lucide-react'
import { Button, useToast } from '../../components'
import { useExpenses, useFriendsById, useGroups, useProfile } from '../../data'
import { ME_ID } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { friendBalance } from '../friends/friendBalance'
import { callFriendEven } from './actions'
import { smallBalance } from './engine'
import styles from './Chhutta.module.css'

/**
 * For a friend whose whole balance with you is small change (under ₹20 either way, across groups
 * and splits): one tap clears everything open between you and logs what was let go, with Undo.
 * Null when nothing is open, when more than that is, and for yourself.
 */
export function CallEvenButton({ friendId }: { friendId: string }) {
  const t = useT()
  const toast = useToast()
  const profile = useProfile()
  const expenses = useExpenses()
  const groups = useGroups()
  const friendsById = useFriendsById()
  const balance = useMemo(() => friendBalance(friendId, expenses, groups, profile.currency), [friendId, expenses, groups, profile.currency])
  const small = useMemo(() => smallBalance(balance.totals), [balance])
  if (friendId === ME_ID || !small) return null

  const name = friendLabel(friendId, friendsById[friendId] ?? null)
  const amount = small.map((total) => formatMoney(Math.abs(total.amount), total.currency, { trimZeros: true })).join(' + ')
  const theyOwe = small.every((total) => total.amount > 0)
  const youOwe = small.every((total) => total.amount < 0)

  const callEven = (): void => {
    const undo = callFriendEven(friendId, { sources: balance.sources, totals: small }, todayIso())
    haptic('success')
    toast(theyOwe ? t('chhutta.friend.done.letGo', { amount, name }) : t('chhutta.friend.done.letOff', { amount, name }), {
      tone: 'success',
      action: { label: t('common.action.undo'), onAction: undo },
    })
  }

  return (
    <div className={styles.friend}>
      <p className={styles.line}>
        {theyOwe ? t('chhutta.friend.owesYou', { name, amount }) : youOwe ? t('chhutta.friend.youOwe', { name, amount }) : t('chhutta.friend.mixed', { name, amount })}
      </p>
      <Button size="md" variant="secondary" iconStart={<Coins />} onClick={callEven} aria-label={t('chhutta.friend.cta.aria', { name, amount })}>
        {t('chhutta.friend.cta')}
      </Button>
    </div>
  )
}
