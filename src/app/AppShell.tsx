import { Component, Suspense, useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { CircleUserRound, House, ReceiptText, RefreshCw, RotateCcw, UsersRound, WifiOff } from 'lucide-react'
import { AppFrame, Banner, Button, EmptyState, ScreenTransition, Skeleton, TabBar, type NavDirection, type TabBarItem } from '../components'
import { migrateLegacy, profileStore, useStorageWritable, useStore } from '../data'
import { BRAND, type Profile } from '../domain/types'
import { hasMessage, t, useLang, type MessageKey } from '../i18n'
import { onboardingDestination, welcomePath } from '../features/onboarding/destination'
import { usePaywall } from '../features/pro/paywall'
import { prefetchHealth } from '../state/health'
import { isChunkLoadError, retryFailedScreens } from './lazyScreen'
import { HOME_PATH, matchAppRoute, PaywallHost, preloadCoreScreens, WELCOME_PATTERN, type TabKey } from './routes'
import { navigate, Redirect, useLocation, useNavDirection } from './router'
import styles from '../App.module.css'

/** The bottom tabs, named in the UI language. */
function tabs(): readonly TabBarItem[] {
  return [
    { key: 'home', label: t('app.tab.home'), icon: <House />, href: HOME_PATH },
    { key: 'groups', label: t('app.tab.groups'), icon: <UsersRound />, href: '/app/groups' },
    { key: 'activity', label: t('app.tab.activity'), icon: <ReceiptText />, href: '/app/activity' },
    { key: 'you', label: t('app.tab.you'), icon: <CircleUserRound />, href: '/app/you' },
  ]
}

/** Route titles (English, from routes.tsx) → their catalog keys, for the browser tab's title. */
const TITLE_KEYS: Readonly<Record<string, MessageKey>> = {
  Home: 'app.title.home',
  Welcome: 'app.title.welcome',
  Groups: 'app.title.groups',
  Group: 'app.title.group',
  'Settle up': 'app.title.settleUp',
  Activity: 'app.title.activity',
  You: 'app.title.you',
  'New split': 'app.title.newSplit',
  'Edit split': 'app.title.editSplit',
  'From SMS': 'app.title.fromSms',
  'Lend or borrow': 'app.title.lend',
  'Edit udhaar': 'app.title.editLend',
  Expense: 'app.title.expense',
  Claims: 'app.title.claims',
  People: 'app.title.people',
  Person: 'app.title.person',
  Insights: 'app.title.insights',
  'Recurring splits': 'app.title.recurring',
  'New recurring split': 'app.title.newRecurring',
  'Recurring split': 'app.title.recurringOne',
  Collections: 'app.title.collections',
  'New collection': 'app.title.newCollection',
  Collection: 'app.title.collection',
  'Edit collection': 'app.title.editCollection',
  Pro: 'app.title.pro',
}

/** A route's title in the UI language: an English title we know, or a catalog key; anything else as is. */
function pageTitle(title: string): string {
  if (Object.hasOwn(TITLE_KEYS, title)) return t(TITLE_KEYS[title] as MessageKey)
  if (hasMessage(title)) return t(title as MessageKey)
  return title
}

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

  // A language change re-renders every screen (helpers outside React read it at render time).
  const lang = useLang()

  // Before paint and after the screen's own layout effects; screens that name the page more
  // precisely (a group's name) set it in a passive effect, which runs after this.
  const title = route?.title ?? null
  useLayoutEffect(() => {
    if (title !== null) document.title = t('app.title.format', { page: pageTitle(title), brand: BRAND.name })
  }, [title, location.path, lang])

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
        {tab !== null && <TabBar items={tabs()} activeKey={tab} onNavigate={switchTab} />}
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
  useLang()
  const writable = useStorageWritable()
  if (writable) return null
  return (
    <div className={styles.notice}>
      <Banner tone="warning" title={t('app.storage.title')}>
        {t('app.storage.body', { brand: BRAND.name })}
      </Banner>
    </div>
  )
}

/** A quiet placeholder while a screen's code loads (it only fades in if that takes a moment). */
function RouteFallback() {
  return (
    <div className={styles.fallback} role="status" aria-label={t('app.loading.aria')}>
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
  let title = t('app.crash.title')
  let text = t('app.crash.body')
  let actions: ReactNode = (
    <>
      <Button block onClick={onRetry}>
        {t('app.crash.retry.cta')}
      </Button>
      <Button block variant="ghost" onClick={goHome}>
        {t('app.crash.home.cta')}
      </Button>
    </>
  )
  if (chunk && isOffline()) {
    icon = <WifiOff />
    title = t('app.crash.offline.title')
    text = t('app.crash.offline.body')
  } else if (chunk) {
    icon = <RefreshCw />
    title = t('app.crash.updated.title', { brand: BRAND.name })
    text = t('app.crash.updated.body')
    actions = (
      <>
        <Button block onClick={() => window.location.reload()}>
          {t('app.crash.reload.cta')}
        </Button>
        <Button block variant="ghost" onClick={goHome}>
          {t('app.crash.home.cta')}
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
