import { useRef, useState, type ChangeEvent } from 'react'
import { DatabaseBackup, Download, FileSpreadsheet, Trash2 } from 'lucide-react'
import { useT } from '../../i18n'
import { Link, navigate } from '../../app/router'
import { Badge, Card, List, ListRow, useToast } from '../../components'
import {
  clearAllData,
  exportBackup,
  importBackup,
  useExpenses,
  useFriends,
  useFriendsById,
  useGroups,
  useHasData,
  useRecurring,
  type BackupFile,
} from '../../data'
import { BRAND } from '../../domain/types'
import { haptic } from '../../lib/haptics'
import { clearLicense, licenseToken, redeemLicense, useHasFeature, usePro } from '../../pro'
import { shareFile } from '../../share'
import { forgetActivityView } from '../activity/viewMemory'
import { clearBillDraft } from '../bill/launch'
import { withPro } from '../pro/paywall'
import {
  backupBlob,
  backupFilename,
  clearLastBackup,
  csvBlob,
  csvFilename,
  lastBackupAt,
  READ_BACKUP_ERRORS,
  readBackupFile,
  savedWhen,
  setLastBackupAt,
  useLastBackupAt,
} from './backupFiles'
import { ClearDataSheet } from './ClearDataSheet'
import { RestoreSheet, type RestoreMode } from './RestoreSheet'
import { SettingIcon } from './SettingIcon'
import styles from './Settings.module.css'

const WELCOME_PATH = '/app/welcome'
const YOU_PATH = '/app/you'

function restoredMessage(mode: RestoreMode, result: { added: number; updated: number }): string {
  if (mode === 'replace') return 'Backup restored'
  const parts = [result.added > 0 && `${result.added} added`, result.updated > 0 && `${result.updated} updated`].filter(Boolean)
  return parts.length > 0 ? `Backup merged — ${parts.join(', ')}` : 'Backup merged — nothing new in it'
}

/**
 * "Your data": save a backup (free, a JSON file the person keeps), restore one (merge or replace,
 * with Undo), export to CSV (Pro), and clear everything (with a backup offered first, and Undo).
 */
export function DataSettings() {
  const t = useT()
  const toast = useToast()
  const expenses = useExpenses()
  const friends = useFriends()
  const friendsById = useFriendsById()
  const groups = useGroups()
  const recurring = useRecurring()
  const hasExpensesOrGroups = useHasData()
  const pro = usePro()
  const csvUnlocked = useHasFeature('export')
  const lastBackup = useLastBackupAt()
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'backup' | 'csv' | 'read' | null>(null)
  const [restore, setRestore] = useState<{ open: boolean; backup: BackupFile | null }>({ open: false, backup: null })
  const [clearing, setClearing] = useState(false)

  // People or recurring splits count too: a "replace" would remove them.
  const hasLocalData = hasExpensesOrGroups || friends.length > 1 || recurring.length > 0

  const saveBackup = async (): Promise<void> => {
    if (busy) return
    setBusy('backup')
    const outcome = await shareFile(backupBlob(exportBackup()), backupFilename(), undefined, { title: `${BRAND.name} backup` })
    setBusy(null)
    if (outcome === 'shared' || outcome === 'downloaded') {
      setLastBackupAt(Date.now())
      haptic('success')
      toast(outcome === 'shared' ? 'Backup shared — keep it somewhere safe' : 'Backup saved to your downloads', { tone: 'success' })
    } else if (outcome === 'failed') {
      toast("Couldn't save the backup. Try again.", { tone: 'error' })
    }
  }

  const onFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const input = event.currentTarget
    const file = input.files?.[0] ?? null
    input.value = '' // so picking the same file again still counts
    if (!file) return
    setBusy('read')
    const result = await readBackupFile(file)
    setBusy(null)
    if (!result.ok) {
      toast(READ_BACKUP_ERRORS[result.reason], { tone: 'error' })
      return
    }
    setRestore({ open: true, backup: result.backup })
  }

  const doRestore = (mode: RestoreMode): void => {
    const backup = restore.backup
    if (!backup) return
    const before = exportBackup()
    const result = importBackup(backup, mode)
    setRestore((current) => ({ ...current, open: false }))
    haptic('success')
    toast(restoredMessage(mode, result), {
      tone: 'success',
      action: {
        label: 'Undo',
        onAction: () => {
          importBackup(before, 'replace')
          toast('Restore undone')
        },
      },
    })
  }

  const exportCsv = async (): Promise<void> => {
    if (busy) return
    setBusy('csv')
    const groupsById = Object.fromEntries(groups.map((g) => [g.id, g]))
    const outcome = await shareFile(csvBlob(expenses, friendsById, groupsById), csvFilename(), undefined, {
      title: `${BRAND.name} expenses`,
    })
    setBusy(null)
    if (outcome === 'shared' || outcome === 'downloaded') {
      const what = `${expenses.length} ${expenses.length === 1 ? 'expense' : 'expenses'}`
      toast(outcome === 'shared' ? `${what} exported` : `${what} saved to your downloads as CSV`, { tone: 'success' })
    } else if (outcome === 'failed') {
      toast("Couldn't export right now. Try again.", { tone: 'error' })
    }
  }

  const clearEverything = ({ removePro }: { removePro: boolean }): void => {
    const snapshot = exportBackup()
    const savedAt = lastBackupAt()
    const token = removePro ? licenseToken() : null
    clearAllData()
    clearBillDraft()
    forgetActivityView()
    clearLastBackup()
    if (removePro) clearLicense()
    setClearing(false)
    toast(removePro ? 'Everything is cleared, Pro included' : 'Everything on this phone is cleared', {
      action: {
        label: 'Undo',
        onAction: () => {
          importBackup(snapshot, 'replace')
          setLastBackupAt(savedAt)
          if (token) void redeemLicense(token)
          navigate(YOU_PATH, { replace: true })
          toast('Everything is back', { tone: 'success' })
        },
      },
    })
    navigate(WELCOME_PATH, { replace: true })
  }

  const backupLine = lastBackup
    ? `Last saved ${savedWhen(lastBackup)}`
    : hasLocalData
      ? 'Not backed up yet — keep a copy somewhere safe'
      : 'Keep a copy of everything, just in case'

  return (
    <section className={styles.section} aria-labelledby="you-data">
      <h2 id="you-data" className={styles.sectionTitle}>
        {t('you.data.title')}
      </h2>
      <Card padding="none">
        <List>
          <ListRow
            leading={
              <SettingIcon>
                <Download />
              </SettingIcon>
            }
            title={t('you.data.backup')}
            subtitle={busy === 'backup' ? t('you.data.backup.busy') : backupLine}
            onClick={() => void saveBackup()}
            disabled={busy === 'backup'}
            chevron
          />
          <ListRow
            leading={
              <SettingIcon>
                <DatabaseBackup />
              </SettingIcon>
            }
            title={t('you.data.restore')}
            subtitle={busy === 'read' ? t('you.data.restore.busy') : t('you.data.restore.body')}
            onClick={() => fileInput.current?.click()}
            disabled={busy === 'read'}
            chevron
          />
          <ListRow
            leading={
              <SettingIcon>
                <FileSpreadsheet />
              </SettingIcon>
            }
            title={t('you.data.csv')}
            subtitle={
              expenses.length === 0
                ? t('you.data.csv.empty')
                : busy === 'csv'
                  ? t('you.data.csv.busy')
                  : t('you.data.csv.body')
            }
            trailing={csvUnlocked ? undefined : <Badge tone="pro">Pro</Badge>}
            onClick={() => withPro('export', () => void exportCsv())}
            disabled={expenses.length === 0 || busy === 'csv'}
            chevron
          />
          <ListRow
            leading={
              <SettingIcon tone="danger">
                <Trash2 />
              </SettingIcon>
            }
            title={<span className={styles.danger}>{t('you.data.clear')}</span>}
            subtitle={t('you.data.clear.body')}
            onClick={() => setClearing(true)}
            chevron
          />
        </List>
      </Card>
      <p className={styles.footnote}>
        Backups hold your people, expenses, groups, recurring splits and settings — not your Pro pass. Moving phones? Copy your
        Pro code from <Link to="/app/pro">{BRAND.name} Pro</Link> and redeem it there.
      </p>

      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(event) => void onFile(event)}
      />
      <RestoreSheet
        open={restore.open}
        backup={restore.backup}
        hasLocalData={hasLocalData}
        onClose={() => setRestore((current) => ({ ...current, open: false }))}
        onRestore={doRestore}
      />
      <ClearDataSheet
        open={clearing}
        onClose={() => setClearing(false)}
        hasPro={pro.license !== null}
        offerBackup={hasLocalData}
        onBackup={() => void saveBackup()}
        onClear={clearEverything}
      />
    </section>
  )
}
