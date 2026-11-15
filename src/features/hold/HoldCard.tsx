import { memo, useMemo, useState } from 'react'
import { PauseCircle } from 'lucide-react'
import { navigate } from '../../app/router'
import { Badge, Button, Card, useToast } from '../../components'
import { useGroups } from '../../data'
import type { Expense, Group } from '../../domain/types'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { openBill } from '../bill/launch'
import { extensionEditPath } from '../expense/extensionActions'
import { daysHeld, heldInGroup, looseHeld, type HeldExpense } from './engine'
import { deleteHeld, heldIndex, holdAgain, releaseHold, restoreHeld, useHeld } from './store'
import styles from './Hold.module.css'

/**
 * On the group page: the group's expenses on hold ("1 expense on hold: Dinner ₹2,400, wrong
 * amount"), each with Put it back, Change it and Delete for good. Null when none are.
 */
export const HoldCard = memo(function HoldCard({ group }: { group: Group }) {
  const held = useHeld()
  const mine = useMemo(() => heldInGroup(held, group.id), [held, group.id])
  return <HeldList held={mine} />
})

/** The same for expenses outside any group (or whose group is gone). Null when none are on hold. */
export const HoldHome = memo(function HoldHome() {
  const held = useHeld()
  const groups = useGroups()
  const loose = useMemo(() => looseHeld(held, new Set(groups.map((g) => g.id))), [held, groups])
  return <HeldList held={loose} />
})

/** Where an expense's editor is: the lend screen for a 1:1 entry, the bill flow for an itemised bill, else the split editor. */
function openEditor(expense: Expense): void {
  const elsewhere = extensionEditPath(expense)
  if (elsewhere) navigate(elsewhere)
  else if (expense.kind === 'bill' && expense.bill && expense.bill.items.length > 0) openBill({ kind: 'edit', expenseId: expense.id })
  else navigate(`/app/split/${encodeURIComponent(expense.id)}/edit`)
}

function HeldList({ held }: { held: readonly HeldExpense[] }) {
  const t = useT()
  const toast = useToast()
  // Read once: the ages shown don't tick while the card is on screen.
  const [now] = useState(() => Date.now())
  if (held.length === 0) return null

  /** Puts it back exactly as it was. Returns whether it went back. */
  const putBack = (entry: HeldExpense, quiet = false): boolean => {
    const index = heldIndex(entry.expense.id)
    const released = releaseHold(entry.expense.id)
    if (!released) return false
    if (!quiet) {
      haptic('success')
      toast(t('hold.back.done', { title: entry.expense.title }), {
        tone: 'success',
        action: { label: t('common.action.undo'), onAction: () => holdAgain(released, index) },
      })
    }
    return true
  }

  const change = (entry: HeldExpense): void => {
    if (putBack(entry, true)) openEditor(entry.expense)
  }

  const remove = (entry: HeldExpense): void => {
    const index = heldIndex(entry.expense.id)
    const removed = deleteHeld(entry.expense.id)
    if (!removed) return
    haptic('tap')
    toast(t('hold.delete.done', { title: entry.expense.title }), { action: { label: t('common.action.undo'), onAction: () => restoreHeld(removed, index) } })
  }

  const heading = t('hold.card.title', { count: held.length })
  return (
    <section className={styles.card} aria-label={heading}>
      <h3 className={styles.heading}>
        <PauseCircle aria-hidden="true" />
        {heading}
      </h3>
      <p className={styles.fine}>{held.length === 1 ? t('hold.card.body.one') : t('hold.card.body')}</p>
      <Card padding="none">
        <ul className={styles.rows}>
          {held.map((entry) => {
            const { expense } = entry
            const amount = formatMoney(expense.total, expense.currency, { trimZeros: true })
            const days = daysHeld(entry.heldAt, now)
            const why = entry.reason === 'other' ? entry.note : t(`hold.reason.${entry.reason}`)
            return (
              <li key={expense.id} className={styles.row} aria-label={t('hold.row.aria', { title: expense.title, amount })}>
                <div className={styles.top}>
                  <span className={styles.name}>{expense.title}</span>
                  <span className={styles.amount}>{amount}</span>
                </div>
                <p className={styles.fine}>
                  {why && (
                    <>
                      <Badge tone="warning">{why}</Badge>{' '}
                    </>
                  )}
                  {days === 0 ? t('hold.row.today') : t('hold.row.days', { count: days })}
                </p>
                <div className={styles.actions}>
                  <Button size="md" onClick={() => putBack(entry)} aria-label={t('hold.row.back.aria', { title: expense.title })}>
                    {t('hold.row.back')}
                  </Button>
                  <Button size="md" variant="secondary" onClick={() => change(entry)} aria-label={t('hold.row.change.aria', { title: expense.title })}>
                    {t('hold.row.change')}
                  </Button>
                  <Button size="md" variant="danger" onClick={() => remove(entry)} aria-label={t('hold.row.delete.aria', { title: expense.title })}>
                    {t('hold.row.delete')}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      </Card>
    </section>
  )
}
