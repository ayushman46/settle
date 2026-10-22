/**
 * From bill draft to saved expense: an itemized bill is saved as an `Expense` with
 * `kind: 'bill'`, split `items`, its people as participants and a snapshot of the bill (enough to
 * show who had what, or to re-open it in the flow).
 */
import type { ExpenseDraft } from '../../data'
import { ME_ID, type ExpenseSource } from '../../domain/types'
import { validShares } from '../../lib/split'
import { billCategory, billDate, effectivePaid } from '../../state/selectors'
import type { BillSource, Session, Shares } from '../../types'

const SOURCES: Readonly<Record<BillSource, ExpenseSource>> = { scan: 'scan', manual: 'manual', sample: 'sample' }

/** Who paid: the person picked on the split, else you. */
export function billPayer(session: Session): string {
  return session.payerId ?? ME_ID
}

/** Everyone who could have paid: the people at the table, and you even if you weren't eating. */
export function payerCandidates(session: Session): string[] {
  const ids = session.people.map((p) => p.id)
  return ids.includes(ME_ID) ? ids : [...ids, ME_ID]
}

/**
 * The expense to save for a bill (`today` is YYYY-MM-DD). Saving it again — after going back to
 * fix something — updates the same expense instead of adding a second one.
 */
export function billExpenseDraft(session: Session, today: string): ExpenseDraft {
  const assignments: Record<string, Shares> = {}
  for (const item of session.items) {
    const shares = validShares(session.assignments[item.id], session.people)
    if (Object.keys(shares).length > 0) assignments[item.id] = shares
  }
  return {
    ...(session.expenseId ? { id: session.expenseId } : {}),
    kind: 'bill',
    title: session.meta.merchant ?? '',
    category: billCategory(session),
    currency: session.currency,
    total: effectivePaid(session),
    date: billDate(session, today),
    payerId: billPayer(session),
    mode: 'items',
    participants: session.people.map((p) => ({ friendId: p.id, input: null })),
    roundedToWhole: false,
    note: null,
    groupId: session.groupId,
    bill: {
      meta: { ...session.meta },
      items: session.items.map((item) => ({ ...item })),
      assignments,
      warnings: [...session.warnings],
    },
    recurringId: null,
    source: session.source ? SOURCES[session.source] : 'manual',
  }
}
