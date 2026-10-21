import { Check, Repeat } from 'lucide-react'
import { Badge, CategoryIcon, ListRow, Money } from '../components'
import { useFriend, useGroup } from '../data'
import type { Expense } from '../domain/types'
import { cx } from '../lib/cx'
import { fullDateLabel, relativeDateLabel } from './dateLabel'
import { expenseRowView } from './expenseLabels'
import { friendLabel } from './friendName'
import styles from './ExpenseRow.module.css'

export interface ExpenseRowProps {
  expense: Expense
  /** Opens the expense. Without it the row is a plain, non-interactive line. */
  onClick?: () => void
  /** Puts the date ("Today", "18 Oct") in front of the subtitle — for lists not already grouped by day. */
  showDate?: boolean
  /** Counts people instead of naming the group (e.g. inside that group's own screen). */
  hideGroup?: boolean
  className?: string
}

/**
 * One expense in a list: its category tile, title, who paid, and — on the right — what it means
 * for you (+ you're owed, − you owe) with a "Settled" / "2 pending" pill. Put rows in a `List`.
 */
export function ExpenseRow({ expense, onClick, showDate = false, hideGroup = false, className }: ExpenseRowProps) {
  const payer = useFriend(expense.payerId)
  const group = useGroup(expense.groupId)
  const view = expenseRowView(expense, {
    payerName: friendLabel(expense.payerId, payer),
    group,
    showGroup: !hideGroup,
  })
  const date = showDate ? relativeDateLabel(expense.date) : null
  const subtitle = date ? `${date} · ${view.subtitle}` : view.subtitle
  const spokenDate = showDate ? fullDateLabel(expense.date) : ''
  const label = [expense.title, spokenDate, view.spoken].filter(Boolean).join(', ')

  return (
    <ListRow
      className={cx(styles.row, className)}
      onClick={onClick}
      aria-label={onClick ? label : undefined}
      leading={<CategoryIcon category={expense.category} size="md" />}
      title={
        <>
          {expense.title}
          {expense.recurringId !== null && (
            <Repeat aria-hidden="true" className={styles.recurring} strokeWidth={2.5} />
          )}
        </>
      }
      subtitle={subtitle}
      trailing={
        <span className={styles.side}>
          <Money
            value={view.amount}
            currency={expense.currency}
            sign={view.tone === 'muted' ? 'auto' : 'always'}
            trimZeros
            strong={view.tone !== 'muted'}
            muted={view.tone === 'muted'}
            tone={view.tone === 'muted' ? 'default' : view.tone}
            className={styles.amount}
          />
          {view.status ? (
            <Badge
              tone={view.status.tone}
              icon={view.status.tone === 'positive' ? <Check strokeWidth={3} /> : undefined}
              className={styles.status}
            >
              {view.status.label}
            </Badge>
          ) : (
            view.caption !== null && <span className={styles.caption}>{view.caption}</span>
          )}
        </span>
      }
    />
  )
}
