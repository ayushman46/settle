import { useRef, useState, type ChangeEvent } from 'react'
import { DatabaseBackup } from 'lucide-react'
import { navigate } from '../../app/router'
import { Button, useToast } from '../../components'
import { importBackup, profileStore, updateProfile } from '../../data'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { READ_BACKUP_ERRORS, readBackupFile } from '../you/backupFiles'

/**
 * "Moving phones? Restore a backup" on the first-run screen: a new phone, another browser, or the
 * Android app after using Settle in Chrome (each keeps its own data) starts with everything back.
 */
export function RestoreBackup() {
  const t = useT()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null
    event.currentTarget.value = ''
    if (!file) return
    setBusy(true)
    const result = await readBackupFile(file)
    setBusy(false)
    if (!result.ok) {
      toast(READ_BACKUP_ERRORS[result.reason], { tone: 'error' })
      return
    }
    // Nothing is here yet on a first run, so the backup simply becomes this phone's data.
    importBackup(result.backup, 'replace')
    if (!profileStore.get().onboarded) updateProfile({ onboarded: true })
    haptic('success')
    toast(t('onboarding.restore.done'), { tone: 'success' })
    navigate('/app', { replace: true })
  }

  return (
    <>
      <Button variant="ghost" block iconStart={<DatabaseBackup />} disabled={busy} onClick={() => input.current?.click()}>
        {t('onboarding.restore.cta')}
      </Button>
      <input ref={input} type="file" accept=".json,application/json" hidden onChange={(e) => void onFile(e)} aria-label={t('onboarding.restore.cta')} />
    </>
  )
}
