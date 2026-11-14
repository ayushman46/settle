import { ChevronRight, Gauge } from 'lucide-react'
import { navigate } from '../../app/router'
import { Card } from '../../components'
import { useT } from '../../i18n'
import { BAND_KEYS } from './bands'
import { Dial } from './Dial'
import { SCORE_PATH } from './paths'
import { useScore } from './useScore'
import styles from './Score.module.css'

/**
 * Your Settle Score on the You screen: a small dial with the number and its band, opening the
 * Score screen. A short line until there's enough history; nothing at all before the first split.
 */
export function ScoreCard() {
  const t = useT()
  const result = useScore()
  if (result.splits === 0) return null
  if (!result.ready) {
    return (
      <p className={styles.pending}>
        <Gauge aria-hidden="true" />
        {t('score.card.pending')}
      </p>
    )
  }
  const band = t(BAND_KEYS[result.band])
  return (
    <Card padding="none">
      <button type="button" className={styles.card} onClick={() => navigate(SCORE_PATH)} aria-label={t('score.card.aria', { score: result.score, band })}>
        <Dial score={result.score} band={result.band} size="sm" />
        <span className={styles.cardText}>
          <span className={styles.cardTitle}>{t('score.title')}</span>
          <span className={styles.cardBand} data-band={result.band}>
            {band}
          </span>
          <span className={styles.fine}>{t('score.card.hint')}</span>
        </span>
        <ChevronRight aria-hidden="true" className={styles.chevron} />
      </button>
    </Card>
  )
}
