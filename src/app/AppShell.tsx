import { Component, Suspense, useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { CircleUserRound, House, ReceiptText, RefreshCw, RotateCcw, UsersRound, WifiOff } from 'lucide-react'
import { AppFrame, Banner, Button, EmptyState, ScreenTransition, Skeleton, TabBar, type NavDirection, type TabBarItem } from '../components'
import { migrateLegacy, profileStore, useStorageWritable, useStore } from '../data'
import { BRAND, type Profile } from '../domain/types'
import { onboardingDestination, welcomePath } from '../features/onboarding/destination'
import { usePaywall } from '../features/pro/paywall'
import { prefetchHealth } from '../state/health'
import { isChunkLoadError, retryFailedScreens } from './lazyScreen'
import { HOME_PATH, matchAppRoute, PaywallHost, preloadCoreScreens, WELCOME_PATTERN, type TabKey } from './routes'
import { navigate, Redirect, useLocation, useNavDirection } from './router'
import styles from '../App.module.css'

const TABS: readonly TabBarItem[] = [
  { key: 'home', label: 'Home', icon: <House />, href: HOME_PATH },
  { key: 'groups', label: 'Groups', icon: <UsersRound />, href: '/app/groups' },
  { key: 'activity', label: 'Activity', icon: <ReceiptText />, href: '/app/activity' },
  { key: 'you', label: 'You', icon: <CircleUserRound />, href: '/app/you' },
]

const selectOnboarded = (p: Profile) => p.onboarded

/** Runs `task` when the browser is idle (or soon, where it can't say). Returns a cancel. */
function whenIdle(task: () => void): () => void {
  const { requestIdleCallback: request, cancelIdleCallback: cancel } = window
  if (typeof request === 'function' && typeof cancel === 'function') {
    const id = request(task, { timeout: 4000 })
    return () => cancel(id)
  }
  const id = setTimeout(task, 1500)
  return () => clearTimeout(id)
}

/** Tab roots switch in place: Back from any tab leaves the app, as on a phone's own apps. */
function switchTab(href: string): void {
  navigate(href, { replace: true })
}

export interface AppShellProps {
  /** Load the core screens' code while idle (default: in production builds). */
  preloadScreens?: boolean
}

/**
 * Everything under `/app`: the phone-width frame, the onboarding gate (welcome comes first,
 * once), the screen for the route — code-split, sliding in the direction of travel, cross-fading
 * between tabs — the bottom tab bar on the four tab roots, tab titles ("Groups · Settle"), a
 * notice when the phone stops saving, a friendly page when something breaks, and the Pro
 * paywall wherever a screen asks for it. Brings the old app's data over once.
 */
export function AppShell({ preloadScreens = import.meta.env.PROD }: AppShellProps) {
  const location = useLocation()
  const navDirection = useNavDirection()
  const onboarded = useStore(profileStore, selectOnboarded)
  const route = matchAppRoute(location.path)
  const tab = route?.tab ?? null

  // Which way the screen on show arrived: tab to tab cross-fades; everything else slides.
  const [shown, setShown] = useState<{ path: string; tab: TabKey | null; direction: NavDirection }>({
    path: location.path,
    tab,
    direction: 'none',
  })
  if (shown.path !== location.path) {
    setShown({ path: location.path, tab, direction: shown.tab !== null && tab !== null ? 'fade' : navDirection })
  }

  useLayoutEffect(() => {
    migrateLegacy()
  }, [])

  useEffect(() => {
    prefetchHealth()
  }, [])

  useEffect(() => {
    if (!preloadScreens) return
    return whenIdle(() => void preloadCoreScreens())
  }, [preloadScreens])

  // Before paint and after the screen's own layout effects; screens that name the page more
  // precisely (a group's name) set it in a passive effect, which runs after this.
  const title = route?.title ?? null
  useLayoutEffect(() => {
    if (title !== null) document.title = `${title} · ${BRAND.name}`
  }, [title, location.path])

  let content: ReactNode
  if (!onboarded && route?.pattern !== WELCOME_PATTERN) {
    content = <Redirect to={welcomePath(`${location.path}${location.search}${location.hash}`)} />
  } else if (onboarded && route?.pattern === WELCOME_PATTERN) {
    content = <Redirect to={onboardingDestination(new URLSearchParams(location.search).get('next'))} />
  } else if (route === null) {
    content = <Redirect to={HOME_PATH} />
  } else {
    const Screen = route.screen
    content = (
      <>
        <ShellErrorBoundary key={location.path}>
          <ScreenTransition direction={shown.direction}>
            <Suspense fallback={<RouteFallback />}>
              <Screen />
            </Suspense>
          </ScreenTransition>
        </ShellErrorBoundary>
        {tab !== null && <TabBar items={TABS} activeKey={tab} onNavigate={switchTab} />}
      </>
    )
  }

  return (
    <AppFrame>
      <StorageNotice />
      {content}
      <PaywallMount />
    </AppFrame>
  )
}

/** The Pro paywall, loaded the first time any screen opens it, then kept for its exit animation. */
function PaywallMount() {
  const { request } = usePaywall()
  if (!request) return null
  return (
    <Suspense fallback={null}>
      <PaywallHost />
    </Suspense>
  )
}

/** Shown while the phone refuses to save (storage full or blocked) — never silently lose work. */
function StorageNotice() {
  const writable = useStorageWritable()
  if (writable) return null
  return (
    <div className={styles.notice}>
      <Banner tone="warning" title="This phone isn’t saving your changes">
        Its storage may be full or blocked. Free up some space — everything stays here while {BRAND.name} is open.
      </Banner>
    </div>
  )
}

/** A quiet placeholder while a screen's code loads (it only fades in if that takes a moment). */
function RouteFallback() {
  return (
    <div className={styles.fallback} role="status" aria-label="Loading">
      <div className={styles.fallbackTop} aria-hidden="true">
        <Skeleton shape="circle" width={40} height={40} />
      </div>
      <Skeleton width="55%" height={28} />
      <Skeleton shape="md" height={148} />
      <Skeleton shape="md" height={64} />
      <Skeleton shape="md" height={64} />
    </div>
  )
}

interface BoundaryState {
  error: unknown
}

/**
 * Last line of defence for a screen: an unexpected crash shows a friendly page with a way forward
 * instead of a blank one. Remounted per page, so going elsewhere always starts clean.
 */
class ShellErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  override state: BoundaryState = { error: null }

  constructor(props: { children: ReactNode }) {
    super(props)
    // A page opened anew gets a fresh try at code that failed to load earlier (offline, say).
    retryFailedScreens()
  }

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { error: error ?? new Error('Unknown error') }
  }

  override componentDidCatch(error: unknown): void {
    // Surface it to the console / error tracking without crashing again.
    if (typeof globalThis.reportError === 'function') {
      globalThis.reportError(error instanceof Error ? error : new Error(String(error)))
    }
  }

  private retry = (): void => {
    retryFailedScreens()
    this.setState({ error: null })
  }

  override render(): ReactNode {
    if (this.state.error === null) return this.props.children
    return <ShellCrash error={this.state.error} onRetry={this.retry} />
  }
}

function isOffline(): boolean {
  try {
    return navigator.onLine === false
  } catch {
    return false
  }
}

function ShellCrash({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const goHome = (): void => navigate(HOME_PATH, { replace: true })
  const chunk = isChunkLoadError(error)

  let icon: ReactNode = <RotateCcw />
  let title = 'Something went wrong'
  let text = 'Sorry about that. Try again, or head back Home — your splits are safe.'
  let actions: ReactNode = (
    <>
      <Button block onClick={onRetry}>
        Try again
      </Button>
      <Button block variant="ghost" onClick={goHome}>
        Go to Home
      </Button>
    </>
  )
  if (chunk && isOffline()) {
    icon = <WifiOff />
    title = 'You’re offline'
    text = 'This screen needs a connection the first time it opens. Reconnect and try again.'
  } else if (chunk) {
    icon = <RefreshCw />
    title = `${BRAND.name} has been updated`
    text = 'Reload to get the latest version — your splits are safe on this phone.'
    actions = (
      <>
        <Button block onClick={() => window.location.reload()}>
          Reload
        </Button>
        <Button block variant="ghost" onClick={goHome}>
          Go to Home
        </Button>
      </>
    )
  }

  return (
    <main className={styles.crash}>
      <h1 className="visually-hidden">{BRAND.name}</h1>
      <EmptyState icon={icon} title={title} text={text} headingLevel={2} />
      <div className={styles.crashActions}>{actions}</div>
    </main>
  )
}
