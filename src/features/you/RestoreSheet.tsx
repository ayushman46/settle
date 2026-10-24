import { useState } from 'react'
import { Combine, Replace, type LucideIcon } from 'lucide-react'
import { useT, type MessageKey } from '../../i18n'
import { Banner, BottomSheet, Button } from '../../components'
import type { BackupFile } from '../../data'
import { cx } from '../../lib/cx'
import { backupContents, backupDateLabel } from './backupFiles'
import styles from './RestoreSheet.module.css'

export type RestoreMode = 'merge' | 'replace'

export interface RestoreSheetProps {
  open: boolean
  /** The backup that was picked (kept while the sheet slides away). */
  backup: BackupFile | null
  /** Something's already on this phone — then merging or replacing is a real choice. */
  hasLocalData: boolean
  onClose: () => void
  onRestore: (mode: RestoreMode) => void
}

const MODES: ReadonlyArray<{ id: RestoreMode; title: MessageKey; text: MessageKey; icon: LucideIcon }> = [
  {
    id: 'merge',
    title: 'you.restore.merge',
    text: 'you.restore.merge.body',
    icon: Combine,
  },
  {
    id: 'replace',
    title: 'you.restore.replace',
    text: 'you.restore.replace.body',
    icon: Replace,
  },
]

/**
 * "Restore this backup?" — what's in the file, then merge or replace (only asked when this phone
 * already has data). Nothing changes until the button is pressed, and Undo follows it.
 */
export function RestoreSheet({ open, backup, hasLocalData, onClose, onRestore }: RestoreSheetProps) {
  const t = useT()
  const [mode, setMode] = useState<RestoreMode>('merge')
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setMode('merge')
  }

  const chosen: RestoreMode = hasLocalData ? mode : 'replace'
  const saved = backup ? backupDateLabel(backup.exportedAt) : null
  const description = backup ? [saved, backupContents(backup)].filter(Boolean).join(' · ') : undefined

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('you.restore.title')}
      description={description}
      footer={
        <Button block onClick={() => onRestore(chosen)} disabled={!backup}>
          {!hasLocalData ? 'Restore backup' : chosen === 'merge' ? 'Merge backup' : 'Replace everything'}
        </Button>
      }
    >
      {hasLocalData ? (
        <div className={styles.body}>
          <div role="radiogroup" aria-label={t('you.restore.how')} className={styles.modes}>
            {MODES.map(({ id, title: titleKey, text: textKey, icon: Icon }) => {
              const title = t(titleKey)
              const text = t(textKey)
              const checked = id === mode
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={checked ? 0 : -1}
                  className={cx(styles.mode, checked && styles.checked)}
                  onClick={() => setMode(id)}
                  onKeyDown={(event) => {
                    if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
                      event.preventDefault()
                      const next = id === 'merge' ? 'replace' : 'merge'
                      setMode(next)
                      const sibling = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)
                      sibling?.focus()
                    }
                  }}
                  data-mode={id}
                >
                  <span className={styles.modeIcon} aria-hidden="true">
                    <Icon />
                  </span>
                  <span className={styles.modeText}>
                    <span className={styles.modeTitle}>{title}</span>
                    <span className={styles.modeBody}>{text}</span>
                  </span>
                  <span className={styles.radio} aria-hidden="true" />
                </button>
              )
            })}
          </div>
          {mode === 'replace' && (
            <Banner tone="warning" title={t('you.restore.replace.title')}>
              Your profile, people, expenses, groups and recurring splits on this phone are swapped for the backup's. You can
              undo it straight after.
            </Banner>
          )}
        </div>
      ) : (
        <p className={styles.fresh}>{t('you.restore.fresh')}</p>
      )}
    </BottomSheet>
  )
}
