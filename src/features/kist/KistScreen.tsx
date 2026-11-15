import { useMemo, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { goBack, navigate } from '../../app/router'
import { Button, Card, EmptyState, List, ListRow, Money, PageTitle, Screen, TopBar } from '../../components'
import { useExpenses, useFriendsById, useGroups, useSummary } from '../../data'
import { ME_ID } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { FriendAvatar, friendLabel } from '../../kit/index-a'
import { formatMoney } from '../../lib/money'
import { planView, unitOf } from './actions'
import { isRunning, MIN_PARTS, sortPlans, type KistPlan, type KistView } from './engine'
import { KistStartSheet } from './KistStartSheet'
import { kistPlanPath } from './paths'
import { usePlans } from './store'
import { planLine } from './text'
import styles from './Kist.module.css'

/** People offered for a new plan: the largest amounts first. */
const MAX_CANDIDATES = 8
/** Finished plans shown (the newest). */
const MAX_FINISHED = 20

interface Row {
  plan: KistPlan
  view: KistView
}

/**
 * `/app/kist` — Pay in parts: the plans where you pay, the plans where you receive, each with
 * the part that comes next; then the people a plan can be started with (the amount comes from
 * what is owed between you), and the finished plans.
 */
export function KistScreen() {
  const t = useT()
  const plans = usePlans()
  const expenses = useExpenses()
  const groups = useGroups()
  const friendsById = useFriendsById()
  const summary = useSummary()
  const [day] = useState(() => todayIso())
  const [starting, setStarting] = useState<{ friendId: string; open: boolean } | null>(null)
  const nameOf = (id: string): string => friendLabel(id, friendsById[id] ?? null)

  const rows = useMemo(() => {
    const books = { expenses, groups }
    const name = (id: string): string => friendsById[id]?.name ?? ''
    const view = (plan: KistPlan): Row => ({ plan, view: planView(plan, plans, books, day) })
    const running = sortPlans(plans.filter(isRunning), name)
    const finished = plans.filter((p) => !isRunning(p)).sort((a, b) => b.createdAt - a.createdAt)
    return {
      pay: running.filter((p) => p.direction === 'pay').map(view),
      receive: running.filter((p) => p.direction === 'receive').map(view),
      finished: finished.slice(0, MAX_FINISHED).map(view),
    }
  }, [plans, expenses, groups, friendsById, day])

  const candidates = useMemo(() => {
    const busy = new Set(plans.filter(isRunning).map((p) => p.friendId))
    const least = MIN_PARTS * unitOf(summary.currency)
    return Object.entries(summary.byFriend)
      .filter(([id, amount]) => id !== ME_ID && friendsById[id] !== undefined && !busy.has(id) && Math.abs(amount) >= least)
      .map(([id, amount]) => ({ id, amount, name: friendsById[id]?.name ?? '' }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount) || (a.name.toLocaleLowerCase() < b.name.toLocaleLowerCase() ? -1 : 1))
      .slice(0, MAX_CANDIDATES)
  }, [plans, summary.byFriend, summary.currency, friendsById])

  const header = <TopBar onBack={() => goBack('/app')} />
  const sheet = starting && (
    <KistStartSheet key={starting.friendId} friendId={starting.friendId} open={starting.open} onClose={() => setStarting({ ...starting, open: false })} />
  )
  const hasPlans = plans.length > 0

  if (!hasPlans && candidates.length === 0) {
    return (
      <Screen header={header} contentClassName={styles.content}>
        <PageTitle title={t('kist.title')} />
        <EmptyState
          icon={<CalendarClock />}
          title={t('kist.empty.title')}
          text={t('kist.empty.body')}
          action={<Button onClick={() => navigate('/app/lend')}>{t('kist.empty.cta')}</Button>}
        />
      </Screen>
    )
  }

  const section = (id: string, title: string, list: readonly Row[]) =>
    list.length > 0 && (
      <section className={styles.block} aria-labelledby={id}>
        <h2 id={id} className={styles.heading}>
          {title}
        </h2>
        <Card padding="none">
          <List aria-labelledby={id}>
            {list.map(({ plan, view }) => {
              const line = planLine(plan, view, day)
              return (
                <ListRow
                  key={plan.id}
                  leading={<FriendAvatar friendId={plan.friendId} size="md" />}
                  title={nameOf(plan.friendId)}
                  subtitle={line}
                  trailing={view.state === 'running' ? <Money value={view.left} currency={plan.currency} trimZeros strong /> : undefined}
                  onClick={() => navigate(kistPlanPath(plan.id))}
                  chevron
                  pending={view.dueCount > 0}
                  aria-label={t('kist.row.aria', { name: nameOf(plan.friendId), line })}
                />
              )
            })}
          </List>
        </Card>
      </section>
    )

  return (
    <Screen header={header} contentClassName={styles.content}>
      <PageTitle title={t('kist.title')} subtitle={t('kist.subtitle')} />
      {section('kist-pay', t('kist.pay.heading'), rows.pay)}
      {section('kist-receive', t('kist.receive.heading'), rows.receive)}
      {candidates.length > 0 && (
        <section className={styles.block} aria-labelledby="kist-start">
          <h2 id="kist-start" className={styles.heading}>
            {t('kist.start.heading')}
          </h2>
          <p className={styles.fine}>{t('kist.start.fine')}</p>
          <Card padding="none">
            <List aria-labelledby="kist-start">
              {candidates.map((c) => {
                const amount = formatMoney(Math.abs(c.amount), summary.currency, { trimZeros: true })
                const line = c.amount > 0 ? t('kist.candidate.owesYou', { amount }) : t('kist.candidate.youOwe', { amount })
                return (
                  <ListRow
                    key={c.id}
                    leading={<FriendAvatar friendId={c.id} size="md" />}
                    title={nameOf(c.id)}
                    subtitle={line}
                    onClick={() => setStarting({ friendId: c.id, open: true })}
                    chevron
                    aria-label={t('kist.candidate.aria', { name: nameOf(c.id), line })}
                  />
                )
              })}
            </List>
          </Card>
        </section>
      )}
      {section('kist-finished', t('kist.done.heading'), rows.finished)}
      {sheet}
    </Screen>
  )
}
