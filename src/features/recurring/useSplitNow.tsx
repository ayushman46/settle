import { useState, type ReactNode } from 'react'
import { navigate } from '../../app/router'
import { Money, SuccessBurst, useToast } from '../../components'
import { createExpenseFromRecurring, ExpenseError, expenseErrorMessage, useFriendsById } from '../../data'
import type { Expense, RecurringTemplate } from '../../domain/types'
import { today } from '../../engine/dates'
import { friendLabel } from '../../kit/index-a'
import { withPro } from '../pro/paywall'
import { monthName, standingFromShares, standingLine } from './recurringLabels'

export interface SplitNow {
  /** Splits `template` for `period` (YYYY-MM): Pro-gated, celebrated, then opens the new expense. */
  splitNow: (template: RecurringTemplate, period: string) => void
  /** The "split" moment to render while it plays (null otherwise). */
  moment: ReactNode
}

interface Done {
  expense: Expense
  title: string
  period: string
}

/**
 * "Split now" for a recurring template: one tap creates this month's expense (once — tapping
 * again never doubles it), plays the success moment, then opens the expense so it can be shared
 * and collected. Free users get the paywall first and carry on once Pro is on.
 */
export function useSplitNow(): SplitNow {
  const toast = useToast()
  const friendsById = useFriendsById()
  const [done, setDone] = useState<Done | null>(null)

  const splitNow = (template: RecurringTemplate, period: string): void => {
    withPro('recurring', () => {
      try {
        const expense = createExpenseFromRecurring(template.id, period)
        setDone({ expense, title: template.title, period })
      } catch (error) {
        if (!(error instanceof ExpenseError)) throw error
        toast(`Couldn't split ${template.title}. ${expenseErrorMessage(error.code)}`, {
          tone: 'error',
          action:
            error.code === 'not_found'
              ? undefined
              : { label: 'Edit', onAction: () => navigate(`/app/recurring/${encodeURIComponent(template.id)}`) },
        })
      }
    })
  }

  let moment: ReactNode = null
  if (done) {
    const { expense } = done
    const payerName = friendLabel(expense.payerId, friendsById[expense.payerId] ?? null)
    const line = standingLine(standingFromShares(expense.payerId, expense.total, expense.shares), expense.currency, payerName, 'now')
    moment = (
      <SuccessBurst
        title={`${done.title} split`}
        amount={<Money value={expense.total} currency={expense.currency} size="lg" trimZeros strong />}
        subtitle={[`For ${monthName(done.period, today())}`, line].filter(Boolean).join(' · ')}
        onDone={() => {
          setDone(null)
          navigate(`/app/expense/${encodeURIComponent(expense.id)}`)
        }}
      />
    )
  }

  return { splitNow, moment }
}
