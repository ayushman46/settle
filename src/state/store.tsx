/* eslint-disable react-refresh/only-export-components -- the provider and its hooks are one unit; an edit here just reloads the page in dev. */
/**
 * The app's single source of truth: the in-progress `Session` (persisted to localStorage),
 * navigation between steps (kept in step with browser history, see `backStack.ts`) and the
 * derived split.
 */
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react'
import { rememberNames } from '../lib/recent'
import { computeSplit, type SplitResult } from '../lib/split'
import type { Session, StepId } from '../types'
import { flowHistory } from './backStack'
import { appReducer, initAppState, type AppState, type NavDirection } from './nav'
import { loadSession, saveSession } from './persist'
import { setPhoto } from './photo'
import type { Action } from './reducer'
import { clampStep, effectivePaid, nextStep, prevStep, resumeStep } from './selectors'

export type { NavDirection } from './nav'

/** Saves are batched: at most one write per this many ms while things are changing. */
export const SAVE_DEBOUNCE_MS = 200

interface StoreValue {
  state: AppState
  dispatch: Dispatch<Action>
}

const StoreContext = createContext<StoreValue | null>(null)

export interface SessionProviderProps {
  children: ReactNode
  /** Start from this session instead of the saved one (tests, previews). */
  initialSession?: Session
  /** Save to localStorage (default true). */
  persist?: boolean
}

export function SessionProvider({ children, initialSession, persist = true }: SessionProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialSession, (init) => initAppState(init ?? loadSession()))
  const { session } = state

  const sessionRef = useRef(session)
  useLayoutEffect(() => {
    sessionRef.current = session
  })

  // History: claim/repair the trail on start, and follow Back/Forward.
  useLayoutEffect(() => {
    const history = flowHistory()
    history.init(sessionRef.current.step)
    history.setPopHandler((entry) => {
      const target = clampStep(sessionRef.current, entry.step)
      dispatch({ type: 'goTo', step: target })
      // A step the data doesn't allow (e.g. Forward into an old bill): put history back too.
      if (target !== entry.step) history.syncTo(target)
    })
    return () => history.setPopHandler(null)
  }, [])

  // Every step change — from any dispatch — is mirrored into history. A layout effect, so the
  // step's entry exists before a new screen opens a sheet on top of it.
  useLayoutEffect(() => {
    flowHistory().syncTo(session.step)
  }, [session.step])

  // Persistence: debounced writes, plus a final write whenever the page may go away.
  const lastSaved = useRef<string | null>(null)
  useEffect(() => {
    if (!persist) return
    const timer = setTimeout(() => {
      const json = JSON.stringify(session)
      if (json !== lastSaved.current && saveSession(session)) lastSaved.current = json
    }, SAVE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [session, persist])

  useEffect(() => {
    if (!persist) return
    const flush = () => {
      const latest = sessionRef.current
      const json = JSON.stringify(latest)
      if (json !== lastSaved.current && saveSession(latest)) lastSaved.current = json
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
      flush()
    }
  }, [persist])

  const value = useMemo<StoreValue>(() => ({ state, dispatch }), [state])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

function useStore(): StoreValue {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useSession/useFlow/useSplit must be used inside <SessionProvider>.')
  return store
}

/** The current session and the reducer's dispatch. */
export function useSession(): { session: Session; dispatch: Dispatch<Action> } {
  const { state, dispatch } = useStore()
  return { session: state.session, dispatch }
}

/** The split for the current session (memoised). Totals always add up to `effectivePaid`. */
export function useSplit(): SplitResult {
  const { session } = useStore().state
  const { items, people, assignments } = session
  const paid = effectivePaid(session)
  return useMemo(() => computeSplit({ items, people, assignments, paid }), [items, people, assignments, paid])
}

export interface Flow {
  step: StepId
  /** Which way the last step change went — for direction-aware transitions. */
  direction: NavDirection
  /** Where `resume()` goes: the furthest step reached on this bill that the data still allows. */
  resumeStep: StepId
  /** The next step in order (no-op on the last one). */
  next(): void
  /** The previous step (no-op on the home screen). History follows, so the system Back button stays in sync. */
  back(): void
  /** Any step, forwards or backwards. History gets one entry per step in between. */
  goTo(step: StepId): void
  /** "Continue" from the home screen. */
  resume(): void
  /** Remembers the people's names for next time, clears the photo, and starts a fresh bill at home. */
  startOver(): void
}

/** Navigation between steps, integrated with browser history (Android Back steps back). */
export function useFlow(): Flow {
  const { state, dispatch } = useStore()
  const stateRef = useRef(state)
  useLayoutEffect(() => {
    stateRef.current = state
  })

  const { step } = state.session
  const resume = resumeStep(state.session, state.furthest)

  const actions = useMemo(() => {
    const goTo = (target: StepId) => dispatch({ type: 'goTo', step: target })
    const goToIfAny = (target: StepId | null) => {
      if (target) goTo(target)
    }
    return {
      goTo,
      next: () => goToIfAny(nextStep(stateRef.current.session.step)),
      back: () => goToIfAny(prevStep(stateRef.current.session.step)),
      resume: () => {
        const { session, furthest } = stateRef.current
        goTo(resumeStep(session, furthest))
      },
      startOver: () => {
        rememberNames(stateRef.current.session.people.map((p) => p.name))
        setPhoto(null)
        dispatch({ type: 'reset' })
      },
    }
  }, [dispatch])

  return useMemo(
    () => ({ step, direction: state.direction, resumeStep: resume, ...actions }),
    [step, state.direction, resume, actions],
  )
}
