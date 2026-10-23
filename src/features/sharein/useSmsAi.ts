/**
 * "Let AI read it" for a message the phone couldn't read for sure: the same free allowance and
 * paywall as "Just say it", the text with OTP lines taken out, and the answer handed to the split
 * screen with the AI banner.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { DescribeError, describedToPrefill, describeSplit } from '../../ai'
import { navigate } from '../../app/router'
import { addFriend, setSplitPrefill, useFriends, useProfile } from '../../data'
import { ME_ID } from '../../domain/types'
import { today } from '../../engine/dates'
import { haptic } from '../../lib/haptics'
import { aiUsedToday, quotaFor, useAiQuota, type AiQuota } from '../../pro/quota'
import { hasFeature } from '../../pro/store'
import { useHealth } from '../../state/health'
import { openPaywall } from '../pro/paywall'
import { aiBanner, smsForAi } from './sms/smsView'

/** Where a split filled in from a message opens. */
export const SMS_SPLIT_PATH = '/app/split/new?from=sms'

export type AiPhase = { kind: 'idle' } | { kind: 'reading' } | { kind: 'error'; error: DescribeError }

export interface SmsAi {
  phase: AiPhase
  /** False while the browser says it's offline. */
  online: boolean
  /** The AI helper isn't set up on this server. */
  off: boolean
  quota: AiQuota
  read: (text: string) => Promise<void>
  /** Back to idle (a new message). */
  reset: () => void
}

function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** `navigator.onLine` is only trustworthy when it says false, so anything else counts as online. */
function readOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, readOnline, () => true)
}

export function useSmsAi(): SmsAi {
  const profile = useProfile()
  const friends = useFriends()
  const quota = useAiQuota()
  const health = useHealth()
  const online = useOnline()
  const request = useRef<AbortController | null>(null)
  const [phase, setPhase] = useState<AiPhase>({ kind: 'idle' })

  // Leaving the screen cancels a read in flight.
  useEffect(
    () => () => {
      request.current?.abort()
      request.current = null
    },
    [],
  )

  const off = health !== 'loading' && health !== null && !health.configured

  const read = async (text: string): Promise<void> => {
    const clean = smsForAi(text)
    if (!clean || !readOnline() || off) return
    // Read fresh, not from this render: after unlocking Pro from the paywall this runs again.
    if (!quotaFor(aiUsedToday(), hasFeature('unlimited_ai')).canUse) {
      haptic('warning')
      openPaywall('unlimited_ai', { onUnlock: () => void read(text) })
      return
    }
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setPhase({ kind: 'reading' })
    try {
      const people = friends.filter((f) => f.id !== ME_ID).map((f) => f.name)
      const draft = await describeSplit(clean, { currency: profile.currency, people, today: today(), source: 'sms' }, controller.signal)
      if (controller.signal.aborted) return
      quota.consume()
      const prefill = describedToPrefill(draft, {
        friends,
        meId: ME_ID,
        currency: profile.currency,
        addFriend: (name) => addFriend({ name }),
      })
      setSplitPrefill({ ...prefill, source: 'sms', banner: aiBanner() })
      haptic('success')
      navigate(SMS_SPLIT_PATH)
    } catch (error) {
      if (controller.signal.aborted) return
      const failure = error instanceof DescribeError ? error : new DescribeError('upstream_error')
      if (failure.code === 'aborted') return
      haptic('error')
      setPhase({ kind: 'error', error: failure })
    } finally {
      if (request.current === controller) request.current = null
    }
  }

  const reset = (): void => {
    request.current?.abort()
    request.current = null
    setPhase({ kind: 'idle' })
  }

  return { phase, online, off, quota, read, reset }
}
