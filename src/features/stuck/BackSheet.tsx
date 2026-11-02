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
import { backInPart, COMPENSATION_PER_DAY, compensationDue, daysLate, nextStep } from './rules'
import { backToast } from './useTickBack'
import { inr, partyName } from './view'
import styles from './Stuck.module.css'

export interface BackSheetProps {
  open: boolean
  onClose: () => void
  payment: StuckPayment
  /** Start the compensation at what's owed (from "They've paid it"). */
  compensationPaid?: boolean
  /** Saving closed it: all the money back, and nothing more owed for the wait. */
  onAllBack?: () => void
}

/**
 * "It's back": how much came back, on what day, and any compensation paid with it — what the RBI's
 * rules say the wait was worth is shown beside it, so a short payment is plain to see. When part of
 * it came back before, this is the rest (or more of it), added to what came then. Saving ticks it
 * back (with Undo); money or compensation still owed keeps it open.
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

function BackSheetFrame({ open, onClose, payment, compensationPaid = false, onAllBack }: BackSheetProps) {
  const t = useT()
  const toast = useToast()
  const day = todayIso()
  // Part of it came back already: what's asked is what came this time, the rest by default.
  const earlier = backInPart(payment) ? (payment.back?.amount ?? 0) : 0
  const more = earlier > 0
  const firstDay = more ? (payment.back?.date ?? payment.date) : payment.date
  const [amount, setAmount] = useState<Minor | null>(more ? payment.amount - earlier : (payment.back?.amount ?? payment.amount))
  const [date, setDate] = useState(!more && payment.back ? payment.back.date : day < firstDay ? firstDay : day)
  const total = earlier + (amount ?? 0)
  // What the wait was worth by the day it came back (failed payments the money really left).
  const backThen = { date, amount: total, compensation: 0 }
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
    const back = { date, amount: total, compensation: asksCompensation ? compensation : 0 }
    const after = { ...payment, back, confirmed: true, dismissedAt: null }
    const closes = nextStep(payment, day).stage !== 'back' && nextStep(after, day).stage === 'back'
    const undo = markStuckBack(payment.id, back)
    haptic('success')
    toast(backToast(t, payment, back, payment.back, day), { tone: 'success', action: undo ? { label: t('common.action.undo'), onAction: undo } : undefined })
    onClose()
    if (closes) onAllBack?.()
  }

  const rest = payment.amount - total
  const short = amount !== null && amount > 0 && rest > 0
  // A first "It's back" says a part is fine; a part already noted says what's left after this.
  const hint = short ? t('stuck.back.short', { amount: inr(rest) }) : payment.back === null ? t('stuck.back.partial') : undefined
  const tooMuch = owedByThen > 0 && compensation > owedByThen

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={more ? t('stuck.back.titleMore') : payment.back ? t('stuck.back.titleEdit') : t('stuck.back.title')}
      description={
        more
          ? t('stuck.back.descriptionPart', { name: partyName(payment), back: inr(earlier), amount: inr(payment.amount) })
          : t('stuck.back.description', { name: partyName(payment), amount: inr(payment.amount) })
      }
      footer={
        <ActionBar>
          <Button block iconStart={<Check />} disabled={amount === null || amount <= 0} onClick={save}>
            {t('stuck.back.save')}
          </Button>
        </ActionBar>
      }
    >
      <div className={styles.backForm}>
        <AmountHero value={amount} currency="INR" onChange={setAmount} label={more ? t('stuck.back.amountMore') : t('stuck.back.amount')} showLabel hint={hint} />
        <div className={styles.dateRow}>
          <span className={styles.dateLabel} aria-hidden="true">
            {t('stuck.back.date')}
          </span>
          <DateField label={t('stuck.back.date')} value={date} min={firstDay} onChange={setDate} />
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
              tooMuch
                ? t('stuck.back.compensation.more', { amount: inr(owedByThen) })
                : owedByThen > 0
                  ? t('stuck.back.compensation.owed', { amount: inr(owedByThen), count: late, perDay: inr(COMPENSATION_PER_DAY) })
                  : t('stuck.back.compensation.none')
            }
          />
        )}
      </div>
    </BottomSheet>
  )
}
