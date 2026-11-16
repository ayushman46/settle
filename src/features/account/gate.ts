/**
 * Settle needs an account: everything a person keeps is saved to it. Where passkeys can't work at
 * all (an old browser, or the Android app's web view on a phone without passkey support) nobody
 * could ever get in, so the app keeps working on the phone alone there instead of locking them out.
 */
import { useEffect, useState } from 'react'
import { inAndroidApp } from '../../lib/nativeApp'
import { refreshAccount, useAccountPeek } from './store'
import { linkedOwner } from './sync/status'

/** How long the Android app waits for the phone to say whether it can make a passkey. */
const ASK_DEVICE_MS = 3_000

interface PasskeyApi {
  isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>
}

function passkeyApi(): PasskeyApi | null {
  if (typeof window === 'undefined') return null
  const api = (window as { PublicKeyCredential?: unknown }).PublicKeyCredential
  return typeof api === 'function' ? (api as PasskeyApi) : null
}

/** True where the browser has passkeys at all (the Android app also asks the phone itself). */
export function accountRequired(): boolean {
  return passkeyApi() !== null
}

/** pass: show the page. wait: still finding out. signin: send them to sign in first. */
export type Gate = 'pass' | 'wait' | 'signin'

export function useAccountGate(exempt: boolean): Gate {
  const [required, setRequired] = useState<boolean | null>(() => {
    if (!accountRequired()) return false
    return inAndroidApp() ? null : true
  })
  const account = useAccountPeek()

  useEffect(() => {
    if (required !== null) return
    let live = true
    const check = passkeyApi()?.isUserVerifyingPlatformAuthenticatorAvailable?.() ?? Promise.resolve(false)
    const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ASK_DEVICE_MS))
    void Promise.race([check, timeout])
      .catch(() => false)
      .then((ok) => {
        if (live) setRequired(ok)
      })
    return () => {
      live = false
    }
  }, [required])

  useEffect(() => {
    if (required === true && account.status === 'unknown') void refreshAccount()
  }, [required, account.status])

  if (exempt || required === false || account.status === 'signedIn') return 'pass'
  if (required === null) return 'wait'
  // A phone already linked to an account keeps working when the server can't be reached.
  if (linkedOwner() !== null && account.status !== 'signedOut') return 'pass'
  if (account.status === 'unknown' || account.status === 'loading') return 'wait'
  return 'signin'
}
