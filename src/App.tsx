import { Component, useEffect, useLayoutEffect, useState, type ComponentType, type ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button, EmptyState, ScreenTransition, ToastProvider, useDismissToast, type NavDirection } from './components'
import { AssignScreen } from './screens/AssignScreen'
import { PaidScreen } from './screens/PaidScreen'
import { PeopleScreen } from './screens/PeopleScreen'
import { ResultScreen } from './screens/ResultScreen'
import { ReviewScreen } from './screens/ReviewScreen'
import { ScanScreen } from './screens/ScanScreen'
import { prefetchHealth } from './state/health'
import { SESSION_KEY } from './state/persist'
import { SessionProvider, useFlow } from './state/store'
import type { Session, StepId } from './types'
import styles from './App.module.css'

const SCREENS: Readonly<Record<StepId, ComponentType>> = {
  scan: ScanScreen,
  review: ReviewScreen,
  paid: PaidScreen,
  people: PeopleScreen,
  assign: AssignScreen,
  result: ResultScreen,
}

const APP_NAME = 'BillSplit'

/** Tab titles per step (also what screen readers announce when switching tabs). */
const TITLES: Readonly<Record<StepId, string>> = {
  scan: `${APP_NAME} — split any bill in seconds`,
  review: `Check the items · ${APP_NAME}`,
  paid: `What you paid · ${APP_NAME}`,
  people: `Who's splitting · ${APP_NAME}`,
  assign: `Who had what · ${APP_NAME}`,
  result: `The split · ${APP_NAME}`,
}

/**
 * The screen for the current step, keyed by step so each arrival replays its entrance. The very
 * first screen rises in gently; after that, screens slide in the direction of travel.
 */
function CurrentStep() {
  const { step, direction } = useFlow()
  const dismissToast = useDismissToast()
  const [firstStep] = useState(step)
  const [navigated, setNavigated] = useState(false)
  if (!navigated && step !== firstStep) setNavigated(true)

  // A layout effect: it runs before the store pushes this step's history entry (parents' layout
  // effects run after their children's) and before any sheet pushes one, so every entry is saved
  // with the right title (shown in the tab and the long-press Back menu).
  useLayoutEffect(() => {
    document.title = TITLES[step]
  }, [step])

  // Toasts belong to the screen that raised them (an "Undo" shouldn't follow you to the next step).
  useEffect(() => dismissToast, [step, dismissToast])

  const StepScreen = SCREENS[step]
  const nav: NavDirection = navigated ? direction : 'none'
  return (
    <ScreenTransition direction={nav}>
      <StepScreen key={step} />
    </ScreenTransition>
  )
}

export interface AppProps {
  /** Start from this session instead of the saved one (tests, previews). */
  initialSession?: Session
  /** Save progress to localStorage (default true). */
  persist?: boolean
}

export function App({ initialSession, persist = true }: AppProps) {
  useEffect(() => {
    // Ask the server early whether scanning is available, so the home screen never flickers.
    prefetchHealth()
  }, [])

  useEffect(() => {
    // A file dropped outside a drop target would make the browser open it — and leave the app.
    const keepFiles = (event: DragEvent): void => {
      if (Array.from(event.dataTransfer?.types ?? []).includes('Files')) event.preventDefault()
    }
    window.addEventListener('dragover', keepFiles)
    window.addEventListener('drop', keepFiles)
    return () => {
      window.removeEventListener('dragover', keepFiles)
      window.removeEventListener('drop', keepFiles)
    }
  }, [])

  return (
    <AppErrorBoundary>
      <ToastProvider>
        <SessionProvider initialSession={initialSession} persist={persist}>
          <CurrentStep />
        </SessionProvider>
      </ToastProvider>
    </AppErrorBoundary>
  )
}

interface BoundaryState {
  failed: boolean
}

/**
 * Last line of defence: an unexpected crash shows a friendly page with a way forward instead of
 * a blank screen. "Start over" also drops the saved bill, in case it is what keeps failing.
 */
class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  override state: BoundaryState = { failed: false }

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true }
  }

  override componentDidCatch(error: unknown): void {
    // Surface it to the console / error tracking without crashing again.
    if (typeof globalThis.reportError === 'function') {
      globalThis.reportError(error instanceof Error ? error : new Error(String(error)))
    }
  }

  private retry = (): void => {
    this.setState({ failed: false })
  }

  private startOver = (): void => {
    try {
      window.localStorage.removeItem(SESSION_KEY)
    } catch {
      // Storage unavailable: a reload still gives the app a fresh start.
    }
    window.location.reload()
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <main className={styles.crash}>
        <h1 className="visually-hidden">{APP_NAME}</h1>
        <EmptyState
          icon={<RotateCcw />}
          title="Something went wrong"
          text="Sorry about that. Try again — or start over with a fresh bill."
          headingLevel={2}
        />
        <div className={styles.crashActions}>
          <Button block onClick={this.retry}>
            Try again
          </Button>
          <Button block variant="ghost" onClick={this.startOver}>
            Start over
          </Button>
        </div>
      </main>
    )
  }
}
