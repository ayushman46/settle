/* eslint-disable react-refresh/only-export-components -- test-only helpers (a tiny app + fixtures), never part of the app bundle. */
/**
 * Test support for the split and expense screens: the two screens behind the real router (so a
 * save really lands on the expense page and Back really goes back), a clean slate for every
 * module with memory, and fixture people, groups and expenses.
 */
import { useLocation, useRoute } from '../../app/router'
import { expensesStore, updateProfile } from '../../data'
import type { Expense } from '../../domain/types'
import { seedPeople as seedKitPeople } from '../../kit/testPeople'
import { makeExpense } from '../../share/testing'
import { resetBillLaunchForTests } from '../bill/launch'
import { ExpenseDetailScreen } from '../expense/ExpenseDetailScreen'
import { currentUrl, renderAt, resetProScreens } from '../pro/testing'
import { NewSplitScreen } from './NewSplitScreen'

export { currentUrl }
export { seedGroup } from '../../kit/testPeople'

const ROUTES = ['/app/split/new', '/app/split/:id/edit', '/app/expense/:id'] as const

/** The split screens as the app routes them; anywhere else shows the address it went to. */
export function TestApp() {
  const { pattern } = useRoute(ROUTES)
  const { path } = useLocation()
  if (pattern === '/app/expense/:id') return <ExpenseDetailScreen key={path} />
  if (pattern !== null) return <NewSplitScreen key={path} />
  return (
    <main>
      <h1>Elsewhere</h1>
      <p data-testid="elsewhere">{path}</p>
    </main>
  )
}

/** Renders the split screens with the address bar at `path`. */
export function renderApp(path: string) {
  return renderAt(path, <TestApp />)
}

/** Forgets everything: data, Pro, the paywall, navigation, hand-offs, drafts and the bill launcher. */
export function resetSplitScreens(): void {
  resetProScreens()
  resetBillLaunchForTests()
}

/**
 * You (Ayush, UPI ayush@okaxis), Riya (UPI riya@okicici, phone 98765 43210), Sam and Neha Sharma,
 * saved as your people with their fixture ids, with rupees as the default currency.
 */
export function seedPeople(): void {
  seedKitPeople()
  updateProfile({ currency: 'INR' })
}

/** Saves `makeExpense(extra)` (₹2,766 dinner I paid, four ways, Riya has paid me back). */
export function seedExpense(extra: Partial<Expense> = {}): Expense {
  const expense = makeExpense({ createdAt: Date.now(), updatedAt: Date.now(), ...extra })
  expensesStore.set([...expensesStore.get().filter((e) => e.id !== expense.id), expense])
  return expense
}
