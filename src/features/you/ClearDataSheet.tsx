import { useState } from 'react'
import { Download } from 'lucide-react'
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
      title="Clear everything?"
      description="Your profile, people, expenses, groups, recurring splits and any bill in progress are deleted from this phone."
      footer={
        <div className={styles.footer}>
          <Button block variant="danger" className={styles.clear} onClick={() => onClear({ removePro: hasPro && removePro })}>
            Clear everything
          </Button>
          <Button block variant="ghost" onClick={onClose}>
            Keep my data
          </Button>
        </div>
      }
    >
      <div className={styles.body}>
        {offerBackup && (
          <div className={styles.backup}>
            <p className={styles.backupText}>Might you want it back one day? Save a backup file first.</p>
            <Button variant="secondary" size="md" iconStart={<Download />} onClick={onBackup}>
              Save a backup first
            </Button>
          </div>
        )}
        {hasPro && (
          <Switch
            checked={removePro}
            onChange={setRemovePro}
            label="Remove Pro from this phone too"
            description="Your pass stays unless you switch this on. Copy your Pro code first if you'll use it on another phone."
          />
        )}
      </div>
    </BottomSheet>
  )
}
