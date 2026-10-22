import { describe, expect, it } from 'vitest'
import * as bill from './index'

describe('the bill feature entry point', () => {
  it('offers the light API other screens need', () => {
    expect(bill.BILL_PATH).toBe('/app/bill')
    expect(bill.QUICK_SPLIT_PATH).toBe('/app/split/new?from=scan')
    expect(typeof bill.openBill).toBe('function')
    expect(typeof bill.billDraftSummary).toBe('function')
    expect(typeof bill.useBillDraft).toBe('function')
    expect(typeof bill.clearBillDraft).toBe('function')
    expect(typeof bill.CurrencySheet).toBe('function')
  })

  it('never pulls the flow itself in (the route lazy-loads it)', () => {
    expect(Object.keys(bill)).not.toContain('BillFlow')
  })
})
