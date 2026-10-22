/**
 * Where features plug into the expense page without sharing its file: cards under the hero (here)
 * and ⋮ menu entries (`extensionActions.ts`). Each appears only when its feature flag is on; the
 * pieces themselves live in their feature's folder (claims, lend, trip).
 */
import { CLAIMS_ENABLED } from '../claim/enabled'
import { ClaimStatusCard } from '../claim/ClaimStatusCard'
import { LEND_ENABLED } from '../lend/enabled'
import { LoanCard } from '../lend/LoanCard'
import { ConvertCard } from '../trip/ConvertCard'
import { TRIP_ENABLED } from '../trip/enabled'
import { FxNote } from '../trip/FxNote'
import type { Expense } from '../../domain/types'

export interface ExpenseExtensionsProps {
  expense: Expense
}

/** Feature cards under the expense hero, in order: claims, loan, paid abroad, convert. */
export function ExpenseExtensions({ expense }: ExpenseExtensionsProps) {
  return (
    <>
      {CLAIMS_ENABLED && <ClaimStatusCard expense={expense} />}
      {LEND_ENABLED && <LoanCard expense={expense} />}
      {TRIP_ENABLED && <FxNote expense={expense} />}
      {TRIP_ENABLED && <ConvertCard expense={expense} />}
    </>
  )
}
