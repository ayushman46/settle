/**
 * The Pro license on this device: one signed token in localStorage, nothing on any server.
 *
 * A stored token was checked before it was saved, so the app opens straight into Pro (no flash
 * of the free state). Each visit re-checks the signature quietly; a token that turns out not to
 * be genuine is ignored (but never deleted — a paid license isn't thrown away on a hunch).
 * Status flips to 'expired' the moment a pass runs out, even with the app open.
 */
import { useSyncExternalStore } from 'react'
import type { License, ProFeature } from '../domain/types'
import { exchangePayment } from './claim'
import { knownLicensePublicKey, loadBillingConfig } from './config'
import { checkLicenseToken, isLicenseActive } from './license'
import { clearPendingPayment, readPendingPayment, savePendingPayment, type PendingPayment } from './pending'
import { extractLicenseToken, LICENSE_HEADER, parseLicenseToken } from './token'

export const LICENSE_KEY = 'settle.v3.license'

export type ProStatus = 'loading' | 'free' | 'pro' | 'expired'

export interface ProState {
  isPro: boolean
  /** The license on this device (also when expired), or null. */
  license: License | null
  /** 'loading' only before the device has been read (server rendering). */
  status: ProStatus
  /** When Pro ends, epoch MILLISECONDS (`license.exp × 1000`) for `new Date()`; null for free and lifetime. */
  expiresAt: number | null
}

export type RedeemResult =
  | { ok: true; license: License }
  /** invalid: not a Settle code (or a forged one) · expired: genuine but over · network: couldn't check it. */
  | { ok: false; reason: 'invalid' | 'expired' | 'network' }

const FREE: ProState = Object.freeze({ isPro: false, license: null, status: 'free', expiresAt: null })
const LOADING: ProState = Object.freeze({ isPro: false, license: null, status: 'loading', expiresAt: null })

/** setTimeout's ceiling (~24.8 days); longer waits are re-armed when they fire. */
const MAX_TIMER_MS = 2_147_483_647

/* ------------------------------------------------------------------ storage */

interface Stored {
  token: string
  license: License
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function readStored(): Stored | null {
  try {
    const raw = storage()?.getItem(LICENSE_KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const token = (value as { token?: unknown }).token
    if (typeof token !== 'string') return null
    const parsed = parseLicenseToken(token)
    return parsed ? { token, license: parsed.license } : null
  } catch {
    return null
  }
}

function writeStored(token: string | null): void {
  try {
    if (token === null) storage()?.removeItem(LICENSE_KEY)
    else storage()?.setItem(LICENSE_KEY, JSON.stringify({ v: 1, token }))
  } catch {
    // Blocked or full storage: Pro still works for this visit.
  }
}

/* ------------------------------------------------------------------ state */

let stored: Stored | null = null
/** A token this visit proved isn't genuine — ignored until it's replaced. */
let rejected: string | null = null
/** The token whose quiet re-check has run (or is running) this visit. */
let checked: string | null = null
let state: ProState = FREE
let started = false
let expiryTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

function compute(now: number = Date.now()): ProState {
  if (!stored || stored.token === rejected) return FREE
  const { license } = stored
  const active = isLicenseActive(license, now / 1000)
  return {
    isPro: active,
    license,
    status: active ? 'pro' : 'expired',
    expiresAt: license.exp === null ? null : license.exp * 1000,
  }
}

function sameState(a: ProState, b: ProState): boolean {
  return a.status === b.status && a.expiresAt === b.expiresAt && a.license?.id === b.license?.id && a.license?.plan === b.license?.plan
}

function armExpiryTimer(): void {
  if (expiryTimer !== null) clearTimeout(expiryTimer)
  expiryTimer = null
  if (state.status !== 'pro' || state.expiresAt === null) return
  const wait = Math.min(Math.max(0, state.expiresAt - Date.now()) + 50, MAX_TIMER_MS)
  expiryTimer = setTimeout(publish, wait)
}

function publish(): void {
  const next = compute()
  if (!sameState(next, state)) {
    state = next
    for (const listener of listeners) listener()
  }
  armExpiryTimer()
}

/** Quietly re-checks the stored token's signature once per visit. */
function recheck(): void {
  const current = stored
  if (!current || checked === current.token) return
  const token = current.token
  checked = token
  void (async () => {
    const key = knownLicensePublicKey() ?? (await loadBillingConfig()).licensePublicKey
    const result = await checkLicenseToken(token, key)
    if (stored?.token !== token) return
    if (result.status === 'invalid') {
      rejected = token
      publish()
    } else if (result.status === 'unverified') {
      checked = null // try again when we're back online
    }
  })()
}

function onStorage(event: StorageEvent): void {
  if (event.key !== null && event.key !== LICENSE_KEY) return
  stored = readStored()
  publish()
  recheck()
}

function onVisible(): void {
  if (document.visibilityState === 'visible') publish()
}

function onOnline(): void {
  recheck()
  void resumePendingPayment()
}

function start(): void {
  if (started) return
  started = true
  stored = readStored()
  state = compute()
  armExpiryTimer()
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage)
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
  }
  recheck()
  void resumePendingPayment()
}

/** Ends later (null = never) — the license to keep when two are on offer. */
function outlasts(a: License, b: License): boolean {
  if (a.exp === null) return true
  if (b.exp === null) return false
  return a.exp >= b.exp
}

/**
 * Saves a checked token as this device's license — unless the current one is active and lasts
 * at least as long (redeeming a 30-day code never cuts short a lifetime pass). Returns the
 * license now in force.
 */
function adopt(token: string, license: License): License {
  start()
  const current = stored && stored.token !== rejected ? stored : null
  if (current && current.token !== token && isLicenseActive(current.license) && outlasts(current.license, license)) {
    return current.license
  }
  writeStored(token)
  stored = { token, license }
  rejected = null
  checked = token
  publish()
  return license
}

/* ------------------------------------------------------------------ public API */

/** The Pro state right now (outside React). */
export function proState(): ProState {
  start()
  return state
}

function subscribe(listener: () => void): () => void {
  start()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Live Pro status for screens; re-renders when a pass is redeemed, bought, cleared or runs out. */
export function usePro(): ProState {
  return useSyncExternalStore(subscribe, proState, () => LOADING)
}

/** Which features need an active pass (all of them, today). Anything that isn't a `ProFeature` is free forever. */
const NEEDS_PRO: Readonly<Record<ProFeature, boolean>> = {
  unlimited_ai: true,
  recurring: true,
  insights: true,
  export: true,
  themes: true,
  clean_cards: true,
}

/** Whether `feature` is unlocked right now. */
export function hasFeature(feature: ProFeature): boolean {
  return !NEEDS_PRO[feature] || proState().isPro
}

/** `hasFeature` for components (re-renders on change). */
export function useHasFeature(feature: ProFeature): boolean {
  const { isPro } = usePro()
  return !NEEDS_PRO[feature] || isPro
}

/**
 * Checks a code (the token, or any text or link containing it) and, when genuine and active,
 * makes it this device's license.
 */
export async function redeemLicense(input: string): Promise<RedeemResult> {
  start()
  const token = extractLicenseToken(input)
  if (!token) return { ok: false, reason: 'invalid' }

  const key = (await loadBillingConfig()).licensePublicKey
  let check = await checkLicenseToken(token, key)
  if (check.status === 'invalid') {
    // The remembered key may be out of date — one more try with the server's current one.
    const freshKey = (await loadBillingConfig({ fresh: true })).licensePublicKey
    if (freshKey && freshKey !== key) check = await checkLicenseToken(token, freshKey)
  }
  if (check.status === 'invalid') return { ok: false, reason: 'invalid' }
  if (check.status === 'unverified') return { ok: false, reason: 'network' }
  if (!isLicenseActive(check.license)) return { ok: false, reason: 'expired' }
  return { ok: true, license: adopt(token, check.license) }
}

/** Removes the license from this device (Pro ends here; the code still works elsewhere). */
export function clearLicense(): void {
  start()
  writeStored(null)
  stored = null
  rejected = null
  checked = null
  publish()
}

/** The stored license token — e.g. to show as "your code" for moving Pro to a new phone. */
export function licenseToken(): string | null {
  start()
  return stored && stored.token !== rejected ? stored.token : null
}

/** `{ 'X-Settle-License': token }` while Pro is active (for the AI endpoints' Pro allowance), else `{}`. */
export function licenseHeaders(): Record<string, string> {
  const token = licenseToken()
  return token && state.isPro ? { [LICENSE_HEADER]: token } : {}
}

/* ------------------------------------------------------------------ claiming a payment */

export type ClaimOutcome =
  | { ok: true; license: License }
  /** pending: the payment is safe on this device and will be claimed again automatically. */
  | { ok: false; pending: boolean }

/** Waits between claim attempts (exported for tests). */
export const CLAIM_RETRY_DELAYS_MS: readonly number[] = [1_500, 4_000]

let claiming: Promise<ClaimOutcome> | null = null

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function claimOnce(payment: PendingPayment, retries: readonly number[]): Promise<ClaimOutcome> {
  try {
    return await attemptClaims(payment, retries)
  } catch {
    return { ok: false, pending: true } // still written down — the next visit tries again
  }
}

async function attemptClaims(payment: PendingPayment, retries: readonly number[]): Promise<ClaimOutcome> {
  for (let attempt = 0; ; attempt++) {
    const result = await exchangePayment(payment)
    if (result.ok) {
      const key = (await loadBillingConfig()).licensePublicKey
      const check = await checkLicenseToken(result.token, key)
      const parsed = parseLicenseToken(result.token)
      // Fresh from our own server for this payment: keep it unless it's provably not genuine.
      if (check.status === 'invalid' || !parsed) {
        clearPendingPayment()
        return { ok: false, pending: false }
      }
      const license = adopt(result.token, check.status === 'valid' ? check.license : parsed.license)
      clearPendingPayment()
      return { ok: true, license }
    }
    if (!result.retriable) {
      clearPendingPayment()
      return { ok: false, pending: false }
    }
    const delay = retries[attempt]
    if (delay === undefined) return { ok: false, pending: true }
    await wait(delay)
  }
}

/**
 * Exchanges a payment Razorpay just confirmed for a license, retrying briefly. The payment is
 * written down first, so if every attempt fails it's claimed again on the next visit.
 */
export function claimPayment(payment: PendingPayment): Promise<ClaimOutcome> {
  start()
  savePendingPayment(payment)
  // After any claim already running (e.g. a resumed one), never alongside it.
  return track((claiming ?? Promise.resolve()).then(() => claimOnce(payment, CLAIM_RETRY_DELAYS_MS)))
}

function track(run: Promise<ClaimOutcome>): Promise<ClaimOutcome> {
  const tracked: Promise<ClaimOutcome> = run.finally(() => {
    if (claiming === tracked) claiming = null
  })
  claiming = tracked
  return tracked
}

/** Claims a payment left over from an earlier visit, if any (once at a time). */
export async function resumePendingPayment(): Promise<License | null> {
  const payment = readPendingPayment()
  if (!payment || claiming) return null
  const outcome = await track(claimOnce(payment, []))
  return outcome.ok ? outcome.license : null
}

/** Forgets this visit's state and re-reads the device (tests). */
export function resetProForTests(): void {
  if (typeof window !== 'undefined') {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
  }
  if (expiryTimer !== null) clearTimeout(expiryTimer)
  expiryTimer = null
  started = false
  stored = null
  rejected = null
  checked = null
  claiming = null
  state = FREE
  listeners.clear()
}
