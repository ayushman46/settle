/**
 * The itemized bill flow, mounted at `/app/bill`: scan → review → paid → people → assign → result.
 * Its steps live in history state (the URL stays `/app/bill`), so Back walks back through them
 * and then returns to the screen the flow was opened from. The draft bill is saved on the device,
 * so a reload (or coming back later) picks up where the person left off.
 */
import { Component, useEffect, useLayoutEffect, useState, type ComponentType, type ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button, EmptyState, ScreenTransition, useDismissToast, type NavDirection } from '../../components'
import { BRAND } from '../../domain/types'
import { prefetchHealth } from '../../state/health'
import { SESSION_KEY } from '../../state/persist'
import { SessionProvider, useFlow } from '../../state/store'
import type { Session, StepId } from '../../types'
import { AssignScreen } from './AssignScreen'
import { PaidScreen } from './PaidScreen'
import { PeopleScreen } from './PeopleScreen'
import { ResultScreen } from './ResultScreen'
import { ReviewScreen } from './ReviewScreen'
import { ScanScreen } from './ScanScreen'
import styles from './BillFlow.module.css'

const SCREENS: Readonly<Record<StepId, ComponentType>> = {
  scan: ScanScreen,
  review: ReviewScreen,
  paid: PaidScreen,
  people: PeopleScreen,
  assign: AssignScreen,
  result: ResultScreen,
}

/** Tab titles per step (also what screen readers announce, and what the long-press Back menu lists). */
const STEP_TITLES: Readonly<Record<StepId, string>> = {
  scan: `Scan a bill · ${BRAND.name}`,
  review: `Check the items · ${BRAND.name}`,
  paid: `What you paid · ${BRAND.name}`,
  people: `Who's splitting · ${BRAND.name}`,
  assign: `Who had what · ${BRAND.name}`,
  result: `The split · ${BRAND.name}`,
}

/**
 * The screen for the current step, keyed by step so each arrival replays its entrance. The first
 * step shown takes the page's own entrance; after that, steps slide in the direction of travel.
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
    document.title = STEP_TITLES[step]
  }, [step])

  // Toasts belong to the step that raised them (an "Undo" shouldn't follow you to the next step).
  useEffect(() => dismissToast, [step, dismissToast])

  const StepScreen = SCREENS[step]
  const nav: NavDirection = navigated ? direction : 'none'
  return (
    <ScreenTransition direction={nav}>
      <StepScreen key={step} />
    </ScreenTransition>
  )
}

export interface BillFlowProps {
  /** Start from this bill instead of the saved one (tests, previews). */
  initialSession?: Session
  /** Save progress on the device (default true). */
  persist?: boolean
}

/** The `/app/bill` page. Needs the app's `ToastProvider` above it. */
export function BillFlow({ initialSession, persist = true }: BillFlowProps) {
  // Generation of the draft provider: "Start a fresh bill" after a crash remounts it.
  const [generation, setGeneration] = useState(0)

  useEffect(() => {
    // Ask early whether scanning is available, so the scan step never flickers.
    prefetchHealth()
  }, [])

  useEffect(() => {
    // A photo dropped outside the scan step's drop zone would make the browser open it — and
    // leave the app with the bill half done.
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
    <BillErrorBoundary onStartOver={() => setGeneration((g) => g + 1)}>
      <SessionProvider key={generation} initialSession={generation === 0 ? initialSession : undefined} persist={persist}>
        <CurrentStep />
      </SessionProvider>
    </BillErrorBoundary>
  )
}

interface BoundaryProps {
  children: ReactNode
  /** The saved bill was dropped: remount the flow so it starts from a fresh one. */
  onStartOver: () => void
}

interface BoundaryState {
  failed: boolean
}

/**
 * An unexpected crash inside the flow shows a friendly page with a way forward instead of a blank
 * screen. "Start a fresh bill" also drops the saved draft, in case it is what keeps failing.
 */
class BillErrorBoundary extends Component<BoundaryProps, BoundaryState> {
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
      // Storage unavailable: the fresh draft simply isn't saved.
    }
    this.props.onStartOver()
    this.setState({ failed: false })
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <main className={styles.crash}>
        <h1 className="visually-hidden">{BRAND.name}</h1>
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
            Start a fresh bill
          </Button>
        </div>
      </main>
    )
  }
}
