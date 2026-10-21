/** Errors thrown by data actions. Screens validate first; these are the safety net. */

export type ExpenseErrorCode =
  | 'no_people'
  | 'bad_total'
  | 'exact_mismatch'
  | 'percent_mismatch'
  | 'payer_missing'
  | 'zero_weights'
  | 'not_found'

const EXPENSE_MESSAGES: Readonly<Record<ExpenseErrorCode, string>> = {
  no_people: 'Add at least one person to split with.',
  bad_total: 'Enter an amount above zero.',
  exact_mismatch: "The amounts don't add up to the total yet.",
  percent_mismatch: "The percentages don't add up to 100% yet.",
  payer_missing: 'Choose who paid.',
  zero_weights: 'Give at least one person a share.',
  not_found: 'That expense no longer exists.',
}

/** Friendly copy for an expense problem — for inline hints next to a disabled Save button. */
export function expenseErrorMessage(code: ExpenseErrorCode): string {
  return EXPENSE_MESSAGES[code]
}

export class ExpenseError extends Error {
  readonly code: ExpenseErrorCode
  constructor(code: ExpenseErrorCode) {
    super(EXPENSE_MESSAGES[code])
    this.name = 'ExpenseError'
    this.code = code
  }
}

export type DataErrorCode = 'not_found' | 'empty_name' | 'duplicate_name' | 'limit' | 'invalid'

const DATA_MESSAGES: Readonly<Record<DataErrorCode, string>> = {
  not_found: "That couldn't be found — it may have been deleted.",
  empty_name: 'Add a name first.',
  duplicate_name: 'Someone with that name is already in your people.',
  limit: "You've reached the limit here — remove something you no longer need.",
  invalid: "That doesn't look right — please check and try again.",
}

export class DataError extends Error {
  readonly code: DataErrorCode
  constructor(code: DataErrorCode, message?: string) {
    super(message ?? DATA_MESSAGES[code])
    this.name = 'DataError'
    this.code = code
  }
}
