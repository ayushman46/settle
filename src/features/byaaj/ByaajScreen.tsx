import { useMemo, useState } from 'react'
import { Percent } from 'lucide-react'
import { goBack, navigate } from '../../app/router'
import { Button, Card, EmptyState, List, ListRow, Money, PageTitle, Screen, TopBar } from '../../components'
import { useExpenses, useFriendsById, useGroups } from '../../data'
import type { Minor } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { FriendAvatar } from '../../kit/FriendAvatar'
import { friendLabel } from '../../kit/friendName'
import { formatMoney } from '../../lib/money'
import { firstName } from '../../share/text'
import { dayLabel, rateLabel } from './byaajText'
import { loanFacts, loanView, type LoanFacts, type LoanView } from './loans'
import { byaajPath, LEND_PATH } from './paths'
import { useByaajPlans } from './store'
import styles from './Byaaj.module.css'

/** Loans offered for interest before the rest are left to their own pages. */
const MAX_OFFERED = 30

/**
 * `/app/byaaj`: loans with interest (what each stands at today), and the loans still open that
 * have none yet, one tap from adding it. Nothing to set up here: loans are the app's own udhaar.
 */
export function ByaajScreen() {
  const t = useT()
  const expenses = useExpenses()
  const groups = useGroups()
  const friendsById = useFriendsById()
  const plans = useByaajPlans()
  const [today] = useState(() => todayIso())

  const { withInterest, without } = useMemo(() => {
    const byId = new Map(expenses.map((e) => [e.id, e]))
    const views: LoanView[] = []
    for (const plan of plans) {
      const facts = loanFacts(byId.get(plan.expenseId), groups)
      if (facts) views.push(loanView(plan, facts, expenses, today))
    }
    // What is still due first (the largest first), then the cleared ones; ties by the loan's date, newest first.
    views.sort((a, b) => Number(a.statement.cleared) - Number(b.statement.cleared) || b.statement.due - a.statement.due || (a.statement.from < b.statement.from ? 1 : -1))
    const planned = new Set(plans.map((p) => p.expenseId))
    const open: LoanFacts[] = []
    for (const e of expenses) {
      if (e.kind !== 'loan' || planned.has(e.id)) continue
      const facts = loanFacts(e, groups)
      if (facts && (facts.open === null || facts.open > 0)) open.push(facts)
    }
    open.sort((a, b) => (a.expense.date < b.expense.date ? 1 : a.expense.date > b.expense.date ? -1 : b.expense.createdAt - a.expense.createdAt))
    return { withInterest: views, without: open.slice(0, MAX_OFFERED) }
  }, [expenses, groups, plans, today])

  const nameOf = (id: string): string => firstName(friendLabel(id, friendsById[id] ?? null))
  const money = (minor: Minor, currency: string): string => formatMoney(minor, currency, { trimZeros: true })
  const header = <TopBar onBack={() => goBack('/app')} />

  if (withInterest.length === 0 && without.length === 0) {
    return (
      <Screen header={header} contentClassName={styles.content}>
        <PageTitle title={t('byaaj.title')} subtitle={t('byaaj.subtitle')} />
        <EmptyState icon={<Percent />} title={t('byaaj.empty.title')} text={t('byaaj.empty.text')} action={<Button onClick={() => navigate(LEND_PATH)}>{t('byaaj.empty.cta')}</Button>} />
      </Screen>
    )
  }

  return (
    <Screen header={header} contentClassName={styles.content}>
      <PageTitle title={t('byaaj.title')} subtitle={t('byaaj.subtitle')} />
      {withInterest.length > 0 && (
        <section className={styles.block} aria-labelledby="byaaj-list">
          <h2 id="byaaj-list" className={styles.heading}>
            {t('byaaj.list.title')}
          </h2>
          <Card padding="none">
            <List>
              {withInterest.map((view) => {
                const { facts, statement: s, plan } = view
                const rate = rateLabel(s.rate)
                const detail = s.cleared
                  ? t('byaaj.list.row.cleared', { rate })
                  : plan.dueOn
                    ? t('byaaj.list.row.detail.dueOn', { rate, total: money(s.due, facts.currency), date: dayLabel(plan.dueOn) })
                    : t('byaaj.list.row.detail', { rate, total: money(s.due, facts.currency) })
                return (
                  <ListRow
                    key={plan.expenseId}
                    leading={<FriendAvatar friendId={facts.friendId} size="md" />}
                    title={t(facts.lent ? 'byaaj.list.row.lent' : 'byaaj.list.row.borrowed', { name: nameOf(facts.friendId), amount: money(s.principalStart, facts.currency) })}
                    subtitle={detail}
                    trailing={s.cleared ? undefined : <Money value={s.due} currency={facts.currency} trimZeros strong />}
                    chevron
                    onClick={() => navigate(byaajPath(plan.expenseId))}
                  />
                )
              })}
            </List>
          </Card>
        </section>
      )}
      {without.length > 0 && (
        <section className={styles.block} aria-labelledby="byaaj-add">
          <h2 id="byaaj-add" className={styles.heading}>
            {t('byaaj.add.title')}
          </h2>
          <Card padding="none">
            <List>
              {without.map((facts) => (
                <ListRow
                  key={facts.expense.id}
                  leading={<FriendAvatar friendId={facts.friendId} size="md" />}
                  title={t(facts.lent ? 'byaaj.list.row.lent' : 'byaaj.list.row.borrowed', { name: nameOf(facts.friendId), amount: money(facts.open ?? facts.expense.total, facts.currency) })}
                  subtitle={t('byaaj.add.row.detail', { date: dayLabel(facts.expense.date) })}
                  chevron
                  onClick={() => navigate(byaajPath(facts.expense.id))}
                />
              ))}
            </List>
          </Card>
        </section>
      )}
    </Screen>
  )
}
