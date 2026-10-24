import { useState } from 'react'
import { Download } from 'lucide-react'
import { useT } from '../../i18n'
import { BottomSheet, Button, Switch } from '../../components'
import styles from './ClearDataSheet.module.css'

export interface ClearDataSheetProps {
  open: boolean
  onClose: () => void
  /** There's a Pro pass on this phone (offer to remove it too). */
  hasPro: boolean
  /** Offer "Save a backup first" (there's something worth keeping). */
  offerBackup: boolean
  onBackup: () => void
  onClear: (options: { removePro: boolean }) => void
}

/**
 * "Clear everything?" — says exactly what goes, offers a backup first, and keeps a Pro pass unless
 * asked (it was paid for). Undo follows for a few seconds.
 */
export function ClearDataSheet({ open, onClose, hasPro, offerBackup, onBackup, onClear }: ClearDataSheetProps) {
  const t = useT()
  const [removePro, setRemovePro] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setRemovePro(false)
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('you.clear.title')}
      description={t('you.clear.body')}
      footer={
        <div className={styles.footer}>
          <Button block variant="danger" className={styles.clear} onClick={() => onClear({ removePro: hasPro && removePro })}>
            {t('you.clear.confirm')}
          </Button>
          <Button block variant="ghost" onClick={onClose}>
            {t('you.clear.keep')}
          </Button>
        </div>
      }
    >
      <div className={styles.body}>
        {offerBackup && (
          <div className={styles.backup}>
            <p className={styles.backupText}>{t('you.clear.backupBody')}</p>
            <Button variant="secondary" size="md" iconStart={<Download />} onClick={onBackup}>
              {t('you.clear.backupCta')}
            </Button>
          </div>
        )}
        {hasPro && (
          <Switch
            checked={removePro}
            onChange={setRemovePro}
            label={t('you.clear.removePro')}
            description={t('you.clear.removePro.body')}
          />
        )}
      </div>
    </BottomSheet>
  )
}
