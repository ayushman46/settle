import { useState } from 'react'
import { BottomSheet, useToast } from '../../components'
import type { LanguageCode } from '../../domain/types'
import { useT } from '../../i18n'
import { LanguageGrid } from '../../i18n/ui/LanguageGrid'
import { chooseAppLanguage, phoneLanguage } from './appLanguage'

export interface LanguageSheetProps {
  open: boolean
  onClose: () => void
  /** The saved choice (`profile.language`); null = automatic (the phone's language). */
  saved: LanguageCode | null
}

/**
 * You → Language: the eight languages as tiles, with "Automatic" first. A tap loads the language,
 * switches the whole app and saves the choice; the sheet stays open so the new check shows.
 */
export function LanguageSheet({ open, onClose, saved }: LanguageSheetProps) {
  const t = useT()
  const toast = useToast()
  const [pending, setPending] = useState<LanguageCode | 'auto' | null>(null)

  const pick = async (code: LanguageCode | null): Promise<void> => {
    if (code === saved) return
    setPending(code ?? 'auto')
    const result = await chooseAppLanguage(code)
    if (result === 'superseded') return
    setPending(null)
    if (result === 'failed') toast(t('common.language.failed'), { tone: 'error' })
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t('common.language.title')} description={t('you.language.description')}>
      <LanguageGrid value={saved} automatic={phoneLanguage()} pending={pending} label={t('common.language.label')} onChange={(code) => void pick(code)} />
    </BottomSheet>
  )
}
