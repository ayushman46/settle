import { useState } from 'react'
import { ActionBar, BottomSheet, Button } from '../../components'
import { useExpense } from '../../data'
import { haptic } from '../../lib/haptics'
import { setPhoto } from '../../state/photo'
import { useSession } from '../../state/store'
import { editingSession, newBillAction, type ReplacingStart } from './boot'
import { plural } from './screenUtils'

export interface StartIntentProps {
  /** What `openBill` asked for, which would replace the bill in progress. */
  start: ReplacingStart
}

/**
 * Asks before something opened from elsewhere (the sample bill, a typed-in bill, a saved bill to
 * fix) replaces the bill in progress — there's only one draft, and no undo. "Keep it" leaves the
 * person on the scan step, their bill waiting under "Pick up where you left off".
 */
export function StartIntent({ start }: StartIntentProps) {
  const { session, dispatch } = useSession()
  const [open, setOpen] = useState(true)
  const expense = useExpense(start.kind === 'edit' ? start.expenseId : null)

  const name = session.meta.merchant ?? 'Your last bill'
  const what = `${name} (${plural(session.items.length, 'item')})`
  const editTitle = expense?.title ?? 'that bill'

  const go = (): void => {
    setOpen(false)
    if (start.kind === 'edit') {
      const editing = editingSession(start.expenseId)
      if (!editing) return
      setPhoto(null)
      dispatch({ type: 'load', session: editing })
    } else {
      setPhoto(null)
      dispatch(newBillAction(start.kind, session.currency))
    }
    haptic('tap')
  }

  return (
    <BottomSheet
      open={open}
      onClose={() => setOpen(false)}
      title={start.kind === 'edit' ? `Edit ${editTitle} instead?` : 'Start a new bill?'}
      description={
        start.kind === 'edit'
          ? `${what} isn't saved yet — editing ${editTitle} replaces it.`
          : `${what} will be replaced.${session.people.length > 0 ? ' The people you added stay.' : ''}`
      }
      footer={
        <ActionBar>
          <Button block onClick={go}>
            {start.kind === 'edit' ? `Edit ${editTitle}` : start.kind === 'sample' ? 'Try the sample' : 'Start new bill'}
          </Button>
          <Button block variant="ghost" onClick={() => setOpen(false)}>
            Keep my bill
          </Button>
        </ActionBar>
      }
    />
  )
}
