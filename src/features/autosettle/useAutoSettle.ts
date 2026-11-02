/**
 * Auto-settle in the Android app: whenever Settle opens or comes back to the front, and whenever a
 * payment arrives while it's open, the phone's alerts are read once and feed two things: whoever
 * paid you is ticked off (a toast with Undo says who), and payments that failed or refunds that
 * were started become Stuck money — and close themselves when the money comes back (a toast with
 * Undo says so). Plus the switch's state, for the screens that show it.
 */
import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../../components'
import { friendsStore } from '../../data'
import type { StuckPayment } from '../../data/stores'
import { today } from '../../engine/dates'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/index-a'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { callPlugin, hasPlugin, listenToPlugin } from '../../lib/nativeApp'
import { navigate } from '../../app/router'
import { feeToastMessage } from '../fees/alertToast'
import { FEES_PATH } from '../fees/paths'
import { trackFeeAlerts } from '../fees/track'
import { merchantById } from '../stuck/merchants'
import { backInPart, backParts, compensationDue, daysLate, stillOwed } from '../stuck/rules'
import { alertSignals, trackStuckSignals, type TrackResult } from '../stuck/track'
import { undoMatches } from '../whospaid/sources'
import { readRawAlerts } from './alerts'
import { settleAlerts, type AutoSettleResult } from './autoSettle'

/** The native plugin (android/…/PaymentAlertsPlugin.java). */
export const PAYMENT_ALERTS = 'PaymentAlerts'

type Translate = ReturnType<typeof useT>

const inr = (paise: number): string => formatMoney(paise, 'INR', { trimZeros: true })

/** Who a stuck payment is with, as the toast names them. */
function nameOf(s: StuckPayment): string | null {
  return s.party ?? merchantById(s.merchant)?.name ?? null
}

/**
 * What the toast says about stuck money just noticed: money back first (the good news), then
 * compensation paid for the wait, then what was added — already late, it says by how much and what
 * the bank owes so far — then a payment that went through after all. Null when nothing changed.
 */
export function stuckToastMessage(result: Pick<TrackResult, 'added' | 'back'> & Partial<Pick<TrackResult, 'cleared' | 'paid'>>, t: Translate, day: string): string | null {
  const back = result.back[0]
  if (result.back.length > 1) return t('stuckalerts.back.many', { count: result.back.length })
  const paid = result.paid?.[0]
  if (!back && paid) return paidMessage(paid, t, day)
  if (back) {
    const name = nameOf(back)
    const amount = inr(back.back?.amount ?? back.amount)
    // Only part of it came back: the rest stays open.
    if (back.back !== null && backInPart(back)) {
      return t('stuckalerts.back.part', { back: amount, amount: inr(back.amount), rest: inr(back.amount - back.back.amount) })
    }
    if (back.kind === 'refund') return name ? t('stuckalerts.back.refund', { name, amount }) : t('stuckalerts.back.refund.anon', { amount })
    const owed = compensationDue(back, day) - (back.back?.compensation ?? 0)
    if (owed > 0) {
      const late = { amount, days: daysLate(back, day), compensation: inr(owed) }
      return name ? t('stuckalerts.back.failed.late', { ...late, name }) : t('stuckalerts.back.failed.anon.late', late)
    }
    return name ? t('stuckalerts.back.failed', { name, amount }) : t('stuckalerts.back.failed.anon', { amount })
  }
  const added = result.added[0]
  if (result.added.length > 1) return t('stuckalerts.added.many', { count: result.added.length })
  if (!added) return clearedMessage(result.cleared ?? [], t)
  const name = nameOf(added)
  const amount = inr(added.amount)
  if (added.kind === 'refund') return name ? t('stuckalerts.refund', { name, amount }) : t('stuckalerts.refund.anon', { amount })
  if (added.confirmed) {
    // Told late (Settle wasn't opened for days): already past the RBI's deadline.
    const owed = compensationDue(added, day)
    if (owed > 0) {
      const late = { amount, days: daysLate(added, day), compensation: inr(owed) }
      if (added.rail === 'atm') return t('stuckalerts.failed.atm.late', late)
      return name ? t('stuckalerts.failed.late', { ...late, name }) : t('stuckalerts.failed.anon.late', late)
    }
    if (added.rail === 'atm') return t('stuckalerts.failed.atm', { amount })
    return name ? t('stuckalerts.failed', { name, amount }) : t('stuckalerts.failed.anon', { amount })
  }
  return name ? t('stuckalerts.check', { name, amount }) : t('stuckalerts.check.anon', { amount })
}

/** The bank paid compensation for the wait on `s`: how much just came, and what's still owed. */
function paidMessage(s: StuckPayment, t: Translate, day: string): string {
  const name = nameOf(s)
  // The compensation that just came: the latest part that paid some.
  const amount = inr(backParts(s).filter((p) => p.compensation > 0).at(-1)?.compensation ?? s.back?.compensation ?? 0)
  const owed = stillOwed(s, day).compensation
  if (owed > 0) return name ? t('stuckalerts.paid.part', { amount, name, owed: inr(owed) }) : t('stuckalerts.paid.part.anon', { amount, owed: inr(owed) })
  return name ? t('stuckalerts.paid', { amount, name }) : t('stuckalerts.paid.anon', { amount })
}

/** A payment that was waiting for a tap went through after all. */
function clearedMessage(cleared: readonly StuckPayment[], t: Translate): string | null {
  const first = cleared[0]
  if (!first) return null
  if (cleared.length > 1) return t('stuckalerts.cleared.many', { count: cleared.length })
  const name = nameOf(first)
  const amount = inr(first.amount)
  return name ? t('stuckalerts.cleared', { name, amount }) : t('stuckalerts.cleared.anon', { amount })
}

/** Reads the phone's waiting alerts: settles who paid, and tracks stuck money. */
export function useAutoSettle(): void {
  const t = useT()
  const toast = useToast()

  useEffect(() => {
    if (!hasPlugin(PAYMENT_ALERTS)) return
    let running = false
    /** Toasts who was ticked off; false when nobody was. */
    const tellTicked = (result: AutoSettleResult): boolean => {
      const first = result.ticked[0]
      if (!first || !result.applied) return false
      const applied = result.applied
      haptic('success')
      const friend = friendsStore.get().find((f) => f.id === first.friendId) ?? null
      const message =
        result.ticked.length === 1
          ? t('autosettle.ticked.one', { name: friendLabel(first.friendId, friend), amount: formatMoney(first.amount, 'INR', { trimZeros: true }), title: first.titles.join(', ') })
          : t('autosettle.ticked.many', { count: result.ticked.length })
      toast(message, { tone: 'success', action: { label: t('common.action.undo'), onAction: () => undoMatches(applied) } })
      return true
    }
    /** Toasts what Stuck money noticed; false when it noticed nothing. */
    const tellStuck = (result: TrackResult): boolean => {
      const message = stuckToastMessage(result, t, today())
      if (message === null) return false
      const good = result.back.length > 0 || result.paid.length > 0 || (result.added.length === 0 && result.cleared.length > 0)
      haptic(good ? 'success' : 'warning')
      toast(message, { tone: good ? 'success' : 'info', action: { label: t('common.action.undo'), onAction: result.undo } })
      return true
    }
    /** Toasts a bank charge just read that breaks a rule (or needs one answer), or one put back. */
    const tellFees = (result: ReturnType<typeof trackFeeAlerts>): void => {
      const message = feeToastMessage(result, t)
      if (message === null) return
      haptic(message.good ? 'success' : 'warning')
      toast(message.text, { tone: message.good ? 'success' : 'info', action: { label: t('fees.title'), onAction: () => navigate(FEES_PATH) } })
    }
    const run = async () => {
      if (running) return
      running = true
      try {
        const { alerts } = await callPlugin<{ alerts?: unknown }>(PAYMENT_ALERTS, 'drain')
        const raw = readRawAlerts(alerts)
        let ticked = false
        try {
          ticked = tellTicked(settleAlerts(raw))
        } catch {
          // Auto-settle couldn't use them; Stuck money still reads them.
        }
        const stuck = trackStuckSignals(alertSignals(raw, today()), 'alert')
        // Bank charges in the same SMS: kept, and checked against the RBI's rules.
        let fees: ReturnType<typeof trackFeeAlerts> | null = null
        try {
          fees = trackFeeAlerts(raw, today())
        } catch {
          // A charge Settle couldn't read: the rest still counts.
        }
        // One toast at a time: someone paying you back comes first, then stuck money, then a bank charge (each is on its screen either way).
        if (!ticked && !tellStuck(stuck) && fees) tellFees(fees)
      } catch {
        // The phone said nothing usable: next time.
      } finally {
        running = false
      }
    }
    void run()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run()
    }
    document.addEventListener('visibilitychange', onVisible)
    document.addEventListener('resume', onVisible)
    const stop = listenToPlugin(PAYMENT_ALERTS, 'alert', () => void run())
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      document.removeEventListener('resume', onVisible)
      stop()
    }
  }, [t, toast])
}

export interface AutoSettleStatus {
  /** This is the Android app, with the payment-alerts plugin. */
  available: boolean
  /** Android's notification access is on for Settle. */
  granted: boolean
  /** Bank SMS alerts are included. */
  sms: boolean
}

const OFF: AutoSettleStatus = { available: false, granted: false, sms: false }

/** Auto-settle's state, re-read when Settle comes back from Android's settings. */
export function useAutoSettleStatus(): { status: AutoSettleStatus; refresh: () => void } {
  const [status, setStatus] = useState<AutoSettleStatus>(() => (hasPlugin(PAYMENT_ALERTS) ? { ...OFF, available: true } : OFF))
  const refresh = useCallback(() => {
    if (!hasPlugin(PAYMENT_ALERTS)) return
    void callPlugin<{ granted?: unknown; sms?: unknown }>(PAYMENT_ALERTS, 'status')
      .then((s) => setStatus({ available: true, granted: s.granted === true, sms: s.sms === true }))
      .catch(() => undefined)
  }, [])
  useEffect(() => {
    refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    document.addEventListener('resume', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      document.removeEventListener('resume', onVisible)
    }
  }, [refresh])
  return { status, refresh }
}

/** Opens Android's switch for Settle, after saving whether bank SMS alerts are included. */
export async function turnOnAutoSettle(sms: boolean): Promise<void> {
  await callPlugin(PAYMENT_ALERTS, 'setOptions', { sms })
  await callPlugin(PAYMENT_ALERTS, 'openSettings')
}

/** Includes bank SMS alerts or not. */
export async function setAutoSettleSms(sms: boolean): Promise<void> {
  await callPlugin(PAYMENT_ALERTS, 'setOptions', { sms })
}

/** Android's switch for Settle (to turn it off). */
export async function openAutoSettleSettings(): Promise<void> {
  await callPlugin(PAYMENT_ALERTS, 'openSettings')
}
