import { useState } from 'react'
import { CalendarCheck } from 'lucide-react'
import { Button, Card, useToast } from '../../components'
import { useT } from '../../i18n'
import { declineGuess, usePaydayGuess } from './store'
import { dayList, paydayLabel } from './labels'
import { PaydaySheet } from './PaydaySheet'
import { useSetMyPayday } from './usePaydayActions'
import styles from './Payday.module.css'

/**
 * "Looks like you get paid on the 30th. Remember it?" Shown once salary alerts in two different
 * months agree (Android app, payment alerts on) and you have no payday saved. It only asks: one
 * tap remembers it (with Undo), "Another day" opens the picker, "Not now" puts this guess away.
 * Nothing otherwise.
 */
export function PaydayGuessCard() {
  const t = useT()
  const toast = useToast()
  const guess = usePaydayGuess()
  const setMine = useSetMyPayday()
  const [picking, setPicking] = useState(false)
  // Once opened, the picker stays mounted so it can close properly after a pick removes the card.
  const [picked, setPicked] = useState(false)
  if (!guess && !picked) return null

  const sheet = picked && <PaydaySheet open={picking} onClose={() => setPicking(false)} />
  if (!guess) return sheet || null

  const notNow = (): void => {
    const undo = declineGuess(guess.payday)
    toast(t('payday.guess.toast.no'), { action: { label: t('common.action.undo'), onAction: undo } })
  }

  return (
    <>
      <Card className={styles.card} aria-label={t('payday.guess.aria')} role="region">
        <div className={styles.cardHead}>
          <span className={styles.icon} aria-hidden="true">
            <CalendarCheck />
          </span>
          <div className={styles.cardText}>
            <h2 className={styles.heading}>{t('payday.guess.title', { payday: paydayLabel(guess.payday) })}</h2>
            <p className={styles.fine}>{t('payday.guess.body', { days: dayList(guess.days) })}</p>
          </div>
        </div>
        <div className={styles.actions}>
          <Button size="md" onClick={() => setMine(guess.payday)}>
            {t('payday.guess.yes')}
          </Button>
          <Button
            size="md"
            variant="secondary"
            onClick={() => {
              setPicked(true)
              setPicking(true)
            }}
          >
            {t('payday.guess.other')}
          </Button>
          <Button size="md" variant="ghost" onClick={notNow}>
            {t('payday.guess.no')}
          </Button>
        </div>
      </Card>
      {sheet}
    </>
  )
}
