/**
 * The little an expense report keeps on this phone: the name, employee ID or department and
 * purpose last typed, so the next claim is filled in already. The expenses come from the data itself.
 */
import * as z from 'zod/mini'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'

export interface ReportDetails {
  /** As it should appear on the claim; empty = the profile name. */
  name: string
  /** Employee ID, department, cost centre: free text. */
  employee: string
  purpose: string
}

export const REPORT_LIMITS = { name: 120, employee: 80, purpose: 200 } as const

const text = (max: number) => z.catch(z.string().check(z.maxLength(max)), '')

export const reportSchema = z.object({
  name: text(REPORT_LIMITS.name),
  employee: text(REPORT_LIMITS.employee),
  purpose: text(REPORT_LIMITS.purpose),
})

export const reportStore = createStore<ReportDetails>({
  key: STORAGE_KEYS.report,
  schema: reportSchema,
  initial: () => ({ name: '', employee: '', purpose: '' }),
  version: 1,
})

export function useReportDetails(): ReportDetails {
  return useStore(reportStore, (state) => state)
}

/** Remembers what was typed (trimmed, capped). */
export function saveReportDetails(patch: Partial<ReportDetails>): void {
  const state = reportStore.get()
  const next = { ...state }
  for (const key of ['name', 'employee', 'purpose'] as const) {
    const value = patch[key]
    if (typeof value === 'string') next[key] = value.trim().slice(0, REPORT_LIMITS[key])
  }
  if (next.name === state.name && next.employee === state.employee && next.purpose === state.purpose) return
  reportStore.set(next)
}
