/**
 * The shape of Settle's browser-history entries, and how to read them back.
 *
 * Every entry the app owns carries a small record in `history.state`:
 *
 *   { settle: 1, depth: 3 }                         a screen (`/app/groups/g1`)
 *   { settle: 1, depth: 4, sheet: 1 }               a bottom sheet open over it (same URL)
 *   { settle: 1, depth: 2, bill: 'review' }         a step of the bill flow (URL stays `/app/bill`)
 *
 * `depth` counts the app's own entries in this tab: 0 is the first one of the visit and each
 * pushed screen, flow step or sheet is one deeper. Because only the app pushes entries, an
 * entry at depth d > 0 always has one of ours beneath it — which is how Back knows whether it
 * would stay in the app. Sheets sit directly above their screen (`depth - sheet` is the screen's
 * entry), and a bill flow's steps sit one per step above its first entry
 * (`depth - STEPS.indexOf(step)` is the flow's first entry).
 */
import { STEPS, type StepId } from '../../types'

/** What the app stores in `history.state` on each entry it owns. */
export interface NavState {
  /** Marks the entry as ours (format version). */
  settle: 1
  /** In-app depth: 0 is the first entry of this visit. */
  depth: number
  /** On a bottom sheet's entry: how many sheets deep it is (1 = the first sheet over the screen). */
  sheet?: number
  /** On the bill flow's entries (and sheets over them): the step on screen. */
  bill?: StepId
}

/** One of the app's history entries, as the history driver sees it. */
export interface NavEntry {
  depth: number
  /** 0 for a screen's own entry; n for the n-th sheet open above it. */
  sheet: number
  /** The bill flow's step on this entry (or under this sheet); null on every other screen. */
  bill: StepId | null
  /** `pathname + search + hash` of the entry. */
  url: string
}

/** A bill-flow entry, in the terms the bill flow thinks in (see `src/state/backStack.ts`). */
export interface FlowEntry {
  step: StepId
  depth: number
  /** True for an entry held by an open bottom sheet. */
  sheet: boolean
}

/** Position of a step in the bill flow: its entry sits this many entries above the flow's first one. */
export function stepDepth(step: StepId): number {
  return STEPS.indexOf(step)
}

function isStep(value: unknown): value is StepId {
  return typeof value === 'string' && (STEPS as readonly string[]).includes(value)
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
}

/**
 * Parses `history.state` into an entry; null when it isn't one of ours. Lenient on purpose —
 * `isWellFormed` decides whether the numbers add up. Also reads the v2 format
 * (`{ billsplit: step, depth, sheet?: true }`), whose flow always started at depth 0.
 */
export function parseState(state: unknown, url: string): NavEntry | null {
  if (typeof state !== 'object' || state === null) return null
  const record = state as Record<string, unknown>
  if (record.settle === 1) {
    return {
      depth: count(record.depth),
      sheet: count(record.sheet),
      bill: isStep(record.bill) ? record.bill : null,
      url,
    }
  }
  if (isStep(record.billsplit)) {
    const depth = count(record.depth)
    const sheet = record.sheet === true ? Math.max(1, depth - stepDepth(record.billsplit)) : 0
    return { depth, sheet, bill: record.billsplit, url }
  }
  return null
}

/** True when the entry's numbers fit the model (see the module comment). */
export function isWellFormed(entry: NavEntry): boolean {
  const screen = entry.depth - entry.sheet
  if (screen < 0) return false
  return entry.bill === null || screen >= stepDepth(entry.bill)
}

export function toState(entry: NavEntry): NavState {
  const state: NavState = { settle: 1, depth: entry.depth }
  if (entry.sheet > 0) state.sheet = entry.sheet
  if (entry.bill !== null) state.bill = entry.bill
  return state
}

/** Depth of the screen entry an entry belongs to (itself, unless it is a sheet's). */
export function screenDepth(entry: NavEntry): number {
  return entry.depth - entry.sheet
}

/**
 * Depth of the entry that stands for the whole page at this URL: the bill flow's first entry
 * for the flow's steps (they all share `/app/bill`), else the screen's own entry.
 */
export function pageDepth(entry: NavEntry): number {
  return screenDepth(entry) - (entry.bill === null ? 0 : stepDepth(entry.bill))
}

/** The entry at `depth` on the same screen as `entry` (the screen itself, or a sheet over it). */
export function onSameScreen(entry: NavEntry, depth: number): NavEntry {
  const screen = screenDepth(entry)
  return { depth, sheet: Math.max(0, depth - screen), bill: entry.bill, url: entry.url }
}

/** Same position and screen. */
export function sameEntry(a: NavEntry, b: NavEntry): boolean {
  return a.depth === b.depth && a.sheet === b.sheet && a.bill === b.bill && a.url === b.url
}

/** The bill-flow view of an entry; null when the entry isn't part of the bill flow. */
export function toFlowEntry(entry: NavEntry): FlowEntry | null {
  return entry.bill === null ? null : { step: entry.bill, depth: entry.depth, sheet: entry.sheet > 0 }
}

/** Parses `history.state` as a bill-flow entry; null when it isn't one. */
export function readEntry(state: unknown): FlowEntry | null {
  const entry = parseState(state, '')
  return entry ? toFlowEntry(entry) : null
}

/** The URL of the page as the router keys it: `pathname + search + hash`. */
export function urlOf(location: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  return location.pathname + location.search + location.hash
}

export type Destination = { internal: true; url: string } | { internal: false; href: string }

/**
 * Where `to` (absolute, root-relative or relative) points from `from`: a URL inside the app
 * (same origin) or somewhere else. Null when `to` isn't a valid URL.
 */
export function resolveDestination(to: string, from: Pick<Location, 'href' | 'origin'>): Destination | null {
  let target: URL
  try {
    target = new URL(to, from.href)
  } catch {
    return null
  }
  if (target.origin !== from.origin) return { internal: false, href: target.href }
  return { internal: true, url: urlOf(target) }
}
