import { useRef, useState } from 'react'
import { ArrowRight, Check, Share2 } from 'lucide-react'
import { Button, Card, useToast } from '../../components'
import { useFriendsById, useProfile, useSummary } from '../../data'
import { ME_ID } from '../../domain/types'
import { today } from '../../engine/dates'
import { useT } from '../../i18n'
import { FriendAvatar, friendLabel } from '../../kit/index-a'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { shareResult } from '../../lib/share'
import { firstName } from '../../share/text'
import { swapKey, type Swap } from './engine'
import { swapMessage, swapPayLink, swapUpiId } from './message'
import { recordSwap } from './settle'
import { dismissSwap, restoreSwap } from './store'
import { useSwaps } from './useSwaps'
import styles from './Swap.module.css'

/**
 * Pay it forward, for Home and "To collect": when someone owes you and you owe someone else,
 * the first can pay the second directly. Shows the best suggestion (the rest a tap away), with
 * the message to send and a tap for once it's paid. Nothing to suggest: nothing shown.
 */
export function SwapCard() {
  const t = useT()
  const { swaps, saved, currency } = useSwaps()
  const [expanded, setExpanded] = useState(false)
  const [first, ...rest] = swaps
  if (!first) return null
  const showSaved = saved !== null && saved > 1

  return (
    <Card className={styles.card}>
      <section aria-label={t('swap.card.aria')} className={styles.section}>
        <p className={styles.eyebrow}>{t('swap.card.eyebrow')}</p>
        <SwapItem swap={first} currency={currency} />
        {expanded && rest.map((swap) => <SwapItem key={swapKey(swap)} swap={swap} currency={currency} divided />)}
        {(rest.length > 0 || showSaved) && (
          <div className={styles.foot}>
            {showSaved && <p className={styles.fine}>{t('swap.card.saved', { count: saved })}</p>}
            {rest.length > 0 && (
              <Button variant="ghost" size="sm" aria-expanded={expanded} onClick={() => setExpanded((v) => !v)}>
                {expanded ? t('swap.card.fewer') : t('swap.card.more', { count: rest.length })}
              </Button>
            )}
          </div>
        )}
      </section>
    </Card>
  )
}

function SwapItem({ swap, currency, divided = false }: { swap: Swap; currency: string; divided?: boolean }) {
  const t = useT()
  const toast = useToast()
  const profile = useProfile()
  const friendsById = useFriendsById()
  const summary = useSummary()
  const busy = useRef(false)
  const fromFriend = friendsById[swap.fromId] ?? null
  const toFriend = friendsById[swap.toId] ?? null
  const from = firstName(friendLabel(swap.fromId, fromFriend))
  const to = firstName(friendLabel(swap.toId, toFriend))
  const money = (minor: number): string => formatMoney(minor, currency, { trimZeros: true })
  const amount = money(swap.amount)
  const owed = summary.byFriend[swap.fromId] ?? 0
  const owe = -(summary.byFriend[swap.toId] ?? 0)
  const hasUpi = swapUpiId(swap.toId, friendsById, profile) !== null

  const ask = async (): Promise<void> => {
    if (busy.current) return
    busy.current = true
    try {
      const link = await swapPayLink(swap, friendsById, profile, currency, today())
      const text = swapMessage(swap, friendsById, profile, currency, link)
      const outcome = await shareResult(text, { title: t('swap.message.title', { to }) })
      if (outcome === 'shared' || outcome === 'copied') haptic('success')
      if (outcome === 'copied') toast(t('swap.toast.copied', { from }), { tone: 'success' })
      if (outcome === 'failed') {
        haptic('error')
        toast(t('swap.toast.failed'), { tone: 'error' })
      }
    } finally {
      busy.current = false
    }
  }

  const paid = (): void => {
    const undo = recordSwap(swap, currency, { method: 'other', date: today() })
    haptic('success')
    toast(t('swap.toast.recorded', { from, to, amount }), {
      tone: 'success',
      action: { label: t('common.action.undo'), onAction: undo },
    })
  }

  const putAway = (): void => {
    const key = swapKey(swap)
    dismissSwap(key)
    toast(t('swap.toast.dismissed'), { action: { label: t('common.action.undo'), onAction: () => restoreSwap(key) } })
  }

  return (
    <div className={divided ? `${styles.item} ${styles.divided}` : styles.item}>
      <div className={styles.diagram} role="img" aria-label={t('swap.card.diagram.aria', { from, to, amount })}>
        <span className={styles.person}>
          <FriendAvatar friend={fromFriend} size="md" />
          <span className={styles.name}>{from}</span>
        </span>
        <span className={styles.route}>
          <span className={styles.amount}>{amount}</span>
          <span className={styles.line}>
            <ArrowRight strokeWidth={2.25} />
          </span>
          <span className={styles.skip}>
            <FriendAvatar friendId={ME_ID} size="xs" className={styles.me} />
            {t('swap.card.skips')}
          </span>
        </span>
        <span className={styles.person}>
          <FriendAvatar friend={toFriend} size="md" />
          <span className={styles.name}>{to}</span>
        </span>
      </div>
      <p className={styles.body}>{t('swap.card.body', { from, to, amount })}</p>
      {(owed !== swap.amount || owe !== swap.amount) && owed > 0 && owe > 0 && (
        <p className={styles.fine}>{t('swap.card.why', { from, to, owed: money(owed), owe: money(owe) })}</p>
      )}
      {!hasUpi && <p className={styles.fine}>{t('swap.card.noUpi', { from, to })}</p>}
      <div className={styles.actions}>
        <Button size="sm" iconStart={<Share2 />} onClick={() => void ask()}>
          {t('swap.card.ask', { from })}
        </Button>
        <Button size="sm" variant="secondary" iconStart={<Check />} onClick={paid} aria-label={t('swap.card.paid.aria', { from, to, amount })}>
          {t('swap.card.paid', { from, to })}
        </Button>
        <Button size="sm" variant="ghost" onClick={putAway} aria-label={t('swap.card.dismiss.aria', { from, to })}>
          {t('swap.card.dismiss')}
        </Button>
      </div>
    </div>
  )
}
