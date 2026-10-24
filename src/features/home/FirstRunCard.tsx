import { Plus, ReceiptText } from 'lucide-react'
import { navigate } from '../../app/router'
import { Button, Illustration } from '../../components'
import { useT } from '../../i18n'
import { openBill } from '../bill/launch'
import { NEW_SPLIT_PATH } from './homeLinks'
import styles from './HomeScreen.module.css'

/** Home before anything's been split: an invitation, a first split, and the sample bill to play with. */
export function FirstRunCard() {
  const t = useT()
  return (
    <section className={styles.firstRun} aria-labelledby="home-first-run">
      <Illustration name="welcome-split" size={184} className={styles.firstRunArt} />
      <h2 id="home-first-run" className={styles.firstRunTitle}>
        {t('home.first.title')}
      </h2>
      <p className={styles.firstRunText}>
        {t('home.first.body')}
      </p>
      <div className={styles.firstRunActions}>
        <Button block iconStart={<Plus strokeWidth={2.5} />} onClick={() => navigate(NEW_SPLIT_PATH)}>
          {t('home.first.split')}
        </Button>
        <Button block variant="secondary" iconStart={<ReceiptText />} onClick={() => openBill({ kind: 'sample' })}>
          {t('home.first.sample')}
        </Button>
      </div>
    </section>
  )
}
