import { useState } from 'react'
import { Check } from 'lucide-react'
import { ActionBar, AmountInput, BottomSheet, Button, useToast } from '../../components'
import { stuckStore, type StuckPayment } from '../../data/stores'
import { addStuckBack } from '../../data/stuck'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { parseMoneyInput, toInputString } from '../../lib/money'
import { DetailDate } from './DetailDate'
import { walletName } from './help'
import { COMPENSATION_PER_DAY, compensationDue, daysLate, nextStep, stillOwed } from './rules'
import { inr, stepPlace, stuckDate, stuckTitle } from './view'
import styles from './Stuck.module.css'

export interface CompSheetProps {
  open: boolean
  onClose: () => void
  payment: StuckPayment
  /** Saving closed it: nothing more owed for the wait. */
  onAllBack?: () => void
}

/**
 * "They've paid the ₹200": the compensation for the wait, paid once the money's back — how much and
 * on what day. It's kept as its own dated part; the money and the day it came back stay as they
 * were. With Undo; paying all that's owed closes it.
 */
export function CompSheet(props: CompSheetProps) {
  // A fresh form each time it opens (the sheet keeps its last content while it slides away).
  const [opened, setOpened] = useState(0)
  const [wasOpen, setWasOpen] = useState(props.open)
  if (props.open !== wasOpen) {
    setWasOpen(props.open)
    if (props.open) setOpened((n) => n + 1)
  }
  return <CompFrame key={opened} {...props} />
}

function CompFrame({ open, onClose, payment, onAllBack }: CompSheetProps) {
  const t = useT()
  const toast = useToast()
  const day = todayIso()
  const owed = stillOwed(payment, day).compensation
  const due = compensationDue(payment, day)
  const paidBefore = payment.back?.compensation ?? 0
  const wallet = walletName(payment)
  // It came with the money or after it.
  const firstDay = payment.back?.date ?? payment.date
  const [text, setText] = useState(owed > 0 ? toInputString(owed, 'INR', { trimZeros: true }) : '')
  const amount = parseMoneyInput(text, 'INR')
  const [date, setDate] = useState(day < firstDay ? firstDay : day)
  const ok = amount !== null && amount > 0 && date >= firstDay && date <= day

  const save = (): void => {
    if (!ok) return
    const undo = addStuckBack(payment.id, { date, amount: 0, compensation: amount })
    const after = stuckStore.get().find((x) => x.id === payment.id) ?? payment
    const left = stillOwed(after, day).compensation
    haptic('success')
    toast(left > 0 ? t('stuck.back.toastPaidPart', { paid: inr(amount), owed: inr(left) }) : t('stuck.comp.toast', { place: stepPlace('bank', payment), amount: inr(amount) }), {
      tone: 'success',
      action: undo ? { label: t('common.action.undo'), onAction: undo } : undefined,
    })
    onClose()
    if (nextStep(after, day).stage === 'back') onAllBack?.()
  }

  // What the rules say, and what came already — or that this is more than what's still owed (likely the money itself).
  const hint =
    amount !== null && owed > 0 && amount > owed
      ? t('stuck.comp.more', { owed: inr(owed) })
      : paidBefore > 0
        ? t('stuck.detail.now.compPart', { due: inr(due), paid: inr(paidBefore), rest: inr(owed) })
        : t('stuck.back.compensation.owed', { amount: inr(due), count: daysLate(payment, day), perDay: inr(COMPENSATION_PER_DAY) })

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={wallet ? t('stuck.comp.title.wallet', { place: wallet }) : t('stuck.comp.title')}
      description={t('stuck.comp.description', { title: stuckTitle(payment), owed: inr(owed) })}
      footer={
        <ActionBar>
          <Button block iconStart={<Check />} disabled={!ok} onClick={save}>
            {amount !== null && amount > 0 ? t('stuck.comp.save', { amount: inr(amount) }) : t('stuck.comp.saveEmpty')}
          </Button>
        </ActionBar>
      }
    >
      <div className={styles.backForm}>
        <AmountInput size="field" value={text} onChange={setText} currency="INR" label={t('stuck.comp.amount')} placeholder="0" hint={hint} />
        <DetailDate
          label={t('stuck.comp.date')}
          value={date}
          onChange={setDate}
          min={firstDay}
          early={t('stuck.back.dateEarly', { date: stuckDate(firstDay, day) })}
        />
      </div>
    </BottomSheet>
  )
}
