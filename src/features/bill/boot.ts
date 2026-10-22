/**
 * Which bill the flow opens on. A reload, Back or Forward lands on the step the history entry
 * says; arriving from elsewhere ("Scan bill") lands on the scan step, where a bill in progress
 * waits under "Pick up where you left off"; and `openBill(start)` can open straight onto the
 * sample, a typed-in bill or a saved bill to fix — asking first (see `StartIntent`) when that
 * would replace a bill in progress.
 */
import { scanToBill, type MappedBill } from '../../api/mapScan'
import { SAMPLE_SCAN } from '../../api/sample'
import { expensesStore } from '../../data'
import { flowHistory } from '../../state/backStack'
import { loadSession } from '../../state/persist'
import { setPhoto } from '../../state/photo'
import { reducer, type Action } from '../../state/reducer'
import { hasProgress } from '../../state/selectors'
import { EMPTY_META, type Session } from '../../types'
import { billSessionFromExpense } from './billExpense'
import { takeBillStart, type BillStart } from './launch'

export interface Boot {
  session: Session
  /** A start that would replace the bill in progress: the flow asks first. */
  ask: BillStart | null
}

/** The `loadBill` action for starting the sample bill or an empty typed-in one. */
export function newBillAction(kind: 'sample' | 'manual', currency: string): Action {
  const bill: MappedBill =
    kind === 'sample'
      ? scanToBill(SAMPLE_SCAN, currency)
      : { currency, category: null, meta: { ...EMPTY_META }, items: [], warnings: [] }
  return { type: 'loadBill', source: kind, ...bill }
}

/** The saved bill `expenseId` as a draft to fix, or null when it's gone (or isn't an itemized bill). */
export function editingSession(expenseId: string): Session | null {
  const expense = expensesStore.get().find((e) => e.id === expenseId)
  return expense ? billSessionFromExpense(expense) : null
}

/**
 * The flow's first session. `initial` (tests, previews) is used as given; otherwise the saved
 * draft, on the scan step unless history puts the flow on another step (reload, Back, Forward).
 */
export function bootFlow(initial?: Session): Boot {
  const start = takeBillStart()
  const saved = initial ?? loadSession()
  const arriving = initial === undefined && flowHistory().current() === null
  const landing: Session = arriving && saved.step !== 'scan' ? { ...saved, step: 'scan' } : saved

  if (start?.kind === 'edit') {
    // Already fixing this very bill: carry on where it was left.
    if (saved.expenseId === start.expenseId && hasProgress(saved)) return { session: saved, ask: null }
    const editing = editingSession(start.expenseId)
    if (!editing) return { session: landing, ask: null }
    if (!hasProgress(saved)) {
      setPhoto(null)
      return { session: editing, ask: null }
    }
    return { session: landing, ask: start }
  }
  if (start) {
    if (hasProgress(saved)) return { session: landing, ask: start }
    setPhoto(null)
    return { session: reducer(landing, newBillAction(start.kind, landing.currency)), ask: null }
  }
  return { session: landing, ask: null }
}
