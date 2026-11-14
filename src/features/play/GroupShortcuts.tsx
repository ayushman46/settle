import { memo } from 'react'
import { Plus } from 'lucide-react'
import { Banner, Button, Chip, useToast } from '../../components'
import { deleteExpense, restoreExpense, saveExpense, useFriendsById } from '../../data'
import { ME_ID, type Expense, type Group } from '../../domain/types'
import { today } from '../../engine/dates'
import { useT } from '../../i18n'
import { relativeDateLabel } from '../../kit/dateLabel'
import { friendLabel } from '../../kit/friendName'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { useBoard } from './useBoard'
import { markDifferent } from './store'
import styles from './Play.module.css'

/**
 * Above a group's expenses: a bill that looks added twice (two people adding the same dinner is the
 * commonest mess in a shared group), and the things the group buys again and again, to add in one tap.
 */
export const GroupShortcuts = memo(function GroupShortcuts({ group }: { group: Group }) {
  const t = useT()
  const toast = useToast()
  const friendsById = useFriendsById()
  const board = useBoard(group)
  if (group.archived || (board.duplicates.length === 0 && board.again.length === 0)) return null
  const money = (paise: number): string => formatMoney(paise, group.currency, { trimZeros: true })
  const nameOf = (id: string): string => friendLabel(id, friendsById[id])

  /** The same expense again, today: the same people and split; paid by you when you're in it. */
  const addAgain = (e: Expense): void => {
    const { id: _id, createdAt: _c, updatedAt: _u, shares: _s, paidBack: _p, partPaid: _pp, ...rest } = e
    try {
      const saved = saveExpense({ ...rest, date: today(), payerId: e.participants.some((p) => p.friendId === ME_ID) ? ME_ID : e.payerId, recurringId: null, source: 'manual' })
      haptic('success')
      toast(t('play.again.done', { title: saved.title, amount: money(saved.total), count: saved.participants.length }), {
        tone: 'success',
        action: { label: t('common.action.undo'), onAction: () => void deleteExpense(saved.id) },
      })
    } catch {
      haptic('error')
      toast(t('play.again.failed'))
    }
  }

  return (
    <div className={styles.shortcuts}>
      {board.duplicates.map(({ key, keep, drop }) => (
        <Banner
          key={key}
          tone="warning"
          title={t('play.dup.title')}
          actions={
            <div className={styles.rowActions}>
              <Button
                size="sm"
                onClick={() => {
                  const removed = deleteExpense(drop.id)
                  if (!removed) return
                  haptic('success')
                  toast(t('play.dup.removed', { title: removed.title }), { action: { label: t('common.action.undo'), onAction: () => restoreExpense(removed) } })
                }}
              >
                {t('play.dup.remove')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => markDifferent(group.id, key)}>
                {t('play.dup.keep')}
              </Button>
            </div>
          }
        >
          {keep.payerId === drop.payerId
            ? t('play.dup.body.same', { title: keep.title, amount: money(keep.total), date: relativeDateLabel(keep.date) })
            : t('play.dup.body', { title: keep.title, amount: money(keep.total), date: relativeDateLabel(keep.date), first: nameOf(keep.payerId), second: nameOf(drop.payerId) })}
        </Banner>
      ))}
      {board.again.length > 0 && (
        <div className={styles.again} role="group" aria-label={t('play.again.title')}>
          <span className={styles.againLabel}>{t('play.again.title')}</span>
          {board.again.map((e) => (
            <Chip key={e.id} onClick={() => addAgain(e)} aria-label={t('play.again.aria', { title: e.title.trim(), amount: money(e.total) })}>
              <span className={styles.chipText}>
                <Plus aria-hidden="true" className={styles.chipIcon} />
                {e.title.trim()} · {money(e.total)}
              </span>
            </Chip>
          ))}
        </div>
      )}
    </div>
  )
})
