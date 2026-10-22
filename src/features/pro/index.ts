/**
 * Settle Pro screens: the upgrade page, the in-context paywall, "Redeem a code" and the locked
 * state of Pro features.
 *
 * For bundle size, import the narrow module you need rather than this barrel:
 *   - any screen that upsells:  `features/pro/paywall`      (`openPaywall`, `withPro` — no UI)
 *   - the app shell, once:      `features/pro/PaywallSheet` (`PaywallHost`)
 *   - the `/app/pro` route:     `features/pro/UpgradeScreen` (lazy)
 */
export {
  closePaywall,
  completePaywall,
  openPaywall,
  paywallState,
  usePaywall,
  withPro,
  type OpenPaywallOptions,
  type PaywallRequest,
  type PaywallState,
} from './paywall'
export { PaywallHost, PaywallSheet, type PaywallSheetProps } from './PaywallSheet'
export { ProLock, type ProLockProps } from './ProLock'
export { RedeemSheet, type RedeemSheetProps } from './RedeemSheet'
export { UpgradeScreen } from './UpgradeScreen'
export { PlanPicker, type PlanPickerProps } from './PlanPicker'
export { featurePitch, FREE_FOREVER, GENERAL_PITCH, proPerks, type FeaturePitch, type Perk } from './perks'
export {
  checkoutLabel,
  checkoutNote,
  cheapestPrice,
  daysLeft,
  defaultPlanId,
  endsInLabel,
  passDate,
  passSummary,
  planOptions,
  planSpokenLabel,
  PLAN_NAMES,
  PREFERRED_PLAN,
  priceLabel,
  savingsAgainstMonthly,
  type PlanOption,
} from './plans'
