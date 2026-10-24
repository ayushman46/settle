import { useState } from 'react'
import { ActionBar, Button, PageTitle, Screen, useToast } from '../../components'
import type { LanguageCode } from '../../domain/types'
import { useLang, useT } from '../../i18n'
import { LanguageGrid } from '../../i18n/ui/LanguageGrid'
import { haptic } from '../../lib/haptics'
import { BrandMark } from '../landing/BrandMark'
import { chooseAppLanguage } from '../you/appLanguage'
import styles from './OnboardingScreen.module.css'

export interface LanguageStepProps {
  /** "Continue": on to the intro slides. */
  onDone: () => void
  /** "Skip": straight to your details, in the language on show. */
  onSkip: () => void
}

/**
 * Onboarding's first screen: "Choose your language" — the eight languages as big tiles in their
 * own scripts, the phone's language already picked. A tap switches the whole app straight away
 * (the language loads behind a spinner on its tile) and is saved; You → Language changes it later.
 */
export function LanguageStep({ onDone, onSkip }: LanguageStepProps) {
  const t = useT()
  const lang = useLang()
  const toast = useToast()
  const [pending, setPending] = useState<LanguageCode | null>(null)

  const pick = async (code: LanguageCode | null): Promise<void> => {
    if (code === null || code === lang) return
    haptic('tap')
    setPending(code)
    const result = await chooseAppLanguage(code)
    if (result === 'superseded') return
    setPending(null)
    if (result === 'failed') toast(t('common.language.failed'), { tone: 'error' })
  }

  return (
    <Screen
      header={
        <div className={styles.topRow}>
          <BrandMark size="sm" />
          <Button variant="ghost" size="sm" onClick={onSkip}>
            {t('common.action.skip')}
          </Button>
        </div>
      }
      footer={
        <ActionBar>
          <Button block onClick={onDone}>
            {t('common.action.continue')}
          </Button>
        </ActionBar>
      }
    >
      <PageTitle title={t('common.language.title')} subtitle={t('onboarding.language.subtitle')} />
      <LanguageGrid className={styles.languages} label={t('common.language.label')} value={pending ?? lang} pending={pending} onChange={(code) => void pick(code)} />
    </Screen>
  )
}
