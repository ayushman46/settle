import { navigate } from '../../app/router'
import { Card, List, SectionHeader } from '../../components'
import { useExpenses } from '../../data'
import { ExpenseRow } from '../../kit/ExpenseRow'
import { ACTIVITY_PATH, expensePath, RECENT_SHOWN } from './homeLinks'
import styles from './HomeScreen.module.css'

/** The latest few expenses, newest first, each opening its detail. Nothing when there are none. */
export function RecentActivity() {
  const expenses = useExpenses()
  if (expenses.length === 0) return null
  return (
    <section className={styles.section} aria-labelledby="home-recent">
      <SectionHeader
        id="home-recent"
        title="Recent activity"
        action={{ label: 'See all', href: ACTIVITY_PATH, 'aria-label': 'See all activity' }}
      />
      <Card padding="none">
        <List>
          {expenses.slice(0, RECENT_SHOWN).map((expense) => (
            <ExpenseRow key={expense.id} expense={expense} showDate onClick={() => navigate(expensePath(expense.id))} />
          ))}
        </List>
      </Card>
    </section>
  )
}
