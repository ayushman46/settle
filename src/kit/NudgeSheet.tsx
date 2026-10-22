import { useId, useState } from 'react'
import { Copy, MessageCircle, MessageSquareText, Shuffle } from 'lucide-react'
import { ActionBar, BottomSheet, Button, SegmentedControl, useToast, type SegmentedOption } from '../components'
import { useProfile } from '../data'
import type { Friend, Minor } from '../domain/types'
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
}

// The emoji sits inside the label (one unbreakable line) and steps aside on 320px phones.
const TONE_OPTIONS: ReadonlyArray<SegmentedOption<NudgeTone>> = NUDGE_TONES.map((t) => ({
  value: t.tone,
  label: (
    <span className={styles.tone}>
      <span className={styles.toneEmoji} aria-hidden="true">
        {t.emoji}
      </span>
      {t.label}
    </span>
  ),
  'aria-label': t.label,
}))

/**
 * A friendly reminder for someone who owes you: pick a tone (friendly, funny, firm), see the
 * exact message, shuffle the wording, then send it on WhatsApp or SMS — straight to their chat
 * when you have their number — or copy it. The message carries your UPI ID and the pay link.
 */
export function NudgeSheet({ open, onClose, friend, amount, currency, title, link, onSent }: NudgeSheetProps) {
  const previewId = useId()
  const toast = useToast()
  const profile = useProfile()
  const [tone, setTone] = useState<NudgeTone>('friendly')
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
  }
  const count = nudgeVariantCount(tone)
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
    onSent?.(channel)
  }

  const copy = async (): Promise<void> => {
    if (await copyText(text)) {
      sent('copy')
      toast('Reminder copied', { tone: 'success' })
    } else {
      haptic('error')
      toast('Couldn’t copy. Long-press the message instead.', { tone: 'error' })
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      eyebrow={`${formatMoney(amount, currency, { trimZeros: true })} for ${title}`}
      title={`Nudge ${first}`}
      description="Pick a tone. They’ll get exactly this."
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
            Send on WhatsApp
          </a>
          <div className={styles.more}>
            <a className={cx(styles.send, styles.secondary)} href={smsUrl(text, friend?.phone)} onClick={() => sent('sms')}>
              <MessageSquareText aria-hidden="true" strokeWidth={2.25} />
              Text message
            </a>
            <Button variant="secondary" size="md" iconStart={<Copy />} onClick={copy}>
              Copy
            </Button>
          </div>
        </ActionBar>
      }
    >
      <div className={styles.body}>
        <SegmentedControl options={TONE_OPTIONS} value={tone} onChange={setTone} ariaLabel="Tone" />

        <figure className={styles.preview} aria-labelledby={previewId}>
          <figcaption id={previewId} className={styles.previewLabel}>
            Message to {first}
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
              Try another
            </Button>
          )}
          <p className={styles.phone}>
            {phone ? `Opens your chat with ${first}.` : `No number saved for ${first}, so you’ll pick the chat.`}
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
