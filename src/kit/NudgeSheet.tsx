import { useId, useState } from 'react'
import { Copy, MessageCircle, MessageSquareText, Shuffle } from 'lucide-react'
import { ActionBar, BottomSheet, Button, SegmentedControl, useToast, type SegmentedOption } from '../components'
import { useProfile } from '../data'
import { shortDateLabel } from '../data/loans'
import { noteReminder } from '../data/reminders'
import type { Friend, Minor } from '../domain/types'
import { useT } from '../i18n'
import { cx } from '../lib/cx'
import { haptic } from '../lib/haptics'
import { formatMoney } from '../lib/money'
import { copyText } from '../lib/share'
import { normalizePhone, NUDGE_TONES, nudgeText, nudgeVariantCount, smsUrl, whatsappUrl, type NudgeTone } from '../share'
import { firstName } from '../share/text'
import { friendLabel } from './friendName'
import styles from './NudgeSheet.module.css'

export type NudgeChannel = 'whatsapp' | 'sms' | 'copy'

export interface NudgeSheetProps {
  open: boolean
  onClose: () => void
  /** Who owes you. Null (removed) still gets a message to copy or send. */
  friend: Friend | null
  /** What they owe, in minor units. */
  amount: Minor
  currency: string
  /** What it was for ("Dinner at Toit", "Goa 2026"). */
  title: string
  /** A pay link to add at the end, when there is one. */
  link: string | null
  /** After the message went to WhatsApp / SMS or was copied (e.g. to note it). */
  onSent?: (channel: NudgeChannel) => void
  /** 'loan': money you lent them — the udhaar wordings ("the ₹500 I lent you"). */
  kind?: 'loan'
  /** The loan's date (YYYY-MM-DD), for wordings that mention it ("the ₹500 from 21 Oct"). */
  date?: string | null
  /** The tone it opens on (default friendly), e.g. the next step after earlier reminders. */
  initialTone?: NudgeTone
}

// The emoji sits inside the label (one unbreakable line) and steps aside on 320px phones.
function toneOptions(): ReadonlyArray<SegmentedOption<NudgeTone>> {
  return NUDGE_TONES.map((option) => ({
    value: option.tone,
    label: (
      <span className={styles.tone}>
        <span className={styles.toneEmoji} aria-hidden="true">
          {option.emoji}
        </span>
        {option.label}
      </span>
    ),
    'aria-label': option.label,
  }))
}

/**
 * A friendly reminder for someone who owes you: pick a tone (friendly, funny, firm), see the
 * exact message, shuffle the wording, then send it on WhatsApp or SMS — straight to their chat
 * when you have their number — or copy it. The message carries your UPI ID and the pay link.
 */
export function NudgeSheet({ open, onClose, friend, amount, currency, title, link, onSent, kind, date, initialTone = 'friendly' }: NudgeSheetProps) {
  const t = useT()
  const previewId = useId()
  const toast = useToast()
  const profile = useProfile()
  const [tone, setTone] = useState<NudgeTone>(initialTone)
  // "Try another" moves off the wording picked for these inputs — for this person and tone only.
  const wordingKey = `${friend?.id ?? ''}\u0000${tone}`
  const [shuffled, setShuffled] = useState<{ key: string; variant: number } | null>(null)
  const variant = shuffled !== null && shuffled.key === wordingKey ? shuffled.variant : null

  const name = friendLabel(friend?.id ?? null, friend)
  const first = firstName(name)
  const input = {
    tone,
    // Someone who was removed is greeted "Hey there" rather than "Hey Someone".
    toName: friend ? name : '',
    amount,
    currency,
    title,
    // You send it, so it reads in the first person ("My UPI: …").
    payeeName: '',
    payeeUpi: profile.upiId,
    link,
    kind,
    date: kind === 'loan' && date ? shortDateLabel(date) : null,
  }
  const count = nudgeVariantCount(tone, input.kind, input.date)
  const natural = nudgeText(input)
  const current = variant ?? Math.max(0, Array.from({ length: count }, (_, i) => nudgeText({ ...input, variant: i })).indexOf(natural))
  const text = variant === null ? natural : nudgeText({ ...input, variant })
  const phone = normalizePhone(friend?.phone)

  const another = (): void => {
    haptic('tap')
    setShuffled({ key: wordingKey, variant: (current + 1) % count })
  }

  const sent = (channel: NudgeChannel): void => {
    haptic('success')
    // Remembered, so the next reminder can say when you last asked (and in what tone).
    if (friend) noteReminder(friend.id, tone)
    onSent?.(channel)
  }

  const copy = async (): Promise<void> => {
    if (await copyText(text)) {
      sent('copy')
      toast(t('kit.nudge.copied.toast'), { tone: 'success' })
    } else {
      haptic('error')
      toast(t('kit.nudge.copyFailed.toast'), { tone: 'error' })
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      eyebrow={t('kit.nudge.eyebrow', { amount: formatMoney(amount, currency, { trimZeros: true }), title })}
      title={t('kit.nudge.title', { name: first })}
      description={t('kit.nudge.description')}
      footer={
        <ActionBar>
          <a
            className={cx(styles.send, styles.primary)}
            href={whatsappUrl(text, friend?.phone)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => sent('whatsapp')}
          >
            <MessageCircle aria-hidden="true" strokeWidth={2.25} />
            {t('kit.nudge.whatsapp.cta')}
          </a>
          <div className={styles.more}>
            <a className={cx(styles.send, styles.secondary)} href={smsUrl(text, friend?.phone)} onClick={() => sent('sms')}>
              <MessageSquareText aria-hidden="true" strokeWidth={2.25} />
              {t('kit.nudge.sms.cta')}
            </a>
            <Button variant="secondary" size="md" iconStart={<Copy />} onClick={copy}>
              {t('kit.nudge.copy.cta')}
            </Button>
          </div>
        </ActionBar>
      }
    >
      <div className={styles.body}>
        <SegmentedControl options={toneOptions()} value={tone} onChange={setTone} ariaLabel={t('kit.nudge.tone.aria')} />

        <figure className={styles.preview} aria-labelledby={previewId}>
          <figcaption id={previewId} className={styles.previewLabel}>
            {t('kit.nudge.preview', { name: first })}
          </figcaption>
          <p className={styles.bubble} aria-live="polite">
            {/* Keyed so each new wording pops in. */}
            <span key={text} className={styles.message}>
              <MessageText text={text} link={link} />
            </span>
          </p>
        </figure>

        <div className={styles.tools}>
          {count > 1 && (
            <Button variant="ghost" size="sm" iconStart={<Shuffle />} onClick={another}>
              {t('kit.nudge.another.cta')}
            </Button>
          )}
          <p className={styles.phone}>
            {phone ? t('kit.nudge.phone', { name: first }) : t('kit.nudge.noPhone', { name: first })}
          </p>
        </div>
      </div>
    </BottomSheet>
  )
}

/** The message with its pay link kept to one quiet line (it's long; it's sent in full). */
function MessageText({ text, link }: { text: string; link: string | null }) {
  const at = link ? text.lastIndexOf(link) : -1
  if (!link || at === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <span className={styles.link}>{link}</span>
      {text.slice(at + link.length)}
    </>
  )
}
