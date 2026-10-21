/**
 * Tiny persisted stores. Each collection lives under its own localStorage key as
 * `{ v: version, data }`, is validated with zod when read (bad records are dropped one by one by
 * the schemas, never the whole collection), follows other tabs through the `storage` event, and
 * is written at most every ~150 ms plus once more when the page is hidden or closed.
 * Every storage access is guarded: private mode or a full disk never breaks the app.
 */
import { useMemo, useState, useSyncExternalStore } from 'react'
import * as z from 'zod/mini'

/** Any zod (classic or mini) schema whose output is `T`. */
export type ZodType<T> = z.core.$ZodType<T>

export interface Store<T> {
  get(): T
  set(next: T): void
  update(fn: (prev: T) => T): void
  subscribe(listener: () => void): () => void
}

export interface PersistedStore<T> extends Store<T> {
  readonly key: string
  /** Writes a pending change now. */
  flush(): void
  /** Drops the in-memory copy; the next read comes from storage again (tests, "clear all data"). */
  reload(): void
}

export interface CreateStoreOptions<T> {
  key: string
  schema: ZodType<T>
  initial: () => T
  version: number
  /** Upgrades anything that isn't a current-version envelope (older formats). Null = unusable. */
  migrate?: (raw: unknown) => T | null
}

/** Pending changes are written at most this long after they happen. */
export const WRITE_DELAY_MS = 150

interface Envelope {
  v: number
  data: unknown
}

function isEnvelope(value: unknown): value is Envelope {
  return typeof value === 'object' && value !== null && typeof (value as { v?: unknown }).v === 'number' && 'data' in value
}

/** localStorage, or null when it's unavailable (SSR, blocked cookies, some private modes). */
export function localStore(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ write health */

let writeOk = true
const healthListeners = new Set<() => void>()

function setWriteOk(ok: boolean): void {
  if (ok === writeOk) return
  writeOk = ok
  for (const listener of [...healthListeners]) listener()
}

function subscribeHealth(listener: () => void): () => void {
  healthListeners.add(listener)
  return () => healthListeners.delete(listener)
}

/** False after a save failed (storage full or blocked) until the next save succeeds. */
export function useStorageWritable(): boolean {
  return useSyncExternalStore(
    subscribeHealth,
    () => writeOk,
    () => true,
  )
}

/* ------------------------------------------------------------------ registry */

const registry = new Set<PersistedStore<unknown>>()
let pageListenersAttached = false

function attachPageListeners(): void {
  if (pageListenersAttached || typeof window === 'undefined') return
  pageListenersAttached = true
  window.addEventListener('pagehide', flushAllStores)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAllStores()
  })
}

/** Writes every store's pending changes now. */
export function flushAllStores(): void {
  for (const store of registry) store.flush()
}

/** Every store re-reads storage on next access, pending writes are dropped and subscribers told. Tests only. */
export function reloadAllStores(): void {
  for (const store of registry) store.reload()
  writeOk = true
}

/* ------------------------------------------------------------------ createStore */

export function createStore<T>(opts: CreateStoreOptions<T>): PersistedStore<T> {
  const { key, schema, initial, version, migrate } = opts
  const listeners = new Set<() => void>()
  let state: T
  let loaded = false
  let dirty = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let storageListenerAttached = false

  /** Reads a raw stored string. `persist` = the value came from an old format and should be re-saved. */
  function decode(raw: string | null): { value: T; persist: boolean } {
    if (raw === null) return { value: initial(), persist: false }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { value: initial(), persist: false }
    }
    if (isEnvelope(parsed) && parsed.v >= version) {
      const result = z.safeParse(schema, parsed.data)
      if (result.success) return { value: result.data, persist: false }
      return { value: initial(), persist: false }
    }
    if (migrate) {
      try {
        const migrated = migrate(parsed)
        if (migrated !== null) return { value: migrated, persist: true }
      } catch {
        // An unreadable old format is treated like no data.
      }
    }
    return { value: initial(), persist: false }
  }

  function readStorage(): { value: T; persist: boolean } {
    let raw: string | null
    try {
      raw = localStore()?.getItem(key) ?? null
    } catch {
      raw = null
    }
    return decode(raw)
  }

  function notify(): void {
    for (const listener of [...listeners]) listener()
  }

  function onStorage(event: StorageEvent): void {
    if (event.storageArea && event.storageArea !== localStore()) return
    if (event.key !== key && event.key !== null) return
    // Our own unsaved change is newer: keep it; the other tab adopts it once we write.
    if (dirty || !loaded) return
    const next = decode(event.key === null ? null : event.newValue).value
    state = next
    notify()
  }

  function ensureLoaded(): void {
    if (loaded) return
    const { value, persist } = readStorage()
    state = value
    loaded = true
    if (persist) scheduleWrite()
    attachPageListeners()
    if (!storageListenerAttached && typeof window !== 'undefined') {
      storageListenerAttached = true
      window.addEventListener('storage', onStorage)
    }
  }

  function write(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (!dirty) return
    dirty = false
    const storage = localStore()
    if (!storage) {
      setWriteOk(false)
      return
    }
    try {
      const envelope: Envelope = { v: version, data: state }
      storage.setItem(key, JSON.stringify(envelope))
      setWriteOk(true)
    } catch {
      setWriteOk(false)
    }
  }

  function scheduleWrite(): void {
    dirty = true
    if (timer === null) timer = setTimeout(write, WRITE_DELAY_MS)
  }

  const store: PersistedStore<T> = {
    key,
    get() {
      ensureLoaded()
      return state
    },
    set(next) {
      ensureLoaded()
      if (Object.is(next, state)) return
      state = next
      scheduleWrite()
      notify()
    },
    update(fn) {
      store.set(fn(store.get()))
    },
    subscribe(listener) {
      ensureLoaded()
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    flush: write,
    reload() {
      if (timer !== null) clearTimeout(timer)
      timer = null
      dirty = false
      loaded = false
      notify()
    },
  }
  registry.add(store as PersistedStore<unknown>)
  return store
}

/* ------------------------------------------------------------------ React */

interface Box<V> {
  current: V
}

/**
 * A `getSnapshot` for `useSyncExternalStore` that runs `selector` once per store state and hands
 * back the previous selection while it's `isEqual` to the new one. `last` carries that previous
 * selection across selector changes (a new filter, an inline selector).
 */
function selectionGetter<T, S>(
  store: Store<T>,
  selector: (state: T) => S,
  isEqual: (a: S, b: S) => boolean,
  last: Box<{ selection: S } | null>,
): () => S {
  let memo: { state: T; selection: S } | null = null
  return () => {
    const state = store.get()
    if (memo && Object.is(memo.state, state)) return memo.selection
    const next = selector(state)
    const previous = memo ?? last.current
    const selection = previous && isEqual(previous.selection, next) ? previous.selection : next
    memo = { state, selection }
    last.current = { selection }
    return selection
  }
}

/**
 * Subscribes a component to `selector(store state)`. Re-renders only when the selection
 * changes by `isEqual` (default `Object.is`), and keeps returning the previous selection object
 * while it's equal — so derived arrays stay referentially stable for memo deps.
 */
export function useStore<T, S>(store: Store<T>, selector: (state: T) => S, isEqual: (a: S, b: S) => boolean = Object.is): S {
  // A mutable box (not a ref: it's only touched from getSnapshot, never read for rendering).
  const [last] = useState<Box<{ selection: S } | null>>(() => ({ current: null }))
  const getSelection = useMemo(() => selectionGetter(store, selector, isEqual, last), [store, selector, isEqual, last])
  return useSyncExternalStore(store.subscribe, getSelection, getSelection)
}

/** `isEqual` for arrays: same length and the same items (by identity) in the same order. */
export function shallowArrayEqual<A>(a: readonly A[], b: readonly A[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false
  return true
}

/** `isEqual` for flat records: same keys with identical values. */
export function shallowRecordEqual<V>(a: Readonly<Record<string, V>>, b: Readonly<Record<string, V>>): boolean {
  if (a === b) return true
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  for (const k of ka) if (!Object.hasOwn(b, k) || !Object.is(a[k], b[k])) return false
  return true
}

/** Memoizes a one-argument function on the identity of its last argument. */
export function memoizeLast<A, R>(fn: (arg: A) => R): (arg: A) => R {
  let has = false
  let lastArg: A
  let lastResult: R
  return (arg: A) => {
    if (has && Object.is(arg, lastArg)) return lastResult
    lastResult = fn(arg)
    lastArg = arg
    has = true
    return lastResult
  }
}
