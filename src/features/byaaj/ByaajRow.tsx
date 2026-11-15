import { useMemo, useState } from 'react'
import { Percent } from 'lucide-react'
import { navigate } from '../../app/router'
import { Card, ListRow } from '../../components'
import { useExpense, useExpenses, useGroups } from '../../data'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { rateLabel } from './byaajText'
import { loanFacts, loanView } from './loans'
import { byaajPath } from './paths'
import { useByaajPlan } from './store'
import styles from './Byaaj.module.css'

export interface ByaajRowProps {
  /** The loan (an udhaar expense). */
  expenseId: string
}

/**
 * For a loan's page. Without interest: "Add interest", one tap to the rate chips. With it:
 * "Interest: 1% a month · ₹1,500 interest due · ₹51,500 in all", one tap to the statement. Shows
 * nothing for anything that isn't cash lent or borrowed between you and one person, and nothing
 * for a loan that is already paid back and never had interest.
 */
export function ByaajRow({ expenseId }: ByaajRowProps) {
  const t = useT()
  const expense = useExpense(expenseId)
  const expenses = useExpenses()
  const groups = useGroups()
  const plan = useByaajPlan(expenseId)
  const [today] = useState(() => todayIso())
  const facts = useMemo(() => loanFacts(expense, groups), [expense, groups])
  const view = useMemo(() => (plan && facts ? loanView(plan, facts, expenses, today) : null), [plan, facts, expenses, today])
  if (!facts) return null
  if (!view && facts.open === 0) return null

  const money = (minor: number): string => formatMoney(minor, facts.currency, { trimZeros: true })
  const icon = (
    <span className={styles.rowIcon} aria-hidden="true">
      <Percent />
    </span>
  )
  return (
    <Card padding="none">
      {view ? (
        <ListRow
          leading={icon}
          title={t('byaaj.row.title', { rate: rateLabel(view.statement.rate) })}
          subtitle={view.statement.cleared ? t('byaaj.row.cleared') : t('byaaj.row.body', { interest: money(view.statement.interestDue), total: money(view.statement.due) })}
          chevron
          onClick={() => navigate(byaajPath(expenseId))}
        />
      ) : (
        <ListRow leading={icon} title={t('byaaj.row.add.title')} subtitle={t('byaaj.row.add.body')} chevron onClick={() => navigate(byaajPath(expenseId))} />
      )}
    </Card>
  )
}
