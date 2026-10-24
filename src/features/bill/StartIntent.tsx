import { useState } from 'react'
import { ActionBar, BottomSheet, Button } from '../../components'
import { useExpense } from '../../data'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { setPhoto } from '../../state/photo'
import { useSession } from '../../state/store'
import { editingSession, newBillAction, type ReplacingStart } from './boot'

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
  const t = useT()
  const { session, dispatch } = useSession()
  const [open, setOpen] = useState(true)
  const expense = useExpense(start.kind === 'edit' ? start.expenseId : null)

  const name = session.meta.merchant ?? t('bill.start.lastBill')
  const what = t('bill.start.what', { name, count: session.items.length })
  const editTitle = expense?.title ?? t('bill.start.thatBill')

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
      title={start.kind === 'edit' ? t('bill.start.edit.title', { title: editTitle }) : t('bill.start.new.title')}
      description={
        start.kind === 'edit'
          ? t('bill.start.edit.description', { what, title: editTitle })
          : t('bill.start.new.description', { what, people: session.people.length > 0 ? 'yes' : 'no' })
      }
      footer={
        <ActionBar>
          <Button block onClick={go}>
            {start.kind === 'edit'
              ? t('bill.start.edit.cta', { title: editTitle })
              : t(start.kind === 'sample' ? 'bill.start.sample.cta' : 'bill.start.new.cta')}
          </Button>
          <Button block variant="ghost" onClick={() => setOpen(false)}>
            {t('bill.start.keep.cta')}
          </Button>
        </ActionBar>
      }
    />
  )
}
