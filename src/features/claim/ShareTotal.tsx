import { useEffect, useState } from 'react'
import { useT } from '../../i18n'
import { amountInWords } from '../../kit/amountWords'
import { money } from './claimView'
import styles from './ShareTotal.module.css'

export interface ShareTotalProps {
  share: number
  itemsPart: number
  currency: string
  /** The bill's items add up to nothing: the share can't be worked out. */
  unknown: boolean
  /** Who to ask when it can't be worked out. */
  organiser: string
}

/** How long the share must stay still before screen readers hear it. */
const ANNOUNCE_MS = 500

/**
 * "Your share ₹549.50 · Items ₹445 + tax & service ₹104.50" — sticky at the bottom of the
 * viewport while picking. Screen readers hear the new share once it stops changing.
 */
export function ShareTotal({ share, itemsPart, currency, unknown, organiser }: ShareTotalProps) {
  const t = useT()
  const extra = share - itemsPart
  const amount = money(share, currency)
  const label = extra < 0 ? t('claim.page.shareLabelDiscount', { amount }) : t('claim.page.shareLabel', { amount })
  const breakdown =
    extra > 0
      ? t('claim.page.breakdown', { items: money(itemsPart, currency), extra: money(extra, currency) })
      : extra < 0
        ? t('claim.page.breakdownDiscount', { items: money(itemsPart, currency), extra: money(-extra, currency) })
        : t('claim.page.breakdownExact', { items: money(itemsPart, currency) })
  const spoken = unknown ? t('claim.page.noShare', { name: organiser }) : `${label}. ${breakdown}`
  const [announced, setAnnounced] = useState(spoken)
  useEffect(() => {
    const timer = setTimeout(() => setAnnounced(spoken), ANNOUNCE_MS)
    return () => clearTimeout(timer)
  }, [spoken])
  const words = unknown ? null : amountInWords(share, currency)

  return (
    <section className={styles.card} aria-labelledby="claim-share-title">
      <div className={styles.row}>
        <h2 id="claim-share-title" className={styles.title}>
          {t('claim.page.yourShare')}
        </h2>
        {!unknown && (
          <p className={styles.amount} aria-label={label}>
            {amount}
          </p>
        )}
      </div>
      {unknown ? (
        <p className={styles.breakdown}>{t('claim.page.noShare', { name: organiser })}</p>
      ) : (
        <p className={styles.breakdown}>
          {breakdown}
          {words && share > 0 && <span className="visually-hidden">. {words}</span>}
        </p>
      )}
      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announced}
      </p>
    </section>
  )
}
