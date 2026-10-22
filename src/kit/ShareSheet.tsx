import { useEffect, useId, useMemo, useState } from 'react'
import { Copy, FileText, Image as ImageIcon, Link2, MessageCircle, Share2, Sparkles } from 'lucide-react'
import {
  Badge,
  BottomSheet,
  Button,
  QuickAction,
  QuickActionGrid,
  Skeleton,
  useToast,
} from '../components'
import { updateFriend, useFriendsById, useGroup, useProfile } from '../data'
import { BRAND, ME_ID, type AccentId, type Expense } from '../domain/types'
import { isSettledInGroup } from '../engine/balances'
import { haptic } from '../lib/haptics'
import { useHasFeature } from '../pro'
import {
  copyText,
  payLinkMessage,
  payLinkProgress,
  renderShareCard,
  shareCardFilename,
  shareCardInputFromExpense,
  shareFile,
  shareResult,
  summaryText,
  whatsappUrl,
  type ShareCardInput,
} from '../share'
import { firstName } from '../share/text'
import { friendLabel } from './friendName'
import { DARK_SCHEME, TOUCH_FIRST, useMediaQuery } from './media'
import { UpiIdForm } from './UpiIdForm'
import { usePayLink } from './usePayLink'
import styles from './ShareSheet.module.css'

export interface ShareSheetProps {
  expense: Expense
  open: boolean
  onClose: () => void
  /** Opens the Pro upsell from the card's footer note (shown on the free plan only). */
  onUpgrade?: () => void
}

type CardState = { key: string; status: 'ready'; blob: Blob; preview: string | null } | { key: string; status: 'failed' }

interface CardOptions {
  watermark: boolean
  theme: 'light' | 'dark'
  accent: AccentId
}

/**
 * The share-card image, drawn as soon as the sheet opens — not on tap, or the browser may refuse
 * the share sheet for a tap that's too old. Kept while the content is the same. Null while drawing.
 */
function useShareCard(open: boolean, input: ShareCardInput, opts: CardOptions): CardState | null {
  const key = JSON.stringify([input, opts])
  const [state, setState] = useState<CardState | null>(null)
  const current = state?.key === key ? state : null

  useEffect(() => {
    if (!open || current) return
    let live = true
    renderShareCard(input, opts).then(
      (blob) => {
        if (!live) return
        let preview: string | null = null
        try {
          preview = URL.createObjectURL(blob)
        } catch {
          // No previews in this browser; the image can still be shared.
        }
        setState({ key, status: 'ready', blob, preview })
      },
      () => {
        if (live) setState({ key, status: 'failed' })
      },
    )
    return () => {
      live = false
    }
  }, [open, key, current, input, opts])

  // Each preview URL lives exactly as long as its state.
  useEffect(() => {
    const preview = state?.status === 'ready' ? state.preview : null
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [state])

  return current
}

/**
 * Everything that gets a split out to the group: one pay link (friends tap their name and pay by
 * UPI), sent on WhatsApp or any app, copied, or as a full text summary — and a receipt-style
 * image of the split (clean on Pro, with a small "Made with Settle" line on the free plan).
 * When whoever's collecting has no UPI ID yet, it offers to add one first. Group expenses settle
 * through the group's balances, so they're shared for the record, without a pay link (paying
 * from one would count the money twice).
 */
export function ShareSheet({ expense, open, onClose, onUpgrade }: ShareSheetProps) {
  const imageHeadingId = useId()
  const toast = useToast()
  const profile = useProfile()
  const friendsById = useFriendsById()
  const group = useGroup(expense.groupId)
  const cleanCards = useHasFeature('clean_cards')
  const themes = useHasFeature('themes')
  const systemDark = useMediaQuery(DARK_SCHEME)
  const touch = useMediaQuery(TOUCH_FIRST)
  const [addingUpi, setAddingUpi] = useState(false)

  const settlesIn = group !== null && isSettledInGroup(expense, [group]) ? group : null
  const { payload, link } = usePayLink(expense, { enabled: open && settlesIn === null })
  const cardInput = useMemo(() => shareCardInputFromExpense(expense, friendsById, profile), [expense, friendsById, profile])
  const theme = profile.theme === 'system' ? (systemDark ? 'dark' : 'light') : profile.theme
  const cardOpts = useMemo<CardOptions>(
    () => ({ watermark: !cleanCards, theme, accent: themes ? profile.accent : 'lime' }),
    [cleanCards, theme, themes, profile.accent],
  )
  const card = useShareCard(open, cardInput, cardOpts)

  const fromPayee = expense.payerId === ME_ID
  const payer = friendsById[expense.payerId] ?? null
  const payerFirst = firstName(friendLabel(expense.payerId, payer))
  const owing = settlesIn === null && payLinkProgress(payload).outstanding > 0
  const rupees = payload.c === 'INR'
  const upiMissing = owing && rupees && payload.to.u === null
  // For the record only: no UPI ID and no link, so the text never asks anyone to pay.
  const record = useMemo(() => summaryText({ ...payload, to: { ...payload.to, u: null } }), [payload])
  const summary = settlesIn ? record : link ? summaryText(payload, link) : null
  const message = settlesIn ? record : link ? payLinkMessage(payload, link, { fromPayee }) : null

  const description = settlesIn
    ? `It settles with ${settlesIn.name}, so friends pay from the group’s settle up. Share it for the record.`
    : !owing
    ? 'Everyone’s settled. Share it for the record.'
    : payload.to.u && rupees
      ? fromPayee
        ? 'Friends tap their name and pay you with any UPI app.'
        : `Friends tap their name and pay ${payerFirst} with any UPI app.`
      : 'Friends tap their name to see what they owe.'

  const done = (text: string) => {
    haptic('success')
    toast(text, { tone: 'success' })
  }
  const oops = (text: string) => {
    haptic('error')
    toast(text, { tone: 'error' })
  }

  const sendWhatsApp = async (): Promise<void> => {
    if (!message) return
    const win = window.open(whatsappUrl(message), '_blank')
    if (win) {
      win.opener = null
      haptic('success')
    } else if (await copyText(message)) {
      // A blocked popup: hand over the message to paste instead.
      done('Message copied. Paste it in WhatsApp.')
    } else {
      oops('Couldn’t open WhatsApp. Try “More apps”.')
    }
  }

  const shareElsewhere = async (): Promise<void> => {
    if (!message) return
    const outcome = await shareResult(message, { mode: 'share', title: expense.title })
    if (outcome === 'shared') haptic('success')
    else if (outcome === 'copied') done('Message copied')
    else if (outcome === 'failed') oops('Couldn’t share. Try copying the link.')
  }

  const copyLink = async (): Promise<void> => {
    if (!link) return
    if (await copyText(link)) done('Pay link copied')
    else oops('Couldn’t copy. Try “More apps”.')
  }

  const copySummary = async (): Promise<void> => {
    if (!summary) return
    if (await copyText(summary)) done('Summary copied')
    else oops('Couldn’t copy the summary.')
  }

  const shareImage = async (): Promise<void> => {
    if (card?.status !== 'ready') return
    // With the pay link along as the caption, where the app takes one (WhatsApp does).
    const caption = settlesIn ? undefined : (message ?? undefined)
    const outcome = await shareFile(card.blob, shareCardFilename(expense.title), caption, { title: expense.title })
    if (outcome === 'shared') haptic('success')
    else if (outcome === 'downloaded') done('Image saved')
    else if (outcome === 'failed') oops('Couldn’t share the image.')
  }

  const saveUpi = (upiId: string): void => {
    try {
      updateFriend(expense.payerId, { upiId })
      setAddingUpi(false)
      done('UPI ID saved')
    } catch {
      oops('Couldn’t save it. Try again.')
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} eyebrow={expense.title} title="Share split" description={description} size="tall">
      <div className={styles.body}>
        {upiMissing && (payer || fromPayee) && (
          <section className={styles.upi} aria-label="UPI ID">
            {addingUpi ? (
              <UpiIdForm
                ownerId={expense.payerId}
                ownerName={friendLabel(expense.payerId, payer)}
                onSave={saveUpi}
                autoFocus
                lead={fromPayee ? 'Add your UPI ID so friends can pay you in a tap.' : `Add a UPI ID for ${payerFirst} so friends can pay from the link.`}
              />
            ) : (
              <>
                <p className={styles.upiText}>
                  {fromPayee
                    ? 'Add your UPI ID and friends can pay you straight from the link.'
                    : `${payerFirst} has no UPI ID here yet, so friends can see their share but not pay from the link.`}
                </p>
                <Button size="sm" variant="primary" onClick={() => setAddingUpi(true)}>
                  Add UPI ID
                </Button>
              </>
            )}
          </section>
        )}

        {settlesIn === null && (
          <div className={styles.link} aria-live="polite">
            <Link2 aria-hidden="true" className={styles.linkIcon} strokeWidth={2.25} />
            {link ? (
              <span className={styles.linkText}>{link.replace(/^https?:\/\//, '')}</span>
            ) : (
              <span className={styles.linkPending}>
                <span className="visually-hidden">Making the pay link…</span>
                <Skeleton width="70%" />
              </span>
            )}
          </div>
        )}

        <QuickActionGrid label={settlesIn ? 'Share the split' : 'Share the pay link'} className={styles.actions}>
          <QuickAction tone="groceries" icon={<MessageCircle />} label="WhatsApp" onClick={sendWhatsApp} disabled={!message} />
          <QuickAction tone="travel" icon={<Share2 />} label="More apps" onClick={shareElsewhere} disabled={!message} />
          {settlesIn === null && <QuickAction tone="ink" icon={<Copy />} label="Copy link" onClick={copyLink} disabled={!link} />}
          <QuickAction tone="entertainment" icon={<FileText />} label="Copy text" onClick={copySummary} disabled={!summary} />
        </QuickActionGrid>

        <section className={styles.image} aria-labelledby={imageHeadingId}>
          <div className={styles.preview}>
            {card?.status === 'ready' && card.preview ? (
              <img src={card.preview} alt={`Share card for ${expense.title}`} className={styles.previewImage} />
            ) : card?.status === 'failed' ? (
              <span className={styles.previewFailed}>No preview</span>
            ) : (
              <Skeleton shape="md" width="100%" height="100%" />
            )}
          </div>
          <div className={styles.imageText}>
            <h3 id={imageHeadingId} className={styles.imageTitle}>
              Share as image
            </h3>
            <p className={styles.imageSub} aria-live="polite">
              {card === null
                ? 'Drawing your receipt…'
                : card.status === 'failed'
                  ? 'This browser couldn’t draw the image. The link works everywhere.'
                  : cleanCards
                    ? 'A clean receipt of the split for the group chat.'
                    : `A receipt of the split, with a small “Made with ${BRAND.name}” line.`}
            </p>
            {/* Phones hand the image to the share sheet; computers download it. */}
            <Button
              size="sm"
              variant="secondary"
              iconStart={<ImageIcon />}
              onClick={shareImage}
              disabled={card?.status !== 'ready'}
            >
              {touch ? 'Share image' : 'Save image'}
            </Button>
            {!cleanCards && onUpgrade && (
              <button type="button" className={styles.upgrade} onClick={onUpgrade}>
                <Sparkles aria-hidden="true" strokeWidth={2.25} />
                Remove the line with{' '}
                <Badge tone="pro">Pro</Badge>
              </button>
            )}
          </div>
        </section>
      </div>
    </BottomSheet>
  )
}
