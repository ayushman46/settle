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
import { backInFull, compensationDue, daysLate, stillOwed } from './rules'
import { trackStuckSignals } from './track'
import { backLine, inr, knownParty, stepPlace } from './view'

type Translate = ReturnType<typeof useT>

/**
 * What the toast says when `back` is noted on `s` (`before` is what was noted till now) — what this
 * added, not the running totals: the money that came now (the last of a part: "The last ₹450 … is
 * back — all of it returned"), what's still to come, and the compensation as paid, due and still
 * owed. Only compensation added: just that.
 */
export function backToast(t: Translate, s: StuckPayment, back: StuckBack, before: StuckBack | null, day: string): string {
  const after: StuckPayment = { ...s, back, confirmed: true, dismissedAt: null }
  const arrived = back.amount - (before?.amount ?? 0)
  const paidNow = back.compensation - (before?.compensation ?? 0)
  const owed = stillOwed(after, day).compensation
  const place = stepPlace('bank', s)
  if (arrived <= 0) {
    return owed > 0 ? t('stuck.back.toastPaidPart', { paid: inr(paidNow), owed: inr(owed) }) : t('stuck.comp.toast', { place, amount: inr(paidNow) })
  }
  const late = daysLate(after, day)
  const last = before !== null && before.amount > 0 && backInFull(after)
  // Compensation paid (now or before) gets its own words below, so the money's line doesn't say it's owed.
  const money = last ? lastLine(t, s, arrived) : backLine(s, back.amount, late, back.compensation > 0 ? 0 : owed)
  if (back.compensation > 0) {
    const wait = owed > 0 ? t('stuck.back.waitPart', { paid: inr(back.compensation), due: inr(compensationDue(after, day)), owed: inr(owed) }) : t('stuck.back.waitPaid', { amount: inr(back.compensation) })
    return `${money} · ${wait}`
  }
  return last && owed > 0 ? `${money} · ${t('stuck.back.waitOwed', { count: late, place, owed: inr(owed) })}` : money
}

/** "The last ₹450 of your ₹2,450 to Ramesh is back — all of it returned" (a refund: "from Flipkart"). */
function lastLine(t: Translate, s: StuckPayment, arrived: number): string {
  const name = knownParty(s)
  const vars = { arrived: inr(arrived), amount: inr(s.amount) }
  if (!name) return t('stuck.back.toastLast', vars)
  return s.kind === 'failed' ? t('stuck.back.toastLastTo', { ...vars, name }) : t('stuck.back.toastLastFrom', { ...vars, name })
}

/** Ticks back what `signal` says came back; true when it matched a stuck payment. */
export function useTickBack(): (signal: StuckSignal) => boolean {
  const t = useT()
  const toast = useToast()
  return useCallback(
    (signal: StuckSignal) => {
      const day = todayIso()
      const result = trackStuckSignals([signal], 'sms')
      // Money back, or else compensation paid for the wait: either is news for one stuck payment.
      const changed = [...result.back, ...(result.paid ?? [])]
      const first = changed[0]
      if (!first) {
        // Told again for one already marked back: say so, rather than that nothing matches.
        const already = (result.already ?? []).length > 0
        toast(already ? t('stuck.back.already', { amount: inr(signal.amount) }) : t('stuck.paste.noMatch', { amount: inr(signal.amount) }))
        return already
      }
      haptic('success')
      const before = result.was?.(first.id)?.back ?? null
      const message =
        changed.length > 1
          ? t('stuck.back.toastMany', { count: changed.length })
          : backToast(t, first, first.back ?? { date: day, amount: first.amount, compensation: 0 }, before, day)
      toast(message, { tone: 'success', action: { label: t('common.action.undo'), onAction: result.undo } })
      return true
    },
    [t, toast],
  )
}
