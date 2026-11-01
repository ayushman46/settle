/**
 * Money that came back (a reversal, a refund credited), told to Stuck money: the open stuck payment
 * it belongs to is ticked back, and a toast says what came back — and, when it came late, what the
 * bank still owes for the wait — with Undo.
 */
import { useCallback } from 'react'
import { useToast } from '../../components'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import type { StuckSignal } from './detect'
import { compensationDue, daysLate } from './rules'
import { trackStuckSignals } from './track'
import { backLine, inr } from './view'

/** Ticks back what `signal` says came back; true when it matched a stuck payment. */
export function useTickBack(): (signal: StuckSignal) => boolean {
  const t = useT()
  const toast = useToast()
  return useCallback(
    (signal: StuckSignal) => {
      const day = todayIso()
      const result = trackStuckSignals([signal], 'sms')
      const first = result.back[0]
      if (!first) {
        toast(t('stuck.paste.noMatch', { amount: inr(signal.amount) }))
        return false
      }
      haptic('success')
      const owed = compensationDue(first, day) - (first.back?.compensation ?? 0)
      const message =
        result.back.length > 1
          ? t('stuck.back.toastMany', { count: result.back.length })
          : backLine(first, first.back?.amount ?? first.amount, daysLate(first, day), owed)
      toast(message, { tone: 'success', action: { label: t('common.action.undo'), onAction: result.undo } })
      return true
    },
    [t, toast],
  )
}
