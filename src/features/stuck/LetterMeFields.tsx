/**
 * "Your details" in the Raise sheet: the mobile number, city and state, and address a letter needs,
 * asked once and kept on this phone (letterMe.ts). Open while something the letter needs is missing;
 * once it's all there, one line with a Change button.
 */
import { useId, useState } from 'react'
import { Button, TextField } from '../../components'
import { useT } from '../../i18n'
import { LETTER_ME_LIMITS, setLetterMe, useLetterMe } from './letterMe'
import styles from './RaiseSheet.module.css'

export type LetterMeField = 'mobile' | 'place' | 'address'

/** The details this letter uses (the address is always optional). */
export function LetterMeFields({ fields }: { fields: readonly LetterMeField[] }) {
  const t = useT()
  const me = useLetterMe()
  const ids = useId()
  const [editing, setEditing] = useState(() => fields.some((f) => f !== 'address' && me[f].trim() === ''))
  if (fields.length === 0) return null
  const filled = fields.map((f) => me[f].trim()).filter((x) => x !== '')

  return (
    <section className={styles.section} aria-labelledby={`${ids}-me`}>
      <h3 id={`${ids}-me`} className={styles.heading}>
        {t('stuckhelp.me.heading')}
      </h3>
      {editing || filled.length === 0 ? (
        <div className={styles.me}>
          <p className={styles.hint}>{t('stuckhelp.me.hint')}</p>
          {fields.includes('mobile') && (
            <TextField
              label={t('stuckhelp.me.mobile')}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={LETTER_ME_LIMITS.mobile}
              value={me.mobile}
              onChange={(event) => setLetterMe({ mobile: event.currentTarget.value })}
            />
          )}
          {fields.includes('place') && (
            <TextField
              label={t('stuckhelp.me.place')}
              placeholder={t('stuckhelp.me.placeExample')}
              autoComplete="address-level2"
              maxLength={LETTER_ME_LIMITS.place}
              value={me.place}
              onChange={(event) => setLetterMe({ place: event.currentTarget.value })}
            />
          )}
          {fields.includes('address') && (
            <TextField
              label={t('stuckhelp.me.address')}
              autoComplete="street-address"
              maxLength={LETTER_ME_LIMITS.address}
              value={me.address}
              onChange={(event) => setLetterMe({ address: event.currentTarget.value })}
            />
          )}
        </div>
      ) : (
        <div className={styles.meRow}>
          <p className={styles.meValues}>{filled.join(' · ')}</p>
          <Button variant="ghost" size="sm" aria-label={t('stuckhelp.me.changeLabel')} onClick={() => setEditing(true)}>
            {t('stuckhelp.me.change')}
          </Button>
        </div>
      )}
    </section>
  )
}
