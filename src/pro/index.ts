/**
 * Settle Pro on the client: licenses (Ed25519-signed, stored on this device), feature gates,
 * plans and checkout (Razorpay, one-time passes), and the free daily AI allowance.
 */
export { isLicenseActive, verifyLicenseToken, checkLicenseToken, type LicenseCheck } from './license'
export {
  clearLicense,
  hasFeature,
  licenseHeaders,
  licenseToken,
  proState,
  redeemLicense,
  resumePendingPayment,
  useHasFeature,
  usePro,
  type ProState,
  type ProStatus,
  type RedeemResult,
} from './store'
export {
  CHECKOUT_MESSAGES,
  FALLBACK_BILLING_CONFIG,
  hasFreshBillingConfig,
  loadBillingConfig,
  planById,
  planMonths,
  planPerMonth,
  startCheckout,
  useBillingConfig,
  type BillingConfig,
  type CheckoutOptions,
  type CheckoutResult,
  type Plan,
} from './billing'
export { aiUsedToday, consumeAiQuota, quotaFor, useAiQuota, type AiQuota } from './quota'
export { extractLicenseToken, LICENSE_HEADER } from './token'
