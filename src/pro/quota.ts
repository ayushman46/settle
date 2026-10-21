/**
 * Free AI allowance: `FREE_AI_PER_DAY` scans/describes per local calendar day, counted on this
 * device (`settle.v3.ai-usage`). Pro is unlimited here (the server applies a fair-use cap).
 * The count resets at local midnight — even with the app left open — and stays in step across tabs.
 */
import { useMemo, useSyncExternalStore } from 'react'
import { FREE_AI_PER_DAY } from '../domain/types'
import { usePro } from './store'

export const AI_USAGE_KEY = 'settle.v3.ai-usage'

/** Highest count we store (a corrupted or hand-edited value can't overflow anything). */
const MAX_COUNT = 10_000

export interface AiQuota {
  /** AI uses today. */
  used: number
  /** `FREE_AI_PER_DAY`, or Infinity with Pro. */
  limit: number
  /** max(0, limit − used); Infinity with Pro. */
  remaining: number
  canUse: boolean
  /** Count one AI use (call after a successful scan or describe). */
  consume(): void
}

interface Usage {
  /** Local date, YYYY-MM-DD. */
  day: string
  used: number
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Local calendar day of `now`, YYYY-MM-DD. */
export function localDay(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function msUntilNextDay(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return Math.max(1_000, next.getTime() - now.getTime() + 250)
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/** Today's count from the device (0 for another day, missing or garbled data). */
function readUsed(day: string): number {
  try {
    const raw = storage()?.getItem(AI_USAGE_KEY)
    if (!raw) return 0
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return 0
    const { day: savedDay, used } = value as Record<string, unknown>
    if (savedDay !== day || typeof used !== 'number' || !Number.isInteger(used) || used < 0) return 0
    return Math.min(used, MAX_COUNT)
  } catch {
    return 0
  }
}

function writeUsage(usage: Usage): void {
  try {
    storage()?.setItem(AI_USAGE_KEY, JSON.stringify(usage))
  } catch {
    // Storage blocked: the count lives in memory for this visit.
  }
}

let usage: Usage | null = null
let dayTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

/** Today's usage; a new object only when the day or the count changes. */
function current(): Usage {
  const day = localDay()
  if (usage === null || usage.day !== day) usage = { day, used: readUsed(day) }
  return usage
}

/** Re-reads the device (another tab, a new day) and tells subscribers if anything changed. */
function refresh(): void {
  const day = localDay()
  const stored = readUsed(day)
  // Counts only go up within a day: a lower stored one means storage was blocked or wiped mid-visit.
  const used = usage !== null && usage.day === day ? Math.max(stored, usage.used) : stored
  if (usage === null || usage.day !== day || usage.used !== used) {
    usage = { day, used }
    emit()
  }
}

function armDayTimer(): void {
  if (dayTimer !== null) clearTimeout(dayTimer)
  dayTimer = setTimeout(() => {
    refresh()
    armDayTimer()
  }, msUntilNextDay())
}

function onStorage(event: StorageEvent): void {
  if (event.key === null || event.key === AI_USAGE_KEY) refresh()
}

function onVisible(): void {
  if (document.visibilityState === 'visible') refresh()
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisible)
    armDayTimer()
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisible)
      if (dayTimer !== null) clearTimeout(dayTimer)
      dayTimer = null
    }
  }
}

/** AI uses counted today on this device. */
export function aiUsedToday(): number {
  return current().used
}

/** Counts one AI use today (outside React). */
export function consumeAiQuota(): void {
  const day = localDay()
  const stored = readUsed(day)
  const inMemory = usage?.day === day ? usage.used : 0
  const next: Usage = { day, used: Math.min(Math.max(stored, inMemory) + 1, MAX_COUNT) }
  usage = next
  writeUsage(next)
  emit()
}

/** The quota as numbers, for a given Pro status (used by the hook; handy outside React too). */
export function quotaFor(used: number, isPro: boolean): Omit<AiQuota, 'consume'> {
  const limit = isPro ? Number.POSITIVE_INFINITY : FREE_AI_PER_DAY
  const remaining = Math.max(0, limit - used)
  return { used, limit, remaining, canUse: remaining > 0 }
}

/**
 * Today's AI allowance: "2 of 3 free AI splits left today" for free users, unlimited with Pro.
 * Re-renders on use, at midnight, and when another tab uses one.
 */
export function useAiQuota(): AiQuota {
  const { isPro } = usePro()
  const today = useSyncExternalStore(subscribe, current, current)
  return useMemo(() => ({ ...quotaFor(today.used, isPro), consume: consumeAiQuota }), [today, isPro])
}

/** Forgets the in-memory count and timers (tests). */
export function resetQuotaForTests(): void {
  if (typeof window !== 'undefined') {
    window.removeEventListener('storage', onStorage)
    document.removeEventListener('visibilitychange', onVisible)
  }
  if (dayTimer !== null) clearTimeout(dayTimer)
  dayTimer = null
  usage = null
  listeners.clear()
}
