/**
 * Auto-settle in the Android app: whenever Settle opens or comes back to the front, and whenever a
 * payment arrives while it's open, the phone's "money received" alerts are read and whoever paid
 * is ticked off (a toast with Undo says who). Plus the switch's state, for the screens that show it.
 */
import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../../components'
import { friendsStore } from '../../data'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/index-a'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { callPlugin, hasPlugin, listenToPlugin } from '../../lib/nativeApp'
import { undoMatches } from '../whospaid/sources'
import { readRawAlerts } from './alerts'
import { settleAlerts } from './autoSettle'

/** The native plugin (android/…/PaymentAlertsPlugin.java). */
export const PAYMENT_ALERTS = 'PaymentAlerts'

/** Reads the phone's waiting alerts and settles them. */
export function useAutoSettle(): void {
  const t = useT()
  const toast = useToast()

  useEffect(() => {
    if (!hasPlugin(PAYMENT_ALERTS)) return
    let running = false
    const run = async () => {
      if (running) return
      running = true
      try {
        const { alerts } = await callPlugin<{ alerts?: unknown }>(PAYMENT_ALERTS, 'drain')
        const result = settleAlerts(readRawAlerts(alerts))
        const first = result.ticked[0]
        if (!first || !result.applied) return
        const applied = result.applied
        haptic('success')
        const friend = friendsStore.get().find((f) => f.id === first.friendId) ?? null
        const message =
          result.ticked.length === 1
            ? t('autosettle.ticked.one', { name: friendLabel(first.friendId, friend), amount: formatMoney(first.amount, 'INR', { trimZeros: true }), title: first.titles.join(', ') })
            : t('autosettle.ticked.many', { count: result.ticked.length })
        toast(message, { tone: 'success', action: { label: t('common.action.undo'), onAction: () => undoMatches(applied) } })
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
