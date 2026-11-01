import { useState } from 'react'
import { Check } from 'lucide-react'
import { ActionBar, AmountInput, BottomSheet, Button, useToast } from '../../components'
import type { StuckPayment } from '../../data/stores'
import { markStuckBack } from '../../data/stuck'
import type { Minor } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { AmountHero, DateField } from '../../kit/index-a'
import { haptic } from '../../lib/haptics'
import { parseMoneyInput, toInputString } from '../../lib/money'
import { COMPENSATION_PER_DAY, compensationDue, daysLate, stillOwed } from './rules'
import { backLine, inr, partyName } from './view'
import styles from './Stuck.module.css'

export interface BackSheetProps {
  open: boolean
  onClose: () => void
  payment: StuckPayment
  /** Start the compensation at what's owed (from "They've paid it"). */
  compensationPaid?: boolean
}

/**
 * "It's back": how much came back, on what day, and any compensation paid with it — what the RBI's
 * rules say the wait was worth is shown beside it, so a short payment is plain to see. Saving ticks
 * it back (with Undo); compensation still owed keeps it open for the claim.
 */
export function BackSheet(props: BackSheetProps) {
  // A fresh form each time it opens (the sheet keeps its last content while it slides away).
  const [opened, setOpened] = useState(0)
  const [wasOpen, setWasOpen] = useState(props.open)
  if (props.open !== wasOpen) {
    setWasOpen(props.open)
    if (props.open) setOpened((n) => n + 1)
  }
  return <BackSheetFrame key={opened} {...props} />
}

function BackSheetFrame({ open, onClose, payment, compensationPaid = false }: BackSheetProps) {
  const t = useT()
  const toast = useToast()
  const day = todayIso()
  const [amount, setAmount] = useState<Minor | null>(payment.back?.amount ?? payment.amount)
  const [date, setDate] = useState(payment.back?.date ?? (day < payment.date ? payment.date : day))
  // What the wait was worth by the day it came back (failed payments the money really left).
  const backThen = { date, amount: amount ?? 0, compensation: 0 }
  const owedByThen = compensationDue({ ...payment, back: backThen }, day)
  const late = daysLate({ ...payment, back: backThen }, day)
  const [compText, setCompText] = useState(() => {
    const paid = payment.back?.compensation ?? 0
    const start = compensationPaid ? Math.max(paid, compensationDue(payment, day)) : paid
    return start > 0 ? toInputString(start, 'INR', { trimZeros: true }) : ''
  })
  const compensation = parseMoneyInput(compText, 'INR') ?? 0
  const asksCompensation = payment.kind === 'failed' && payment.confirmed

  const save = (): void => {
    const back = { date, amount: amount ?? payment.amount, compensation: asksCompensation ? compensation : 0 }
    const undo = markStuckBack(payment.id, back)
    haptic('success')
    const still = stillOwed({ ...payment, back, dismissedAt: null }, day).compensation
    toast(backLine(payment, back.amount, late, still), { tone: 'success', action: undo ? { label: t('common.action.undo'), onAction: undo } : undefined })
    onClose()
  }

  const short = amount !== null && amount > 0 && amount < payment.amount

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={payment.back ? t('stuck.back.titleEdit') : t('stuck.back.title')}
      description={t('stuck.back.description', { name: partyName(payment), amount: inr(payment.amount) })}
      footer={
        <ActionBar>
          <Button block iconStart={<Check />} disabled={amount === null || amount <= 0} onClick={save}>
            {t('stuck.back.save')}
          </Button>
        </ActionBar>
      }
    >
      <div className={styles.backForm}>
        <AmountHero
          value={amount}
          currency="INR"
          onChange={setAmount}
          label={t('stuck.back.amount')}
          hint={short ? t('stuck.back.short', { amount: inr(payment.amount - (amount ?? 0)) }) : undefined}
        />
        <div className={styles.dateRow}>
          <span className={styles.dateLabel}>{t('stuck.back.date')}</span>
          <DateField label={t('stuck.back.date')} value={date} min={payment.date} onChange={setDate} />
        </div>
        {asksCompensation && (
          <AmountInput
            size="field"
            value={compText}
            onChange={setCompText}
            currency="INR"
            label={t('stuck.back.compensation')}
            placeholder="0"
            hint={
              owedByThen > 0
                ? t('stuck.back.compensation.owed', { amount: inr(owedByThen), count: late, perDay: inr(COMPENSATION_PER_DAY) })
                : t('stuck.back.compensation.none')
            }
          />
        )}
      </div>
    </BottomSheet>
  )
}
