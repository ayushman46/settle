import { Check } from 'lucide-react'
import { Link } from '../../app/router'
import { CategoryIcon, Money, Receipt } from '../../components'
import { ME_ID, type Expense, type Group } from '../../domain/types'
import { CATEGORY_META } from '../../engine/categories'
import { useT } from '../../i18n'
import { FriendAvatar, fullDateLabel, relativeDateLabel } from '../../kit/index-a'
import { cx } from '../../lib/cx'
import type { StandingPill } from './expenseView'
import styles from './ExpenseHero.module.css'

export interface ExpenseHeroProps {
  expense: Expense
  /** The payer as the owner knows them ("You", "Riya", "Someone"). */
  payerName: string
  /** The group it's filed under, while that group exists. */
  group: Group | null
  standing: StandingPill | null
}

/**
 * The top of an expense, as a torn-off receipt: its category, title and date, the amount in big
 * numerals, who paid, and where the owner stands.
 */
export function ExpenseHero({ expense, payerName, group, standing }: ExpenseHeroProps) {
  const t = useT()
  const category = CATEGORY_META[expense.category]
  return (
    <Receipt padding="lg" className={styles.hero} paperClassName={styles.paper}>
      <CategoryIcon category={expense.category} size="xl" label={category.label} />
      <h1 className={styles.title} tabIndex={-1}>
        {expense.title}
      </h1>
      <p className={styles.meta}>
        <time dateTime={expense.date} title={fullDateLabel(expense.date)}>
          {relativeDateLabel(expense.date)}
        </time>
        {/* "Rent · Rent" says nothing twice: the category only shows when the title doesn't say it. */}
        {category.label.toLocaleLowerCase() !== expense.title.trim().toLocaleLowerCase() && <> · {category.label}</>}
      </p>
      {group && (
        <Link to={`/app/groups/${encodeURIComponent(group.id)}`} className={styles.group} aria-label={t('expense.hero.group.aria', { name: group.name })}>
          <span aria-hidden="true">{group.emoji}</span>
          <span className={styles.groupName}>{group.name}</span>
        </Link>
      )}
      <Money value={expense.total} currency={expense.currency} size="xl" trimZeros strong className={styles.amount} />
      <p className={styles.payer}>
        <FriendAvatar friendId={expense.payerId} size="xs" />
        <span>{t('expense.hero.paidBy', { who: expense.payerId === ME_ID ? 'me' : 'other', name: payerName })}</span>
      </p>
      {standing && (
        <p className={cx(styles.standing, styles[standing.tone])}>
          {standing.done && <Check aria-hidden="true" className={styles.standingIcon} strokeWidth={3} />}
          {standing.label}
        </p>
      )}
    </Receipt>
  )
}
