import { memo, useMemo } from 'react'
import { UserRoundMinus } from 'lucide-react'
import { navigate } from '../../app/router'
import { Banner, Button, followLink, useToast } from '../../components'
import { useExpenses, useFriendsById } from '../../data'
import { ME_ID, type Expense, type Group } from '../../domain/types'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { haptic } from '../../lib/haptics'
import { expensePath } from '../groups/paths'
import { dayLabel, expenseItem, listText, takeOff } from './actions'
import { fixUpKey, presenceFixUps, spreadsPart, type PersonFixUps } from './engine'
import { decline, undecline, useAnchors, useDeclined, useStays } from './store'
import styles from './Presence.module.css'

/** A link to an expense, opening its page. */
function ExpenseLink({ expense, children }: { expense: Expense; children: string }) {
  const href = expensePath(expense.id)
  return (
    <a className={styles.link} href={href} onClick={(event) => followLink(event, href, navigate)}>
      {children}
    </a>
  )
}

/**
 * Above a group's expenses: someone who came late or left early is still on expenses from days
 * they weren't there. The banner names those expenses, and one tap takes them off (with Undo);
 * stays (villa, hotel) are never taken off but pointed to "Split by nights"; the rest are listed to
 * fix by hand. Says nothing when there's nothing to fix.
 */
export const PresenceBanner = memo(function PresenceBanner({ group }: { group: Group }) {
  const t = useT()
  const toast = useToast()
  const friendsById = useFriendsById()
  const expenses = useExpenses({ groupId: group.id })
  const stays = useStays(group.id)
  const declined = useDeclined(group.id)
  const anchors = useAnchors()
  const nameOf = useMemo(() => (id: string) => friendLabel(id, friendsById[id]), [friendsById])
  const people = useMemo(
    () => presenceFixUps({ group, expenses, stays, declined, nameOf, anchors }),
    [group, expenses, stays, declined, nameOf, anchors],
  )
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
        list: listText(change.changed.map(expenseItem)),
      }),
      {
        tone: 'success',
        action: { label: t('common.action.undo'), onAction: change.undo },
      },
    )
  }

  const leave = (p: PersonFixUps): void => {
    const keys = [...p.safe.map((e) => e.id), ...p.byHand.map((h) => h.expense.id), ...p.nightly.map((e) => e.id)].map((id) =>
      fixUpKey(id, p.friendId),
    )
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
        const title =
          count > 0 ? t(`presence.banner.${p.side}${you ? '.you' : ''}`, vars) : t(you ? 'presence.banner.stayOnly.you' : 'presence.banner.stayOnly', { name })
        const spread = p.safe.filter(spreadsPart)
        const hand = p.byHand.length > 0 && (
          <div className={styles.hand}>
            <p className={styles.fine}>{t(p.safe.length > 0 ? 'presence.hand.more' : 'presence.hand.only', { count: p.byHand.length })}</p>
            <ul className={styles.handList}>
              {p.byHand.map(({ expense, reason }) => (
                <li key={expense.id}>
                  <ExpenseLink expense={expense}>
                    {t('presence.hand.item', {
                      title: expense.title.trim(),
                      date: dayLabel(expense.date),
                    })}
                  </ExpenseLink>{' '}
                  <span className={styles.fine}>({t(`presence.reason.${reason}`)})</span>
                </li>
              ))}
            </ul>
          </div>
        )
        const nightly = p.nightly.length > 0 && (
          <div className={styles.hand}>
            <p className={styles.fine}>{t(you ? 'presence.banner.nights.you' : 'presence.banner.nights', { name, count: p.nightly.length })}</p>
            <ul className={styles.handList}>
              {p.nightly.map((expense) => (
                <li key={expense.id}>
                  <ExpenseLink expense={expense}>{expenseItem(expense)}</ExpenseLink>
                </li>
              ))}
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
                  <Button size="md" onClick={() => apply(p)}>
                    {t(you ? 'presence.banner.apply.you' : 'presence.banner.apply', { name })}
                  </Button>
                )}
                <Button size="md" variant="ghost" onClick={() => leave(p)}>
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
                  list: listText(p.safe.map(expenseItem)),
                })}
              </p>
            )}
            {spread.length > 0 && <p className={styles.fine}>{t('presence.banner.spread', { list: listText(spread.map((e) => e.title.trim() || t('presence.list.untitled'))) })}</p>}
            {nightly}
            {hand}
          </Banner>
        )
      })}
    </div>
  )
})
