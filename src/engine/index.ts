/** The engine: pure, deterministic money maths for "split anything". No storage, no React. */
export {
  FULL_PERCENT_BPS,
  expenseShares,
  isValidTotal,
  roundSharesToWhole,
  splitAmount,
  splitRestEqually,
  uniqueParticipants,
  type AmountSplitInput,
  type AmountSplitMode,
  type AmountSplitResult,
  type SplitIssue,
} from './split'
export {
  collectProgress,
  expenseNet,
  expenseStanding,
  groupBalances,
  isSettledInGroup,
  overallSummary,
  simplifyDebts,
  type ExpenseStanding,
  type OverallSummary,
  type Transfer,
} from './balances'
export { insights, insightsRange, type Insights, type InsightsOptions, type InsightsRange } from './insights'
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
