import { useState } from 'react'
import { ExternalLink, Mail, MessageCircle, Phone } from 'lucide-react'
import { ActionBar, BottomSheet, Button, Chip } from '../../components'
import type { LanguageCode } from '../../domain/types'
import { getLanguage, LANGUAGES, useT } from '../../i18n'
import type { BillFinding } from './billCheck'
import { NOTE_SOURCES, staffNote } from './staffNote'
import styles from './StaffNoteSheet.module.css'

export interface StaffNoteSheetProps {
  open: boolean
  findings: readonly BillFinding[]
  currency: string
  onClose: () => void
}

/** Where to complain when a restaurant won't take it off: the government's own helplines. */
const HELP = [
  { key: 'bill.check.help.call', href: 'tel:1915', icon: Phone },
  { key: 'bill.check.help.whatsapp', href: 'https://wa.me/918800001915', icon: MessageCircle },
  { key: 'bill.check.help.web', href: 'https://consumerhelpline.gov.in/public/', icon: ExternalLink },
  { key: 'bill.check.help.commission', href: 'https://e-jagriti.gov.in/', icon: ExternalLink },
  { key: 'bill.check.help.email', href: 'mailto:com-ccpa@nic.in', icon: Mail },
] as const

/**
 * "Show the staff": a polite note asking the restaurant to take the charges off, big enough to
 * read across the table and in the language the staff read best — then why it's fair to ask, where
 * to complain if they won't, and what Bill check can't know.
 */
export function StaffNoteSheet({ open, findings, currency, onClose }: StaffNoteSheetProps) {
  const t = useT()
  const [lang, setLang] = useState<LanguageCode>(getLanguage)
  const note = staffNote(findings, lang, currency)

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      size="tall"
      title={t('bill.check.note.title')}
      description={t('bill.check.note.description')}
      footer={
        <ActionBar>
          <Button block onClick={onClose}>
            {t('bill.check.note.done')}
          </Button>
        </ActionBar>
      }
    >
      <div className={styles.langs} role="group" aria-label={t('bill.check.note.lang.aria')}>
        {LANGUAGES.map((language) => (
          <Chip key={language.code} selected={language.code === lang} onClick={() => setLang(language.code)} lang={language.code}>
            {language.native}
          </Chip>
        ))}
      </div>

      {note.length > 0 && (
        <blockquote className={styles.note} lang={lang}>
          {note.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <footer className={styles.sources} lang="en">
            {NOTE_SOURCES}
          </footer>
        </blockquote>
      )}

      <section className={styles.section} aria-labelledby="bill-check-why">
        <h3 id="bill-check-why" className={styles.heading}>
          {t('bill.check.why.title')}
        </h3>
        <p className={styles.text}>{t('bill.check.why.text')}</p>
      </section>

      <section className={styles.section} aria-labelledby="bill-check-help">
        <h3 id="bill-check-help" className={styles.heading}>
          {t('bill.check.help.title')}
        </h3>
        <p className={styles.text}>{t('bill.check.help.text')}</p>
        <ul className={styles.help}>
          {HELP.map(({ key, href, icon: Icon }) => (
            <li key={key}>
              <a className={styles.link} href={href} target={href.startsWith('https:') ? '_blank' : undefined} rel="noreferrer">
                <Icon aria-hidden="true" />
                <span>{t(key)}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <p className={styles.disclaimer}>{t('bill.check.disclaimer')}</p>
    </BottomSheet>
  )
}
