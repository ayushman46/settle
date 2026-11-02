import { useState } from 'react'
import { Check } from 'lucide-react'
import { ActionBar, BottomSheet, Button, useToast } from '../../components'
import type { StuckPayment } from '../../data/stores'
import { markBankReplied } from '../../data/stuck'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { DetailDate } from './DetailDate'
import { OMBUDSMAN_WINDOW_DAYS } from './rules'
import { stuckDate } from './view'

export interface DetailReplySheetProps {
  open: boolean
  onClose: () => void
  payment: StuckPayment
  /** What the button said ("My bank replied or said no", "Paytm replied again"). */
  title: string
}

/**
 * "My bank replied or said no": the day the bank answered the complaint without fixing it — on or
 * after the day it was raised, and not after today. The RBI Ombudsman takes it from then; there's
 * no need to wait out the bank's 30 days. A later reply can be noted too: the Ombudsman's 90 days
 * count from the bank's last reply when that's later than its 30 days (with Undo).
 */
export function DetailReplySheet(props: DetailReplySheetProps) {
  // A fresh form each time it opens (the sheet keeps its last content while it slides away).
  const [opened, setOpened] = useState(0)
  const [wasOpen, setWasOpen] = useState(props.open)
  if (props.open !== wasOpen) {
    setWasOpen(props.open)
    if (props.open) setOpened((n) => n + 1)
  }
  return <ReplyFrame key={opened} {...props} />
}

function ReplyFrame({ open, onClose, payment, title }: DetailReplySheetProps) {
  const t = useT()
  const toast = useToast()
  const day = todayIso()
  // It can't have replied before it was asked.
  const asked = payment.steps.find((x) => x.kind === 'bank')?.date ?? payment.date
  // Kept while the sheet slides away after saving.
  const [again] = useState(payment.repliedAt !== null)
  const [heading] = useState(title)
  const [date, setDate] = useState(day < asked ? asked : day)
  const ok = date >= asked && date <= day

  const save = (): void => {
    if (!ok) return
    const undo = markBankReplied(payment.id, date)
    haptic('success')
    toast(t('stuck.reply.toast'), { tone: 'success', action: { label: t('common.action.undo'), onAction: undo } })
    onClose()
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={heading}
      description={again ? t('stuck.reply.textAgain', { days: OMBUDSMAN_WINDOW_DAYS }) : t('stuck.reply.text')}
      footer={
        <ActionBar>
          <Button block iconStart={<Check />} disabled={!ok} onClick={save}>
            {t('stuck.reply.save')}
          </Button>
        </ActionBar>
      }
    >
      <DetailDate label={t('stuck.reply.date')} value={date} onChange={setDate} min={asked} early={t('stuck.reply.dateEarly', { date: stuckDate(asked, day) })} />
    </BottomSheet>
  )
}
