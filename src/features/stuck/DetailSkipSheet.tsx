import { useState } from 'react'
import { SkipForward } from 'lucide-react'
import { ActionBar, BottomSheet, Button, useToast } from '../../components'
import type { StuckPayment, StuckStepKind } from '../../data/stores'
import { addStuckStep } from '../../data/stuck'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { DetailDate } from './DetailDate'
import { stepPlace, stuckDate } from './view'

export interface DetailSkipSheetProps {
  open: boolean
  onClose: () => void
  payment: StuckPayment
  /** Where "They don't answer" goes: the National Consumer Helpline, or AirSewa for an airline. */
  step: StuckStepKind
  /** Tried them (the day is noted): on to that place's complaint. */
  onNext: () => void
  /** Not tried them yet: their own complaint first. */
  onAsk: () => void
}

/**
 * "They don't answer", for a late refund nothing was noted on yet: when you tried the business. The
 * day is noted as raised with them (with Undo), so the complaint to the helpline says what you did —
 * never that you asked when you didn't. Not tried them yet: their own complaint, first.
 */
export function DetailSkipSheet(props: DetailSkipSheetProps) {
  // A fresh form each time it opens (the sheet keeps its last content while it slides away).
  const [opened, setOpened] = useState(0)
  const [wasOpen, setWasOpen] = useState(props.open)
  if (props.open !== wasOpen) {
    setWasOpen(props.open)
    if (props.open) setOpened((n) => n + 1)
  }
  return <SkipFrame key={opened} {...props} />
}

function SkipFrame({ open, onClose, payment, step, onNext, onAsk }: DetailSkipSheetProps) {
  const t = useT()
  const toast = useToast()
  const day = todayIso()
  const name = stepPlace('merchant', payment)
  const place = stepPlace(step, payment)
  const [date, setDate] = useState(day < payment.date ? payment.date : day)
  const ok = date >= payment.date && date <= day

  const next = (): void => {
    if (!ok) return
    const undo = addStuckStep(payment.id, { kind: 'merchant', date, ref: null })
    haptic('tap')
    toast(t('stuck.other.skip.toast', { name, date: stuckDate(date, day) }), { tone: 'info', action: undo ? { label: t('common.action.undo'), onAction: undo } : undefined })
    onClose()
    onNext()
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('stuck.other.skip.title', { name })}
      description={t('stuck.other.skip.why', { place })}
      footer={
        <ActionBar>
          <Button block iconStart={<SkipForward />} disabled={!ok} onClick={next}>
            {t('stuck.now.take', { place })}
          </Button>
          <Button
            block
            variant="ghost"
            onClick={() => {
              onClose()
              onAsk()
            }}
          >
            {t('stuck.other.skip.notYet')}
          </Button>
        </ActionBar>
      }
    >
      <DetailDate
        label={t('stuck.other.skip.date')}
        value={date}
        onChange={setDate}
        min={payment.date}
        early={t('stuck.other.skip.dateEarly', { date: stuckDate(payment.date, day) })}
      />
    </BottomSheet>
  )
}
