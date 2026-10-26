import { useEffect, useId, useMemo, useState } from 'react'
import { Copy, FileText, Image as ImageIcon, Link2, MessageCircle, Share2, Sparkles } from 'lucide-react'
import {
  Badge,
  BottomSheet,
  Button,
  Money,
  QuickAction,
  QuickActionGrid,
  Skeleton,
  useToast,
} from '../components'
import { updateFriend, useFriendsById, useGroup, useProfile } from '../data'
import { BRAND, ME_ID, type AccentId, type Expense } from '../domain/types'
import { isSettledInGroup } from '../engine/balances'
import { tx, useT } from '../i18n'
import { haptic } from '../lib/haptics'
import { useHasFeature } from '../pro'
import {
  copyText,
  payLinkMessage,
  payLinkProgress,
  personalPayMessage,
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
import { pendingIds } from './collectLabels'
import { FriendAvatar } from './FriendAvatar'
import { friendLabel } from './friendName'
import { DARK_SCHEME, TOUCH_FIRST, useMediaQuery } from './media'
import { UpiIdForm } from './UpiIdForm'
import { usePayLink, usePersonalPayLinks } from './usePayLink'
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
  const t = useT()
  const imageHeadingId = useId()
  const eachHeadingId = useId()
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
  // Or one by one: each person gets their own message and link, straight to their chat.
  const askIds = settlesIn === null && owing ? pendingIds(expense) : []
  const personal = usePersonalPayLinks(expense, askIds, open && askIds.length > 1)

  const description = settlesIn
    ? t('kit.share.description.group', { group: settlesIn.name })
    : !owing
    ? t('kit.share.description.settled')
    : payload.to.u && rupees
      ? fromPayee
        ? t('kit.share.description.payMe')
        : t('kit.share.description.payThem', { name: payerFirst })
      : t('kit.share.description.see')

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
      done(t('kit.share.whatsappCopied.toast'))
    } else {
      oops(t('kit.share.whatsappFailed.toast'))
    }
  }

  const shareElsewhere = async (): Promise<void> => {
    if (!message) return
    const outcome = await shareResult(message, { mode: 'share', title: expense.title })
    if (outcome === 'shared') haptic('success')
    else if (outcome === 'copied') done(t('kit.share.copied.toast'))
    else if (outcome === 'failed') oops(t('kit.share.failed.toast'))
  }

  const copyLink = async (): Promise<void> => {
    if (!link) return
    if (await copyText(link)) done(t('kit.share.linkCopied.toast'))
    else oops(t('kit.share.copyFailed.toast'))
  }

  const copySummary = async (): Promise<void> => {
    if (!summary) return
    if (await copyText(summary)) done(t('kit.share.summaryCopied.toast'))
    else oops(t('kit.share.summaryFailed.toast'))
  }

  const shareImage = async (): Promise<void> => {
    if (card?.status !== 'ready') return
    // With the pay link along as the caption, where the app takes one (WhatsApp does).
    const caption = settlesIn ? undefined : (message ?? undefined)
    const outcome = await shareFile(card.blob, shareCardFilename(expense.title), caption, { title: expense.title })
    if (outcome === 'shared') haptic('success')
    else if (outcome === 'downloaded') done(t('kit.share.imageSaved.toast'))
    else if (outcome === 'failed') oops(t('kit.share.imageFailed.toast'))
  }

  const saveUpi = (upiId: string): void => {
    try {
      updateFriend(expense.payerId, { upiId })
      setAddingUpi(false)
      done(t('kit.share.upiSaved.toast'))
    } catch {
      oops(t('kit.share.upiFailed.toast'))
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} eyebrow={expense.title} title={t('kit.share.title')} description={description}>
      <div className={styles.body}>
        {upiMissing && (payer || fromPayee) && (
          <section className={styles.upi} aria-label={t('kit.share.upi.aria')}>
            {addingUpi ? (
              <UpiIdForm
                ownerId={expense.payerId}
                ownerName={friendLabel(expense.payerId, payer)}
                onSave={saveUpi}
                autoFocus
                lead={fromPayee ? t('kit.share.upi.lead.mine') : t('kit.share.upi.lead.theirs', { name: payerFirst })}
              />
            ) : (
              <>
                <p className={styles.upiText}>
                  {fromPayee
                    ? t('kit.share.upi.missing.mine')
                    : t('kit.share.upi.missing.theirs', { name: payerFirst })}
                </p>
                <Button size="sm" variant="primary" onClick={() => setAddingUpi(true)}>
                  {t('kit.share.upi.add.cta')}
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
                <span className="visually-hidden">{t('kit.share.link.pending')}</span>
                <Skeleton width="70%" />
              </span>
            )}
          </div>
        )}

        <QuickActionGrid label={settlesIn ? t('kit.share.actions.split') : t('kit.share.actions.link')} className={styles.actions}>
          <QuickAction tone="groceries" icon={<MessageCircle />} label="WhatsApp" /* i18n-ignore: brand */ onClick={sendWhatsApp} disabled={!message} />
          <QuickAction tone="travel" icon={<Share2 />} label={t('kit.share.moreApps')} onClick={shareElsewhere} disabled={!message} />
          {settlesIn === null && <QuickAction tone="ink" icon={<Copy />} label={t('kit.share.copyLink')} onClick={copyLink} disabled={!link} />}
          <QuickAction tone="entertainment" icon={<FileText />} label={t('kit.share.copyText')} onClick={copySummary} disabled={!summary} />
        </QuickActionGrid>

        {askIds.length > 1 && (
          <section className={styles.each} aria-labelledby={eachHeadingId}>
            <div>
              <h3 id={eachHeadingId} className={styles.eachTitle}>
                {t('kit.share.each.title')}
              </h3>
              <p className={styles.eachSub}>{t('kit.share.each.body')}</p>
            </div>
            <ul className={styles.eachList}>
              {askIds.map((id) => {
                const friend = friendsById[id] ?? null
                const name = friendLabel(id, friend)
                const own = personal[id]
                const index = own?.payload.f
                const text = own && own.link && index !== undefined ? personalPayMessage(own.payload, index, own.link, { fromPayee }) : null
                return (
                  <li key={id} className={styles.eachRow}>
                    <FriendAvatar friendId={id} size="sm" />
                    <span className={styles.eachName}>{name}</span>
                    <Money value={expense.shares[id] ?? 0} currency={expense.currency} trimZeros strong className={styles.eachAmount} />
                    {text ? (
                      <a
                        className={styles.eachSend}
                        href={whatsappUrl(text, friend?.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('kit.share.each.aria', { name })}
                        onClick={() => haptic('success')}
                      >
                        <MessageCircle aria-hidden="true" strokeWidth={2.25} />
                        {t('kit.share.each.cta')}
                      </a>
                    ) : (
                      <span className={styles.eachPending}>
                        <Skeleton width="4.5rem" height={36} shape="md" />
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <section className={styles.image} aria-labelledby={imageHeadingId}>
          <div className={styles.preview}>
            {card?.status === 'ready' && card.preview ? (
              <img src={card.preview} alt={t('kit.share.image.alt', { title: expense.title })} className={styles.previewImage} />
            ) : card?.status === 'failed' ? (
              <span className={styles.previewFailed}>{t('kit.share.image.noPreview')}</span>
            ) : (
              <Skeleton shape="md" width="100%" height="100%" />
            )}
          </div>
          <div className={styles.imageText}>
            <h3 id={imageHeadingId} className={styles.imageTitle}>
              {t('kit.share.image.title')}
            </h3>
            <p className={styles.imageSub} aria-live="polite">
              {card === null
                ? t('kit.share.image.drawing')
                : card.status === 'failed'
                  ? t('kit.share.image.failed')
                  : cleanCards
                    ? t('kit.share.image.clean')
                    : t('kit.share.image.watermark', { brand: BRAND.name })}
            </p>
            {/* Phones hand the image to the share sheet; computers download it. */}
            <Button
              size="sm"
              variant="secondary"
              iconStart={<ImageIcon />}
              onClick={shareImage}
              disabled={card?.status !== 'ready'}
            >
              {touch ? t('kit.share.image.share.cta') : t('kit.share.image.save.cta')}
            </Button>
            {!cleanCards && onUpgrade && (
              <button type="button" className={styles.upgrade} onClick={onUpgrade}>
                <Sparkles aria-hidden="true" strokeWidth={2.25} />
                {tx('kit.share.image.upgrade', {}, { pro: (chunk) => <Badge tone="pro">{chunk}</Badge> })}
              </button>
            )}
          </div>
        </section>
      </div>
    </BottomSheet>
  )
}
