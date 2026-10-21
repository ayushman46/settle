/** Test support: a clean slate for the data layer between tests. */
import { clearSplitPrefill } from './handoff'
import { reloadAllStores } from './store'

/**
 * Empties localStorage and sessionStorage, drops pending writes and in-memory state, and tells
 * subscribers. Call in `beforeEach`/`afterEach` of any test that reads or writes data.
 */
export function resetDataForTests(): void {
  try {
    window.localStorage.clear()
    window.sessionStorage.clear()
  } catch {
    // Storage unavailable: the in-memory reset still applies.
  }
  clearSplitPrefill()
  reloadAllStores()
}
