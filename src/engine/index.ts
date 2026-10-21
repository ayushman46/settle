/** The engine: pure, deterministic money maths for "split anything". No storage, no React. */
export {
  FULL_PERCENT_BPS,
  expenseShares,
  isValidTotal,
  roundSharesToWhole,
  splitAmount,
  uniqueParticipants,
  type AmountSplitInput,
  type AmountSplitMode,
  type AmountSplitResult,
  type SplitIssue,
} from './split'
export {
  collectProgress,
  expenseNet,
  groupBalances,
  overallSummary,
  simplifyDebts,
  type OverallSummary,
  type Transfer,
} from './balances'
export { insights, type Insights, type InsightsOptions } from './insights'
export { DUE_SOON_DAYS, dueRecurring, nextRecurringPeriod, type RecurringDue } from './recurring'
export { CATEGORY_META, categoryFromText, isCategoryId, type CategoryMeta } from './categories'
export {
  addDays,
  addMonths,
  dateInPeriod,
  daysBetween,
  daysInMonth,
  isIsoDate,
  isPeriod,
  periodOf,
  periodsBetween,
  toIsoDate,
  today,
} from './dates'
