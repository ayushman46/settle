import { useState } from 'react'
import { Globe } from 'lucide-react'
import { Card, List, ListRow } from '../../components'
import { useFriend } from '../../data'
import { ME_ID } from '../../domain/types'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/index-a'
import { formatMoney } from '../../lib/money'
import { firstName } from '../../share/text'
import { AbroadSheet } from './AbroadSheet'
import { useAbroad } from './store'
import { useAbroadMoney } from './useAbroadMoney'
import styles from './Abroad.module.css'

export interface AbroadRowProps {
  friendId: string
  /** Only the row, for placing inside a list that is already there. Default: its own card. */
  bare?: boolean
  className?: string
}

/**
 * For a friend's page. Not set up: a quiet "Lives outside India?" that opens the set-up. Set up:
 * their currency and what is open between you in both, opening the sheet. Nothing for yourself or
 * someone who is gone.
 */
export function AbroadRow({ friendId, bare = false, className }: AbroadRowProps) {
  const t = useT()
  const friend = useFriend(friendId)
  const setup = useAbroad(friendId)
  const { view } = useAbroadMoney(friendId, setup)
  const [open, setOpen] = useState(false)
  if (friendId === ME_ID || !friend) return null

  const name = firstName(friendLabel(friendId, friend))
  const amount = formatMoney(view.amount, view.currency, { trimZeros: true })
  const theirs = view.theirAmount !== null && !view.same ? formatMoney(view.theirAmount, view.theirCurrency, { trimZeros: true }) : null
  const subtitle =
    setup === null
      ? t('abroad.row.setup.body')
      : view.side === 'even'
        ? t('abroad.row.even')
        : view.side === 'youOwe'
          ? theirs !== null
            ? t('abroad.row.youOwe.both', { amount, theirs })
            : t('abroad.row.youOwe', { amount })
          : theirs !== null
            ? t('abroad.row.theyOwe.both', { amount, theirs })
            : t('abroad.row.theyOwe', { amount })

  const row = (
    <ListRow
      className={bare ? className : undefined}
      leading={
        <span className={styles.rowIcon} aria-hidden="true">
          <Globe />
        </span>
      }
      title={setup === null ? t('abroad.row.setup.title') : t('abroad.row.title', { currency: setup.currency })}
      subtitle={subtitle}
      chevron
      onClick={() => setOpen(true)}
    />
  )

  return (
    <>
      {bare ? (
        row
      ) : (
        <Card padding="none" className={className}>
          <List aria-label={t('abroad.row.aria', { name })}>{row}</List>
        </Card>
      )}
      <AbroadSheet friendId={friendId} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
