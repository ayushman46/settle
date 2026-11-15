/** Where interest on loans lives. */
export const BYAAJ_PATH = '/app/byaaj'
export const BYAAJ_DETAIL_PATTERN = '/app/byaaj/:id'

/** One loan's interest; `expenseId` is the loan's own id. */
export function byaajPath(expenseId: string): string {
  return `${BYAAJ_PATH}/${encodeURIComponent(expenseId)}`
}

/** Where a loan is written down (the app's udhaar screen). */
export const LEND_PATH = '/app/lend'
