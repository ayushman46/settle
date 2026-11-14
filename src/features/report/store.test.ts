import { beforeEach, describe, expect, it } from 'vitest'
import { resetDataForTests } from '../../data'
import { STORAGE_KEYS } from '../../data/stores'
import { reportStore, saveReportDetails } from './store'

beforeEach(() => {
  resetDataForTests()
  window.localStorage.removeItem(STORAGE_KEYS.report)
  reportStore.reload()
})

describe('the report store', () => {
  it('starts empty and remembers what was typed, trimmed and capped', () => {
    expect(reportStore.get()).toEqual({ name: '', employee: '', purpose: '' })
    saveReportDetails({ name: '  Ayush Kumar ', purpose: 'Client visit, Pune' })
    saveReportDetails({ employee: 'E-1042 / Sales' })
    expect(reportStore.get()).toEqual({ name: 'Ayush Kumar', employee: 'E-1042 / Sales', purpose: 'Client visit, Pune' })
    saveReportDetails({ purpose: 'x'.repeat(500) })
    expect(reportStore.get().purpose).toHaveLength(200)
  })

  it('reads what it can from junk in storage', () => {
    window.localStorage.setItem(STORAGE_KEYS.report, JSON.stringify({ v: 1, data: { name: 'Ayush', employee: 42, purpose: 'y'.repeat(900), extra: true } }))
    reportStore.reload()
    expect(reportStore.get()).toEqual({ name: 'Ayush', employee: '', purpose: '' })
  })

  it('falls back to empty on unreadable storage', () => {
    window.localStorage.setItem(STORAGE_KEYS.report, '{not json')
    reportStore.reload()
    expect(reportStore.get()).toEqual({ name: '', employee: '', purpose: '' })
    window.localStorage.setItem(STORAGE_KEYS.report, JSON.stringify({ v: 1, data: 'nope' }))
    reportStore.reload()
    expect(reportStore.get()).toEqual({ name: '', employee: '', purpose: '' })
  })
})
