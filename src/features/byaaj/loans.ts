/**
 * Interest meets the app's own data: which expenses are loans interest can go on, what the app says
 * is still out on one, and recording a payment so that the principal part goes through the app's
 * normal "paid back" path (balances everywhere stay right) while the interest part is kept with the
 * loan's interest.
 *
 * The loan can also be marked paid back elsewhere in the app (the loan card, To collect, settling
 * up with the person). That is never lost: whatever the app says has come back, beyond what was
 * recorded here, is read as a payment towards the amount lent, dated by the app's own record of it.
 */
import { deleteSettlement, recordPartPayment, recordSettlement, setPaidBack } from '../../data'
import { isLendEntry, oneToOnePerson, repayLoanPart } from '../../data/loans'
import { ME_ID, type Expense, type Group, type Minor } from '../../domain/types'
import { stillOwed } from '../../engine/balances'
import { isIsoDate, toIsoDate } from '../../engine/dates'
import { newId } from '../../lib/ids'
import { currencyDigits } from '../../lib/money'
import { loanStatement, payInterestFirst, type LoanPayment, type LoanStatement, type PaymentParts } from './engine'
import { addByaajPayment, removeByaajPayment, type ByaajPayment, type ByaajPlan } from './store'

export interface LoanFacts {
  expense: Expense
  /** The other person. */
  friendId: string
  /** I lent it (true) or borrowed it (false). */
  lent: boolean
  lenderId: string
  borrowerId: string
  currency: string
  /** The group whose balances settle this loan, or null when it is settled person to person. */
  group: Group | null
  /**
   * What the app says is still out on this loan. Null for a loan inside a group: a group's
   * balances are settled as a whole, so the app cannot say how much of one loan has come back.
   */
  open: Minor | null
}

/** The facts of a loan interest can go on: cash lent or borrowed between you and one person. Null for anything else. */
export function loanFacts(expense: Expense | null | undefined, groups: readonly Group[]): LoanFacts | null {
  if (!expense || expense.kind !== 'loan' || expense.bill !== null || !isLendEntry(expense)) return null
  const borrowerId = oneToOnePerson(expense)
  if (borrowerId === null) return null
  const share = expense.shares[borrowerId]
  if (typeof share !== 'number' || !Number.isSafeInteger(share) || share <= 0) return null
  const lent = expense.payerId === ME_ID
  const group = expense.groupId === null ? undefined : groups.find((g) => g.id === expense.groupId)
  const inGroup = group !== undefined && group.currency === expense.currency
  return {
    expense,
    friendId: lent ? borrowerId : expense.payerId,
    lent,
    lenderId: expense.payerId,
    borrowerId,
    currency: expense.currency,
    group: inGroup ? group : null,
    open: inGroup ? null : stillOwed(expense, borrowerId),
  }
}

/** The local day of a moment; `fallback` when it isn't a real moment. */
function dayOf(ms: number | undefined, fallback: string): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return fallback
  const day = toIsoDate(new Date(ms))
  return isIsoDate(day) ? day : fallback
}

/** "Paid back" records the app made when part of this loan came back (see `repayLoanPart`): same loan, already ticked off. */
function repaidCopies(facts: LoanFacts, expenses: readonly Expense[], since: number, linked: ReadonlySet<string>): Expense[] {
  const e = facts.expense
  return expenses.filter(
    (x) =>
      x.id !== e.id &&
      !linked.has(x.id) &&
      x.kind === 'loan' &&
      x.payerId === e.payerId &&
      x.currency === e.currency &&
      x.date === e.date &&
      x.title === e.title &&
      x.groupId === e.groupId &&
      x.createdAt >= since &&
      oneToOnePerson(x) === facts.borrowerId &&
      x.paidBack[facts.borrowerId] !== undefined,
  )
}

export interface LoanView {
  facts: LoanFacts
  plan: ByaajPlan
  /** The amount interest started on (the amount when interest was added; more if the loan was edited up since). */
  principal: Minor
  /** Every payment in date order: the ones recorded on the interest page, and money marked paid back elsewhere. */
  payments: LoanPayment[]
  /** Interest is rounded to this many minor units (the currency's whole unit). */
  unit: number
  statement: LoanStatement
}

/** The payments on a loan as interest sees them, and the amount it started from. */
export function loanPayments(plan: ByaajPlan, facts: LoanFacts, expenses: readonly Expense[], today: string): { principal: Minor; payments: LoanPayment[] } {
  const payments: LoanPayment[] = plan.payments.map((p) => ({ id: p.id, date: p.date, interest: p.interest, principal: p.principal }))
  let principal = plan.principal
  if (facts.open === null) return { principal, payments }

  const recorded = plan.payments.reduce((sum, p) => sum + p.principal, 0)
  const expected = Math.max(0, plan.principal - recorded)
  if (facts.open > expected) {
    // More is out than interest knows of: the loan's amount was edited up (or a tick was taken back). Interest follows the loan.
    principal += facts.open - expected
    return { principal, payments }
  }
  let gap = expected - facts.open
  if (gap === 0) return { principal, payments }

  // Money that came back without being recorded here, oldest first, dated by the app's own record of it.
  const e = facts.expense
  const chunks: Array<{ date: string; amount: Minor }> = []
  const linked = new Set(plan.payments.map((p) => p.repaidExpenseId).filter((id): id is string => id !== null))
  for (const copy of repaidCopies(facts, expenses, plan.createdAt, linked)) {
    chunks.push({ date: dayOf(copy.paidBack[facts.borrowerId], today), amount: copy.shares[facts.borrowerId] ?? 0 })
  }
  const ticked = e.paidBack[facts.borrowerId]
  if (ticked !== undefined) chunks.push({ date: dayOf(ticked, today), amount: e.shares[facts.borrowerId] ?? 0 })
  else if ((e.partPaid?.[facts.borrowerId] ?? 0) > 0) chunks.push({ date: dayOf(e.updatedAt, today), amount: e.partPaid?.[facts.borrowerId] ?? 0 })
  chunks.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  let n = 0
  for (const chunk of chunks) {
    const amount = Math.min(gap, Math.max(0, chunk.amount))
    if (amount <= 0) continue
    payments.push({ id: `outside:${n++}`, date: chunk.date < e.date ? e.date : chunk.date, interest: 0, principal: amount, outside: true })
    gap -= amount
  }
  // Whatever the app's records can't date came back at some point: count it from today, which never overstates what was paid.
  if (gap > 0) payments.push({ id: `outside:${n}`, date: today, interest: 0, principal: gap, outside: true })
  return { principal, payments }
}

/** A loan with interest, worked out as of `today`. */
export function loanView(plan: ByaajPlan, facts: LoanFacts, expenses: readonly Expense[], today: string): LoanView {
  const { principal, payments } = loanPayments(plan, facts, expenses, today)
  const unit = 10 ** currencyDigits(facts.currency)
  const statement = loanStatement({ principal, rate: { bp: plan.bp, per: plan.per }, from: facts.expense.date, asOf: today, payments, unit })
  return { facts, plan, principal, payments, unit, statement }
}

/** Where the loan stood on `date` (for dividing a payment made that day). */
export function statementOn(view: LoanView, date: string): LoanStatement {
  return loanStatement({ principal: view.principal, rate: { bp: view.plan.bp, per: view.plan.per }, from: view.facts.expense.date, asOf: date, payments: view.payments, unit: view.unit })
}

/** The earliest day a new payment can be dated: the loan's date, or the last payment's. */
export function earliestPaymentDate(view: LoanView): string {
  let earliest = view.facts.expense.date
  for (const p of view.payments) if (p.date > earliest) earliest = p.date
  return earliest
}

export type RecordOutcome =
  | { ok: true; parts: PaymentParts; undo: () => void }
  /** Nothing typed; more than was due that day; or the app could not write it down. */
  | { ok: false; reason: 'empty' | 'tooMuch' | 'failed' }

/**
 * Records a payment made on `date`: interest first, then the amount lent. The principal part goes
 * through the app's normal path (the loan ticked off when it is all back, a "paid back" record for
 * a part, a group payment for a loan inside a group); the interest part is kept with the loan's
 * interest. Returns an undo that takes both back.
 */
export function recordLoanPayment(view: LoanView, input: { amount: Minor; date: string; now: number }): RecordOutcome {
  const { facts, plan } = view
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || !isIsoDate(input.date)) return { ok: false, reason: 'empty' }
  const on = statementOn(view, input.date)
  const parts = payInterestFirst(input.amount, on.interestDue, Math.min(on.principal, view.statement.principal))
  if (parts.extra > 0) return { ok: false, reason: 'tooMuch' }

  const e = facts.expense
  let undoPrincipal: () => void = () => undefined
  let repaidExpenseId: string | null = null
  let settlementId: string | null = null
  try {
    if (parts.principal > 0) {
      if (facts.group) {
        const groupId = facts.group.id
        const s = recordSettlement(groupId, { fromId: facts.borrowerId, toId: facts.lenderId, amount: parts.principal, date: input.date, method: 'other' })
        settlementId = s.id
        undoPrincipal = () => deleteSettlement(groupId, s.id)
      } else if (facts.open !== null && parts.principal >= facts.open) {
        setPaidBack(e.id, facts.borrowerId, true)
        undoPrincipal = () => {
          try {
            setPaidBack(e.id, facts.borrowerId, false)
          } catch {
            // The loan was deleted meanwhile: nothing to untick.
          }
        }
      } else if ((e.partPaid?.[facts.borrowerId] ?? 0) > 0) {
        undoPrincipal = recordPartPayment(e.id, facts.borrowerId, parts.principal).undo
      } else {
        const result = repayLoanPart(e.id, parts.principal)
        repaidExpenseId = result.repaid.id
        undoPrincipal = result.undo
      }
    }
  } catch {
    return { ok: false, reason: 'failed' }
  }

  const payment: ByaajPayment = { id: newId(), date: input.date, interest: parts.interest, principal: parts.principal, createdAt: input.now, repaidExpenseId, settlementId }
  if (!addByaajPayment(plan.expenseId, payment)) {
    undoPrincipal()
    return { ok: false, reason: 'failed' }
  }
  return {
    ok: true,
    parts,
    undo: () => {
      undoPrincipal()
      removeByaajPayment(plan.expenseId, payment.id)
    },
  }
}
