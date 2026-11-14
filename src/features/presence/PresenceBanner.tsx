import { memo, useMemo } from 'react'
import { UserRoundMinus } from 'lucide-react'
import { navigate } from '../../app/router'
import { Banner, Button, followLink, useToast } from '../../components'
import { useExpenses, useFriendsById } from '../../data'
import { ME_ID, type Group } from '../../domain/types'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { haptic } from '../../lib/haptics'
import { expensePath } from '../groups/paths'
import { dayLabel, takeOff } from './actions'
import { fixUpKey, presenceFixUps, type PersonFixUps } from './engine'
import { decline, undecline, useDeclined, useStays } from './store'
import styles from './Presence.module.css'

/**
 * Above a group's expenses: someone who came late or left early is still on expenses from days
 * they weren't there. One tap takes them off the plain splits (with Undo); the rest are listed to
 * fix by hand. Says nothing when there's nothing to fix.
 */
export const PresenceBanner = memo(function PresenceBanner({ group }: { group: Group }) {
  const t = useT()
  const toast = useToast()
  const friendsById = useFriendsById()
  const expenses = useExpenses({ groupId: group.id })
  const stays = useStays(group.id)
  const declined = useDeclined(group.id)
  const nameOf = useMemo(() => (id: string) => friendLabel(id, friendsById[id]), [friendsById])
  const people = useMemo(() => presenceFixUps({ group, expenses, stays, declined, nameOf }), [group, expenses, stays, declined, nameOf])
  if (people.length === 0) return null

  const apply = (p: PersonFixUps): void => {
    const you = p.friendId === ME_ID
    const name = nameOf(p.friendId)
    const change = takeOff(p.safe, p.friendId)
    if (change.count === 0) {
      haptic('error')
      toast(t('presence.banner.failed'))
      return
    }
    haptic('success')
    toast(
      t(you ? 'presence.banner.done.you' : 'presence.banner.done', {
        name,
        count: change.count,
      }),
      {
        tone: 'success',
        action: { label: t('common.action.undo'), onAction: change.undo },
      },
    )
  }

  const leave = (p: PersonFixUps): void => {
    const keys = [...p.safe.map((e) => e.id), ...p.byHand.map((h) => h.expense.id)].map((id) => fixUpKey(id, p.friendId))
    decline(group.id, keys)
    toast(t('presence.banner.left'), {
      action: {
        label: t('common.action.undo'),
        onAction: () => undecline(group.id, keys),
      },
    })
  }

  return (
    <div className={styles.banners}>
      {people.map((p) => {
        const you = p.friendId === ME_ID
        const name = nameOf(p.friendId)
        const count = p.safe.length + p.byHand.length
        const vars = {
          name,
          count,
          date: dayLabel(p.side === 'before' ? (p.stay.from ?? '') : (p.stay.to ?? '')),
          from: dayLabel(p.stay.from ?? ''),
          to: dayLabel(p.stay.to ?? ''),
        }
        const title = t(`presence.banner.${p.side}${you ? '.you' : ''}`, vars)
        const hand = p.byHand.length > 0 && (
          <div className={styles.hand}>
            <p className={styles.fine}>{t(p.safe.length > 0 ? 'presence.hand.more' : 'presence.hand.only', { count: p.byHand.length })}</p>
            <ul className={styles.handList}>
              {p.byHand.map(({ expense, reason }) => {
                const href = expensePath(expense.id)
                return (
                  <li key={expense.id}>
                    <a className={styles.link} href={href} onClick={(event) => followLink(event, href, navigate)}>
                      {t('presence.hand.item', {
                        title: expense.title.trim(),
                        date: dayLabel(expense.date),
                      })}
                    </a>{' '}
                    <span className={styles.fine}>({t(`presence.reason.${reason}`)})</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )
        return (
          <Banner
            key={p.friendId}
            tone={p.safe.length > 0 ? 'warning' : 'info'}
            icon={<UserRoundMinus />}
            title={title}
            actions={
              <div className={styles.actions}>
                {p.safe.length > 0 && (
                  <Button size="sm" onClick={() => apply(p)}>
                    {t(you ? 'presence.banner.apply.you' : 'presence.banner.apply', { name })}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => leave(p)}>
                  {p.safe.length > 0 ? t('presence.banner.leave') : t('presence.hand.dismiss')}
                </Button>
              </div>
            }
          >
            {p.safe.length > 0 && (
              <p className={styles.text}>
                {t(you ? 'presence.banner.ask.you' : 'presence.banner.ask', {
                  name,
                  count: p.safe.length,
                })}
              </p>
            )}
            {hand}
          </Banner>
        )
      })}
    </div>
  )
})
