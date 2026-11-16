/**
 * Who is signed in to a Settle account on this phone, shared by every screen. Asked of the server
 * once per visit (the session is an HttpOnly cookie, so only the server knows); screens update it
 * from what their own calls return.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { profileStore } from '../../data'
import { cloud, type Me } from './api'

export type AccountStatus = 'unknown' | 'loading' | 'signedOut' | 'signedIn' | 'unavailable'

export interface AccountState {
  status: AccountStatus
  me: Me | null
  /** Why the server couldn't be asked (offline, account service down). */
  message: string | null
}

let state: AccountState = { status: 'unknown', me: null, message: null }
const listeners = new Set<() => void>()

function set(next: AccountState): void {
  state = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function accountState(): AccountState {
  return state
}

export async function refreshAccount(): Promise<void> {
  if (state.status === 'unknown') set({ ...state, status: 'loading' })
  const res = await cloud<{ me: Me }>('GET', '/me')
  if (res.ok) setMe(res.data.me)
  else if (res.status === 401) set({ status: 'signedOut', me: null, message: null })
  else set({ status: state.me ? 'signedIn' : 'unavailable', me: state.me, message: res.message })
}

export function setMe(me: Me): void {
  set({ status: 'signedIn', me, message: null })
  adoptUpiId(me)
}

/** The account's default UPI ID becomes the phone's own when it has none (pay links and requests use it). */
function adoptUpiId(me: Me): void {
  const upi = me.paymentMethods.find((p) => p.isDefault)?.upiId
  if (upi && !profileStore.get().upiId) profileStore.update((p) => ({ ...p, upiId: upi }))
}

export function setSignedOut(): void {
  set({ status: 'signedOut', me: null, message: null })
}

/** The account, asked of the server the first time any screen needs it. */
export function useAccount(): AccountState {
  const current = useSyncExternalStore(subscribe, accountState, accountState)
  useEffect(() => {
    if (state.status === 'unknown') void refreshAccount()
  }, [])
  return current
}

/** For tests. */
export function resetAccountForTests(): void {
  state = { status: 'unknown', me: null, message: null }
  listeners.clear()
}

/** The account as last known, without asking the server (for rows that shouldn't cause a request). */
export function useAccountPeek(): AccountState {
  return useSyncExternalStore(subscribe, accountState, accountState)
}
