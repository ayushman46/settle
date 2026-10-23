import { useState } from 'react'
import { ChevronRight, Receipt } from 'lucide-react'
import { navigate } from '../../app/router'
import { BottomSheet, Button, Money, useToast } from '../../components'
import type { Friend } from '../../domain/types'
import { today } from '../../engine/dates'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/index-a'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { firstName } from '../../share/text'
import { GroupEmoji } from '../groups/GroupEmoji'
import { settleUpPath } from '../groups/paths'
import { settleWithFriend, sourceDirection, type FriendBalance, type FriendSource } from './friendBalance'
import styles from './FriendSettleSheet.module.css'

export interface FriendSettleSheetProps {
  friend: Friend
  balance: FriendBalance
  open: boolean
  onClose: () => void
  /** Everything was settled in one go (for the celebration). */
  onSettledAll: () => void
}

/**
 * Everything open with one friend, place by place: splits outside groups can be ticked off here
 * (with an undo); each shared group opens its own settle up, where its payments are recorded.
 * "Settle everything" does it all at once — ticking off the splits and recording a payment in
 * each group.
 */
export function FriendSettleSheet({ friend, balance, open, onClose, onSettledAll }: FriendSettleSheetProps) {
  const t = useT()
  const toast = useToast()
  const name = firstName(friendLabel(friend.id, friend))
  // Keeps the last rows on show while the sheet slides away after everything was settled.
  const [last, setLast] = useState(balance)
  if (balance.sources.length > 0 && balance !== last) setLast(balance)
  const sources = balance.sources.length > 0 ? balance.sources : last.sources

  const markSplits = (source: Extract<FriendSource, { kind: 'splits' }>): void => {
    const undo = settleWithFriend(friend.id, [source], { method: 'other', date: today() })
    haptic('success')
    toast(t('friends.settle.marked.toast', { count: source.count }), {
      tone: 'success',
      action: { label: t('common.action.undo'), onAction: undo },
    })
    if (sources.length === 1) onClose()
  }

  const settleAll = (): void => {
    const undo = settleWithFriend(friend.id, sources, { method: 'other', date: today() })
    onClose()
    onSettledAll()
    toast(t('friends.allSquare', { name }), { tone: 'success', action: { label: t('common.action.undo'), onAction: undo } })
  }

  const lead = balance.totals[0]
  const description = lead
    ? lead.amount > 0
      ? t('friends.settle.owesYou', { name, amount: formatMoney(lead.amount, lead.currency, { trimZeros: true }) })
      : t('friends.settle.youOwe', { name, amount: formatMoney(-lead.amount, lead.currency, { trimZeros: true }) })
    : t('friends.settle.square', { name })

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('friends.settle.title', { name })}
      description={description}
      footer={
        sources.length > 1 ? (
          <Button block variant="secondary" onClick={settleAll}>
            {t('friends.settle.all.cta')}
          </Button>
        ) : undefined
      }
    >
      <ul role="list" className={styles.sources} aria-label={t('friends.sources.title')}>
        {sources.map((source) => (
          <li key={source.key} className={styles.source}>
            {source.kind === 'group' ? (
              <GroupEmoji emoji={source.group.emoji} kind={source.group.kind} size="sm" />
            ) : (
              <span className={styles.splitIcon} aria-hidden="true">
                <Receipt strokeWidth={2.25} />
              </span>
            )}
            <span className={styles.text}>
              <span className={styles.title}>
                {source.kind === 'group' ? source.group.name : t('friends.sources.splits', { count: source.count })}
              </span>
              <span className={styles.sub}>{sourceDirection(source, name)}</span>
            </span>
            <Money
              value={Math.abs(source.amount)}
              currency={source.currency}
              trimZeros
              strong
              tone={source.amount > 0 ? 'positive' : source.amount < 0 ? 'negative' : 'default'}
            />
            {source.kind === 'group' ? (
              <Button
                size="sm"
                variant="tonal"
                iconEnd={<ChevronRight />}
                className={styles.action}
                onClick={() => navigate(settleUpPath(source.group.id))}
                aria-label={t('friends.settle.inGroup.aria', { name: source.group.name })}
              >
                {t('friends.settle.inGroup.cta')}
              </Button>
            ) : (
              <Button size="sm" variant="tonal" className={styles.action} onClick={() => markSplits(source)}>
                {t('friends.settle.mark.cta')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </BottomSheet>
  )
}
