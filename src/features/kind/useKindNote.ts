import { useMemo } from 'react'
import { useExpenses, useGroups } from '../../data'
import { findKindEntry, type KindEntry } from './engine'
import { useKindEntries } from './store'

/** The payment in kind behind a record (see `kindNote`), following the data as it changes. */
export function useKindNote(id: string, debtorId?: string): KindEntry | null {
  const entries = useKindEntries()
  const expenses = useExpenses()
  const groups = useGroups()
  return useMemo(() => (entries.length === 0 ? null : findKindEntry(entries, id, debtorId, { expenses, groups })), [entries, id, debtorId, expenses, groups])
}
