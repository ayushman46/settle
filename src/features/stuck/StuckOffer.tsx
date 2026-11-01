import { useId, type ReactNode } from 'react'
import { CircleCheck, Landmark, Store } from 'lucide-react'
import { navigate } from '../../app/router'
import { Button, Card } from '../../components'
import { useStore } from '../../data'
import { stuckStore } from '../../data/stores'
import { isStuckOpen } from '../../data/stuck'
import { useT } from '../../i18n'
import type { StuckSignal } from './detect'
import { STUCK_PATH } from './paths'
import { openStuckAdd, prefillFromSignal } from './prefill'
import { useTickBack } from './useTickBack'
import styles from './Stuck.module.css'

/**
 * Under a message read elsewhere in Settle (a bank SMS pasted or shared in): when it's about stuck
 * money — a payment that failed or is pending, a refund a business has started, or money back for
 * something being tracked — the way into Stuck money. Nothing for anything else.
 */
export function StuckOffer({ signal }: { signal: StuckSignal }) {
  const t = useT()
  const anyOpen = useStore(stuckStore, (all) => all.some(isStuckOpen))
  const tickBack = useTickBack()
  if (signal.type === 'debit') return null

  if (signal.type === 'reversal' || signal.type === 'refund_credited') {
    if (!anyOpen) return null
    return (
      <Offer
        icon={<CircleCheck />}
        title={t('stuck.offer.back.title')}
        text={t('stuck.offer.back.text')}
        action={
          <Button
            block
            variant="secondary"
            onClick={() => {
              if (tickBack(signal)) navigate(STUCK_PATH)
            }}
          >
            {t('stuck.offer.back.cta')}
          </Button>
        }
      />
    )
  }

  const prefill = prefillFromSignal(signal, 'sms')
  if (!prefill) return null
  const refund = signal.type === 'refund_initiated'
  return (
    <Offer
      icon={refund ? <Store /> : <Landmark />}
      title={refund ? t('stuck.offer.refund.title') : t('stuck.offer.failed.title')}
      text={refund ? t('stuck.offer.refund.text') : t('stuck.offer.failed.text')}
      action={
        <Button block variant="secondary" onClick={() => openStuckAdd(prefill)}>
          {t('stuck.track.cta')}
        </Button>
      }
    />
  )
}

function Offer({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action: ReactNode }) {
  const titleId = useId()
  return (
    <Card className={styles.offer} role="region" aria-labelledby={titleId}>
      <div className={styles.offerHead}>
        <span className={styles.offerIcon} aria-hidden="true">
          {icon}
        </span>
        <div className={styles.offerText}>
          <h2 id={titleId} className={styles.offerTitle}>
            {title}
          </h2>
          <p className={styles.offerBody}>{text}</p>
        </div>
      </div>
      {action}
    </Card>
  )
}
