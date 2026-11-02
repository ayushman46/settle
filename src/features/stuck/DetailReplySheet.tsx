import { useState } from 'react'
import { Check } from 'lucide-react'
import { ActionBar, BottomSheet, Button, useToast } from '../../components'
import type { StuckPayment } from '../../data/stores'
import { markBankReplied } from '../../data/stuck'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { DateField } from '../../kit/index-a'
import { haptic } from '../../lib/haptics'
import styles from './Stuck.module.css'

export interface DetailReplySheetProps {
  open: boolean
  onClose: () => void
  payment: StuckPayment
}

/**
 * "My bank replied or said no": the day the bank answered the complaint without fixing it. The RBI
 * Ombudsman takes it from then — there's no need to wait out the bank's 30 days (with Undo).
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

function ReplyFrame({ open, onClose, payment }: DetailReplySheetProps) {
  const t = useT()
  const toast = useToast()
  const day = todayIso()
  // It can't have replied before it was asked.
  const asked = payment.steps.find((x) => x.kind === 'bank')?.date ?? payment.date
  const [date, setDate] = useState(payment.repliedAt ?? (day < asked ? asked : day))

  const save = (): void => {
    const undo = markBankReplied(payment.id, date)
    haptic('success')
    toast(t('stuck.reply.toast'), { tone: 'success', action: { label: t('common.action.undo'), onAction: undo } })
    onClose()
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('stuck.reply.title')}
      description={t('stuck.reply.text')}
      footer={
        <ActionBar>
          <Button block iconStart={<Check />} onClick={save}>
            {t('stuck.reply.save')}
          </Button>
        </ActionBar>
      }
    >
      <div className={styles.dateRow}>
        <span className={styles.dateLabel} aria-hidden="true">
          {t('stuck.reply.date')}
        </span>
        <DateField label={t('stuck.reply.date')} value={date} min={asked} onChange={setDate} />
      </div>
    </BottomSheet>
  )
}
