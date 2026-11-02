/**
 * For a NACH debit, in the Raise sheet: had you cancelled (revoked) the mandate before it? A debit
 * after that isn't a failed payment, so the letters say it was taken after you revoked it, and when.
 * The answer is kept on this phone with your letter details (letterMe.ts).
 */
import { useId } from 'react'
import { Chip, TextField } from '../../components'
import type { StuckPayment } from '../../data/stores'
import { isIsoDate } from '../../engine/dates'
import { useT } from '../../i18n'
import { setMandateRevoked, useLetterMe } from './letterMe'
import styles from './RaiseSheet.module.css'

export function LetterMandate({ payment }: { payment: StuckPayment }) {
  const t = useT()
  const ids = useId()
  const on = useLetterMe().revoked[payment.id]
  const yes = on !== undefined

  return (
    <section className={styles.section} aria-labelledby={`${ids}-heading`}>
      <h3 id={`${ids}-heading`} className={styles.heading}>
        {t('stuckhelp.mandate.heading')}
      </h3>
      <p id={`${ids}-question`} className={styles.question}>
        {t('stuckhelp.mandate.question')}
      </p>
      <div className={styles.choices} role="radiogroup" aria-labelledby={`${ids}-question`}>
        <Chip role="radio" selected={!yes} onClick={() => setMandateRevoked(payment.id, null)}>
          {t('stuckhelp.mandate.no')}
        </Chip>
        <Chip role="radio" selected={yes} onClick={() => setMandateRevoked(payment.id, on ?? '')}>
          {t('stuckhelp.mandate.yes')}
        </Chip>
      </div>
      {yes && (
        <TextField
          label={t('stuckhelp.mandate.date')}
          hint={t('stuckhelp.mandate.hint')}
          type="date"
          max={payment.date}
          value={on}
          onChange={(event) => {
            const value = event.currentTarget.value
            setMandateRevoked(payment.id, isIsoDate(value) ? value : '')
          }}
        />
      )}
    </section>
  )
}
