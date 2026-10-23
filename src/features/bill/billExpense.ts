/**
 * From bill draft to saved expense and back: an itemized bill is saved as an `Expense` with
 * `kind: 'bill'`, split `items`, its people as participants and a snapshot of the bill — enough to
 * show who had what, or to re-open it in the flow to fix something.
 */
import { friendsStore, type ExpenseDraft } from '../../data'
import { ME_ID, type Expense, type ExpenseSource, type Friend } from '../../domain/types'
import { uniqueParticipants } from '../../engine/split'
import { UNKNOWN_FRIEND_LABEL } from '../../kit/index-a'
import { validShares } from '../../lib/split'
import { createSession, repairSession, sanitizeItem } from '../../state/reducer'
import { billCategory, billDate, clampStep, effectivePaid } from '../../state/selectors'
import { EMPTY_META, type BillSource, type Person, type Session, type Shares } from '../../types'
import { personById } from './billPeople'

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
      meta: session.meta.fees ? { ...session.meta, fees: session.meta.fees.map((fee) => ({ ...fee })) } : { ...session.meta },
      items: session.items.map((item) => ({ ...item })),
      assignments,
      warnings: [...session.warnings],
      // How fees are shared only matters (and is only kept) when there are fees.
      ...(session.meta.fees && session.meta.fees.length > 0 ? { feeSplit: session.feeSplit ?? 'proportional' } : {}),
    },
    recurringId: null,
    source: session.source ? SOURCES[session.source] : 'manual',
  }
}

/**
 * A saved bill back as a draft, on its last step, for fixing who had what (or anything else):
 * saving it then updates the same expense. Someone removed from your people since shows as
 * "Someone". Null for an expense that isn't an itemized bill.
 */
export function billSessionFromExpense(expense: Expense, friends: readonly Friend[] = friendsStore.get()): Session | null {
  const { bill } = expense
  if (expense.kind !== 'bill' || !bill || bill.items.length === 0) return null
  const people: Person[] = uniqueParticipants(expense.participants).map(
    ({ friendId }) => personById(friendId, friends) ?? { id: friendId, name: UNKNOWN_FRIEND_LABEL, color: 0 },
  )
  const fresh = createSession(expense.currency)
  const source: BillSource = expense.source === 'scan' || expense.source === 'sample' ? expense.source : 'manual'
  const session = repairSession({
    ...fresh,
    step: 'result',
    source,
    meta: { ...EMPTY_META, ...bill.meta },
    warnings: [],
    items: bill.items.map(sanitizeItem),
    paid: expense.total,
    people,
    assignments: bill.assignments,
    payerId: expense.payerId,
    category: expense.category,
    date: expense.date,
    groupId: expense.groupId,
    expenseId: expense.id,
    ...(bill.feeSplit ? { feeSplit: bill.feeSplit } : {}),
  })
  return { ...session, step: clampStep(session, 'result') }
}

