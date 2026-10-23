import { useId } from 'react'
import { Check, ShieldCheck } from 'lucide-react'
import { BottomSheet } from '../../components'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { voiceLanguages, type VoiceLang } from './voiceLanguages'
import styles from './VoiceLanguageSheet.module.css'

export interface VoiceLanguageSheetProps {
  open: boolean
  value: VoiceLang
  onClose: () => void
  /** A language was picked (the sheet closes). */
  onSelect: (code: VoiceLang) => void
}

/**
 * "Speak in": the eight languages as a radio group — each name in its own script (marked with its
 * `lang`, so screen readers say it right), in English, and a sentence to say in it — and a note on
 * where the voice goes.
 */
export default function VoiceLanguageSheet({ open, value, onClose, onSelect }: VoiceLanguageSheetProps) {
  const t = useT()
  const name = useId()
  const languages = voiceLanguages()
  return (
    <BottomSheet open={open} onClose={onClose} title={t('voice.lang.title')} size="tall">
      <div className={styles.body}>
        <div role="radiogroup" aria-label={t('voice.lang.title')} className={styles.list}>
          {languages.map((language) => {
            const checked = language.code === value
            return (
              <label key={language.code} className={cx(styles.row, checked && styles.checked)}>
                <input
                  type="radio"
                  name={name}
                  value={language.code}
                  checked={checked}
                  onChange={() => onSelect(language.code)}
                  onClick={() => {
                    // Picking the current one again still closes the sheet.
                    if (checked) onSelect(language.code)
                  }}
                  className={styles.radio}
                  aria-labelledby={`${name}-${language.code}-name`}
                  aria-describedby={`${name}-${language.code}`}
                />
                <span className={styles.text}>
                  <span id={`${name}-${language.code}-name`} className={styles.names}>
                    <span className={styles.native} lang={language.code}>
                      {language.native}
                    </span>{' '}
                    <span className={styles.english}>{language.english}</span>
                  </span>
                  <span id={`${name}-${language.code}`} className={styles.example} lang={language.code}>
                    {language.example}
                  </span>
                </span>
                <span className={styles.mark} aria-hidden="true">
                  {checked && <Check strokeWidth={3} />}
                </span>
              </label>
            )
          })}
        </div>
        <p className={styles.note}>
          <ShieldCheck aria-hidden="true" className={styles.noteIcon} />
          <span>{t('voice.lang.note')}</span>
        </p>
      </div>
    </BottomSheet>
  )
}
