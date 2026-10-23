import { useId, type ReactNode, type Ref } from 'react'
import { PenLine, Sparkles, WifiOff } from 'lucide-react'
import { DESCRIBE_ERROR_MESSAGES } from '../../ai'
import { Banner, Button, type BannerTone } from '../../components'
import { useT, type MessageKey } from '../../i18n'
import type { IgnoreReason } from './sms/parseSms'
import type { SmsAi } from './useSmsAi'
import styles from './ShareInScreen.module.css'

interface NoticeCopy {
  tone: BannerTone
  title: MessageKey
  body: MessageKey
  /** The AI path's button, when it has one. */
  action: MessageKey | null
}

/** Tone and copy by reason (spec 02 §2.3). */
const NOTICES: Readonly<Record<IgnoreReason, NoticeCopy>> = {
  otp: { tone: 'error', title: 'sharein.ignored.otp.title', body: 'sharein.ignored.otp.body', action: null },
  promo: { tone: 'info', title: 'sharein.ignored.promo.title', body: 'sharein.ignored.promo.body', action: 'sharein.ignored.anyway.cta' },
  request: { tone: 'info', title: 'sharein.ignored.request.title', body: 'sharein.ignored.request.body', action: 'sharein.ignored.anyway.cta' },
  failed: { tone: 'warning', title: 'sharein.ignored.failed.title', body: 'sharein.ignored.failed.body', action: null },
  statement: { tone: 'info', title: 'sharein.ignored.statement.title', body: 'sharein.ignored.statement.body', action: 'sharein.ignored.now.cta' },
  mandate: { tone: 'info', title: 'sharein.ignored.mandate.title', body: 'sharein.ignored.mandate.body', action: null },
  balance: { tone: 'info', title: 'sharein.ignored.balance.title', body: 'sharein.ignored.balance.body', action: null },
  not_txn: { tone: 'info', title: 'sharein.ignored.notTxn.title', body: 'sharein.ignored.notTxn.body', action: 'sharein.ignored.anyway.cta' },
}

export interface IgnoredNoticeProps {
  reason: IgnoreReason
  /** Split it by hand (offered when the AI fails). */
  onByHand: () => void
  /** The notice's AI button (focused after a read). */
  ref?: Ref<HTMLButtonElement>
  ai: SmsAi
  /** What the AI reads when asked to split it anyway. */
  text: string
}

/** Why a message isn't split — and, for offers, requests, bills and the unreadable, a way to split it anyway. */
export function IgnoredNotice({ reason, ai, text, onByHand, ref }: IgnoredNoticeProps) {
  const t = useT()
  const copy = NOTICES[reason]
  const action = copy.action
  return (
    <div className={styles.result}>
      <Banner
        tone={copy.tone}
        title={t(copy.title)}
        actions={action ? <AiButton ref={ref} ai={ai} text={text} label={t(action)} variant="secondary" /> : undefined}
      >
        {t(copy.body)}
      </Banner>
      {action && <AiStatus ai={ai} onByHand={onByHand} />}
    </div>
  )
}

export interface UnknownNoticeProps {
  ai: SmsAi
  text: string
  onByHand: () => void
  ref?: Ref<HTMLButtonElement>
}

/** A message read but not for sure ("Your Uber trip cost ₹1,280"): the AI reads it, or split it by hand. */
export function UnknownNotice({ ai, text, onByHand, ref }: UnknownNoticeProps) {
  const t = useT()
  const titleId = useId()
  return (
    <section className={styles.unknown} aria-labelledby={titleId}>
      <span className={styles.unknownIcon} aria-hidden="true">
        <Sparkles />
      </span>
      <div className={styles.unknownText}>
        <h2 id={titleId} className={styles.unknownTitle}>
          {t('sharein.unknown.title')}
        </h2>
        <p className={styles.unknownBody}>{t('sharein.unknown.body')}</p>
      </div>
      <div className={styles.actions}>
        <AiButton ref={ref} ai={ai} text={text} label={t('sharein.ai.cta')} variant="primary" />
        <Button block variant="ghost" iconStart={<PenLine />} onClick={onByHand}>
          {t('sharein.hand.cta')}
        </Button>
      </div>
      <AiStatus ai={ai} onByHand={onByHand} />
    </section>
  )
}

interface AiButtonProps {
  ai: SmsAi
  text: string
  label: string
  variant: 'primary' | 'secondary'
  ref?: Ref<HTMLButtonElement>
}

function AiButton({ ai, text, label, variant, ref }: AiButtonProps) {
  const t = useT()
  const blocked = !ai.online || ai.off
  const quotaId = useId()
  const limited = Number.isFinite(ai.quota.limit)
  return (
    <span className={styles.aiButton}>
      <Button
        ref={ref}
        block={variant === 'primary'}
        size={variant === 'primary' ? 'lg' : 'sm'}
        variant={variant === 'primary' ? 'accent' : 'secondary'}
        iconStart={<Sparkles />}
        loading={ai.phase.kind === 'reading'}
        disabled={blocked}
        aria-describedby={quotaId}
        onClick={() => void ai.read(text)}
      >
        {label}
      </Button>
      <span id={quotaId} className={styles.quota}>
        {!ai.online ? (
          <>
            <WifiOff aria-hidden="true" className={styles.quotaIcon} />
            {t('sharein.ai.offline')}
          </>
        ) : ai.off ? null : limited ? (
          t('sharein.ai.quota', { n: ai.quota.remaining })
        ) : (
          t('sharein.ai.unlimited')
        )}
      </span>
    </span>
  )
}

/** "Reading your message…", or why the AI couldn't. */
function AiStatus({ ai, onByHand }: { ai: SmsAi; onByHand?: () => void }): ReactNode {
  const t = useT()
  if (ai.off) {
    return (
      <Banner tone="info" action={onByHand ? { label: t('sharein.hand.cta'), onAction: onByHand } : undefined}>
        {DESCRIBE_ERROR_MESSAGES.not_configured}
      </Banner>
    )
  }
  if (ai.phase.kind === 'reading') {
    return (
      <p className={styles.reading} role="status">
        <Sparkles aria-hidden="true" className={styles.readingSpark} />
        {t('sharein.ai.reading')}
      </p>
    )
  }
  if (ai.phase.kind === 'error') {
    return (
      <Banner tone="error" title={t('sharein.ai.error.title')} action={onByHand ? { label: t('sharein.hand.cta'), onAction: onByHand } : undefined}>
        {ai.phase.error.message}
      </Banner>
    )
  }
  return null
}
