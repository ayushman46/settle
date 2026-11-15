/**
 * Families and couples pay as one: households inside a group. A household's balance is the sum of
 * its members'; Settle shows one payment per household; a new expense can be shared per family,
 * with children at half or free.
 *
 * The Tools hub shows this feature with the copy keys `units.tool.title` and `units.tool.body`.
 */
export {
  applyUnits,
  hasHouseholds,
  householdOf,
  planUnitPayment,
  resolveUnits,
  unitBalances,
  unitShares,
  unitsSplitFor,
  unitsSummary,
  unitTransfers,
  unitWeights,
  unitWeightsFor,
  type ChildRule,
  type GroupUnits,
  type Household,
  type PlannedPayment,
  type Unit,
  type UnitBalance,
  type UnitsBasis,
  type UnitTransfer,
} from './engine'
export { withUnitsSplit } from './applyUnits'
export { HouseholdsScreen } from './HouseholdsScreen'
export { HOUSEHOLDS_ROUTE, householdsPath } from './paths'
export {
  getGroupUnits,
  getUnitPayments,
  isWithinFamily,
  recordUnitPayment,
  setGroupUnits,
  undoUnitPayment,
  unitsStore,
  useGroupUnits,
  useUnitPayments,
  useWithinFamily,
  withinFamilyIds,
  type UnitPayment,
  type UnitsState,
} from './store'
export { unitsToday } from './today'
export { UnitsCard } from './UnitsCard'
export { UnitsSheet, type UnitsSheetProps } from './UnitsSheet'
export { UnitsSplitBar, type UnitsSplitBarProps } from './UnitsSplitBar'
export { paySentence, unitLabel } from './unitText'
export { useHouseholds, useUnitPeople } from './useUnits'
