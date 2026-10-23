/**
 * The bill flow, from the rest of the app — without loading the flow itself (it is its own
 * chunk): open it to scan, straight onto the sample bill or a typed-in one, or onto a saved bill
 * to fix who had what; read the draft in progress (for a "Continue your bill" card); clear it.
 *
 *   openBill()                                   // the scan step ("Scan bill")
 *   openBill({ kind: 'resume' })                 // "Continue your bill": where it was left
 *   openBill({ kind: 'sample' })                 // "Try a sample bill"
 *   openBill({ kind: 'edit', expenseId: e.id })  // an itemized expense's "Edit"
 *   openBill({ kind: 'photo' })                  // a photo shared in (`setSharedPhoto`): the scan step reads it
 *   openBill({ kind: 'delivery' })               // "Food order": the scan step, set up for a delivery app's order
 *
 * Starting something new asks first when it would replace a bill in progress.
 */
import { useState } from 'react'
import { navigate } from '../../app/router'
import { loadSession, SESSION_KEY } from '../../state/persist'
import { setPhoto } from '../../state/photo'
import { effectivePaid, hasProgress } from '../../state/selectors'
import type { Minor, StepId } from '../../types'

/** The bill flow's route. */
export const BILL_PATH = '/app/bill'

export type BillStart =
  /** The sample bill (works offline), straight onto its items. */
  | { kind: 'sample' }
  /** An empty bill with the item editor open. */
  | { kind: 'manual' }
  /** A saved itemized bill, back in the flow on its last step; saving updates it. */
  | { kind: 'edit'; expenseId: string }
  /** The bill in progress, right where it was left (the scan step when there is none). */
  | { kind: 'resume' }
  /**
   * A photo shared into Settle (left with `setSharedPhoto`): the scan step reads it straight away,
   * asking first (like a pasted photo) when it would replace a bill in progress.
   */
  | { kind: 'photo' }
  /** A food-delivery or quick-commerce order: the scan step, with the delivery hint (`takeScanHint`). */
  | { kind: 'delivery' }

/** How the scan step should read the next photo. */
export type ScanHint = 'delivery'

/** A second `take` this soon after the first returns the same value (React StrictMode double renders). */
const RETAKE_GRACE_MS = 1000

let pending: BillStart | null = null
let lastTaken: { value: BillStart; at: number } | null = null
let scanHint: ScanHint | null = null

/** Opens the bill flow, optionally starting something in it (see `BillStart`). */
export function openBill(start?: BillStart): void {
  pending = start ?? null
  lastTaken = null
  scanHint = start?.kind === 'delivery' ? 'delivery' : null
  navigate(BILL_PATH)
}

/** The hint `openBill({ kind: 'delivery' })` left for the scan step (once) — null when none. */
export function takeScanHint(): ScanHint | null {
  const hint = scanHint
  scanHint = null
  return hint
}

/** What `openBill` asked the flow to start (once) — null when nothing. The flow calls this as it opens. */
export function takeBillStart(): BillStart | null {
  const value = pending
  pending = null
  if (value) {
    lastTaken = { value, at: Date.now() }
    return value
  }
  if (lastTaken && Date.now() - lastTaken.at < RETAKE_GRACE_MS) return lastTaken.value
  return null
}

export interface BillDraftSummary {
  /** The restaurant's name, when known. */
  title: string | null
  items: number
  /** What's being split. */
  total: Minor
  currency: string
  people: number
  /** The step it was left on. */
  step: StepId
  /** True when it is a saved bill being changed (not a new one). */
  editing: boolean
}

/** The bill in progress on this device, or null when there is none. */
export function billDraftSummary(): BillDraftSummary | null {
  const session = loadSession()
  if (!hasProgress(session)) return null
  return {
    title: session.meta.merchant,
    items: session.items.length,
    total: effectivePaid(session),
    currency: session.currency,
    people: session.people.length,
    step: session.step,
    editing: session.expenseId !== null,
  }
}

/** `billDraftSummary()` as the screen mounts (the flow isn't on screen at the same time). */
export function useBillDraft(): BillDraftSummary | null {
  const [draft] = useState(billDraftSummary)
  return draft
}

/** Forgets the bill in progress (e.g. "Clear all data"). */
export function clearBillDraft(): void {
  pending = null
  lastTaken = null
  scanHint = null
  setPhoto(null)
  try {
    window.localStorage.removeItem(SESSION_KEY)
  } catch {
    // Storage unavailable: nothing was saved there either.
  }
}

/** Forgets any pending start (tests). */
export function resetBillLaunchForTests(): void {
  pending = null
  lastTaken = null
  scanHint = null
}
