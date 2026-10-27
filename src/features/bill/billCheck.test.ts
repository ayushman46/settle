import { describe, expect, it } from 'vitest'
import { SAMPLE_SCAN } from '../../api/sample'
import { scanToBill } from '../../api/mapScan'
import { parseSession } from '../../state/persist'
import { createSession, reducer } from '../../state/reducer'
import { effectivePaid } from '../../state/selectors'
import { EMPTY_META, type BillFee, type BillMeta, type BillTaxLine, type Session } from '../../types'
import { checkBill, type BillFinding } from './billCheck'
import { sampleSession } from './screenTestKit'

/** Rupees → paise. */
const r = (rupees: number) => Math.round(rupees * 100)

/** A scanned rupee bill: `items` as [name, rupees]; meta amounts in rupees. */
function bill(meta: Partial<Record<keyof BillMeta, unknown>>, items: ReadonlyArray<readonly [string, number]>, extra: Partial<Session> = {}): Session {
  const money = (key: 'subtotal' | 'tax' | 'serviceCharge' | 'discount' | 'tip' | 'total') => (typeof meta[key] === 'number' ? r(meta[key]) : null)
  return {
    ...createSession('INR'),
    source: 'scan',
    step: 'paid',
    meta: {
      ...EMPTY_META,
      merchant: (meta.merchant as string | undefined) ?? 'Saffron Table',
      subtotal: money('subtotal'),
      tax: money('tax'),
      serviceCharge: money('serviceCharge'),
      discount: money('discount'),
      tip: money('tip'),
      total: money('total'),
      ...(meta.fees ? { fees: meta.fees as BillFee[] } : {}),
      ...(meta.taxLines ? { taxLines: meta.taxLines as BillTaxLine[] } : {}),
      ...(meta.billOfSupply ? { billOfSupply: true } : {}),
    },
    items: items.map(([name, rupees], i) => ({ id: `i${i}`, name, quantity: 1, amount: r(rupees) })),
    ...extra,
  }
}

const kinds = (s: Session) => checkBill(s).findings.map((f) => f.kind)
const find = <K extends BillFinding['kind']>(s: Session, kind: K) => checkBill(s).findings.find((f): f is Extract<BillFinding, { kind: K }> => f.kind === kind)

describe('checkBill — service charge', () => {
  it('finds the sample bill’s service charge with 5% GST worked out on it too', () => {
    const check = checkBill(sampleSession('paid'))
    expect(check.findings).toEqual([{ kind: 'service_charge', key: 'service_charge', amount: 11525, gst: 576, gstUnknown: false, saving: 12101 }])
    expect(check.saving).toBe(12101)
    expect(check.take).toEqual({ serviceCharge: true, tip: false, tax: 576, taxLineIds: [], itemIds: [], feeIds: [] })
  })

  it('counts no GST when the tax is on the food alone', () => {
    const s = bill({ serviceCharge: 100, tax: 50, total: 1150 }, [['Thali', 1000]])
    expect(find(s, 'service_charge')).toMatchObject({ amount: r(100), gst: 0, gstUnknown: false, saving: r(100) })
  })

  it('works out GST on the discounted food (GST is due on the value after discount)', () => {
    // ₹1,000 food − ₹100 off = ₹900; 5% of (₹900 + ₹100 service charge) = ₹50.
    const s = bill({ serviceCharge: 100, discount: 100, tax: 50, total: 1050 }, [['Thali', 1000]])
    expect(find(s, 'service_charge')).toMatchObject({ gst: r(5), saving: r(105) })
  })

  it('reads GST at 18% too', () => {
    const s = bill({ serviceCharge: 100, tax: 198, total: 1298 }, [['Thali', 1000]])
    expect(find(s, 'service_charge')).toMatchObject({ gst: r(18), saving: r(118) })
  })

  it('knows a printed subtotal can already include the service charge', () => {
    const s = bill({ subtotal: 1100, serviceCharge: 100, tax: 55, total: 1155 }, [['Thali', 1000]])
    expect(find(s, 'service_charge')).toMatchObject({ gst: r(5) })
  })

  it('can’t tell the GST on a bill with drinks (alcohol is taxed with VAT, outside GST)', () => {
    const s = bill({ serviceCharge: 100, tax: 75, total: 1175 }, [
      ['Paneer Tikka', 600],
      ['Kingfisher Ultra Beer', 400],
    ])
    expect(find(s, 'service_charge')).toMatchObject({ gst: 0, gstUnknown: true, saving: r(100) })
    expect(kinds(s)).not.toContain('odd_tax')
  })

  it('treats a VAT line as drinks', () => {
    const s = bill(
      { serviceCharge: 100, tax: 75, total: 1175, taxLines: [{ id: 't1', label: 'VAT 20%', amount: r(75) }] },
      [['Paneer Tikka', 1000]],
    )
    expect(find(s, 'service_charge')).toMatchObject({ gstUnknown: true })
  })

  it('finds a service charge under another name, with its GST', () => {
    const s = bill({ tax: 52.5, total: 1102.5 }, [
      ['Veg Thali', 1000],
      ['Staff Contribution 5%', 50],
    ])
    expect(checkBill(s).findings).toEqual([
      { kind: 'renamed_charge', key: 'renamed:i1', label: 'Staff Contribution 5%', amount: r(50), gst: r(2.5), itemId: 'i1', feeId: null, saving: r(52.5) },
    ])
    expect(checkBill(s).take).toMatchObject({ itemIds: ['i1'], tax: r(2.5) })
  })

  it.each(['S.C. @ 10%', 'Service Chg', 'Optional Service Charge', 'Staff welfare fund', 'Gratuity', 'Tip', 'Hospitality charge', 'Voluntary contribution'])(
    'reads “%s” as a service charge',
    (name) => {
      expect(kinds(bill({}, [['Thali', 1000], [name, 50]]))).toContain('renamed_charge')
    },
  )

  it.each(['Schezwan Fried Rice', 'Tipsy Pudding', 'Service Station Burger', 'Scallops', 'Staffordshire Pie'])('leaves the dish “%s” alone', (name) => {
    expect(kinds(bill({}, [['Thali', 1000], [name, 50]]))).not.toContain('renamed_charge')
  })

  it('finds a fee that is a service charge by another name, but never a delivery app’s fees', () => {
    const fee: BillFee = { id: 'f1', kind: 'other', label: 'Service fee', amount: r(80) }
    expect(find(bill({ fees: [fee] }, [['Thali', 1000]]), 'renamed_charge')).toMatchObject({ feeId: 'f1', itemId: null })

    const app = bill(
      {
        merchant: 'Swiggy',
        fees: [
          { id: 'f1', kind: 'delivery', label: 'Delivery fee', amount: r(40) },
          { id: 'f2', kind: 'tip', label: 'Delivery partner tip', amount: r(30) },
        ],
        serviceCharge: 50,
      },
      [['Biryani', 400]],
    )
    expect(kinds(app)).toEqual([])
  })

  it('flags a tip printed on the bill', () => {
    expect(find(bill({ tip: 100, tax: 50, total: 1150 }, [['Thali', 1000]]), 'printed_tip')).toEqual({ kind: 'printed_tip', key: 'printed_tip', amount: r(100), saving: r(100) })
  })

  it('leaves typed bills and other currencies out of the service-charge rules', () => {
    expect(kinds(bill({ serviceCharge: 100, tax: 50 }, [['Thali', 1000]], { source: 'manual' }))).toEqual([])
    expect(kinds(bill({ serviceCharge: 10 }, [['Pasta', 100]], { currency: 'EUR' }))).toEqual([])
  })
})

describe('checkBill — taxes', () => {
  it('finds a tax GST replaced in 2017, and takes just that line off', () => {
    const lines: BillTaxLine[] = [
      { id: 't1', label: 'CGST 2.5%', amount: r(25) },
      { id: 't2', label: 'SGST 2.5%', amount: r(25) },
      { id: 't3', label: 'Service Tax @6%', amount: r(60) },
    ]
    const check = checkBill(bill({ tax: 110, total: 1110, taxLines: lines }, [['Thali', 1000]]))
    expect(check.findings).toEqual([{ kind: 'old_tax', key: 'old_tax:t3', label: 'Service Tax @6%', amount: r(60), lineId: 't3', saving: r(60) }])
    expect(check.take).toMatchObject({ tax: r(60), taxLineIds: ['t3'] })
  })

  it('finds GST on a bill of supply, and takes every tax line off', () => {
    const lines: BillTaxLine[] = [
      { id: 't1', label: 'CGST', amount: r(25) },
      { id: 't2', label: 'SGST', amount: r(25) },
    ]
    const check = checkBill(bill({ tax: 50, total: 1050, taxLines: lines, billOfSupply: true }, [['Thali', 1000]]))
    expect(check.findings).toEqual([{ kind: 'supply_gst', key: 'supply_gst', amount: r(50), saving: r(50) }])
    expect(check.take).toMatchObject({ tax: r(50), taxLineIds: ['t1', 't2'] })
  })

  it('says 18% is the hotel rate, with what 5% would be — never a saving', () => {
    expect(find(bill({ tax: 180, total: 1180 }, [['Thali', 1000]]), 'hotel_rate')).toEqual({ kind: 'hotel_rate', key: 'hotel_rate', tax: r(180), atFive: r(50), saving: 0 })
  })

  it('says a rate that fits neither 5% nor 18% looks unusual', () => {
    expect(find(bill({ tax: 120, total: 1120 }, [['Thali', 1000]]), 'odd_tax')).toMatchObject({ rate: 0.12, saving: 0 })
  })

  it('is quiet about a normal 5% bill (rounded either way)', () => {
    expect(kinds(bill({ tax: 50, total: 1050 }, [['Thali', 1000]]))).toEqual([])
    expect(kinds(bill({ tax: 51, total: 1051 }, [['Thali', 1000]]))).toEqual([])
  })

  it('checks CGST and SGST are equal halves', () => {
    const lines: BillTaxLine[] = [
      { id: 't1', label: 'CGST 2.5%', amount: r(25) },
      { id: 't2', label: 'SGST 2.5%', amount: r(30) },
    ]
    expect(find(bill({ tax: 55, total: 1055, taxLines: lines }, [['Thali', 1000]]), 'gst_halves')).toMatchObject({ cgst: r(25), sgst: r(30) })
  })

  it('runs the tax-rate check on restaurant bills only', () => {
    expect(kinds(bill({ tax: 120, total: 1120 }, [['Shirt', 1000]], { category: 'shopping' }))).toEqual([])
  })
})

describe('checkBill — arithmetic', () => {
  it('finds a total above the bill’s own lines (on any currency)', () => {
    expect(find(bill({ tax: 50, total: 1100 }, [['Thali', 1000]]), 'total_over')).toEqual({
      kind: 'total_over',
      key: 'total_over',
      lines: r(1050),
      total: r(1100),
      over: r(50),
      saving: 0,
    })
    expect(kinds(bill({ total: 120 }, [['Pasta', 100]], { currency: 'EUR' }))).toEqual(['total_over'])
  })

  it('lets a rupee of round-off through', () => {
    expect(kinds(bill({ tax: 52.4, total: 1052.5 }, [['Thali', 1000]]))).toEqual([])
  })

  it('points out the same line twice', () => {
    expect(find(bill({}, [['Butter Naan', 60], ['Dal Makhani', 300], ['butter naan', 60]]), 'duplicate')).toEqual({
      kind: 'duplicate',
      key: 'duplicate:butter naan:6000',
      name: 'Butter Naan',
      amount: r(60),
      count: 2,
      itemId: 'i2',
      saving: 0,
    })
  })

  it('puts the money first', () => {
    const s = bill({ serviceCharge: 100, tip: 200, tax: 50, total: 1400 }, [['Thali', 1000]])
    expect(kinds(s)).toEqual(['printed_tip', 'service_charge', 'total_over'])
  })
})

describe('checkBill — kept findings', () => {
  it('leaves out what the table kept, and counts it', () => {
    const check = checkBill(sampleSession('paid', { checkKept: ['service_charge'] }))
    expect(check).toMatchObject({ findings: [], kept: 1, saving: 0 })
  })
})

describe('takeOff and keepFinding', () => {
  it('takes the sample’s service charge and its GST off the total', () => {
    const s = sampleSession('paid')
    const next = reducer(s, { type: 'takeOff', ...checkBill(s).take })
    expect(next.meta).toMatchObject({ serviceCharge: null, tax: 10949 - 576, total: 229900 - 12101 })
    expect(effectivePaid(next)).toBe(217799)
    expect(checkBill(next).findings).toEqual([])
  })

  it('brings a typed amount paid down too, and takes renamed lines, tips and tax lines off', () => {
    const lines: BillTaxLine[] = [{ id: 't3', label: 'Service Tax', amount: r(60) }]
    const s = bill({ tip: 100, tax: 110, total: 1310, taxLines: lines }, [['Thali', 1000], ['Staff contribution', 50]], {
      paid: r(1310),
      assignments: { i0: { me: 1 }, i1: { me: 1 } },
    })
    const take = checkBill(s).take
    expect(take).toMatchObject({ tip: true, tax: r(60), itemIds: ['i1'], taxLineIds: ['t3'] })
    const next = reducer(s, { type: 'takeOff', ...take })
    expect(next.items.map((i) => i.id)).toEqual(['i0'])
    expect(next.assignments).toEqual({ i0: { me: 1 } })
    expect(next.meta).toMatchObject({ tip: null, tax: r(50), total: r(1310 - 100 - 60 - 50) })
    expect(next.meta.taxLines).toBeUndefined()
    expect(next.paid).toBe(r(1100))
  })

  it('never takes off more tax than there is, and ignores nothing to take', () => {
    const s = bill({ serviceCharge: 100, tax: 5, total: 1105 }, [['Thali', 1000]])
    expect(reducer(s, { type: 'takeOff', serviceCharge: true, tip: false, tax: r(50), taxLineIds: [], itemIds: [], feeIds: [] }).meta.tax).toBe(0)
    const none = { type: 'takeOff', serviceCharge: false, tip: false, tax: 0, taxLineIds: [], itemIds: [], feeIds: [] } as const
    expect(reducer(s, none)).toBe(s)
  })

  it('keeps a finding once', () => {
    const s = sampleSession('paid')
    const kept = reducer(s, { type: 'keepFinding', key: 'service_charge' })
    expect(kept.checkKept).toEqual(['service_charge'])
    expect(reducer(kept, { type: 'keepFinding', key: 'service_charge' })).toBe(kept)
    expect(reducer(s, { type: 'keepFinding', key: '' })).toBe(s)
  })

  it('a new bill starts with nothing kept, and keeps its tax lines', () => {
    const s = sampleSession('paid', { checkKept: ['service_charge'] })
    const bill = scanToBill({ ...SAMPLE_SCAN, taxLines: [{ label: 'CGST 2.5%', amount: 54.75 }, { label: 'SGST 2.5%', amount: 54.74 }], billOfSupply: true }, 'INR')
    const next = reducer(s, { type: 'loadBill', source: 'scan', ...bill })
    expect(next.checkKept).toBeUndefined()
    expect(next.meta.billOfSupply).toBe(true)
    expect(next.meta.taxLines?.map((l) => [l.label, l.amount])).toEqual([
      ['CGST 2.5%', 5475],
      ['SGST 2.5%', 5474],
    ])
  })

  it('rescales tax lines with the currency', () => {
    const s = bill({ tax: 50, taxLines: [{ id: 't1', label: 'VAT', amount: r(50) }] }, [['Pasta', 1000]])
    expect(reducer(s, { type: 'setCurrency', currency: 'JPY' }).meta.taxLines).toEqual([{ id: 't1', label: 'VAT', amount: 50 }])
  })
})

describe('saving and loading', () => {
  it('keeps tax lines, a bill of supply and kept findings across a reload — and drops junk', () => {
    const s = bill({ tax: 50, taxLines: [{ id: 't1', label: 'CGST', amount: r(25) }], billOfSupply: true }, [['Thali', 1000]], { checkKept: ['total_over'] })
    const loaded = parseSession(JSON.parse(JSON.stringify(s)))
    expect(loaded?.meta.taxLines).toEqual([{ id: 't1', label: 'CGST', amount: r(25) }])
    expect(loaded?.meta.billOfSupply).toBe(true)
    expect(loaded?.checkKept).toEqual(['total_over'])

    const junk = JSON.parse(JSON.stringify(s))
    junk.meta.taxLines = [{ id: 't1', label: '', amount: 5 }, 'x', { id: 't2', label: 'SGST', amount: -1 }]
    junk.meta.billOfSupply = 'yes'
    junk.checkKept = [1, 'a', 'a']
    const repaired = parseSession(junk)
    expect(repaired?.meta.taxLines).toBeUndefined()
    expect(repaired?.meta.billOfSupply).toBeUndefined()
    expect(repaired?.checkKept).toEqual(['a'])
  })
})
