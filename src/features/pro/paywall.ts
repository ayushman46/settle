/**
 * The in-context Pro upsell. Any screen asks for it — `openPaywall('insights')`, or
 * `withPro('recurring', carryOn)` to run something now if Pro is on and right after unlocking if
 * not — and the one `PaywallHost` shows the pitch for that feature. Tiny on purpose: importing it
 * never pulls the sheet into a screen's bundle.
 */
import { useSyncExternalStore } from 'react'
import type { ProFeature } from '../../domain/types'
import { hasFeature } from '../../pro'

export interface PaywallRequest {
  /** What sent the person here (tailors the pitch); null = Pro in general. */
  feature: ProFeature | null
  /** Runs once, after Pro is unlocked from this paywall (bought or redeemed) — e.g. carry on where they were. */
  onUnlock: (() => void) | null
  /** New for every open, so opening again starts the sheet afresh. */
  id: number
}

export interface PaywallState {
  open: boolean
  /** The latest request — kept after closing so the sheet can finish its exit animation. */
  request: PaywallRequest | null
}

export interface OpenPaywallOptions {
  /** Runs right after Pro is unlocked from this paywall (not when it's just closed). */
  onUnlock?: () => void
}

const CLOSED: PaywallState = Object.freeze({ open: false, request: null })

let state: PaywallState = CLOSED
let nextId = 1
const listeners = new Set<() => void>()

function set(next: PaywallState): void {
  state = next
  for (const listener of listeners) listener()
}

/** Shows the Pro paywall, pitched for `feature` (or Pro in general). */
export function openPaywall(feature: ProFeature | null = null, opts: OpenPaywallOptions = {}): void {
  set({ open: true, request: { feature, onUnlock: opts.onUnlock ?? null, id: nextId++ } })
}

/** Hides the paywall without unlocking anything. */
export function closePaywall(): void {
  if (state.open) set({ open: false, request: state.request })
}

/** Hides the paywall after Pro was unlocked from it, then runs the request's `onUnlock` (once). */
export function completePaywall(): void {
  const action = state.request?.onUnlock ?? null
  set({ open: false, request: state.request ? { ...state.request, onUnlock: null } : null })
  action?.()
}

/** Runs `action` straight away when `feature` is unlocked; otherwise opens the paywall and runs it once Pro is on. */
export function withPro(feature: ProFeature, action: () => void): void {
  if (hasFeature(feature)) action()
  else openPaywall(feature, { onUnlock: action })
}

/** The paywall right now (outside React). */
export function paywallState(): PaywallState {
  return state
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Live paywall state, for the host that renders the sheet. */
export function usePaywall(): PaywallState {
  return useSyncExternalStore(subscribe, paywallState, () => CLOSED)
}

/** Closes the paywall and forgets every request (tests). */
export function resetPaywallForTests(): void {
  nextId = 1
  set(CLOSED)
}
