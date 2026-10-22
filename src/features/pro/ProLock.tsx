import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { Badge, Button } from '../../components'
import { BRAND, type ProFeature } from '../../domain/types'
import { cx } from '../../lib/cx'
import { FALLBACK_BILLING_CONFIG, useBillingConfig, usePro } from '../../pro'
import { openPaywall } from './paywall'
import { PaywallHost } from './PaywallSheet'
import { featurePitch } from './perks'
import { cheapestPrice, passDate } from './plans'
import styles from './ProLock.module.css'

export interface ProLockProps {
  feature: ProFeature
  /** A decorative sketch of what's behind the lock, shown softly blurred (hidden from assistive tech). */
  preview?: ReactNode
  /** An extra line about the person's own data, e.g. "You've split 14 expenses so far." */
  note?: ReactNode
  /** Runs once Pro is unlocked from the paywall (the screen usually just re-renders unlocked). */
  onUnlock?: () => void
  className?: string
}

/**
 * A Pro feature's locked state: what it does, one clear "Unlock" that opens the paywall, and the
 * starting price — no countdowns, no fake scarcity. Says so when a pass has run out.
 */
export function ProLock({ feature, preview, note, onUnlock, className }: ProLockProps) {
  const pro = usePro()
  const config = useBillingConfig()
  const pitch = featurePitch(feature, (config ?? FALLBACK_BILLING_CONFIG).proAiPerDay)
  const from = cheapestPrice(config)
  const ended = pro.status === 'expired' && pro.expiresAt !== null

  return (
    <div className={cx(styles.lock, preview != null && styles.withPreview, className)}>
      {preview != null && (
        <div className={styles.preview} aria-hidden="true" inert>
          {preview}
        </div>
      )}
      <section className={styles.panel} aria-labelledby={`pro-lock-${feature}`}>
        <span className={styles.badges}>
          <span className={styles.lockIcon} aria-hidden="true">
            <Lock strokeWidth={2.25} />
          </span>
          <Badge tone="pro">{BRAND.name} Pro</Badge>
        </span>
        <h2 id={`pro-lock-${feature}`} className={styles.title}>
          {pitch.title}
        </h2>
        <p className={styles.text}>{pitch.text}</p>
        {ended && pro.expiresAt !== null && (
          <p className={styles.ended}>Your Pro pass ended on {passDate(pro.expiresAt)}.</p>
        )}
        {note != null && <p className={styles.note}>{note}</p>}
        <Button block onClick={() => openPaywall(feature, onUnlock ? { onUnlock } : {})}>
          {ended ? 'Renew Pro' : pitch.unlock}
        </Button>
        {from && <p className={styles.price}>Pro from {from} · one-time payment, nothing renews</p>}
      </section>
      <PaywallHost />
    </div>
  )
}
