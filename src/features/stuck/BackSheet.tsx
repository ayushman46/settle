import { useState } from 'react'
import { Check } from 'lucide-react'
import { ActionBar, AmountInput, BottomSheet, Button, useToast } from '../../components'
import { stuckStore, type StuckPayment } from '../../data/stores'
import { addStuckBack } from '../../data/stuck'
import type { Minor } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { AmountHero } from '../../kit/index-a'
import { haptic } from '../../lib/haptics'
import { parseMoneyInput, toInputString } from '../../lib/money'
import { DetailDate } from './DetailDate'
import { backInPart, COMPENSATION_PER_DAY, compensationDue, daysLate, nextStep } from './rules'
import { backToast } from './useTickBack'
import { inr, stuckDate, stuckTitle } from './view'
import styles from './Stuck.module.css'

export interface BackSheetProps {
  open: boolean
  onClose: () => void
  payment: StuckPayment
  /** Saving closed it: all the money back, and nothing more owed for the wait. */
  onAllBack?: () => void
}

/**
 * "It's back": how much came back, on what day, and any compensation paid with it — what the RBI's
 * rules say the wait was worth is shown beside it, so a short payment is plain to see. When part of
 * it came back before, this is the rest (or more of it), kept as its own dated part. Never more
 * than was still to come, never before the money left or after today. Saving ticks it back (with
 * Undo); money or compensation still owed keeps it open.
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

function BackSheetFrame({ open, onClose, payment, onAllBack }: BackSheetProps) {
  const t = useT()
  const toast = useToast()
  const day = todayIso()
  // Part of it came back already: what's asked is what came this time, the rest by default.
  const earlier = backInPart(payment) ? (payment.back?.amount ?? 0) : 0
  const more = earlier > 0
  const left = payment.amount - earlier
  const firstDay = more ? (payment.back?.date ?? payment.date) : payment.date
  const [amount, setAmount] = useState<Minor | null>(left)
  const [date, setDate] = useState(day < firstDay ? firstDay : day)
  const total = earlier + (amount ?? 0)
  const paidBefore = payment.back?.compensation ?? 0
  // What the wait was worth by the day it came back (failed payments the money really left).
  const backThen = { date, amount: Math.min(total, payment.amount), compensation: 0 }
  const owedByThen = compensationDue({ ...payment, back: backThen }, day)
  const late = daysLate({ ...payment, back: backThen }, day)
  const [compText, setCompText] = useState('')
  const compensation = parseMoneyInput(compText, 'INR') ?? 0
  const asksCompensation = payment.kind === 'failed' && payment.confirmed
  // More than was still to come back: likely the compensation came with it.
  const extra = amount === null ? 0 : amount - left
  const ok = amount !== null && amount > 0 && extra <= 0 && date >= firstDay && date <= day

  const save = (): void => {
    if (amount === null || !ok) return
    const before = payment.back
    const undo = addStuckBack(payment.id, { date, amount, compensation: asksCompensation ? compensation : 0 })
    const after = stuckStore.get().find((x) => x.id === payment.id) ?? payment
    const closes = nextStep(payment, day).stage !== 'back' && nextStep(after, day).stage === 'back'
    haptic('success')
    toast(backToast(t, payment, after.back ?? backThen, before, day), { tone: 'success', action: undo ? { label: t('common.action.undo'), onAction: undo } : undefined })
    onClose()
    if (closes) onAllBack?.()
  }

  const putExtraUnderCompensation = (): void => {
    setAmount(left)
    setCompText(toInputString(compensation + extra, 'INR', { trimZeros: true }))
  }

  const rest = payment.amount - total
  const short = amount !== null && amount > 0 && rest > 0
  // A first "It's back" says a part is fine; a part already noted says what's left after this.
  const hint = short ? t('stuck.back.short', { amount: inr(rest) }) : payment.back === null ? t('stuck.back.partial') : undefined
  const tooMuch = owedByThen > 0 && paidBefore + compensation > owedByThen
  // Still short after this: the wait (and what it's worth) counts on to today.
  const owedHint = short
    ? t('stuck.back.compensation.soFar', { amount: inr(owedByThen), count: late, perDay: inr(COMPENSATION_PER_DAY) })
    : t('stuck.back.compensation.owed', { amount: inr(owedByThen), count: late, perDay: inr(COMPENSATION_PER_DAY) })

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={more ? t('stuck.back.titleMore') : t('stuck.back.title')}
      description={
        more
          ? t('stuck.back.descriptionPart', { name: stuckTitle(payment), back: inr(earlier), amount: inr(payment.amount) })
          : t('stuck.back.description', { name: stuckTitle(payment), amount: inr(payment.amount) })
      }
      footer={
        <ActionBar>
          <Button block iconStart={<Check />} disabled={!ok} onClick={save}>
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
          label={more ? t('stuck.back.amountMore') : t('stuck.back.amount')}
          showLabel
          hint={hint}
          error={extra > 0 ? t('stuck.back.over', { left: inr(left) }) : undefined}
        />
        {extra > 0 && asksCompensation && (
          <Button size="sm" variant="secondary" className={styles.backExtra} onClick={putExtraUnderCompensation}>
            {t('stuck.back.overToComp', { extra: inr(extra) })}
          </Button>
        )}
        <DetailDate
          label={t('stuck.back.date')}
          value={date}
          onChange={setDate}
          min={firstDay}
          early={t('stuck.back.dateEarly', { date: stuckDate(firstDay, day) })}
        />
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
                  ? owedHint
                  : t('stuck.back.compensation.none')
            }
          />
        )}
      </div>
    </BottomSheet>
  )
}
