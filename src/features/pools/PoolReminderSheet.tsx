import { useId, useState } from 'react'
import { Copy, MessageCircle, MessageSquareText } from 'lucide-react'
import { ActionBar, BottomSheet, Button, SegmentedControl, useToast, type SegmentedOption } from '../../components'
import type { Minor, Pool } from '../../domain/types'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { copyText } from '../../lib/share'
import { smsUrl, whatsappUrl } from '../../share/links'
import { NUDGE_TONES, type NudgeTone } from '../../share/nudge'
import { poolReminderText, poolRemindAllText } from '../../share/poolNudge'
import { giftRecipient } from './poolTemplates'
import styles from './PoolReminderSheet.module.css'

export type PoolReminderTarget =
  | { kind: 'one'; name: string; phone: string | null; amount: Minor | null }
  | { kind: 'all'; names: string[] }

export interface PoolReminderSheetProps {
  open: boolean
  onClose: () => void
  pool: Pool
  target: PoolReminderTarget | null
  inCount: number
  expected: number | null
  link: string | null
}

const TONES: ReadonlyArray<SegmentedOption<NudgeTone>> = NUDGE_TONES.map((tone) => ({
  value: tone.tone,
  label: (
    <span className={styles.tone}>
      <span aria-hidden="true">{tone.emoji}</span>
      {tone.label}
    </span>
  ),
  'aria-label': tone.label,
}))

/**
 * A reminder for one person (friendly, funny or firm) or one message for the group with everyone
 * still to chip in — the exact text, then WhatsApp (their chat when you have their number), SMS or Copy.
 */
export function PoolReminderSheet({ open, onClose, pool, target, inCount, expected, link }: PoolReminderSheetProps) {
  const t = useT()
  const toast = useToast()
  const previewId = useId()
  const [tone, setTone] = useState<NudgeTone>('friendly')
  if (!target) return null
  const one = target.kind === 'one'
  const text = one
    ? poolReminderText({
        tone,
        toName: target.name,
        amount: target.amount,
        currency: pool.currency,
        title: pool.title,
        emoji: pool.emoji,
        forName: giftRecipient(pool.occasion, pool.title),
        inCount,
        expected,
        deadline: pool.deadline,
        link,
      })
    : poolRemindAllText({ title: pool.title, emoji: pool.emoji, names: target.names, inCount, expected, link })
  const phone = one ? target.phone : null

  const copy = async (): Promise<void> => {
    if (await copyText(text)) {
      haptic('success')
      toast(t('pools.remind.copied'), { tone: 'success' })
    } else {
      haptic('error')
      toast(t('pools.remind.copyFailed'), { tone: 'error' })
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      eyebrow={pool.title}
      title={one ? t('pools.remind.title', { name: target.name }) : t('pools.remind.allTitle')}
      description={one ? t('pools.remind.description') : t('pools.remind.allDescription')}
      footer={
        <ActionBar>
          <a
            className={cx(styles.send, styles.primary)}
            href={whatsappUrl(text, phone)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => haptic('success')}
          >
            <MessageCircle aria-hidden="true" strokeWidth={2.25} />
            {t('pools.remind.whatsapp')}
          </a>
          <div className={styles.more}>
            <a className={cx(styles.send, styles.secondary)} href={smsUrl(text, phone)} onClick={() => haptic('success')}>
              <MessageSquareText aria-hidden="true" strokeWidth={2.25} />
              {t('pools.remind.sms')}
            </a>
            <Button variant="secondary" size="md" iconStart={<Copy />} onClick={copy}>
              {t('pools.remind.copy')}
            </Button>
          </div>
        </ActionBar>
      }
    >
      <div className={styles.body}>
        {one && <SegmentedControl options={TONES} value={tone} onChange={setTone} ariaLabel={t('pools.remind.tone')} />}
        <figure className={styles.preview} aria-labelledby={previewId}>
          <figcaption id={previewId} className={styles.previewLabel}>
            {t('pools.remind.preview')}
          </figcaption>
          <p className={styles.bubble} aria-live="polite" data-testid="pool-reminder-text">
            {text}
          </p>
        </figure>
      </div>
    </BottomSheet>
  )
}
