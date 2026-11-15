import { useToast } from '../../components'
import { useFriend, useProfile, useSummary } from '../../data'
import { ME_ID, type Minor } from '../../domain/types'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { formatMoney } from '../../lib/money'
import { firstName } from '../../share/text'
import { limitStanding, ownChoice } from './engine'
import { LimitPicker, type LimitChoice } from './LimitPicker'
import { setEveryoneLimit, setFriendLimit, useLimitState } from './store'
import styles from './Limit.module.css'

export interface LimitRowProps {
  friendId: string
}

/**
 * One person's udhaar limit, for their page: what it is for in a line, the chips (one tap sets
 * it, with Undo), and where they stand against it right now. Shows nothing for yourself or for
 * someone who isn't in your people.
 */
export function LimitRow({ friendId }: LimitRowProps) {
  const t = useT()
  const toast = useToast()
  const friend = useFriend(friendId)
  const profile = useProfile()
  const summary = useSummary()
  const state = useLimitState()
  if (!friend || friendId === ME_ID) return null

  const currency = profile.currency
  const name = firstName(friendLabel(friendId, friend))
  const money = (minor: Minor): string => formatMoney(minor, currency, { trimZeros: true })
  const standing = limitStanding(state, friendId, summary.byFriend)
  const choice = ownChoice(state, friendId)

  const pick = (next: LimitChoice): void => {
    const undo = setFriendLimit(friendId, next === 'everyone' ? null : next)
    const message =
      typeof next === 'number'
        ? t('limit.toast.set', { name, amount: money(next) })
        : next === 'everyone'
          ? t('limit.toast.everyone.back', { name })
          : t('limit.toast.none', { name })
    toast(message, { tone: 'success', action: { label: t('common.action.undo'), onAction: undo } })
  }

  return (
    <section className={styles.row} aria-label={t('limit.row.aria', { name })}>
      <h3 className={styles.title}>{t('limit.row.title')}</h3>
      <p className={styles.fine}>{t('limit.row.body', { name })}</p>
      <LimitPicker label={t('limit.pick.aria', { name })} value={choice} currency={currency} everyone={state.everyone} onPick={pick} />
      {standing.limit && (
        <p className={standing.over > 0 ? styles.over : styles.fine} role="status">
          {!standing.limit.own && `${t('limit.status.everyone', { amount: money(standing.limit.amount) })} `}
          {standing.over > 0
            ? t('limit.status.over', { name, owed: money(standing.owed), over: money(standing.over) })
            : standing.owed === standing.limit.amount
              ? t('limit.status.at', { name, owed: money(standing.owed) })
              : standing.owed > 0
                ? t('limit.status.within', { name, owed: money(standing.owed), left: money(standing.limit.amount - standing.owed) })
                : t('limit.status.nothing', { name })}
        </p>
      )}
    </section>
  )
}

/**
 * The limit for everyone who has none of their own, for the limits screen (or Settings). One tap
 * sets it, with Undo.
 */
export function LimitEveryoneRow() {
  const t = useT()
  const toast = useToast()
  const profile = useProfile()
  const state = useLimitState()
  const currency = profile.currency
  const money = (minor: Minor): string => formatMoney(minor, currency, { trimZeros: true })

  const pick = (next: LimitChoice): void => {
    const amount = typeof next === 'number' ? next : null
    const undo = setEveryoneLimit(amount)
    toast(amount !== null ? t('limit.toast.everyone.set', { amount: money(amount) }) : t('limit.toast.everyone.none'), {
      tone: 'success',
      action: { label: t('common.action.undo'), onAction: undo },
    })
  }

  return (
    <section className={styles.row} aria-label={t('limit.everyone.title')}>
      <h3 className={styles.title}>{t('limit.everyone.title')}</h3>
      <p className={styles.fine}>{t('limit.everyone.body')}</p>
      <LimitPicker label={t('limit.pick.everyone.aria')} value={state.everyone ?? 'none'} currency={currency} onPick={pick} />
    </section>
  )
}
