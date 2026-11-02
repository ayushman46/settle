import { useRef, useState, type ChangeEvent } from 'react'
import { DatabaseBackup, Download, FileSpreadsheet, Trash2 } from 'lucide-react'
import { t, tx, useT } from '../../i18n'
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
  usePools,
  useRecurring,
  useStore,
  type BackupFile,
} from '../../data'
import { stuckStore } from '../../data/stores'
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
  lastSavedLine,
  readBackupError,
  readBackupFile,
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
  if (mode === 'replace') return t('you.data.restored')
  const parts = [
    result.added > 0 && t('you.data.merged.added', { count: result.added }),
    result.updated > 0 && t('you.data.merged.updated', { count: result.updated }),
  ].filter(Boolean)
  return parts.length > 0 ? t('you.data.merged', { parts: parts.join(', ') }) : t('you.data.merged.none')
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
  const pools = usePools()
  const hasStuck = useStore(stuckStore, (list) => list.length > 0)
  const hasExpensesOrGroups = useHasData()
  const pro = usePro()
  const csvUnlocked = useHasFeature('export')
  const lastBackup = useLastBackupAt()
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'backup' | 'csv' | 'read' | null>(null)
  const [restore, setRestore] = useState<{ open: boolean; backup: BackupFile | null }>({ open: false, backup: null })
  const [clearing, setClearing] = useState(false)

  // People, recurring splits, collections and stuck money count too: a "replace" would remove them.
  const hasLocalData = hasExpensesOrGroups || friends.length > 1 || recurring.length > 0 || pools.length > 0 || hasStuck

  const saveBackup = async (): Promise<void> => {
    if (busy) return
    setBusy('backup')
    const outcome = await shareFile(backupBlob(exportBackup()), backupFilename(), undefined, { title: t('you.data.backup.shareTitle', { brand: BRAND.name }) })
    setBusy(null)
    if (outcome === 'shared' || outcome === 'downloaded') {
      setLastBackupAt(Date.now())
      haptic('success')
      toast(outcome === 'shared' ? t('you.data.shared') : t('you.data.saved'), { tone: 'success' })
    } else if (outcome === 'failed') {
      toast(t('you.data.saveFailed'), { tone: 'error' })
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
      toast(readBackupError(result.reason), { tone: 'error' })
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
        label: t('you.data.undo'),
        onAction: () => {
          importBackup(before, 'replace')
          toast(t('you.data.undone'))
        },
      },
    })
  }

  const exportCsv = async (): Promise<void> => {
    if (busy) return
    setBusy('csv')
    const groupsById = Object.fromEntries(groups.map((g) => [g.id, g]))
    const outcome = await shareFile(csvBlob(expenses, friendsById, groupsById), csvFilename(), undefined, {
      title: t('you.data.csv.shareTitle', { brand: BRAND.name }),
    })
    setBusy(null)
    if (outcome === 'shared' || outcome === 'downloaded') {
      const count = expenses.length
      toast(outcome === 'shared' ? t('you.data.csv.shared', { count }) : t('you.data.csv.saved', { count }), { tone: 'success' })
    } else if (outcome === 'failed') {
      toast(t('you.data.exportFailed'), { tone: 'error' })
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
    toast(removePro ? t('you.data.cleared.pro') : t('you.data.cleared'), {
      action: {
        label: t('you.data.undo'),
        onAction: () => {
          importBackup(snapshot, 'replace')
          setLastBackupAt(savedAt)
          if (token) void redeemLicense(token)
          navigate(YOU_PATH, { replace: true })
          toast(t('you.data.back'), { tone: 'success' })
        },
      },
    })
    navigate(WELCOME_PATH, { replace: true })
  }

  const backupLine = lastBackup
    ? lastSavedLine(lastBackup)
    : hasLocalData
      ? t('you.data.notBacked')
      : t('you.data.keepCopy')

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
      <p className={styles.footnote}>{tx('you.data.footnote', { brand: BRAND.name }, { link: (chunk) => <Link to="/app/pro">{chunk}</Link> })}</p>

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
