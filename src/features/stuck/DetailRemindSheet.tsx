import { useId } from 'react'
import { CalendarPlus, ExternalLink } from 'lucide-react'
import { ActionBar, BottomSheet, Button, useToast } from '../../components'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { shareFile } from '../../share/shareFile'
import { googleCalendarUrl, icsFor, remindLabel, type StuckReminder } from './reminder'
import styles from './Stuck.module.css'

export interface DetailRemindSheetProps {
  open: boolean
  onClose: () => void
  /** The stuck payment's id (the event's own id, so adding it twice updates it). */
  id: string
  reminder: StuckReminder
}

/**
 * "Remind me on 7 Nov" (or tomorrow): the next date as a calendar event, made on this phone — an
 * .ics file for whatever calendar the phone has, or Google Calendar's new-event page, filled in
 * (which Google then sees, so the sheet says so).
 */
export function DetailRemindSheet({ open, onClose, id, reminder }: DetailRemindSheetProps) {
  const t = useT()
  const toast = useToast()
  const noteId = useId()

  const addToCalendar = async (): Promise<void> => {
    const file = new Blob([icsFor(reminder, id, new Date())], { type: 'text/calendar' })
    const outcome = await shareFile(file, 'settle-reminder.ics', undefined, { prefer: 'download', title: reminder.title })
    if (outcome === 'cancelled') return
    if (outcome === 'failed') {
      haptic('error')
      toast(t('stuck.remind.failed'), { tone: 'error' })
      return
    }
    haptic('success')
    toast(t('stuck.remind.saved'), { tone: 'success' })
    onClose()
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={remindLabel(reminder, todayIso())}
      description={t('stuck.remind.text')}
      footer={
        <ActionBar>
          <Button block iconStart={<CalendarPlus />} onClick={() => void addToCalendar()}>
            {t('stuck.remind.ics')}
          </Button>
          <a
            className={styles.remindLink}
            href={googleCalendarUrl(reminder)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('stuck.remind.newTab')}
            aria-describedby={noteId}
            onClick={() => {
              haptic('tap')
              onClose()
            }}
          >
            <ExternalLink aria-hidden="true" strokeWidth={2.25} />
            {t('stuck.remind.google')}
          </a>
        </ActionBar>
      }
    >
      <p className={styles.remindEvent}>{reminder.title}</p>
      <p id={noteId} className={styles.fine}>
        {t('stuck.remind.googleNote')}
      </p>
    </BottomSheet>
  )
}
