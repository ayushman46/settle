/**
 * Keeps every shared group on this phone in step with its room on the server: a change here goes
 * out a moment later, and what the others changed comes in when the app is opened, comes back to
 * the front, comes online, and every few seconds while it's on screen. Each round is the same:
 * take the room's copy, merge it with this phone's, and leave the result there if it says more.
 * When the server has nowhere to keep copies, groups still merge from links (see JoinPage).
 */
import { useSyncExternalStore } from 'react'
import { expensesStore, friendsStore, groupsStore, profileStore } from '../../data/stores'
import { buildWire, syncLocal } from './local'
import { groupSyncStore, putShared, sharedFor } from './store'
import { pull, push } from './transport'
import { canonical, type WireGroup } from './wire'

/** How long after a change here before it's sent (changes made together go together). */
export const SEND_DELAY_MS = 700
/** How often the room is checked while the app is on screen. */
export const CHECK_EVERY_MS = 8000

export type SyncState =
  /** Live and up to date as of `at`. */
  | { kind: 'live'; at: number }
  | { kind: 'syncing' }
  /** Couldn't reach the server: changes wait on this phone. */
  | { kind: 'waiting' }
  /** This server doesn't keep copies: the group travels by link. */
  | { kind: 'links' }

/** What the last round with the room left there, per group (not kept between visits: the first round finds out). */
const rooms = new Map<string, { v: string | null; text: string | null }>()
const states = new Map<string, SyncState>()
const listeners = new Set<() => void>()
const running = new Map<string, Promise<void>>()
const again = new Set<string>()
/** What others brought in, for whoever is looking at the group (a toast). */
const newsListeners = new Set<(groupId: string, news: NonNullable<ReturnType<typeof syncLocal>>['news']) => void>()
let off = false

function setState(groupId: string, state: SyncState): void {
  const prev = states.get(groupId)
  if (prev?.kind === state.kind && (state.kind !== 'live' || (prev.kind === 'live' && prev.at === state.at))) return
  states.set(groupId, state)
  for (const listener of [...listeners]) listener()
}

export function onGroupNews(listener: (groupId: string, news: NonNullable<ReturnType<typeof syncLocal>>['news']) => void): () => void {
  newsListeners.add(listener)
  return () => newsListeners.delete(listener)
}

/** Where a shared group's sync stands (null: not shared, or not tried yet this visit). */
export function useSyncState(groupId: string | null | undefined): SyncState | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => (groupId ? (states.get(groupId) ?? null) : null),
    () => null,
  )
}

/** True once this visit has found the server can't keep copies. */
export function liveIsOff(): boolean {
  return off
}

async function round(groupId: string): Promise<void> {
  const shared = sharedFor(groupId)
  if (!shared) return
  if (off) {
    syncLocal(groupId, null)
    setState(groupId, { kind: 'links' })
    return
  }
  const room = rooms.get(groupId) ?? { v: null, text: null }
  if (!states.has(groupId)) setState(groupId, { kind: 'syncing' })
  const pulled = await pull(shared.key, room.v)
  if (pulled.kind === 'off') {
    off = true
    syncLocal(groupId, null)
    setState(groupId, { kind: 'links' })
    return
  }
  if (pulled.kind === 'failed') {
    syncLocal(groupId, null)
    setState(groupId, { kind: 'waiting' })
    return
  }
  let theirs: WireGroup | null = null
  if (pulled.kind === 'copy') {
    theirs = pulled.wire
    room.v = pulled.v
    room.text = canonical(pulled.wire)
  } else if (pulled.v === null) {
    room.v = null
    room.text = null
  }
  const out = syncLocal(groupId, theirs)
  if (!out) return
  if (theirs && (out.news.added || out.news.changed || out.news.removed || out.news.payments || out.news.joined.length)) {
    for (const listener of [...newsListeners]) listener(groupId, out.news)
  }
  if (out.text !== room.text) {
    const v = await push(out.wire, shared.key)
    if (v === null) {
      rooms.set(groupId, room)
      setState(groupId, { kind: 'waiting' })
      return
    }
    room.v = v
    room.text = out.text
  }
  rooms.set(groupId, room)
  const now = Date.now()
  const latest = sharedFor(groupId)
  if (latest) putShared({ ...latest, synced: { at: now, hash: room.v ?? '' } })
  setState(groupId, { kind: 'live', at: now })
}

/** One round for a group now (rounds for the same group never overlap; a request during one runs another after). */
export function syncNow(groupId: string): Promise<void> {
  const current = running.get(groupId)
  if (current) {
    again.add(groupId)
    return current
  }
  const run = round(groupId)
    .catch(() => setState(groupId, { kind: 'waiting' }))
    .finally(() => {
      running.delete(groupId)
      if (again.delete(groupId)) void syncNow(groupId)
    })
  running.set(groupId, run)
  return run
}

export function syncAll(): void {
  for (const groupId of Object.keys(groupSyncStore.get())) void syncNow(groupId)
}

/** Sends what changed here: only the groups whose copy now reads differently from the room's. */
function sendChanges(): void {
  for (const shared of Object.values(groupSyncStore.get())) {
    const built = buildWire(shared)
    if (built && canonical(built.wire) !== rooms.get(shared.groupId)?.text) void syncNow(shared.groupId)
  }
}

let started = false

/** Starts keeping shared groups in step (once per page; safe to call again). Returns how to stop (tests). */
export function startGroupSync(): () => void {
  if (started || typeof window === 'undefined') return () => undefined
  started = true
  let timer: number | undefined
  const changed = (): void => {
    if (Object.keys(groupSyncStore.get()).length === 0) return
    window.clearTimeout(timer)
    timer = window.setTimeout(sendChanges, SEND_DELAY_MS)
  }
  const unsubscribe = [groupsStore, expensesStore, friendsStore, profileStore].map((store) => store.subscribe(changed))
  const visible = (): void => {
    if (document.visibilityState === 'visible') syncAll()
  }
  const online = (): void => {
    off = false
    syncAll()
  }
  document.addEventListener('visibilitychange', visible)
  window.addEventListener('online', online)
  const interval = window.setInterval(() => {
    if (document.visibilityState === 'visible' && !off) syncAll()
  }, CHECK_EVERY_MS)
  syncAll()
  return () => {
    started = false
    window.clearTimeout(timer)
    window.clearInterval(interval)
    for (const stop of unsubscribe) stop()
    document.removeEventListener('visibilitychange', visible)
    window.removeEventListener('online', online)
  }
}

/** Forgets what this visit learned (tests). */
export function resetGroupSyncForTests(): void {
  rooms.clear()
  states.clear()
  running.clear()
  again.clear()
  off = false
}
