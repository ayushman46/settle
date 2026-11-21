/**
 * Every page of Settle: the public pages (`/`, `/pay`, `/claim`, `/pool`, `/privacy`, `/terms`) and the app under
 * `/app`. Home and onboarding ship in the main bundle (the app opens on one of them); every other
 * screen is its own chunk, loaded on first visit — or earlier, while the person is idle on Home
 * (`preloadCoreScreens`), so moving around feels instant and works offline afterwards.
 */
import { useEffect, type ComponentType } from 'react'
import { HomeScreen } from '../features/home/HomeScreen'
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen'
import { lazyScreen, type LazyScreen } from './lazyScreen'
import { matchPath, navigate } from './router'

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
export const ClaimPage = lazyScreen(
  'ClaimPage',
  () => import('../features/claim/ClaimPage'),
  (m) => m.ClaimPage,
)
export const PoolPage = lazyScreen(
  'PoolPage',
  () => import('../features/pools/PoolPage'),
  (m) => m.PoolPage,
)
export const JoinPage = lazyScreen(
  'JoinPage',
  () => import('../features/groupsync/JoinPage'),
  (m) => m.JoinPage,
)
export const GetPage = lazyScreen(
  'GetPage',
  () => import('../features/install/GetPage'),
  (m) => m.GetPage,
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

export type PublicPageKey = 'landing' | 'pay' | 'claim' | 'pool' | 'join' | 'get' | 'privacy' | 'terms'

export const PUBLIC_PAGES: Readonly<Record<string, { key: PublicPageKey; page: LazyScreen }>> = {
  '/': { key: 'landing', page: LandingPage },
  '/pay': { key: 'pay', page: PayPage },
  '/claim': { key: 'claim', page: ClaimPage },
  '/pool': { key: 'pool', page: PoolPage },
  '/join': { key: 'join', page: JoinPage },
  '/get': { key: 'get', page: GetPage },
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
const ClaimRoundScreen = lazyScreen(
  'ClaimRoundScreen',
  () => import('../features/claim/ClaimRoundScreen'),
  (m) => m.ClaimRoundScreen,
)
const ClaimReplyScreen = lazyScreen(
  'ClaimReplyScreen',
  () => import('../features/claim/ClaimReplyScreen'),
  (m) => m.ClaimReplyScreen,
)
const ShareInScreen = lazyScreen(
  'ShareInScreen',
  () => import('../features/sharein/ShareInScreen'),
  (m) => m.ShareInScreen,
)
const ProofScreen = lazyScreen(
  'ProofScreen',
  () => import('../features/proof/ProofScreen'),
  (m) => m.ProofScreen,
)
const RentListScreen = lazyScreen(
  'RentListScreen',
  () => import('../features/rent/RentListScreen'),
  (m) => m.RentListScreen,
)
const RentEditorScreen = lazyScreen(
  'RentEditorScreen',
  () => import('../features/rent/RentEditorScreen'),
  (m) => m.RentEditorScreen,
)
const BijliScreen = lazyScreen(
  'BijliScreen',
  () => import('../features/bijli/BijliScreen'),
  (m) => m.BijliScreen,
)
const WhosPaidScreen = lazyScreen(
  'WhosPaidScreen',
  () => import('../features/whospaid/WhosPaidScreen'),
  (m) => m.WhosPaidScreen,
)
const CollectScreen = lazyScreen(
  'CollectScreen',
  () => import('../features/collect/CollectScreen'),
  (m) => m.CollectScreen,
)
const RentDetailScreen = lazyScreen(
  'RentDetailScreen',
  () => import('../features/rent/RentDetailScreen'),
  (m) => m.RentDetailScreen,
)
const RentReceiptsScreen = lazyScreen(
  'RentReceiptsScreen',
  () => import('../features/rent/RentReceiptsScreen'),
  (m) => m.RentReceiptsScreen,
)
const LendScreen = lazyScreen(
  'LendScreen',
  () => import('../features/lend/LendScreen'),
  (m) => m.LendScreen,
)
const PoolsScreen = lazyScreen(
  'PoolsScreen',
  () => import('../features/pools/PoolsScreen'),
  (m) => m.PoolsScreen,
)
const PoolEditorScreen = lazyScreen(
  'PoolEditorScreen',
  () => import('../features/pools/PoolEditorScreen'),
  (m) => m.PoolEditorScreen,
)
const PoolDetailScreen = lazyScreen(
  'PoolDetailScreen',
  () => import('../features/pools/PoolDetailScreen'),
  (m) => m.PoolDetailScreen,
)
const PoolReplyScreen = lazyScreen(
  'PoolReplyScreen',
  () => import('../features/pools/PoolReplyScreen'),
  (m) => m.PoolReplyScreen,
)
const PaidReplyScreen = lazyScreen(
  'PaidReplyScreen',
  () => import('../features/expense/PaidReplyScreen'),
  (m) => m.PaidReplyScreen,
)
const QueueScreen = lazyScreen(
  'QueueScreen',
  () => import('../features/queue/QueueScreen'),
  (m) => m.QueueScreen,
)
const WrappedScreen = lazyScreen(
  'WrappedScreen',
  () => import('../features/wrapped/WrappedScreen'),
  (m) => m.WrappedScreen,
)
const ReportScreen = lazyScreen(
  'ReportScreen',
  () => import('../features/report/ReportScreen'),
  (m) => m.ReportScreen,
)
const ShagunScreen = lazyScreen(
  'ShagunScreen',
  () => import('../features/shagun/ShagunScreen'),
  (m) => m.ShagunScreen,
)
const ShagunEntryScreen = lazyScreen(
  'ShagunEntryScreen',
  () => import('../features/shagun/ShagunEntryScreen'),
  (m) => m.ShagunEntryScreen,
)
const ShagunFamilyScreen = lazyScreen(
  'ShagunFamilyScreen',
  () => import('../features/shagun/ShagunFamilyScreen'),
  (m) => m.ShagunFamilyScreen,
)
const ShagunFunctionScreen = lazyScreen(
  'ShagunFunctionScreen',
  () => import('../features/shagun/ShagunFunctionScreen'),
  (m) => m.ShagunFunctionScreen,
)
const ScoreScreen = lazyScreen(
  'ScoreScreen',
  () => import('../features/score/ScoreScreen'),
  (m) => m.ScoreScreen,
)
const SettleDayScreen = lazyScreen(
  'SettleDayScreen',
  () => import('../features/settleday/SettleDayScreen'),
  (m) => m.SettleDayScreen,
)
const CheckoutScreen = lazyScreen(
  'CheckoutScreen',
  () => import('../features/checkout/CheckoutScreen'),
  (m) => m.CheckoutScreen,
)
const PaydayScreen = lazyScreen(
  'PaydayScreen',
  () => import('../features/payday/PaydayScreen'),
  (m) => m.PaydayScreen,
)
const KistScreen = lazyScreen(
  'KistScreen',
  () => import('../features/kist/KistScreen'),
  (m) => m.KistScreen,
)
const KistPlanScreen = lazyScreen(
  'KistPlanScreen',
  () => import('../features/kist/KistPlanScreen'),
  (m) => m.KistPlanScreen,
)
const PromisesScreen = lazyScreen(
  'PromisesScreen',
  () => import('../features/promise/PromisesScreen'),
  (m) => m.PromisesScreen,
)
const HouseholdsScreen = lazyScreen(
  'HouseholdsScreen',
  () => import('../features/units/HouseholdsScreen'),
  (m) => m.HouseholdsScreen,
)
const PassbookScreen = lazyScreen(
  'PassbookScreen',
  () => import('../features/passbook/PassbookScreen'),
  (m) => m.PassbookScreen,
)
const LimitScreen = lazyScreen(
  'LimitScreen',
  () => import('../features/limit/LimitScreen'),
  (m) => m.LimitScreen,
)
const ByaajScreen = lazyScreen(
  'ByaajScreen',
  () => import('../features/byaaj/ByaajScreen'),
  (m) => m.ByaajScreen,
)
const ByaajDetailScreen = lazyScreen(
  'ByaajDetailScreen',
  () => import('../features/byaaj/ByaajDetailScreen'),
  (m) => m.ByaajDetailScreen,
)
const ToolsScreen = lazyScreen(
  'ToolsScreen',
  () => import('../features/tools/ToolsScreen'),
  (m) => m.ToolsScreen,
)
const ProofPackScreen = lazyScreen(
  'ProofPackScreen',
  () => import('../features/proofpack/ProofPackScreen'),
  (m) => m.ProofPackScreen,
)
const ImportScreen = lazyScreen(
  'ImportScreen',
  () => import('../features/importer/ImportScreen'),
  (m) => m.default,
)
const ChatScreen = lazyScreen(
  'ChatScreen',
  () => import('../features/chat/ChatScreen'),
  (m) => m.ChatScreen,
)
const CounterScreen = lazyScreen(
  'CounterScreen',
  () => import('../features/counter/CounterScreen'),
  (m) => m.CounterScreen,
)
const StuckScreen = lazyScreen(
  'StuckScreen',
  () => import('../features/stuck/StuckScreen'),
  (m) => m.StuckScreen,
)
const StuckAddScreen = lazyScreen(
  'StuckAddScreen',
  () => import('../features/stuck/StuckAddScreen'),
  (m) => m.StuckAddScreen,
)
const StuckDetailScreen = lazyScreen(
  'StuckDetailScreen',
  () => import('../features/stuck/StuckDetailScreen'),
  (m) => m.StuckDetailScreen,
)
const FeesScreen = lazyScreen(
  'FeesScreen',
  () => import('../features/fees/FeesScreen'),
  (m) => m.FeesScreen,
)
const UpgradeScreen = lazyScreen(
  'UpgradeScreen',
  () => import('../features/pro/UpgradeScreen'),
  (m) => m.UpgradeScreen,
)
const TallyScreen = lazyScreen(
  'TallyScreen',
  () => import('../features/tally/TallyScreen'),
  (m) => m.TallyScreen,
)
const TallyDetailScreen = lazyScreen(
  'TallyDetailScreen',
  () => import('../features/tally/TallyDetailScreen'),
  (m) => m.TallyDetailScreen,
)
const CommitteeScreen = lazyScreen(
  'CommitteeScreen',
  () => import('../features/committee/CommitteeScreen'),
  (m) => m.CommitteeScreen,
)
const CommitteeDetailScreen = lazyScreen(
  'CommitteeDetailScreen',
  () => import('../features/committee/CommitteeDetailScreen'),
  (m) => m.CommitteeDetailScreen,
)
const FairRentScreen = lazyScreen(
  'FairRentScreen',
  () => import('../features/fairrent/FairRentScreen'),
  (m) => m.FairRentScreen,
)
const HelpScreen = lazyScreen(
  'HelpScreen',
  () => import('../features/help/HelpScreen'),
  (m) => m.HelpScreen,
)
const HelpPersonScreen = lazyScreen(
  'HelpPersonScreen',
  () => import('../features/help/HelpPersonScreen'),
  (m) => m.HelpPersonScreen,
)
const AccountScreen = lazyScreen('AccountScreen', () => import('../features/account/AccountScreen'), (m) => m.AccountScreen)
const CloudGroupsScreen = lazyScreen('CloudGroupsScreen', () => import('../features/account/CloudGroupsScreen'), (m) => m.CloudGroupsScreen)
const CloudGroupScreen = lazyScreen('CloudGroupScreen', () => import('../features/account/CloudGroupScreen'), (m) => m.CloudGroupScreen)
const CloudJoinScreen = lazyScreen('CloudJoinScreen', () => import('../features/account/CloudJoinScreen'), (m) => m.CloudJoinScreen)

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
  { pattern: '/app/groups/:id/wrapped', screen: WrappedScreen, title: 'Story', tab: null },
  { pattern: '/app/activity', screen: ActivityScreen, title: 'Activity', tab: 'activity' },
  { pattern: '/app/you', screen: YouScreen, title: 'You', tab: 'you' },
  { pattern: '/app/split/new', screen: NewSplitScreen, title: 'New split', tab: null },
  { pattern: '/app/split/:id/edit', screen: NewSplitScreen, title: 'Edit split', tab: null },
  { pattern: '/app/share', screen: ShareInScreen, title: 'From SMS', tab: null },
  { pattern: '/app/lend', screen: LendScreen, title: 'Lend or borrow', tab: null },
  { pattern: '/app/proof', screen: ProofScreen, title: 'Paid? Drop the screenshot', tab: null },
  { pattern: '/app/lend/:id/edit', screen: LendScreen, title: 'Edit udhaar', tab: null },
  { pattern: '/app/expense/:id', screen: ExpenseDetailScreen, title: 'Expense', tab: null },
  { pattern: '/app/counter/:id', screen: CounterScreen, title: 'Pay at the counter', tab: null },
  { pattern: '/app/chat', screen: ChatScreen, title: 'Chat to split', tab: null },
  { pattern: '/app/import', screen: ImportScreen, title: 'Bring your Splitwise', tab: null },
  { pattern: '/app/proof-of-repayments', screen: ProofPackScreen, title: 'Proof of repayments', tab: null },
  { pattern: '/app/groups/:id/settle-day', screen: SettleDayScreen, title: 'Settle day', tab: null },
  { pattern: '/app/groups/:id/checkout', screen: CheckoutScreen, title: 'Settle before you leave', tab: null },
  { pattern: '/app/tools', screen: ToolsScreen, title: 'Everything Settle does', tab: null },
  { pattern: '/app/payday', screen: PaydayScreen, title: 'Payday', tab: null },
  { pattern: '/app/people/:id/statement', screen: PassbookScreen, title: 'Statement', tab: null },
  { pattern: '/app/limit', screen: LimitScreen, title: 'Udhaar limit', tab: null },
  { pattern: '/app/byaaj', screen: ByaajScreen, title: 'Interest on a loan', tab: null },
  { pattern: '/app/byaaj/:id', screen: ByaajDetailScreen, title: 'Interest on a loan', tab: null },
  { pattern: '/app/kist', screen: KistScreen, title: 'Pay in parts', tab: null },
  { pattern: '/app/kist/:id', screen: KistPlanScreen, title: 'Pay in parts', tab: null },
  { pattern: '/app/promises', screen: PromisesScreen, title: 'Promises', tab: null },
  { pattern: '/app/groups/:id/households', screen: HouseholdsScreen, title: 'Households', tab: null },
  { pattern: '/app/score', screen: ScoreScreen, title: 'Settle Score', tab: null },
  { pattern: '/app/pay-all', screen: QueueScreen, title: 'Clear everything', tab: null },
  { pattern: '/app/report', screen: ReportScreen, title: 'Expense claim', tab: null },
  { pattern: '/app/shagun', screen: ShagunScreen, title: 'Shagun book', tab: null },
  { pattern: '/app/shagun/add', screen: ShagunEntryScreen, title: 'Add envelopes', tab: null },
  { pattern: '/app/shagun/family/:name', screen: ShagunFamilyScreen, title: 'Shagun book', tab: null },
  { pattern: '/app/shagun/function/:id', screen: ShagunFunctionScreen, title: 'Shagun book', tab: null },
  { pattern: '/app/paid', screen: PaidReplyScreen, title: 'Payment', tab: null },
  { pattern: '/app/bill', screen: BillFlow, title: null, tab: null },
  // Where people look for it by name.
  { pattern: '/app/scan', screen: ToScanBill, title: 'Scan bill', tab: null },
  { pattern: '/app/claims/in', screen: ClaimReplyScreen, title: 'Claims', tab: null },
  { pattern: '/app/claims/:id', screen: ClaimRoundScreen, title: 'Claims', tab: null },
  { pattern: '/app/friends', screen: FriendsScreen, title: 'People', tab: null },
  { pattern: '/app/friends/:id', screen: FriendDetailScreen, title: 'Person', tab: null },
  { pattern: '/app/insights', screen: InsightsScreen, title: 'Insights', tab: null },
  { pattern: '/app/recurring', screen: RecurringScreen, title: 'Recurring splits', tab: null },
  { pattern: '/app/recurring/new', screen: RecurringEditorScreen, title: 'New recurring split', tab: null },
  { pattern: '/app/recurring/:id', screen: RecurringEditorScreen, title: 'Recurring split', tab: null },
  { pattern: '/app/pools', screen: PoolsScreen, title: 'Collections', tab: null },
  { pattern: '/app/pools/new', screen: PoolEditorScreen, title: 'New collection', tab: null },
  { pattern: '/app/pools/in', screen: PoolReplyScreen, title: 'Collections', tab: null },
  { pattern: '/app/pools/:id', screen: PoolDetailScreen, title: 'Collection', tab: null },
  { pattern: '/app/pools/:id/edit', screen: PoolEditorScreen, title: 'Edit collection', tab: null },
  { pattern: '/app/pro', screen: UpgradeScreen, title: 'Pro', tab: null },
  { pattern: '/app/rent', screen: RentListScreen, title: 'Rent', tab: null },
  { pattern: '/app/rent/new', screen: RentEditorScreen, title: 'Set up your rent', tab: null },
  { pattern: '/app/rent/:id', screen: RentDetailScreen, title: 'Rent', tab: null },
  { pattern: '/app/rent/:id/edit', screen: RentEditorScreen, title: 'Edit rent', tab: null },
  { pattern: '/app/rent/:id/receipts', screen: RentReceiptsScreen, title: 'Rent receipts', tab: null },
  { pattern: '/app/bijli', screen: BijliScreen, title: 'Electricity', tab: null },
  { pattern: '/app/whos-paid', screen: WhosPaidScreen, title: 'Who’s paid?', tab: null },
  { pattern: '/app/collect', screen: CollectScreen, title: 'To collect', tab: null },
  { pattern: '/app/stuck', screen: StuckScreen, title: 'Stuck money', tab: null },
  { pattern: '/app/stuck/new', screen: StuckAddScreen, title: 'Add stuck money', tab: null },
  { pattern: '/app/stuck/:id', screen: StuckDetailScreen, title: 'Stuck money', tab: null },
  { pattern: '/app/stuck/:id/edit', screen: StuckAddScreen, title: 'Edit stuck money', tab: null },
  { pattern: '/app/fees', screen: FeesScreen, title: 'Bank charges', tab: null },
  { pattern: '/app/tally', screen: TallyScreen, title: 'Daily tally', tab: null },
  { pattern: '/app/tally/:id', screen: TallyDetailScreen, title: 'Tally', tab: null },
  { pattern: '/app/committee', screen: CommitteeScreen, title: 'Committee', tab: null },
  { pattern: '/app/committee/:id', screen: CommitteeDetailScreen, title: 'Committee', tab: null },
  { pattern: '/app/fair-rent', screen: FairRentScreen, title: 'Fair rent', tab: null },
  { pattern: '/app/help', screen: HelpScreen, title: 'House help', tab: null },
  { pattern: '/app/help/:id', screen: HelpPersonScreen, title: 'House help', tab: null },
  { pattern: '/app/account', screen: AccountScreen, title: 'account.tool.title', tab: null },
  { pattern: '/app/cloud', screen: CloudGroupsScreen, title: 'account.cloud.title', tab: null },
  { pattern: '/app/cloud/join', screen: CloudJoinScreen, title: 'account.cloud.join.title', tab: null },
  { pattern: '/app/cloud/:id', screen: CloudGroupScreen, title: 'account.cloud.title', tab: null },
]

/** The app route for `path`, or null for an unknown `/app/*` path. */
export function matchAppRoute(path: string): AppRoute | null {
  return APP_ROUTES.find((route) => matchPath(route.pattern, path) !== null) ?? null
}

/** `/app/scan` (what people type) is the bill flow's own address, `/app/bill`. */
function ToScanBill() {
  useEffect(() => navigate('/app/bill', { replace: true }), [])
  return null
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
  LendScreen,
  // Stuck money: a Home tile, and needed most when the network is bad.
  StuckScreen,
  StuckDetailScreen,
  StuckAddScreen,
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
