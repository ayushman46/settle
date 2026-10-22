/**
 * Every page of Settle: the public pages (`/`, `/pay`, `/privacy`, `/terms`) and the app under
 * `/app`. Home and onboarding ship in the main bundle (the app opens on one of them); every other
 * screen is its own chunk, loaded on first visit — or earlier, while the person is idle on Home
 * (`preloadCoreScreens`), so moving around feels instant and works offline afterwards.
 */
import type { ComponentType } from 'react'
import { HomeScreen } from '../features/home/HomeScreen'
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen'
import { lazyScreen, type LazyScreen } from './lazyScreen'
import { matchPath } from './router'

/* ------------------------------------------------------------------ public pages */

export const LandingPage = lazyScreen(
  'LandingPage',
  () => import('../features/landing/LandingPage'),
  (m) => m.LandingPage,
)
export const PayPage = lazyScreen(
  'PayPage',
  () => import('../features/pay/PayPage'),
  (m) => m.PayPage,
)
export const PrivacyPage = lazyScreen(
  'PrivacyPage',
  () => import('../features/legal/PrivacyPage'),
  (m) => m.PrivacyPage,
)
export const TermsPage = lazyScreen(
  'TermsPage',
  () => import('../features/legal/TermsPage'),
  (m) => m.TermsPage,
)

export type PublicPageKey = 'landing' | 'pay' | 'privacy' | 'terms'

export const PUBLIC_PAGES: Readonly<Record<string, { key: PublicPageKey; page: LazyScreen }>> = {
  '/': { key: 'landing', page: LandingPage },
  '/pay': { key: 'pay', page: PayPage },
  '/privacy': { key: 'privacy', page: PrivacyPage },
  '/terms': { key: 'terms', page: TermsPage },
}

/** The public page at `path` (a trailing slash is fine), or null. */
export function publicPage(path: string): { key: PublicPageKey; page: LazyScreen } | null {
  const bare = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
  return Object.hasOwn(PUBLIC_PAGES, bare) ? (PUBLIC_PAGES[bare] ?? null) : null
}

/** True for `/app` and everything under it. */
export function isAppPath(path: string): boolean {
  return path === '/app' || path.startsWith('/app/')
}

/* ------------------------------------------------------------------ app screens */

const GroupsScreen = lazyScreen(
  'GroupsScreen',
  () => import('../features/groups/GroupsScreen'),
  (m) => m.GroupsScreen,
)
const GroupDetailScreen = lazyScreen(
  'GroupDetailScreen',
  () => import('../features/groups/GroupDetailScreen'),
  (m) => m.GroupDetailScreen,
)
const SettleUpScreen = lazyScreen(
  'SettleUpScreen',
  () => import('../features/groups/SettleUpScreen'),
  (m) => m.SettleUpScreen,
)
const ActivityScreen = lazyScreen(
  'ActivityScreen',
  () => import('../features/activity/ActivityScreen'),
  (m) => m.ActivityScreen,
)
const YouScreen = lazyScreen(
  'YouScreen',
  () => import('../features/you/YouScreen'),
  (m) => m.YouScreen,
)
const NewSplitScreen = lazyScreen(
  'NewSplitScreen',
  () => import('../features/split/NewSplitScreen'),
  (m) => m.NewSplitScreen,
)
const ExpenseDetailScreen = lazyScreen(
  'ExpenseDetailScreen',
  () => import('../features/expense/ExpenseDetailScreen'),
  (m) => m.ExpenseDetailScreen,
)
const BillFlow = lazyScreen(
  'BillFlow',
  () => import('../features/bill/BillFlow'),
  (m) => m.BillFlow,
)
const FriendsScreen = lazyScreen(
  'FriendsScreen',
  () => import('../features/friends/FriendsScreen'),
  (m) => m.FriendsScreen,
)
const FriendDetailScreen = lazyScreen(
  'FriendDetailScreen',
  () => import('../features/friends/FriendDetailScreen'),
  (m) => m.FriendDetailScreen,
)
const InsightsScreen = lazyScreen(
  'InsightsScreen',
  () => import('../features/insights/InsightsScreen'),
  (m) => m.InsightsScreen,
)
const RecurringScreen = lazyScreen(
  'RecurringScreen',
  () => import('../features/recurring/RecurringScreen'),
  (m) => m.RecurringScreen,
)
const RecurringEditorScreen = lazyScreen(
  'RecurringEditorScreen',
  () => import('../features/recurring/RecurringEditorScreen'),
  (m) => m.RecurringEditorScreen,
)
const UpgradeScreen = lazyScreen(
  'UpgradeScreen',
  () => import('../features/pro/UpgradeScreen'),
  (m) => m.UpgradeScreen,
)

/** The paywall sheet, loaded the first time any screen asks for it. */
export const PaywallHost = lazyScreen(
  'PaywallHost',
  () => import('../features/pro/PaywallSheet'),
  (m) => m.PaywallHost,
)

export type TabKey = 'home' | 'groups' | 'activity' | 'you'

export interface AppRoute {
  pattern: string
  screen: ComponentType
  /** The tab's title ("Groups" → "Groups · Settle"); null when the screen titles itself (the bill flow). */
  title: string | null
  /** Set on the four tab roots: they show the tab bar. */
  tab: TabKey | null
}

export const HOME_PATH = '/app'
export const WELCOME_PATTERN = '/app/welcome'

/** First match wins (so `/app/recurring/new` comes before `/app/recurring/:id`). */
export const APP_ROUTES: readonly AppRoute[] = [
  { pattern: HOME_PATH, screen: HomeScreen, title: 'Home', tab: 'home' },
  { pattern: WELCOME_PATTERN, screen: OnboardingScreen, title: 'Welcome', tab: null },
  { pattern: '/app/groups', screen: GroupsScreen, title: 'Groups', tab: 'groups' },
  { pattern: '/app/groups/:id', screen: GroupDetailScreen, title: 'Group', tab: null },
  { pattern: '/app/groups/:id/settle', screen: SettleUpScreen, title: 'Settle up', tab: null },
  { pattern: '/app/activity', screen: ActivityScreen, title: 'Activity', tab: 'activity' },
  { pattern: '/app/you', screen: YouScreen, title: 'You', tab: 'you' },
  { pattern: '/app/split/new', screen: NewSplitScreen, title: 'New split', tab: null },
  { pattern: '/app/split/:id/edit', screen: NewSplitScreen, title: 'Edit split', tab: null },
  { pattern: '/app/expense/:id', screen: ExpenseDetailScreen, title: 'Expense', tab: null },
  { pattern: '/app/bill', screen: BillFlow, title: null, tab: null },
  { pattern: '/app/friends', screen: FriendsScreen, title: 'People', tab: null },
  { pattern: '/app/friends/:id', screen: FriendDetailScreen, title: 'Person', tab: null },
  { pattern: '/app/insights', screen: InsightsScreen, title: 'Insights', tab: null },
  { pattern: '/app/recurring', screen: RecurringScreen, title: 'Recurring splits', tab: null },
  { pattern: '/app/recurring/new', screen: RecurringEditorScreen, title: 'New recurring split', tab: null },
  { pattern: '/app/recurring/:id', screen: RecurringEditorScreen, title: 'Recurring split', tab: null },
  { pattern: '/app/pro', screen: UpgradeScreen, title: 'Pro', tab: null },
]

/** The app route for `path`, or null for an unknown `/app/*` path. */
export function matchAppRoute(path: string): AppRoute | null {
  return APP_ROUTES.find((route) => matchPath(route.pattern, path) !== null) ?? null
}

/** The screens people reach from Home most (and the paywall), loaded ahead of time — also so they open offline. */
const CORE_SCREENS: readonly LazyScreen[] = [
  NewSplitScreen,
  ExpenseDetailScreen,
  GroupsScreen,
  ActivityScreen,
  YouScreen,
  BillFlow,
  FriendsScreen,
  GroupDetailScreen,
  FriendDetailScreen,
  // Last: the paywall opens instantly the first time a free limit is reached.
  PaywallHost,
]

/** Loads the core screens' code one after another (never all at once). Failures are ignored. */
export async function preloadCoreScreens(): Promise<void> {
  for (const screen of CORE_SCREENS) {
    try {
      await screen.preload()
    } catch {
      // Offline or a bad deploy: the screen loads (or explains) when it's opened.
    }
  }
}
