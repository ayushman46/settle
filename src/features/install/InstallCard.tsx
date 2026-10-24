import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '../../components'
import { useT } from '../../i18n'
import { useHasData } from '../../data'
import { INSTALL_ENABLED } from './enabled'
import { InstallSheet } from './InstallSheet'
import { dismissed, showInstallCard, type InstallMemory } from './installState'
import { noteSessionVisit, writeMemory } from './installMemory'
import { useInstall } from './useInstall'
import styles from './Install.module.css'

/**
 * Home's "Install Settle" card: after the first split or a second visit, never on first paint.
 * Android and desktop Chrome get the browser's own install dialog; iPhone gets the two steps.
 */
export function InstallCard() {
  const t = useT()
  const hasData = useHasData()
  const install = useInstall()
  // Counts this browser session once; the memory read here already includes it.
  const [memory, setMemory] = useState<InstallMemory>(noteSessionVisit)
  const [now] = useState(() => Date.now())
  const [sheet, setSheet] = useState(false)

  if (!INSTALL_ENABLED) return null
  const show = showInstallCard({
    standalone: install.standalone,
    platform: install.platform,
    canPrompt: install.canPrompt,
    memory,
    splits: hasData ? 1 : 0,
    now,
  })
  if (!show) return null

  const later = () => {
    const next = dismissed(memory, Date.now())
    writeMemory(next)
    setMemory(next)
  }
  const ios = install.platform === 'ios' && !install.canPrompt
  const onInstall = () => {
    if (ios) setSheet(true)
    else void install.install()
  }

  return (
    <section className={styles.card} aria-labelledby="install-card-title">
      <span className={styles.cardIcon} aria-hidden="true">
        <Download strokeWidth={2.25} />
      </span>
      <div className={styles.cardBody}>
        <h2 id="install-card-title" className={styles.cardTitle}>
          {t('install.card.title')}
        </h2>
        <p className={styles.cardText}>{t('install.card.body')}</p>
        <div className={styles.cardActions}>
          <Button size="sm" onClick={onInstall}>
            {ios ? t('install.card.howto') : t('install.card.install')}
          </Button>
          <Button size="sm" variant="ghost" onClick={later}>
            {t('install.card.later')}
          </Button>
        </div>
      </div>
      <InstallSheet open={sheet} onClose={() => setSheet(false)} />
    </section>
  )
}
