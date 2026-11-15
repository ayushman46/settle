import { useState } from 'react'
import { Banknote } from 'lucide-react'
import { Button, type ButtonProps } from '../../components'
import type { Minor } from '../../domain/types'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { formatMoney } from '../../lib/money'
import { cashPlan } from './engine'
import { NotesSheet } from './NotesSheet'
import styles from './Notes.module.css'

export interface NotesButtonProps {
  /** What is being paid in cash, in paise. */
  amount: Minor
  currency: string
  /** As shown in the app ("You", "Sam"). Leave blank for plain wording. */
  payerName?: string
  receiverName?: string
  variant?: ButtonProps['variant']
  className?: string
}

/**
 * "Which notes?", for wherever cash is recorded: opens the notes to give and the change to get
 * back. Nothing for another currency or with no amount yet.
 */
export function NotesButton({ amount, currency, payerName, receiverName, variant = 'ghost', className }: NotesButtonProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const plan = cashPlan(amount, currency)
  if (!plan) return null
  return (
    <>
      <Button
        variant={variant}
        size="md"
        iconStart={<Banknote />}
        className={cx(styles.button, className)}
        aria-label={t('notes.button.aria', { amount: formatMoney(plan.amount, 'INR', { trimZeros: true }) })}
        onClick={() => setOpen(true)}
      >
        {t('notes.button')}
      </Button>
      <NotesSheet amount={amount} currency={currency} payerName={payerName} receiverName={receiverName} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
