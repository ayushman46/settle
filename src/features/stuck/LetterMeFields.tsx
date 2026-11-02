/**
 * "Your details" in the Raise sheet: what a letter needs from you, asked once. The mobile number,
 * city and state, and address are kept on this phone (letterMe.ts); your name (asked only when the
 * profile has none: a skipped name is saved as "You") and your UPI ID go to your profile, as You →
 * Edit profile saves them. Open while something the letter needs is missing; once it's all there,
 * one line with a Change button. An empty field the letter needs is marked `data-blank`, for the
 * sheet's "Fill them in".
 */
import { useId, useState } from 'react'
import { Button, TextField } from '../../components'
import { updateProfile, useProfile } from '../../data'
import { useT } from '../../i18n'
import { MAX_NAME_LENGTH } from '../../lib/people'
import { isValidUpiId, normalizeUpiId } from '../../lib/upi'
import { LETTER_ME_LIMITS, setLetterMe, useLetterMe } from './letterMe'
import { isRealName } from './letters'
import styles from './RaiseSheet.module.css'

export type LetterMeField = 'name' | 'mobile' | 'upi' | 'place' | 'address'

/** The letter reads fine without these (the line is left out). */
const OPTIONAL: ReadonlySet<LetterMeField> = new Set<LetterMeField>(['upi', 'address'])

/** The details this letter uses. */
export function LetterMeFields({ fields }: { fields: readonly LetterMeField[] }) {
  const t = useT()
  const me = useLetterMe()
  const profile = useProfile()
  const ids = useId()
  // Asked only while the profile has no real name; typing one in doesn't take the field away.
  const [askName] = useState(() => !isRealName(profile.name))
  const [name, setName] = useState('')
  // The UPI ID as typed: saved to the profile once it's a whole one (or emptied).
  const [upi, setUpi] = useState(profile.upiId ?? '')
  const [upiError, setUpiError] = useState(false)
  const shown = fields.filter((f) => f !== 'name' || askName)
  const valueOf = (f: LetterMeField): string => (f === 'name' ? name : f === 'upi' ? upi : me[f])
  const [editing, setEditing] = useState(() => shown.some((f) => !OPTIONAL.has(f) && valueOf(f).trim() === ''))
  if (shown.length === 0) return null
  const filled = shown.map((f) => valueOf(f).trim()).filter((x) => x !== '')
  /** Marks a field the letter still needs. */
  const blank = (f: LetterMeField): { 'data-blank'?: '' } => (!OPTIONAL.has(f) && valueOf(f).trim() === '' ? { 'data-blank': '' } : {})

  const changeUpi = (value: string): void => {
    const typed = value.replace(/\s+/g, '')
    setUpi(typed)
    setUpiError(false)
    if (typed === '') updateProfile({ upiId: null })
    else if (isValidUpiId(typed)) updateProfile({ upiId: normalizeUpiId(typed) })
  }

  return (
    <section className={styles.section} aria-labelledby={`${ids}-me`}>
      <h3 id={`${ids}-me`} className={styles.heading}>
        {t('stuckhelp.me.heading')}
      </h3>
      {editing || filled.length === 0 ? (
        <div className={styles.me}>
          <p className={styles.hint}>{t('stuckhelp.me.hint')}</p>
          {shown.includes('name') && (
            <TextField
              label={t('stuckhelp.me.name')}
              autoComplete="name"
              autoCapitalize="words"
              maxLength={MAX_NAME_LENGTH * 2}
              value={name}
              onChange={(event) => {
                setName(event.currentTarget.value)
                updateProfile({ name: event.currentTarget.value })
              }}
              {...blank('name')}
            />
          )}
          {shown.includes('mobile') && (
            <TextField
              label={t('stuckhelp.me.mobile')}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={LETTER_ME_LIMITS.mobile}
              value={me.mobile}
              onChange={(event) => setLetterMe({ mobile: event.currentTarget.value })}
              {...blank('mobile')}
            />
          )}
          {shown.includes('upi') && (
            <TextField
              label={t('stuckhelp.me.upi')}
              hint={t('stuckhelp.me.upiHint')}
              error={upiError ? t('kit.upiForm.error') : undefined}
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={upi}
              onChange={(event) => changeUpi(event.currentTarget.value)}
              onBlur={() => setUpiError(upi !== '' && !isValidUpiId(upi))}
            />
          )}
          {shown.includes('place') && (
            <TextField
              label={t('stuckhelp.me.place')}
              hint={t('stuckhelp.me.placeExample')}
              autoComplete="address-level2"
              maxLength={LETTER_ME_LIMITS.place}
              value={me.place}
              onChange={(event) => setLetterMe({ place: event.currentTarget.value })}
              {...blank('place')}
            />
          )}
          {shown.includes('address') && (
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
