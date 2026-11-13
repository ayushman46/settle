import { useId, useRef, useState, type FormEvent } from 'react'
import { ChevronRight, ShieldCheck } from 'lucide-react'
import { ActionBar, Button, PageTitle, Screen, TextField, TopBar } from '../../components'
import { legacyUpiIdFor, useProfile } from '../../data'
import { BRAND } from '../../domain/types'
import { t, useT } from '../../i18n'
import { currencyName } from '../../lib/currencies'
import { haptic } from '../../lib/haptics'
import { currencySymbol } from '../../lib/money'
import { MAX_NAME_LENGTH, nameKey, normalizeName } from '../../lib/people'
import { isPhoneUpiId, isValidUpiId, normalizeUpiId } from '../../lib/upi'
import { CurrencySheet } from '../bill/CurrencySheet'
import { ConnectUpi } from '../../kit/ConnectUpi'
import styles from './OnboardingScreen.module.css'

export interface AboutYou {
  name: string
  /** A valid UPI ID (normalized), or null for none. */
  upiId: string | null
  currency: string
}

export interface AboutYouStepProps {
  /** Just the name, for someone on their way to Stuck money (it goes on the letters); UPI ID and currency wait for You. */
  nameOnly?: boolean
  onBack: () => void
  /** "Start splitting" with everything valid. */
  onDone: (about: AboutYou) => void
  /** "Skip for now": whatever valid details there are (name may be blank). */
  onSkip: (about: AboutYou) => void
}

/** Placeholder names that don't say who the owner is (an earlier skip saves "You"). */
const PLACEHOLDER_NAMES: ReadonlySet<string> = new Set(['', 'you', 'me'])

/** "Add your name — …", in the current language. */
export const nameErrorText = (): string => t('onboarding.about.name.error')
/** "That doesn't look like a UPI ID…", in the current language. */
export const upiErrorText = (): string => t('onboarding.about.upi.error')

function startingName(saved: string): string {
  return PLACEHOLDER_NAMES.has(nameKey(saved)) ? '' : saved
}

/**
 * The last onboarding step: your name (required), your UPI ID (optional — prefilled from a split
 * you made in the old app) and your currency — or only the name (`nameOnly`). Nothing leaves the phone.
 */
export function AboutYouStep({ nameOnly = false, onBack, onDone, onSkip }: AboutYouStepProps) {
  const t = useT()
  const profile = useProfile()
  const formId = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const upiRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(() => startingName(profile.name))
  const [typedUpi, setTypedUpi] = useState<string | null>(() => profile.upiId)
  const [currency, setCurrency] = useState(profile.currency)
  const [picking, setPicking] = useState(false)
  const [nameError, setNameError] = useState(false)
  const [upiChecked, setUpiChecked] = useState(false)

  // Until they type in it, the UPI field offers the ID the old app remembered for this name.
  const remembered = typedUpi === null ? legacyUpiIdFor(normalizeName(name)) : null
  const upi = typedUpi ?? remembered ?? ''
  // Without the field on show, a remembered ID that doesn't check out is simply left off.
  const upiValid = upi.trim() === '' || isValidUpiId(upi)
  const upiBlocks = !nameOnly && !upiValid
  const showUpiError = upiChecked && !upiValid

  const details = (fallbackName: string): AboutYou => ({
    name: normalizeName(name) || fallbackName,
    upiId: upi.trim() !== '' && upiValid ? normalizeUpiId(upi) : null,
    currency,
  })

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const missingName = normalizeName(name) === ''
    setNameError(missingName)
    setUpiChecked(true)
    if (missingName || upiBlocks) {
      haptic('warning')
      ;(missingName ? nameRef : upiRef).current?.focus()
      return
    }
    haptic('success')
    onDone(details(''))
  }

  return (
    <Screen
      header={<TopBar onBack={onBack} />}
      footer={
        <ActionBar>
          <Button block type="submit" form={formId}>
            {nameOnly ? t('onboarding.about.stuck.cta') : t('onboarding.about.start.cta')}
          </Button>
          {/* A skipped name is saved as "You" (data, not copy: see PLACEHOLDER_NAMES). */}
          <Button block variant="ghost" onClick={() => onSkip(details('You'))}>
            {t('onboarding.about.skip.cta')}
          </Button>
        </ActionBar>
      }
    >
      <PageTitle title={t('onboarding.about.title')} subtitle={nameOnly ? t('onboarding.about.stuck.subtitle') : t('onboarding.about.subtitle')} />
      <form id={formId} className={styles.form} noValidate onSubmit={submit}>
        <TextField
          ref={nameRef}
          label={t('onboarding.about.name.label')}
          placeholder={t('onboarding.about.name.placeholder')}
          autoComplete="given-name"
          autoCapitalize="words"
          enterKeyHint={nameOnly ? 'done' : 'next'}
          maxLength={MAX_NAME_LENGTH * 2}
          value={name}
          error={nameError ? t('onboarding.about.name.error') : undefined}
          onChange={(event) => {
            setName(event.target.value)
            if (nameError && normalizeName(event.target.value) !== '') setNameError(false)
          }}
        />
        {!nameOnly && (
          <>
            <ConnectUpi
              onConnect={(qr) => {
                setTypedUpi(qr.vpa)
                setUpiChecked(false)
              }}
            />
            <TextField
              ref={upiRef}
              label={t('onboarding.about.upi.label')}
              placeholder={t('onboarding.about.upi.placeholder')}
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              className={styles.mono}
              value={upi}
              hint={
                isPhoneUpiId(upi)
                  ? t('kit.upiForm.hint.phone')
                  : remembered !== null
                    ? t('onboarding.about.upi.hint.remembered')
                    : t('onboarding.about.upi.hint')
              }
              error={showUpiError ? t('onboarding.about.upi.error') : undefined}
              onChange={(event) => {
                setTypedUpi(event.target.value)
                if (upiChecked && (event.target.value.trim() === '' || isValidUpiId(event.target.value))) setUpiChecked(false)
              }}
              onBlur={() => setUpiChecked(true)}
            />
            <div className={styles.currencyField}>
              <span className={styles.fieldLabel} id={`${formId}-currency`}>
                {t('onboarding.about.currency.label')}
              </span>
              <button
                type="button"
                className={styles.currencyButton}
                aria-labelledby={`${formId}-currency ${formId}-currency-value ${formId}-currency-change`}
                aria-haspopup="dialog"
                onClick={() => setPicking(true)}
              >
                <span className={styles.currencySymbol} aria-hidden="true">
                  {currencySymbol(currency).slice(0, 3)}
                </span>
                <span id={`${formId}-currency-value`} className={styles.currencyText}>
                  {currencyName(currency)} <span className={styles.currencyCode}>{currency}</span>
                </span>
                <span id={`${formId}-currency-change`} className={styles.currencyChange} aria-hidden="true">
                  {t('onboarding.about.currency.change')}
                  <ChevronRight strokeWidth={2.5} />
                </span>
              </button>
            </div>
          </>
        )}
      </form>
      <p className={styles.privacy}>
        <ShieldCheck aria-hidden="true" className={styles.privacyIcon} />
        <span>{t('onboarding.about.privacy', { brand: BRAND.name })}</span>
      </p>
      <CurrencySheet
        open={picking}
        currency={currency}
        title={t('onboarding.about.currency.sheet.title')}
        description={t('onboarding.about.currency.sheet.body')}
        onClose={() => setPicking(false)}
        onSelect={(code) => {
          setCurrency(code)
          setPicking(false)
        }}
      />
    </Screen>
  )
}
