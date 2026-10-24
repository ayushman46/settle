import { ChevronRight, ReceiptText } from 'lucide-react'
import { openBill, useBillDraft } from '../bill/launch'
import { useT } from '../../i18n'
import { draftLine } from './homeLinks'
import styles from './HomeScreen.module.css'

/** A bill left half-split on this phone, one tap from picking it back up where it was left. Nothing when there's none. */
export function BillDraftCard() {
  const t = useT()
  const draft = useBillDraft()
  if (!draft) return null
  const heading = draft.editing ? t('home.draft.finish') : t('home.draft.continue')
  return (
    <button type="button" className={styles.draft} onClick={() => openBill({ kind: 'resume' })}>
      <span className={styles.draftIcon} aria-hidden="true">
        <ReceiptText />
      </span>
      <span className={styles.draftText}>
        <span className={styles.draftTitle}>{heading}</span>
        <span className={styles.draftLine}>{draftLine(draft)}</span>
      </span>
      <ChevronRight aria-hidden="true" className={styles.draftChevron} />
    </button>
  )
}
