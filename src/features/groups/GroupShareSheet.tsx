import { useEffect, useId, useMemo, useState } from 'react'
import { FileText, Image as ImageIcon, MessageCircle, Share2, Sparkles } from 'lucide-react'
import { Badge, BottomSheet, Button, QuickAction, QuickActionGrid, Skeleton, useToast } from '../../components'
import { useExpenses, useFriendsById, useProfile } from '../../data'
import { BRAND, type AccentId, type Group } from '../../domain/types'
import { DARK_SCHEME, TOUCH_FIRST, useMediaQuery } from '../../kit/index-b'
import { haptic } from '../../lib/haptics'
import { useHasFeature } from '../../pro'
import {
  copyText,
  groupCardInputFromGroup,
  renderGroupCard,
  shareCardFilename,
  shareFile,
  shareResult,
  whatsappUrl,
  type GroupCardInput,
} from '../../share'
import { openPaywall } from '../pro/paywall'
import { groupSummaryText } from './groupView'
import styles from './GroupShareSheet.module.css'

export interface GroupShareSheetProps {
  group: Group
  open: boolean
  onClose: () => void
}

type CardState = { key: string; status: 'ready'; blob: Blob; preview: string | null } | { key: string; status: 'failed' }

interface CardOptions {
  watermark: boolean
  theme: 'light' | 'dark'
  accent: AccentId
}

/**
 * The group card image, drawn as soon as the sheet opens — not on tap, or the browser may refuse
 * the share sheet for a tap that's too old. Kept while the content is the same. Null while drawing.
 */
function useGroupCard(open: boolean, input: GroupCardInput, opts: CardOptions): CardState | null {
  const key = JSON.stringify([input, opts])
  const [state, setState] = useState<CardState | null>(null)
  const current = state?.key === key ? state : null

  useEffect(() => {
    if (!open || current) return
    let live = true
    renderGroupCard(input, opts).then(
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

  useEffect(() => {
    const preview = state?.status === 'ready' ? state.preview : null
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [state])

  return current
}

/**
 * A group's story for the group chat: who pays whom and what it all came to — as a text message
 * (WhatsApp, any app, or copied) or as a receipt-style image (clean on Pro).
 */
export function GroupShareSheet({ group, open, onClose }: GroupShareSheetProps) {
  const imageHeadingId = useId()
  const toast = useToast()
  const profile = useProfile()
  const friendsById = useFriendsById()
  const expenses = useExpenses({ groupId: group.id })
  const cleanCards = useHasFeature('clean_cards')
  const themes = useHasFeature('themes')
  const systemDark = useMediaQuery(DARK_SCHEME)
  const touch = useMediaQuery(TOUCH_FIRST)

  const input = useMemo(() => groupCardInputFromGroup(group, expenses, friendsById, profile), [group, expenses, friendsById, profile])
  const text = useMemo(() => groupSummaryText(input), [input])
  const theme = profile.theme === 'system' ? (systemDark ? 'dark' : 'light') : profile.theme
  const opts = useMemo<CardOptions>(
    () => ({ watermark: !cleanCards, theme, accent: themes ? profile.accent : 'lime' }),
    [cleanCards, theme, themes, profile.accent],
  )
  const card = useGroupCard(open, input, opts)

  const done = (message: string) => {
    haptic('success')
    toast(message, { tone: 'success' })
  }
  const oops = (message: string) => {
    haptic('error')
    toast(message, { tone: 'error' })
  }

  const sendWhatsApp = async (): Promise<void> => {
    const win = window.open(whatsappUrl(text), '_blank')
    if (win) {
      win.opener = null
      haptic('success')
    } else if (await copyText(text)) {
      done('Summary copied. Paste it in WhatsApp.')
    } else {
      oops('Couldn’t open WhatsApp. Try “More apps”.')
    }
  }

  const shareElsewhere = async (): Promise<void> => {
    const outcome = await shareResult(text, { mode: 'share', title: group.name })
    if (outcome === 'shared') haptic('success')
    else if (outcome === 'copied') done('Summary copied')
    else if (outcome === 'failed') oops('Couldn’t share. Try copying the text.')
  }

  const copySummary = async (): Promise<void> => {
    if (await copyText(text)) done('Summary copied')
    else oops('Couldn’t copy the summary.')
  }

  const shareImage = async (): Promise<void> => {
    if (card?.status !== 'ready') return
    const outcome = await shareFile(card.blob, shareCardFilename(group.name), text, { title: group.name })
    if (outcome === 'shared') haptic('success')
    else if (outcome === 'downloaded') done('Image saved')
    else if (outcome === 'failed') oops('Couldn’t share the image.')
  }

  const description =
    input.transfers.length > 0
      ? `${input.transfers.length} ${input.transfers.length === 1 ? 'payment squares' : 'payments square'} everyone up.`
      : input.expenseCount > 0
        ? 'Everyone’s settled up. Share it for the record.'
        : 'Nothing spent yet — share it once the first expense is in.'

  return (
    <BottomSheet open={open} onClose={onClose} eyebrow={group.name} title="Share group summary" description={description}>
      <div className={styles.body}>
        <QuickActionGrid label="Share the summary" className={styles.actions}>
          <QuickAction tone="groceries" icon={<MessageCircle />} label="WhatsApp" onClick={sendWhatsApp} />
          <QuickAction tone="travel" icon={<Share2 />} label="More apps" onClick={shareElsewhere} />
          <QuickAction tone="entertainment" icon={<FileText />} label="Copy text" onClick={copySummary} />
        </QuickActionGrid>

        <section className={styles.image} aria-labelledby={imageHeadingId}>
          <div className={styles.preview}>
            {card?.status === 'ready' && card.preview ? (
              <img src={card.preview} alt={`Summary card for ${group.name}`} className={styles.previewImage} />
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
                ? 'Drawing your summary…'
                : card.status === 'failed'
                  ? 'This browser couldn’t draw the image. The text works everywhere.'
                  : cleanCards
                    ? 'Who pays whom, as a clean card for the group chat.'
                    : `Who pays whom, with a small “Made with ${BRAND.name}” line.`}
            </p>
            <Button size="sm" variant="secondary" iconStart={<ImageIcon />} onClick={shareImage} disabled={card?.status !== 'ready'}>
              {touch ? 'Share image' : 'Save image'}
            </Button>
            {!cleanCards && (
              <button type="button" className={styles.upgrade} onClick={() => openPaywall('clean_cards')}>
                <Sparkles aria-hidden="true" strokeWidth={2.25} />
                Remove the line with <Badge tone="pro">Pro</Badge>
              </button>
            )}
          </div>
        </section>
      </div>
    </BottomSheet>
  )
}
