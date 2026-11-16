/** Where syncing with the account stands, for the account screen. Tiny, so screens can import it eagerly. */
import { useSyncExternalStore } from 'react'

export interface SyncStatus {
  state: 'off' | 'syncing' | 'synced' | 'error'
  /** When the phone and the account last matched (epoch ms). */
  lastSyncedAt: number | null
  message: string | null
}

let status: SyncStatus = { state: 'off', lastSyncedAt: null, message: null }
const listeners = new Set<() => void>()

export function setSyncStatus(next: Partial<SyncStatus>): void {
  status = { ...status, ...next }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const read = () => status

/** The status right now (outside React). */
export function syncStatus(): SyncStatus {
  return status
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribe, read, read)
}

/** Where the phone remembers what it last agreed with the account. Not itself synced. */
export const SHADOW_KEY = 'settle-cloud-sync'

/** The account this phone's data belongs to, without loading the sync engine. */
export function linkedOwner(): string | null {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(SHADOW_KEY)
    const owner = raw ? (JSON.parse(raw) as { owner?: unknown }).owner : null
    return typeof owner === 'string' ? owner : null
  } catch {
    return null
  }
}
