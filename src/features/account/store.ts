/**
 * Who is signed in to a Settle account on this phone, shared by every screen. Asked of the server
 * once per visit (the session is an HttpOnly cookie, so only the server knows); screens update it
 * from what their own calls return.
 */
import { useEffect, useSyncExternalStore } from 'react'
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
  if (res.ok) set({ status: 'signedIn', me: res.data.me, message: null })
  else if (res.status === 401) set({ status: 'signedOut', me: null, message: null })
  else set({ status: state.me ? 'signedIn' : 'unavailable', me: state.me, message: res.message })
}

export function setMe(me: Me): void {
  set({ status: 'signedIn', me, message: null })
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
