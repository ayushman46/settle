/**
 * App state = the persisted `Session` + in-memory navigation facts the UI needs:
 * which way the last step change went (for direction-aware screen transitions) and the
 * furthest step reached on this bill (for "Continue" on the home screen).
 */
import type { Session, StepId } from '../types'
import { reducer, type Action } from './reducer'
import { isAssigned, stepIndex } from './selectors'

export type NavDirection = 'forward' | 'back'

export interface AppState {
  session: Session
  /** Direction of the most recent step change. */
  direction: NavDirection
  /** Furthest step reached on this bill during this page visit. */
  furthest: StepId
}

export function initAppState(session: Session): AppState {
  const seen = visitedStep(session)
  return {
    session,
    direction: 'forward',
    furthest: stepIndex(seen) > stepIndex(session.step) ? seen : session.step,
  }
}

/**
 * The furthest step a saved bill shows signs of having reached. "Furthest" lives in memory, so
 * after a reload on the home screen this is what lets "Continue" land where the person left off:
 * a chosen payer means the split was reached (the payer is picked there), any assignment means
 * the assign step, and a typed-in amount means the paid step. Conservative on purpose: never
 * further than the person has been.
 */
export function visitedStep(session: Session): StepId {
  if (session.items.length === 0) return 'scan'
  if (session.payerId !== null) return 'result'
  if (session.items.some((item) => isAssigned(session, item.id))) return 'assign'
  if (session.paid !== null) return 'paid'
  return 'review'
}

export function appReducer(state: AppState, action: Action): AppState {
  const session = reducer(state.session, action)
  if (session === state.session) return state
  const before = state.session
  let { direction, furthest } = state
  if (session.step !== before.step) {
    direction = stepIndex(session.step) < stepIndex(before.step) ? 'back' : 'forward'
  }
  if (session.id !== before.id) furthest = session.step
  else if (stepIndex(session.step) > stepIndex(furthest)) furthest = session.step
  return { session, direction, furthest }
}
