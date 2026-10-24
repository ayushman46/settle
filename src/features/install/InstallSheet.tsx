import { Plus, Share } from 'lucide-react'
import { BottomSheet, Button } from '../../components'
import { useT } from '../../i18n'
import styles from './Install.module.css'

export interface InstallSheetProps {
  open: boolean
  onClose: () => void
}

/** iPhone Safari has no install prompt: two steps, Share and then Add to Home Screen. */
export function InstallSheet({ open, onClose }: InstallSheetProps) {
  const t = useT()
  return (
    <BottomSheet open={open} onClose={onClose} title={t('install.sheet.title')} description={t('install.sheet.description')}>
      <ol className={styles.steps} aria-label={t('install.sheet.title')}>
        <li className={styles.step}>
          <span className={styles.stepIcon} aria-hidden="true">
            <Share strokeWidth={2.25} />
          </span>
          <span>
            <strong className={styles.stepTitle}>{t('install.sheet.step1.title')}</strong>
            <span className={styles.stepBody}>{t('install.sheet.step1.body')}</span>
          </span>
        </li>
        <li className={styles.step}>
          <span className={styles.stepIcon} aria-hidden="true">
            <Plus strokeWidth={2.25} />
          </span>
          <span>
            <strong className={styles.stepTitle}>{t('install.sheet.step2.title')}</strong>
            <span className={styles.stepBody}>{t('install.sheet.step2.body')}</span>
          </span>
        </li>
      </ol>
      <Button block onClick={onClose}>
        {t('install.sheet.done')}
      </Button>
    </BottomSheet>
  )
}
