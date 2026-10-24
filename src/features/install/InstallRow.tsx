import { useState } from 'react'
import { Download } from 'lucide-react'
import { useT } from '../../i18n'
import { INSTALL_ENABLED } from './enabled'
import { InstallSheet } from './InstallSheet'
import { showInstallRow } from './installState'
import { useInstall } from './useInstall'
import styles from './Install.module.css'

/** For You → Shortcuts: "Install the app". Hidden once installed or where installing isn't possible. */
export function InstallRow() {
  const t = useT()
  const install = useInstall()
  const [sheet, setSheet] = useState(false)
  if (!INSTALL_ENABLED || !showInstallRow(install)) return null
  const ios = install.platform === 'ios' && !install.canPrompt
  return (
    <>
      <button type="button" className={styles.row} onClick={() => (ios ? setSheet(true) : void install.install())}>
        <span className={styles.cardIcon} aria-hidden="true">
          <Download strokeWidth={2.25} />
        </span>
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>{t('install.row.title')}</span>
          <span className={styles.rowSub}>{t('install.row.subtitle')}</span>
        </span>
      </button>
      <InstallSheet open={sheet} onClose={() => setSheet(false)} />
    </>
  )
}
