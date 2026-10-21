/**
 * Pro plans, prices and the license public key (`GET /api/billing/config`), fetched once per page
 * load and remembered on the device, so the paywall paints instantly and licenses can be checked
 * offline. When the server can't be reached and nothing is remembered, the built-in plans stand
 * in (with checkout off) — the paywall never shows an empty state.
 */
import { useSyncExternalStore } from 'react'
import type { BillingConfig, Plan } from '../../shared/api'
import type { PlanId } from '../domain/types'
import { callApi, isRecord } from '../api/http'
import { isPlanId } from './token'

export type { BillingConfig, Plan } from '../../shared/api'

/** localStorage key for the last config the server sent. */
export const BILLING_CACHE_KEY = 'settle.v3.billing'

export const BILLING_CONFIG_TIMEOUT_MS = 8_000

/** The Pro allowance per day when the server doesn't say (fair use). */
const DEFAULT_PRO_AI_PER_DAY = 200

/** Used until the server answers, and whenever it can't: the launch prices (as server/plans.ts builds them), checkout off. */
export const FALLBACK_BILLING_CONFIG: BillingConfig = Object.freeze<BillingConfig>({
  checkout: null,
  keyId: null,
  currency: 'INR',
  plans: [
    { id: 'pro_monthly', name: 'Monthly', amount: 4900, currency: 'INR', days: 30, badge: null, savingsPercent: null },
    // 12 × ₹49 = ₹588 a year; ₹399 saves ₹189 → 32% (rounded down, never overstated).
    { id: 'pro_yearly', name: 'Yearly', amount: 39900, currency: 'INR', days: 365, badge: 'Best value', savingsPercent: 32 },
    { id: 'pro_lifetime', name: 'Lifetime', amount: 99900, currency: 'INR', days: null, badge: 'Pay once', savingsPercent: null },
  ],
  licensePublicKey: null,
  proAiPerDay: DEFAULT_PRO_AI_PER_DAY,
})

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean && clean.length <= max ? clean : null
}

function positiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
}

function parsePlan(value: unknown): Plan | null {
  if (!isRecord(value) || !isPlanId(value.id)) return null
  const amount = positiveInt(value.amount)
  if (amount === null) return null
  const fallback = FALLBACK_BILLING_CONFIG.plans.find((p) => p.id === value.id)
  const days = value.days === null ? null : positiveInt(value.days)
  if (days === null && value.days !== null) return null
  const savings = value.savingsPercent
  return {
    id: value.id,
    name: text(value.name, 40) ?? fallback?.name ?? value.id,
    amount,
    currency: 'INR',
    days,
    badge: text(value.badge, 40),
    savingsPercent:
      typeof savings === 'number' && Number.isInteger(savings) && savings > 0 && savings < 100 ? savings : null,
  }
}

/** Checks a config from the server (or the device cache); null when it isn't one. */
export function parseBillingConfig(value: unknown): BillingConfig | null {
  if (!isRecord(value) || !Array.isArray(value.plans)) return null
  const plans: Plan[] = []
  for (const raw of value.plans) {
    const plan = parsePlan(raw)
    if (plan && !plans.some((p) => p.id === plan.id)) plans.push(plan)
  }
  if (plans.length === 0) return null
  const keyId = text(value.keyId, 200)
  const checkout = value.checkout === 'razorpay' && keyId ? 'razorpay' : null
  return {
    checkout,
    keyId: checkout ? keyId : null,
    currency: 'INR',
    plans,
    licensePublicKey: typeof value.licensePublicKey === 'string' && value.licensePublicKey.trim() ? value.licensePublicKey.trim() : null,
    proAiPerDay: positiveInt(value.proAiPerDay) ?? DEFAULT_PRO_AI_PER_DAY,
  }
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function readCache(): BillingConfig | null {
  try {
    const raw = storage()?.getItem(BILLING_CACHE_KEY)
    return raw ? parseBillingConfig(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function writeCache(config: BillingConfig): void {
  try {
    storage()?.setItem(BILLING_CACHE_KEY, JSON.stringify(config))
  } catch {
    // Storage full or blocked — we'll just fetch again next time.
  }
}

/** What the paywall shows: null only before the first answer when nothing is remembered. */
let current: BillingConfig | null = readCache()
/** True once this page load has the server's own answer. */
let fresh = false
let inflight: Promise<BillingConfig | null> | null = null
/** When the last attempt failed (epoch ms), so a screen full of subscribers doesn't hammer a down server. */
let failedAt = 0
let listening = false
const listeners = new Set<() => void>()

function publish(next: BillingConfig): void {
  current = next
  for (const listener of listeners) listener()
}

/** A failed fetch is retried by subscribers only after this long (or straight away when back online). */
const RETRY_AFTER_FAILURE_MS = 30_000

function onOnline(): void {
  if (!fresh) void refreshBillingConfig()
}

function listen(): void {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('online', onOnline)
}

/** Asks the server (once at a time). Resolves to its config, or null when it couldn't be reached. */
function refreshBillingConfig(): Promise<BillingConfig | null> {
  if (inflight) return inflight
  listen()
  inflight = callApi('/api/billing/config', { timeoutMs: BILLING_CONFIG_TIMEOUT_MS })
    .then((result) => {
      const config = result.ok ? parseBillingConfig(result.body) : null
      if (config) {
        fresh = true
        writeCache(config)
        publish(config)
      } else {
        failedAt = Date.now()
        if (!current) publish(FALLBACK_BILLING_CONFIG)
      }
      return config
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

/**
 * The config to act on. `fresh: true` (checkout) asks the server unless this page load already
 * did; otherwise the remembered config is good enough. Falls back to the built-in plans; never throws.
 */
export async function loadBillingConfig(opts: { fresh?: boolean } = {}): Promise<BillingConfig> {
  if (current && (fresh || !opts.fresh)) {
    if (!fresh) void refreshBillingConfig()
    return current
  }
  const config = await refreshBillingConfig()
  return config ?? current ?? FALLBACK_BILLING_CONFIG
}

/** The license public key we know right now (remembered or fetched this visit), or null. */
export function knownLicensePublicKey(): string | null {
  return current?.licensePublicKey ?? null
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  if (!fresh && Date.now() - failedAt >= RETRY_AFTER_FAILURE_MS) void refreshBillingConfig()
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): BillingConfig | null {
  return current
}

/**
 * Plans and checkout availability for the paywall and the landing page's pricing table.
 * null only for a first-time visitor until the server answers (or fails → built-in plans).
 */
export function useBillingConfig(): BillingConfig | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null)
}

export function planById(config: BillingConfig | null, id: PlanId): Plan | null {
  return config?.plans.find((p) => p.id === id) ?? null
}

/** Whole months a pass covers (30 days → 1, 365 → 12); null for lifetime. */
export function planMonths(plan: Plan): number | null {
  return plan.days === null ? null : Math.max(1, Math.round(plan.days / 30.4))
}

/** What a pass costs per month, in minor units, rounded down ("₹33/mo" for ₹399 a year); null for lifetime. */
export function planPerMonth(plan: Plan): number | null {
  const months = planMonths(plan)
  return months === null ? null : Math.floor(plan.amount / months)
}

/** Forgets this page load's config and re-reads the device cache (tests). */
export function resetBillingConfigForTests(): void {
  if (typeof window !== 'undefined') window.removeEventListener('online', onOnline)
  listening = false
  current = readCache()
  fresh = false
  inflight = null
  failedAt = 0
  listeners.clear()
}
