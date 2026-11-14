import { useMemo } from 'react'
import { navigate } from '../../app/router'
import { Button, Card, useToast } from '../../components'
import { useExpenses, useGroups } from '../../data'
import { ME_ID, type Expense, type Group } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { settleUpPath } from '../groups/paths'
import { hasStory, looksDone, type LooksDone } from './engine'
import { wrappedPath } from './paths'
import { putAwayCard, restorePutAway, usePutAway, usePutAwayAll } from './store'
import styles from './Wrapped.module.css'

/**
 * "Goa looks done. 3 payments settle it." — on a group whose spending has stopped after a burst,
 * with money still owed. Settle up, see the story, or put it away until the group gets busy again.
 */
export function TripOverCard({ group }: { group: Group }) {
  const expenses = useExpenses({ groupId: group.id })
  const putAway = usePutAway(group.id)
  const day = todayIso()
  const done = useMemo(() => looksDone(group, expenses, day, ME_ID, putAway), [group, expenses, day, putAway])
  if (!done) return null
  return <DoneCard group={group} expenses={expenses} done={done} today={day} />
}

/** Home's version: the group that most recently looks done (null when none does). */
export function TripOverHome() {
  const groups = useGroups({ archived: false })
  const expenses = useExpenses()
  const putAway = usePutAwayAll()
  const day = todayIso()
  const found = useMemo(() => {
    let best: { group: Group; done: LooksDone } | null = null
    for (const group of groups) {
      const done = looksDone(group, expenses, day, ME_ID, putAway[group.id] ?? null)
      if (!done) continue
      if (!best || done.last > best.done.last || (done.last === best.done.last && group.name.localeCompare(best.group.name) < 0)) best = { group, done }
    }
    return best
  }, [groups, expenses, day, putAway])
  if (!found) return null
  return <DoneCard group={found.group} expenses={expenses} done={found.done} today={day} />
}

function DoneCard({ group, expenses, done, today }: { group: Group; expenses: readonly Expense[]; done: LooksDone; today: string }) {
  const t = useT()
  const toast = useToast()
  const money = (paise: number): string => formatMoney(paise, group.currency, { trimZeros: true })
  const story = hasStory(group, expenses)
  const mine = done.mine > 0 ? t('wrapped.done.owed', { amount: money(done.mine) }) : done.mine < 0 ? t('wrapped.done.owe', { amount: money(-done.mine) }) : t('wrapped.done.even')

  const later = (): void => {
    const before = putAwayCard(group.id, today, done.last)
    haptic('success')
    toast(t('wrapped.done.later.toast', { name: group.name }), { action: { label: t('common.action.undo'), onAction: () => restorePutAway(group.id, before) } })
  }

  return (
    <Card className={styles.done} role="region" aria-label={t('wrapped.done.title', { name: group.name })}>
      <div className={styles.doneHead}>
        <span className={styles.doneEmoji} aria-hidden="true">
          {group.emoji}
        </span>
        <div className={styles.doneText}>
          <h2 className={styles.doneTitle}>{t('wrapped.done.title', { name: group.name })}</h2>
          <p className={styles.doneBody}>
            {t('wrapped.done.body', { count: done.payments, amount: money(done.total) })} {mine}
          </p>
        </div>
      </div>
      <div className={styles.doneActions}>
        <Button size="md" onClick={() => navigate(settleUpPath(group.id))}>
          {t('wrapped.done.settle')}
        </Button>
        {story && (
          <Button size="md" variant="secondary" onClick={() => navigate(wrappedPath(group.id))}>
            {t('wrapped.done.story')}
          </Button>
        )}
        <Button size="md" variant="ghost" className={styles.doneLater} onClick={later}>
          {t('wrapped.done.later')}
        </Button>
      </div>
    </Card>
  )
}
