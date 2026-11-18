/**
 * Runs the sync (engine.ts) while someone is signed in: on start, a few seconds after any change,
 * every so often to hear about other phones, and when the page is hidden. One cycle at a time.
 */
import * as z from 'zod/mini'
import { clearAllData, expensesStore, flushAllStores, friendsStore, groupsStore, profileStore, STORAGE_KEYS } from '../../../data'
import { reloadStores } from '../../../data/store'
import { expenseSchema, friendSchema, groupSchema } from '../../../data/schemas'
import { t } from '../../../i18n'
import { cloud } from '../api'
import { announceNotified } from '../payRequests'
import { batches, emptyShadow, hashOf, planPull, planPush, recordPushed, type LocalData, type Parsers, type Pulled, type Shadow } from './engine'
import { SHADOW_KEY, setSyncStatus } from './status'

const CHANGE_DELAY_MS = 2_000
const POLL_MS = 20_000
const MAX_PULL_PAGES = 100

const RELATIONAL_KEYS = new Set<string>([STORAGE_KEYS.friends, STORAGE_KEYS.groups, STORAGE_KEYS.expenses])
/**
 * Kept on the phone only: caches anyone can fetch again, and state about this device itself (the
 * install prompt, a share that just arrived, a payment mid-way through checkout).
 */
const DEVICE_ONLY = new Set<string>([
  SHADOW_KEY,
  'settle.v4.rates',
  'settle.v3.billing',
  'settle.v3.pending-payment',
  'settle.v3.migrated',
  'settle.v3.handoff',
  'settle.install.v1',
  'settle.install.session',
  'settle-share',
  'settle-i18n',
])
const KEY = /^settle[.-][A-Za-z0-9._-]+$/
/** A single value bigger than this stays on the phone rather than breaking the sync. */
const MAX_VALUE_CHARS = 1_000_000

/** Everything else Settle keeps is the person's own, and goes to their account. */
export function isSyncedKey(key: string): boolean {
  return KEY.test(key) && key.length <= 80 && !RELATIONAL_KEYS.has(key) && !DEVICE_ONLY.has(key) && !key.endsWith('.unreadable')
}

/** Text that isn't JSON (a few settings are plain words) travels wrapped. */
interface RawText {
  $raw: string
}
function isRawText(value: unknown): value is RawText {
  return typeof value === 'object' && value !== null && typeof (value as RawText).$raw === 'string' && Object.keys(value).length === 1
}

const parsers: Parsers = {
  friend: (v) => {
    const r = z.safeParse(friendSchema, v)
    return r.success ? r.data : null
  },
  group: (v) => {
    const r = z.safeParse(groupSchema, v)
    return r.success ? r.data : null
  },
  expense: (v) => {
    const r = z.safeParse(expenseSchema, v)
    return r.success ? r.data : null
  },
}

/** Hashes of unchanged records are remembered by object (stores keep unchanged objects as they are). */
const objectHashes = new WeakMap<object, string>()
const textHashes = new Map<string, { raw: string; h: string; value: unknown }>()
function hash(value: unknown): string {
  if (typeof value !== 'object' || value === null) return hashOf(value)
  const known = objectHashes.get(value)
  if (known) return known
  const h = hashOf(value)
  objectHashes.set(value, h)
  return h
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function loadShadow(): Shadow {
  try {
    const raw = storage()?.getItem(SHADOW_KEY)
    if (!raw) return emptyShadow()
    return { ...emptyShadow(), ...(JSON.parse(raw) as Partial<Shadow>) }
  } catch {
    return emptyShadow()
  }
}

function saveShadow(shadow: Shadow): void {
  try {
    storage()?.setItem(SHADOW_KEY, JSON.stringify(shadow))
  } catch {
    // Full storage: the next cycle sends a little more than it needs to.
  }
}

/** What's on the phone now. Stores are read as stored, so ones no screen opened yet are included. */
function readLocal(): LocalData {
  const stores: Record<string, unknown> = {}
  const box = storage()
  const keys: string[] = []
  try {
    for (let i = 0; box && i < box.length; i++) {
      const key = box.key(i)
      if (key !== null && isSyncedKey(key)) keys.push(key)
    }
  } catch {
    // Blocked storage: nothing to read.
  }
  for (const key of new Set([...keys, ...Object.keys(loadShadow().stores)])) {
    let raw: string | null
    try {
      raw = box?.getItem(key) ?? null
    } catch {
      raw = null
    }
    if (raw === null || raw.length > MAX_VALUE_CHARS) {
      stores[key] = undefined
      continue
    }
    const known = textHashes.get(key)
    if (known && known.raw === raw) {
      stores[key] = known.value
      continue
    }
    let value: unknown
    try {
      value = JSON.parse(raw) as unknown
    } catch {
      value = { $raw: raw } satisfies RawText
    }
    if (typeof value !== 'object' || value === null) value = { $raw: raw } satisfies RawText
    stores[key] = value
    const h = hashOf(value)
    objectHashes.set(value as object, h)
    textHashes.set(key, { raw, h, value })
  }
  return { friends: friendsStore.get(), groups: groupsStore.get(), expenses: expensesStore.get(), stores }
}

function apply(result: ReturnType<typeof planPull>): void {
  if (result.friends) friendsStore.set(result.friends)
  if (result.groups) groupsStore.set(result.groups)
  if (result.expenses) expensesStore.set(result.expenses)
  const box = storage()
  for (const [key, value] of Object.entries(result.stores)) {
    try {
      if (value === null) box?.removeItem(key)
      else box?.setItem(key, isRawText(value) ? value.$raw : JSON.stringify(value))
    } catch {
      continue
    }
    reloadStores(key)
  }
  flushAllStores()
}

async function pullAll(shadow: Shadow, mode: 'normal' | 'serverWins'): Promise<Shadow | null> {
  let current = shadow
  for (let page = 0; page < MAX_PULL_PAGES; page++) {
    const res = await cloud<Pulled>('GET', `/sync/pull?since=${current.cursor}`)
    if (!res.ok) {
      setSyncStatus({ state: 'error', message: res.message })
      return null
    }
    flushAllStores()
    const result = planPull(current, readLocal(), res.data, mode, parsers, hash, isSyncedKey)
    apply(result)
    if (Object.keys(result.stores).some((key) => !registeredKeys.has(key))) restartNeeded = true
    current = { ...result.shadow, cursor: res.data.cursor }
    saveShadow(current)
    if (!res.data.more) break
  }
  return current
}

async function pushAll(shadow: Shadow): Promise<Shadow | null> {
  let current = shadow
  const plan = planPush(current, readLocal(), Date.now(), hash)
  let pushed = false
  for (const batch of batches(plan)) {
    const res = await cloud<{ written: number }>('POST', '/sync/push', batch.payload)
    if (!res.ok) {
      setSyncStatus({ state: 'error', message: res.message })
      return null
    }
    current = recordPushed(current, batch.entries)
    saveShadow(current)
    pushed = true
  }
  // Friends on Settle in new splits are asked to pay (best effort: the sync is done either way).
  if (pushed) {
    const raised = await cloud<{ notified: number }>('POST', '/requests/raise', {})
    if (raised.ok) announceNotified(raised.data.notified)
  }
  return current
}

/** Keys the stores registry re-reads on its own; anything else is read once, when the page loads. */
const registeredKeys = new Set<string>(Object.values(STORAGE_KEYS))
/** Settings outside the stores came down: the page reloads once so every part of the app uses them. */
let restartNeeded = false

let owner: string | null = null
let inFlight: Promise<void> | null = null
let again = false
let changeTimer: ReturnType<typeof setTimeout> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let unsubscribers: Array<() => void> = []

async function cycle(): Promise<void> {
  const userId = owner
  if (!userId) return
  setSyncStatus({ state: 'syncing' })
  flushAllStores()
  let shadow = loadShadow()
  if (shadow.owner !== null && shadow.owner !== userId) {
    // This phone's data belongs to another account: it must not mix into this one.
    clearAllData()
    shadow = emptyShadow()
    saveShadow(shadow)
  }
  const first = shadow.owner === null
  let next: Shadow | null = shadow
  if (first) {
    next = await pullAll(shadow, 'serverWins')
    if (!next) return
    next = { ...next, owner: userId }
    saveShadow(next)
  }
  next = await pushAll(next)
  if (!next) return
  if (!first) next = await pullAll(next, 'normal')
  if (!next || owner !== userId) return
  setSyncStatus({ state: 'synced', lastSyncedAt: Date.now(), message: null })
  if (first && restartNeeded) {
    restartNeeded = false
    window.location.reload()
  }
  restartNeeded = false
}

/** Syncs now (or right after the cycle already running). */
export function syncNow(): Promise<void> {
  if (inFlight) {
    again = true
    return inFlight
  }
  inFlight = cycle()
    .catch(() => setSyncStatus({ state: 'error', message: t('account.sync.error') }))
    .finally(() => {
      inFlight = null
      if (again && owner) {
        again = false
        void syncNow()
      }
    })
  return inFlight
}

function soon(): void {
  if (changeTimer !== null) clearTimeout(changeTimer)
  changeTimer = setTimeout(() => {
    changeTimer = null
    void syncNow()
  }, CHANGE_DELAY_MS)
}

function onVisibility(): void {
  if (document.visibilityState === 'hidden') void syncNow()
  else soon()
}

export function startCloudSync(userId: string): void {
  if (owner === userId) return
  stopCloudSync()
  owner = userId
  unsubscribers = [friendsStore, groupsStore, expensesStore, profileStore].map((store) => store.subscribe(soon))
  pollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow()
  }, POLL_MS)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('online', soon)
  void syncNow()
}

export function stopCloudSync(): void {
  owner = null
  for (const off of unsubscribers) off()
  unsubscribers = []
  if (pollTimer !== null) clearInterval(pollTimer)
  if (changeTimer !== null) clearTimeout(changeTimer)
  pollTimer = null
  changeTimer = null
  if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
  if (typeof window !== 'undefined') window.removeEventListener('online', soon)
  setSyncStatus({ state: 'off' })
}

/** Signing out: this phone forgets the account's data (it's safe on the account). */
export function forgetThisPhone(): void {
  stopCloudSync()
  clearAllData()
  const box = storage()
  try {
    const keys: string[] = []
    for (let i = 0; box && i < box.length; i++) {
      const key = box.key(i)
      if (key !== null && (isSyncedKey(key) || key === SHADOW_KEY)) keys.push(key)
    }
    for (const key of keys) box?.removeItem(key)
  } catch {
    // Blocked storage: nothing to forget.
  }
  textHashes.clear()
}
