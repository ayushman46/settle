import { useId } from 'react'
import { Badge, Button, CategoryIcon, SectionHeader } from '../../components'
import { useDueRecurring } from '../../data'
import { today } from '../../engine/dates'
import type { RecurringDue } from '../../engine/recurring'
import { useT } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { dueLabel, monthName } from '../recurring/recurringLabels'
import { useSplitNow } from '../recurring/useSplitNow'
import { DUE_SHOWN, RECURRING_PATH } from './homeLinks'
import styles from './HomeScreen.module.css'

/**
 * Recurring splits that are due (or overdue): "Rent · Due in 3 days" with a one-tap "Split now"
 * that creates this month's expense, celebrates and opens it. Nothing when none are due.
 */
export function DueSplits() {
  const t = useT()
  const day = today()
  const due = useDueRecurring(day)
  const { splitNow, moment } = useSplitNow()
  if (due.length === 0) return moment
  return (
    <section className={styles.section} aria-labelledby="home-due">
      <SectionHeader
        id="home-due"
        title={t('home.due.title')}
        action={due.length > DUE_SHOWN ? { label: t('common.action.seeAll'), href: RECURRING_PATH, 'aria-label': t('home.due.seeAllAria') } : undefined}
      />
      <ul role="list" className={styles.dueList}>
        {due.slice(0, DUE_SHOWN).map((item) => (
          <li key={item.template.id}>
            <DueCard due={item} day={day} onSplit={() => splitNow(item.template, item.period)} />
          </li>
        ))}
      </ul>
      {moment}
    </section>
  )
}

function DueCard({ due, day, onSplit }: { due: RecurringDue; day: string; onSplit: () => void }) {
  const t = useT()
  const { template, period } = due
  const titleId = useId()
  const month = monthName(period, day)
  return (
    <article className={styles.dueCard} aria-labelledby={titleId}>
      <CategoryIcon category={template.category} size="md" />
      <div className={styles.dueText}>
        <h3 id={titleId} className={styles.dueTitle}>
          {template.title}
        </h3>
        <p className={styles.dueMeta}>
          <Badge tone={due.overdue ? 'negative' : 'warning'}>{dueLabel(due)}</Badge>
          <span className={styles.dueAmount}>{formatMoney(template.total, template.currency, { trimZeros: true })}</span>
        </p>
      </div>
      <Button variant="accent" size="sm" onClick={onSplit} aria-label={`Split ${template.title} for ${month} now`}>
        {t('home.due.splitNow')}
      </Button>
    </article>
  )
}
