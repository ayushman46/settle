/**
 * Money that came back (a reversal, a refund credited), told to Stuck money: the open stuck payment
 * it belongs to is ticked back, and a toast says what came back — what's still to come when only
 * part of it did, and, when it came late, what the bank still owes for the wait — with Undo.
 */
import { useCallback } from 'react'
import { useToast } from '../../components'
import type { StuckBack, StuckPayment } from '../../data/stores'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import type { StuckSignal } from './detect'
import { backInFull, daysLate, stillOwed } from './rules'
import { trackStuckSignals } from './track'
import { backLine, inr } from './view'

type Translate = ReturnType<typeof useT>

/**
 * What the toast says when `back` is noted on `s` (`before` is what was noted till now): what came
 * back and what's still to come, as backLine() says it — or, when the money was back already and
 * what's new is compensation paid, just that.
 */
export function backToast(t: Translate, s: StuckPayment, back: StuckBack, before: StuckBack | null, day: string): string {
  const after: StuckPayment = { ...s, back, confirmed: true, dismissedAt: null }
  const owed = stillOwed(after, day).compensation
  if (before !== null && backInFull({ amount: s.amount, back: before }) && back.compensation > before.compensation) {
    return owed > 0 ? t('stuck.back.toastPaidPart', { paid: inr(back.compensation), owed: inr(owed) }) : t('stuck.back.toastPaid', { amount: inr(back.compensation) })
  }
  return backLine(s, back.amount, daysLate(after, day), owed)
}

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
      const message =
        result.back.length > 1
          ? t('stuck.back.toastMany', { count: result.back.length })
          : backToast(t, first, first.back ?? { date: day, amount: first.amount, compensation: 0 }, null, day)
      toast(message, { tone: 'success', action: { label: t('common.action.undo'), onAction: result.undo } })
      return true
    },
    [t, toast],
  )
}
