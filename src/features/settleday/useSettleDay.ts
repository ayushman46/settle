import { useMemo } from 'react'
import { useToast } from '../../components'
import { useExpenses, useFriendsById } from '../../data'
import { ME_ID, type Group } from '../../domain/types'
import type { Transfer } from '../../engine/balances'
import { today as todayIso, toIsoDate } from '../../engine/dates'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { haptic } from '../../lib/haptics'
import { openPayments, settleDayStatus, summarizeOpen, type OpenSummary, type SettleDay, type SettleDayStatus } from './engine'
import { everyLabel } from './labels'
import { restoreSettleDay, setSettleDay, useSettleDayEntry, type SettleDayEntry } from './store'

export interface SettleDayView {
  today: string
  /** The group's settle day, or null when none is picked. */
  entry: SettleDayEntry | null
  /** Everything to settle right now: yours first. */
  payments: Transfer[]
  open: OpenSummary
  /** Where today stands against the day; null without a day. */
  status: SettleDayStatus | null
}

/** A group's settle day and what is open in it, worked out from the group's own expenses and payments. */
export function useSettleDay(group: Group): SettleDayView {
  const entry = useSettleDayEntry(group.id)
  const expenses = useExpenses({ groupId: group.id })
  const friendsById = useFriendsById()
  const today = todayIso()
  return useMemo(() => {
    const payments = openPayments(group, expenses, ME_ID, (id) => friendLabel(id, friendsById[id] ?? null))
    const status = entry ? settleDayStatus(entry.day, today, { open: payments.length > 0, setOn: entry.setAt > 0 ? toIsoDate(new Date(entry.setAt)) : null }) : null
    return { today, entry, payments, open: summarizeOpen(payments, ME_ID), status }
  }, [group, expenses, friendsById, entry, today])
}

/** Picks the day and says so, with Undo putting back exactly what was there. */
export function usePickSettleDay(group: Pick<Group, 'id'>): (day: SettleDay) => void {
  const t = useT()
  const toast = useToast()
  return (day) => {
    const before = setSettleDay(group.id, day)
    haptic('success')
    toast(t('settleday.set.toast', { every: everyLabel(day) }), {
      tone: 'success',
      action: { label: t('common.action.undo'), onAction: () => restoreSettleDay(group.id, before) },
    })
  }
}
