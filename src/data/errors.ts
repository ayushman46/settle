/** Errors thrown by data actions. Screens validate first; these are the safety net. */
import { t, type MessageKey } from '../i18n'

export type ExpenseErrorCode =
  | 'no_people'
  | 'bad_total'
  | 'exact_mismatch'
  | 'percent_mismatch'
  | 'payer_missing'
  | 'zero_weights'
  | 'nothing_had'
  | 'not_found'

/** The copy for each expense problem (English in `en/state.ts`). */
const EXPENSE_MESSAGES: Readonly<Record<ExpenseErrorCode, MessageKey>> = {
  no_people: 'state.error.expense.noPeople',
  bad_total: 'state.error.expense.badTotal',
  exact_mismatch: 'state.error.expense.exactMismatch',
  percent_mismatch: 'state.error.expense.percentMismatch',
  payer_missing: 'state.error.expense.payerMissing',
  zero_weights: 'state.error.expense.zeroWeights',
  nothing_had: 'state.error.expense.nothingHad',
  not_found: 'state.error.expense.notFound',
}

/** Friendly copy for an expense problem (in the UI language) — for inline hints next to a disabled Save button. */
export function expenseErrorMessage(code: ExpenseErrorCode): string {
  return t(EXPENSE_MESSAGES[code])
}

export class ExpenseError extends Error {
  readonly code: ExpenseErrorCode
  constructor(code: ExpenseErrorCode) {
    super(expenseErrorMessage(code))
    this.name = 'ExpenseError'
    this.code = code
  }
}

export type DataErrorCode = 'not_found' | 'empty_name' | 'duplicate_name' | 'limit' | 'invalid'

const DATA_MESSAGES: Readonly<Record<DataErrorCode, MessageKey>> = {
  not_found: 'state.error.data.notFound',
  empty_name: 'state.error.data.emptyName',
  duplicate_name: 'state.error.data.duplicateName',
  limit: 'state.error.data.limit',
  invalid: 'state.error.data.invalid',
}

/** The copy for a data problem, in the UI language. */
export function dataErrorMessage(code: DataErrorCode): string {
  return t(DATA_MESSAGES[code])
}

export class DataError extends Error {
  readonly code: DataErrorCode
  constructor(code: DataErrorCode, message?: string) {
    super(message ?? dataErrorMessage(code))
    this.name = 'DataError'
    this.code = code
  }
}
