/**
 * Whether the server can scan bills (`GET /api/health`), fetched once per page load and shared.
 * A failed check (e.g. offline) is retried when the browser comes back online.
 *
 * "Scanning is off" is remembered on this device, so a returning visitor gets the typing-first
 * home screen on the first paint instead of photo buttons that vanish a moment later. The live
 * check still runs every visit and replaces the remembered answer.
 */
import { useSyncExternalStore } from 'react'
import type { HealthResponse } from '../../shared/api'
import { getHealth } from '../api/client'

export type HealthState = HealthResponse | null | 'loading'

/** localStorage key for the last known `configured` flag. */
export const HEALTH_KEY = 'billsplit.health.v1'

/** The last known answer, or null. Never throws. */
function savedConfigured(): boolean | null {
  try {
    const raw = window.localStorage.getItem(HEALTH_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const configured = (parsed as { configured?: unknown }).configured
    return typeof configured === 'boolean' ? configured : null
  } catch {
    return null
  }
}

function saveConfigured(configured: boolean): void {
  try {
    window.localStorage.setItem(HEALTH_KEY, JSON.stringify({ configured }))
  } catch {
    // Storage blocked — the next visit just starts from 'loading'.
  }
}

/** Where a page load starts: "scanning is off" if that's what this device last heard, else loading. */
function initialState(): HealthState {
  if (typeof window === 'undefined') return 'loading'
  return savedConfigured() === false ? { ok: true, configured: false, models: [] } : 'loading'
}

let state: HealthState = initialState()
let started = false
let inflight = false
/** Bumped by resets so a stale in-flight check can't overwrite a newer state. */
let generation = 0
const listeners = new Set<() => void>()

function publish(next: HealthState): void {
  state = next
  for (const listener of listeners) listener()
}

function fetchHealth(): void {
  if (inflight) return
  inflight = true
  const gen = generation
  void getHealth().then((result) => {
    if (gen !== generation) return
    inflight = false
    if (result) saveConfigured(result.configured)
    publish(result)
  })
}

/**
 * A scan just failed because the service can't scan (no key, or the key was rejected): the rest
 * of this visit — and the next one, until a health check says otherwise — leads with typing.
 * Wins over a check that was already on its way (that answer predates the failed scan).
 */
export function markScanningUnavailable(): void {
  generation++
  inflight = false
  saveConfigured(false)
  const models = typeof state === 'object' && state !== null ? state.models : []
  publish({ ok: true, configured: false, models })
}

function onOnline(): void {
  if (state === null) fetchHealth()
}

/** Starts the health check if it hasn't run yet (e.g. at app start, before any screen asks). */
export function prefetchHealth(): void {
  if (started || typeof window === 'undefined') return
  started = true
  window.addEventListener('online', onOnline)
  fetchHealth()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  prefetchHealth()
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): HealthState {
  return state
}

/**
 * `'loading'` until the check finishes (or the remembered "scanning is off" meanwhile), then the
 * server's answer — or null if it couldn't be reached.
 */
export function useHealth(): HealthState {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'loading')
}

/** Forgets this page load's result, as if the page had just loaded (tests): re-seeds from storage. */
export function resetHealthForTests(): void {
  if (typeof window !== 'undefined') window.removeEventListener('online', onOnline)
  generation++
  state = initialState()
  started = false
  inflight = false
  listeners.clear()
}
