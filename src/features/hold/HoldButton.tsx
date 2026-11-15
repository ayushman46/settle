import { useId, useState } from 'react'
import { PauseCircle } from 'lucide-react'
import { goBack } from '../../app/router'
import { Banner, BottomSheet, Button, Chip, TextField, useToast } from '../../components'
import { useExpense } from '../../data'
import type { Expense } from '../../domain/types'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { expensePath, groupPath } from '../groups/paths'
import { useShared } from '../groupsync/store'
import { DEFAULT_HOLD_REASON, HOLD_REASONS, MAX_HELD, MAX_HOLD_NOTE, type HoldReason } from './engine'
import { heldIndex, holdExpense, holdStore, releaseHold } from './store'
import styles from './Hold.module.css'

export interface HoldButtonProps {
  expenseId: string
  /**
   * Called with the expense just before it leaves the app's expenses, so the page showing it can
   * keep it on screen while it closes (the expense page does the same for Delete).
   */
  onHolding?: (expense: Expense) => void
}

/**
 * On the expense page: "Put on hold" opens a sheet with the reasons; one more tap takes the
 * expense out of every balance and keeps it whole until it is put back. Null when the expense is gone.
 */
export function HoldButton({ expenseId, onHolding }: HoldButtonProps) {
  const t = useT()
  const toast = useToast()
  const expense = useExpense(expenseId)
  const shared = useShared(expense?.groupId)
  const reasonId = useId()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<HoldReason>(DEFAULT_HOLD_REASON)
  const [note, setNote] = useState('')
  if (!expense) return null

  const start = (): void => {
    setReason(DEFAULT_HOLD_REASON)
    setNote('')
    setOpen(true)
  }

  const hold = (): void => {
    if (holdStore.get().held.length >= MAX_HELD) {
      haptic('error')
      toast(t('hold.full'), { tone: 'error' })
      return
    }
    onHolding?.(expense)
    const entry = holdExpense(expense.id, reason, note)
    setOpen(false)
    if (!entry) {
      haptic('error')
      toast(t('hold.failed'), { tone: 'error' })
      return
    }
    haptic('success')
    toast(t('hold.done', { title: expense.title }), {
      tone: 'success',
      action: {
        label: t('common.action.undo'),
        onAction: () => {
          if (heldIndex(expense.id) !== -1) releaseHold(expense.id)
        },
      },
    })
    // The expense's own page has nothing left to show: step back from it.
    if (typeof window !== 'undefined' && window.location.pathname === expensePath(expense.id)) {
      goBack(expense.groupId ? groupPath(expense.groupId) : '/app/activity')
    }
  }

  return (
    <>
      <Button variant="secondary" size="md" iconStart={<PauseCircle />} onClick={start}>
        {t('hold.button')}
      </Button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('hold.sheet.title')}
        eyebrow={`${expense.title} · ${formatMoney(expense.total, expense.currency, { trimZeros: true })}`}
        footer={
          <Button block onClick={hold}>
            {t('hold.sheet.cta')}
          </Button>
        }
      >
        <div className={styles.sheet}>
          <p className={styles.body}>{t('hold.sheet.body')}</p>
          {shared && <Banner tone="warning">{t('hold.sheet.shared')}</Banner>}
          <section className={styles.block} aria-labelledby={reasonId}>
            <h3 id={reasonId} className={styles.label}>
              {t('hold.sheet.reason')}
            </h3>
            <div className={styles.chips} role="group" aria-labelledby={reasonId}>
              {HOLD_REASONS.map((r) => (
                <Chip key={r} size="lg" selected={r === reason} onClick={() => setReason(r)}>
                  {t(`hold.reason.${r}`)}
                </Chip>
              ))}
            </div>
            {reason === 'other' && (
              <TextField
                label={t('hold.sheet.note')}
                placeholder={t('hold.sheet.note.placeholder')}
                value={note}
                maxLength={MAX_HOLD_NOTE}
                onChange={(event) => setNote(event.target.value)}
                enterKeyHint="done"
              />
            )}
          </section>
        </div>
      </BottomSheet>
    </>
  )
}
