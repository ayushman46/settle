/**
 * Settle's data layer: persisted stores (localStorage, no server), actions that keep them
 * consistent, and React hooks to read them. Money maths lives in `src/engine`.
 */
export {
  createStore,
  flushAllStores,
  memoizeLast,
  reloadAllStores,
  shallowArrayEqual,
  shallowRecordEqual,
  useStorageWritable,
  useStore,
  WRITE_DELAY_MS,
  type CreateStoreOptions,
  type PersistedStore,
  type Store,
  type ZodType,
} from './store'
export { expensesStore, friendsStore, groupsStore, profileStore, recurringStore, STORAGE_KEYS, STORAGE_VERSION } from './stores'
export {
  compareExpensesNewestFirst,
  hasData,
  sortFriends,
  useDueRecurring,
  useExpense,
  useExpenses,
  useFriend,
  useFriends,
  useFriendsById,
  useGroup,
  useGroupBalances,
  useGroups,
  useHasData,
  useMe,
  useProfile,
  useRecurring,
  useSummary,
  type ExpenseFilter,
} from './hooks'
export { DataError, ExpenseError, type DataErrorCode, type ExpenseErrorCode } from './errors'
export { updateProfile } from './profile'
export { addFriend, findFriendByName, isFriendInUse, removeFriend, touchFriends, updateFriend } from './friends'
export {
  deleteExpense,
  duplicateExpenseDraft,
  expenseDraftIssue,
  restoreExpense,
  saveExpense,
  setAllPaidBack,
  setPaidBack,
  type ExpenseDraft,
} from './expenses'
export {
  createGroup,
  deleteGroup,
  deleteSettlement,
  recordSettlement,
  restoreGroup,
  setGroupArchived,
  updateGroup,
  type GroupSnapshot,
} from './groups'
export {
  createExpenseFromRecurring,
  deleteRecurring,
  restoreRecurring,
  saveRecurring,
  type RecurringDraft,
} from './recurring'
export { BACKUP_VERSION, clearAllData, exportBackup, importBackup, parseBackup, type BackupFile } from './backup'
export { CSV_BOM, csvField, exportCsv } from './csv'
export { completeOnboarding, legacyUpiIdFor, migrateLegacy, MIGRATION_KEY } from './legacy'
export {
  clearSplitPrefill,
  HANDOFF_KEY,
  peekSplitPrefill,
  setSplitPrefill,
  takeSplitPrefill,
  type SplitPrefill,
} from './handoff'
export {
  DEFAULT_GROUP_EMOJI,
  GROUP_KINDS,
  MAX_FRIENDS,
  MAX_GROUP_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_TITLE_LENGTH,
  cleanPhone,
  cleanUpiId,
} from './schemas'
export { resetDataForTests } from './testing'
