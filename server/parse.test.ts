import { describe, expect, it } from 'vitest'
import {
  classifyLine,
  cleanText,
  extractJson,
  isAcceptableReply,
  isUsable,
  normalize,
  normalizeCurrency,
  normalizeDate,
  ParseError,
  parseExtraction,
  parseNumber,
  repairJson,
  roundMoney,
  tidyName,
  WARNINGS,
} from './parse'

const scan = (raw: unknown, model = 'test-model') => normalize(parseExtraction(raw), model)

const SAFFRON = {
  isBill: true,
  merchant: 'SAFFRON TABLE',
  category: 'food',
  date: '2026-10-18',
  currency: 'INR',
  items: [
    { name: 'PANEER TIKKA', quantity: 1, amount: 345 },
    { name: 'BUTTER CHICKEN', quantity: 1, amount: 495 },
    { name: 'DAL MAKHANI', quantity: 1, amount: 325 },
    { name: 'GARLIC NAAN', quantity: 4, amount: 300 },
    { name: 'JEERA RICE', quantity: 1, amount: 245 },
    { name: 'FRESH LIME SODA', quantity: 2, amount: 240 },
    { name: 'MANGO LASSI', quantity: 1, amount: 165 },
    { name: 'GULAB JAMUN', quantity: 2, amount: 190 },
  ],
  subtotal: 2305,
  tax: 109.49,
  serviceCharge: 115.25,
  discount: 230.5,
  tip: null,
  total: 2299,
}

describe('extractJson', () => {
  it('parses a plain JSON reply', () => {
    expect(extractJson(JSON.stringify(SAFFRON))).toEqual(SAFFRON)
  })

  it('strips ```json fences and prose around them', () => {
    const reply = `Sure! Here is the bill:\n\n\`\`\`json\n${JSON.stringify(SAFFRON, null, 2)}\n\`\`\`\n\nLet me know if you need anything else.`
    expect(extractJson(reply)).toEqual(SAFFRON)
  })

  it('handles unlabelled fences', () => {
    expect(extractJson('```\n{"items": [], "total": 5}\n```')).toEqual({ items: [], total: 5 })
  })

  it('removes <think> blocks, even ones containing braces', () => {
    const reply = '<think>The total is {maybe} 2299. {"items": "draft"}</think>\n{"items": [{"name": "Tea", "amount": 20}], "total": 20}'
    expect(extractJson(reply)).toEqual({ items: [{ name: 'Tea', amount: 20 }], total: 20 })
  })

  it('keeps only what follows a dangling </think> (opening tag in the template)', () => {
    const reply = 'reasoning about {"items": []} ... </think>{"items": [{"name": "Coffee", "amount": 3}], "total": 3}'
    expect(extractJson(reply)).toEqual({ items: [{ name: 'Coffee', amount: 3 }], total: 3 })
  })

  it('is string-aware when matching braces', () => {
    const reply = 'Result: {"merchant": "Cafe {Brace} \\"Quoted\\"", "items": [], "total": 1} trailing } text'
    expect(extractJson(reply)).toEqual({ merchant: 'Cafe {Brace} "Quoted"', items: [], total: 1 })
  })

  it('tolerates trailing commas, comments and Python literals', () => {
    const reply = `{
      "isBill": True, // definitely a bill
      "merchant": None,
      "items": [{"name": "Tea", "quantity": 1, "amount": 20,},],
      /* totals */ "total": 20,
    }`
    expect(extractJson(reply)).toEqual({ isBill: true, merchant: null, items: [{ name: 'Tea', quantity: 1, amount: 20 }], total: 20 })
  })

  it('tolerates smart quotes', () => {
    const reply = '{“items”: [{“name”: “Tea”, “amount”: 20}], “total”: 20}'
    expect(extractJson(reply)).toEqual({ items: [{ name: 'Tea', amount: 20 }], total: 20 })
  })

  it('tolerates single-quoted (Python dict) output and unquoted keys', () => {
    expect(extractJson(`{'items': [{'name': "Chef's Special", 'amount': 12.5}], 'total': 12.5}`)).toEqual({
      items: [{ name: "Chef's Special", amount: 12.5 }],
      total: 12.5,
    })
    expect(extractJson('{items: [{name: "Tea", amount: 20}], total: 20}')).toEqual({ items: [{ name: 'Tea', amount: 20 }], total: 20 })
  })

  it('skips an echoed JSON schema and finds the answer after it', () => {
    const reply = `Schema: {"type": "object", "properties": {"items": {"type": "array"}}}\nAnswer: {"items": [], "total": 9}`
    expect(extractJson(reply)).toEqual({ items: [], total: 9 })
  })

  it('does not mistake a lone line item for the bill', () => {
    // The outer object is cut off; the only complete objects are line items.
    const reply = '{"merchant": "X", "items": [{"name": "Tea", "quantity": 1, "total": 20}, {"name": "Bun", "total": 10}'
    expect(() => extractJson(reply)).toThrow(ParseError)
  })

  it('accepts a bill wrapped in another object', () => {
    expect(extractJson('{"bill": {"items": [], "total": 4}}')).toEqual({ bill: { items: [], total: 4 } })
  })

  it('strips a BOM', () => {
    expect(extractJson('﻿{"items": [], "total": 1}')).toEqual({ items: [], total: 1 })
  })

  it('throws ParseError when there is no JSON', () => {
    expect(() => extractJson('I cannot read this image, sorry.')).toThrow(ParseError)
    expect(() => extractJson('')).toThrow(ParseError)
    expect(() => extractJson('{not json at all')).toThrow(ParseError)
    expect(() => extractJson('{"foo": 1}')).toThrow(ParseError)
  })

  it('gives up quickly on pathological input', () => {
    const started = performance.now()
    expect(() => extractJson('{'.repeat(50_000))).toThrow(ParseError)
    expect(performance.now() - started).toBeLessThan(2000)
  })
})

describe('extractJson with another shape of answer', () => {
  const isSplit = (value: Record<string, unknown>) => 'people' in value

  it('finds the object the caller is looking for, skipping echoed schemas and other objects', () => {
    const reply = `Schema: {"type":"object","properties":{"people":{}}} Example: {"total": 5} Answer: {"people": [], "amount": 840}`
    expect(extractJson(reply, isSplit)).toEqual({ people: [], amount: 840 })
  })

  it('throws ParseError when no object matches', () => {
    expect(() => extractJson('{"amount": 840}', isSplit)).toThrow(ParseError)
  })
})

describe('repairJson', () => {
  it('leaves string contents alone', () => {
    expect(repairJson('{"a": "x, // not a comment,]", "b": [1,],}')).toBe('{"a": "x, // not a comment,]", "b": [1]}')
  })

  it('escapes double quotes inside single-quoted strings', () => {
    expect(JSON.parse(repairJson(`{'a': 'say "hi"'}`))).toEqual({ a: 'say "hi"' })
  })
})

describe('parseNumber', () => {
  it.each([
    [42, 42],
    [12.5, 12.5],
    ['1,234.50', 1234.5],
    ['₹ 420', 420],
    ['Rs.99', 99],
    ['Rs. 1,299.00', 1299],
    ['(50.00)', -50],
    ['-50', -50],
    ['50-', -50],
    ['−12.30', -12.3],
    ['₹-50', -50],
    ['1,23,456.78', 123456.78],
    ['12,34,567', 1234567],
    ['1.234,50', 1234.5],
    ['1.234.567', 1234567],
    ['12,5', 12.5],
    ['12,50 €', 12.5],
    ['1,234', 1234],
    ['0,500', 0.5],
    ['$.50', 0.5],
    ['.5', 0.5],
    ['12 500', 12500],
    ['12 500,00', 12500],
    ["1'234.50", 1234.5],
    ['USD 7.25', 7.25],
    ['  19.99  ', 19.99],
  ])('%j → %j', (input, expected) => {
    expect(parseNumber(input)).toBe(expected)
  })

  it.each([[null], [undefined], [''], ['N/A'], ['abc'], [Number.NaN], [Number.POSITIVE_INFINITY], [{}], [[1]], [true], ['1.2.3,4,5']])(
    '%j → null',
    (input) => {
      expect(parseNumber(input)).toBeNull()
    },
  )
})

describe('roundMoney', () => {
  it('rounds half away from zero without float artefacts', () => {
    expect(roundMoney(1.005)).toBe(1.01)
    expect(roundMoney(0.1 + 0.2)).toBe(0.3)
    expect(roundMoney(-2.675)).toBe(-2.68)
    expect(Object.is(roundMoney(-0.001), 0)).toBe(true)
  })
})

describe('cleanText', () => {
  it('collapses whitespace and control characters', () => {
    expect(cleanText('  Butter\n\tChicken \u0007 ')).toBe('Butter Chicken')
  })

  it('treats placeholders as missing', () => {
    for (const value of ['', '   ', 'null', 'N/A', 'n/a', 'none', 'Unknown', '-', '??', 'not printed']) expect(cleanText(value)).toBeNull()
    expect(cleanText(42)).toBe('42')
    expect(cleanText({})).toBeNull()
  })
})

describe('tidyName', () => {
  it('title-cases shouting and keeps modifiers', () => {
    expect(tidyName('BUTTER CHICKEN (HALF)')).toBe('Butter Chicken (Half)')
    expect(tidyName('CHICKEN TIKKA WITH NAAN')).toBe('Chicken Tikka with Naan')
    expect(tidyName('BBQ WINGS 6PC')).toBe('BBQ Wings 6pc')
    expect(tidyName('VEG BIRYANI')).toBe('Veg Biryani')
  })

  it('keeps mixed-case names as printed', () => {
    expect(tidyName('iPhone Case')).toBe('iPhone Case')
    expect(tidyName('Crème brûlée')).toBe('Crème brûlée')
  })

  it('drops bullets, serial numbers and trailing junk', () => {
    expect(tidyName('1. Masala Dosa')).toBe('Masala Dosa')
    expect(tidyName('• Filter Coffee -')).toBe('Filter Coffee')
    expect(tidyName('  --  ')).toBeNull()
  })

  it('caps names at 80 characters without splitting emoji', () => {
    const long = `${'🍕'.repeat(10)}${'x'.repeat(100)}`
    const result = tidyName(long)
    expect(Array.from(result ?? '').length).toBe(80)
    expect(result?.startsWith('🍕'.repeat(10))).toBe(true)
  })
})

describe('classifyLine', () => {
  it.each([
    ['Grand Total', 'total'],
    ['TOTAL', 'total'],
    ['Net Amount', 'total'],
    ['Amount Payable', 'total'],
    ['Sub Total', 'subtotal'],
    ['Subtotal', 'subtotal'],
    ['Food Total', 'subtotal'],
    ['Item Total', 'subtotal'],
    ['CGST @ 2.5%', 'tax'],
    ['SGST 2.5%', 'tax'],
    ['IGST', 'tax'],
    ['GST (5%)', 'tax'],
    ['VAT', 'tax'],
    ['VAT 20%', 'tax'],
    ['Sales Tax', 'tax'],
    ['Service Tax', 'tax'],
    ['Tax', 'tax'],
    ['Taxes & Fees', 'tax'],
    ['Krishi Kalyan Cess', 'tax'],
    ['Service Charge', 'serviceCharge'],
    ['Service Charge @ 10%', 'serviceCharge'],
    ['Packing Charges', 'serviceCharge'],
    ['Delivery Fee', 'serviceCharge'],
    ['Platform Fee', 'serviceCharge'],
    ['Card Surcharge', 'serviceCharge'],
    ['Discount', 'discount'],
    ['Happy Hour Discount', 'discount'],
    ['Disc 10%', 'discount'],
    ['Coupon SAVE50', 'discount'],
    ['Less: Loyalty', 'discount'],
    ['10% off', 'discount'],
    ['Tip', 'tip'],
    ['Tip (18%)', 'tip'],
    ['Gratuity', 'tip'],
    ['Round Off', 'ignore'],
    ['Rounding', 'ignore'],
    ['Cash', 'ignore'],
    ['Change', 'ignore'],
    ['Total Qty', 'ignore'],
    ['UPI', 'ignore'],
  ])('%s → %s', (name, kind) => {
    expect(classifyLine(name)).toBe(kind)
  })

  it.each([
    'VAT 69 Whisky',
    'Vat 69',
    'Butter Chicken',
    'Cashew Curry',
    'Cardamom Tea',
    'Round Bread',
    'Tip Top Burger',
    'Tipsy Pudding',
    'Disco Fries',
    'Less Spicy Curry',
    'Gstaad Fondue',
    'Total Recall Burger',
    'Service Station Sandwich',
    'Container Garden Salad',
  ])('%s is a genuine item', (name) => {
    expect(classifyLine(name)).toBeNull()
  })
})

describe('normalizeCurrency', () => {
  it.each([
    ['INR', 'INR'],
    ['inr', 'INR'],
    ['₹', 'INR'],
    ['Rs', 'INR'],
    ['Rs.', 'INR'],
    ['INR (₹)', 'INR'],
    ['$', 'USD'],
    ['US$', 'USD'],
    ['€', 'EUR'],
    ['£', 'GBP'],
    ['¥', 'JPY'],
    ['AED', 'AED'],
    ['د.إ', 'AED'],
    ['S$', 'SGD'],
    ['A$', 'AUD'],
    ['C$', 'CAD'],
    ['HK$', 'HKD'],
    ['฿', 'THB'],
    ['RM', 'MYR'],
    ['Rp', 'IDR'],
    ['RMB', 'CNY'],
    ['Euro', 'EUR'],
    ['Price in S$', 'SGD'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeCurrency(input)).toBe(expected)
  })

  it.each([[null], ['XYZ'], ['money'], ['']])('%j → null', (input) => {
    expect(normalizeCurrency(input)).toBeNull()
  })
})

describe('normalizeDate', () => {
  it.each([
    ['2026-10-18', '2026-10-18'],
    ['2026/10/18 19:45', '2026-10-18'],
    ['2026-1-5', '2026-01-05'],
    ['18/10/2026', '2026-10-18'],
    ['10/18/2026', '2026-10-18'],
    ['18.10.26', '2026-10-18'],
    ['05/05/2026', '2026-05-05'],
    ['18-Oct-2026', '2026-10-18'],
    ['18 October 2026 7:45 PM', '2026-10-18'],
    ['18th Oct 26', '2026-10-18'],
    ['Oct 18, 2026', '2026-10-18'],
    ['September 3 2026', '2026-09-03'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeDate(input)).toBe(expected)
  })

  it('keeps ambiguous or invalid dates as printed', () => {
    expect(normalizeDate('03/04/2026')).toBe('03/04/2026')
    expect(normalizeDate('2026-02-30')).toBe('2026-02-30')
    expect(normalizeDate('Tuesday evening')).toBe('Tuesday evening')
    expect(normalizeDate(null)).toBeNull()
  })
})

describe('parseExtraction', () => {
  it('reads the schema shape', () => {
    const extraction = parseExtraction(SAFFRON)
    expect(extraction.isBill).toBe(true)
    expect(extraction.items).toHaveLength(8)
    expect(extraction.total).toBe(2299)
  })

  it('fills in missing keys', () => {
    expect(parseExtraction({ items: [{ name: 'Tea' }] })).toEqual({
      isBill: true,
      merchant: null,
      category: null,
      date: null,
      currency: null,
      items: [{ name: 'Tea', quantity: 1, amount: null }],
      subtotal: null,
      tax: null,
      serviceCharge: null,
      discount: null,
      tip: null,
      total: null,
    })
  })

  it('never throws on garbage', () => {
    for (const raw of [null, undefined, 42, 'text', [], [1, 2], { items: 'nope' }, { items: [null, 1, 'x'] }]) {
      expect(() => parseExtraction(raw)).not.toThrow()
    }
    expect(parseExtraction('text').items).toEqual([])
  })

  it('coerces strings, aliases and odd booleans', () => {
    const extraction = parseExtraction({
      is_bill: 'yes',
      restaurant_name: 'Cafe',
      line_items: [{ item: 'Latte', qty: '2', line_total: '₹ 1,240.00' }],
      grand_total: 'Rs. 1,302',
      taxes: '62',
    })
    expect(extraction).toMatchObject({
      isBill: true,
      merchant: 'Cafe',
      items: [{ name: 'Latte', quantity: 2, amount: 1240 }],
      total: 1302,
      tax: 62,
    })
    expect(parseExtraction({ isBill: 'false', items: [] }).isBill).toBe(false)
    expect(parseExtraction({ isBill: 0 }).isBill).toBe(false)
  })

  it('prefers a line total over a bare price and multiplies a unit price when that is all there is', () => {
    expect(parseExtraction({ items: [{ name: 'Naan', qty: 4, price: 75, total: 300 }] }).items[0]?.amount).toBe(300)
    expect(parseExtraction({ items: [{ name: 'Naan', qty: 4, rate: 75 }] }).items[0]?.amount).toBe(300)
  })

  it('fixes bad quantities', () => {
    const items = parseExtraction({ items: [{ name: 'A', quantity: 0 }, { name: 'B', quantity: -2 }, { name: 'C', quantity: 'abc' }, { name: 'D', quantity: 0.5 }] }).items
    expect(items.map((item) => item.quantity)).toEqual([1, 1, 1, 0.5])
  })

  it('unwraps {"bill": {...}} and [bill]', () => {
    expect(parseExtraction({ bill: SAFFRON }).total).toBe(2299)
    expect(parseExtraction([SAFFRON]).total).toBe(2299)
  })
})

describe('normalize', () => {
  it('turns the sample bill into a clean ScanResponse', () => {
    expect(scan(SAFFRON, 'nvidia/x')).toEqual({
      merchant: 'Saffron Table',
      date: '2026-10-18',
      currency: 'INR',
      category: 'food',
      items: [
        { name: 'Paneer Tikka', quantity: 1, amount: 345 },
        { name: 'Butter Chicken', quantity: 1, amount: 495 },
        { name: 'Dal Makhani', quantity: 1, amount: 325 },
        { name: 'Garlic Naan', quantity: 4, amount: 300 },
        { name: 'Jeera Rice', quantity: 1, amount: 245 },
        { name: 'Fresh Lime Soda', quantity: 2, amount: 240 },
        { name: 'Mango Lassi', quantity: 1, amount: 165 },
        { name: 'Gulab Jamun', quantity: 2, amount: 190 },
      ],
      subtotal: 2305,
      tax: 109.49,
      serviceCharge: 115.25,
      discount: 230.5,
      tip: null,
      total: 2299,
      warnings: [],
      model: 'nvidia/x',
    })
  })

  it('moves negative item lines into the discount (positive)', () => {
    const result = scan({
      items: [
        { name: 'Pizza', amount: 500 },
        { name: 'Coke', amount: 100 },
        { name: 'Promo FRIDAY', amount: -60 },
      ],
      total: 540,
    })
    expect(result.items.map((item) => item.name)).toEqual(['Pizza', 'Coke'])
    expect(result.discount).toBe(60)
  })

  it('folds tax, charge and tip lines listed as items into their fields', () => {
    const result = scan({
      items: [
        { name: 'Burger', amount: 10 },
        { name: 'Fries', amount: 4 },
        { name: 'CGST 2.5%', amount: 0.35 },
        { name: 'SGST 2.5%', amount: 0.35 },
        { name: 'Service Charge', amount: 1.4 },
        { name: 'Round Off', amount: -0.1 },
        { name: 'Tip', amount: 2 },
        { name: 'Grand Total', amount: 18 },
        { name: 'Sub Total', amount: 14 },
      ],
    })
    expect(result.items).toEqual([
      { name: 'Burger', quantity: 1, amount: 10 },
      { name: 'Fries', quantity: 1, amount: 4 },
    ])
    expect(result).toMatchObject({ subtotal: 14, tax: 0.7, serviceCharge: 1.4, tip: 2, total: 18, warnings: [] })
  })

  it('does not double-count a tax line the model already put in the tax field', () => {
    const result = scan({
      items: [
        { name: 'Thali', amount: 400 },
        { name: 'CGST', amount: 10 },
        { name: 'SGST', amount: 10 },
      ],
      tax: 20,
      total: 420,
    })
    expect(result.tax).toBe(20)
    expect(result.items).toHaveLength(1)
  })

  it('does not add an included-VAT line as tax when the items already make the total', () => {
    const result = scan({
      currency: 'EUR',
      items: [
        { name: 'Schnitzel', amount: 12.5 },
        { name: 'Radler', amount: 7.5 },
        { name: 'MwSt 19%', amount: 3.19 },
      ],
      total: 20,
    })
    expect(result.items.map((item) => item.name)).toEqual(['Schnitzel', 'Radler'])
    expect(result).toMatchObject({ tax: null, discount: null, total: 20 })
  })

  it('folds tax and discount lines together when only both make the total', () => {
    const result = scan({
      items: [
        { name: 'Thali', amount: 1000 },
        { name: 'CGST 2.5%', amount: 25 },
        { name: 'SGST 2.5%', amount: 25 },
        { name: 'Discount', amount: -100 },
      ],
      total: 950,
    })
    expect(result.items).toHaveLength(1)
    expect(result).toMatchObject({ tax: 50, discount: 100, total: 950 })
  })

  it('folds lines that cancel out rather than dropping them', () => {
    const result = scan({
      items: [
        { name: 'Thali', amount: 1000 },
        { name: 'GST 5%', amount: 50 },
        { name: 'Discount', amount: -50 },
      ],
      total: 1000,
    })
    expect(result).toMatchObject({ tax: 50, discount: 50, total: 1000 })
  })

  it('keeps VAT 69 as a drink, not a tax', () => {
    const result = scan({ items: [{ name: 'VAT 69 (60ml)', quantity: 2, amount: 560 }], total: 560 })
    expect(result.items).toEqual([{ name: 'VAT 69 (60ml)', quantity: 2, amount: 560 }])
    expect(result.tax).toBeNull()
  })

  it('fixes unit prices copied into the amount when the subtotal proves it', () => {
    const result = scan({
      items: [
        { name: 'Garlic Naan', quantity: 4, amount: 75 },
        { name: 'Lime Soda', quantity: 2, amount: 120 },
        { name: 'Dal', quantity: 1, amount: 325 },
      ],
      subtotal: 865,
      total: 908.25,
    })
    expect(result.items.map((item) => item.amount)).toEqual([300, 240, 325])
    expect(result.warnings).toEqual([])
  })

  it('fixes line totals multiplied by the quantity again, using the total when there is no subtotal', () => {
    const result = scan({
      items: [
        { name: 'Beer', quantity: 3, amount: 54 },
        { name: 'Nachos', quantity: 1, amount: 9 },
      ],
      tax: 2.25,
      total: 29.25,
    })
    expect(result.items.map((item) => item.amount)).toEqual([18, 9])
  })

  it('leaves amounts alone when no rescaling explains the gap', () => {
    const result = scan({
      items: [
        { name: 'A', quantity: 2, amount: 100 },
        { name: 'B', quantity: 1, amount: 50 },
      ],
      subtotal: 400,
      total: 420,
    })
    expect(result.items.map((item) => item.amount)).toEqual([100, 50])
    expect(result.warnings).toEqual([WARNINGS.itemsMismatch])
  })

  it('warns when the items do not match the subtotal and when the total is missing', () => {
    const result = scan({ items: [{ name: 'A', amount: 100 }], subtotal: 150 })
    expect(result.warnings).toEqual([WARNINGS.itemsMismatch, WARNINGS.noTotal])
  })

  it('tolerates a small mismatch (rounding)', () => {
    expect(scan({ items: [{ name: 'A', amount: 99.5 }], subtotal: 100, total: 105 }).warnings).toEqual([])
    expect(scan({ items: [{ name: 'A', amount: 9_950 }], subtotal: 10_000, total: 10_500 }).warnings).toEqual([])
  })

  it('rounds money to 2 decimals and normalises currency and date', () => {
    const result = scan({
      currency: '₹',
      date: '18/10/2026',
      items: [{ name: 'Tea', quantity: '1', amount: '20.004' }],
      total: '21.006',
      discount: -5,
    })
    expect(result).toMatchObject({ currency: 'INR', date: '2026-10-18', total: 21.01, discount: 5 })
    expect(result.items[0]?.amount).toBe(20)
  })

  it('drops nameless items, keeps free ones, and keeps repeated lines', () => {
    const result = scan({
      items: [
        { name: '', amount: 5 },
        { name: null, amount: 5 },
        { name: 'Water (Complimentary)', amount: 0 },
        { name: 'Beer', amount: 6 },
        { name: 'Beer', amount: 6 },
      ],
      total: 12,
    })
    expect(result.items.map((item) => item.name)).toEqual(['Water (Complimentary)', 'Beer', 'Beer'])
  })

  it('ignores negative totals and charges rather than inventing numbers', () => {
    const result = scan({ items: [{ name: 'A', amount: 10 }], total: -10, subtotal: -10, tax: -1, tip: -2, serviceCharge: -3 })
    expect(result).toMatchObject({ total: null, subtotal: null, tax: null, tip: null, serviceCharge: null })
  })

  it('caps the item list at 200 lines', () => {
    const items = Array.from({ length: 450 }, (_, index) => ({ name: `Item ${index}`, amount: 1 }))
    expect(scan({ items }).items).toHaveLength(200)
  })
})

describe('isUsable / isAcceptableReply', () => {
  it('needs priced items, items with a total, or just a total', () => {
    expect(isUsable(scan({ items: [] }))).toBe(false)
    expect(isUsable(scan({ items: [{ name: 'A' }] }))).toBe(false)
    expect(isUsable(scan({ items: [{ name: 'A' }], total: 10 }))).toBe(true)
    expect(isUsable(scan({ items: [{ name: 'A', amount: 3 }] }))).toBe(true)
    expect(isUsable(scan({ items: [], total: 1230 }))).toBe(true)
    expect(isUsable(scan({ items: [], total: 0 }))).toBe(false)
  })

  it('accepts usable bills and confident "not a bill" answers', () => {
    expect(isAcceptableReply(SAFFRON)).toBe(true)
    expect(isAcceptableReply({ isBill: false, items: [] })).toBe(true)
    expect(isAcceptableReply({ isBill: true, items: [] })).toBe(false)
    expect(isAcceptableReply('garbage')).toBe(false)
  })

  it('accepts a total alone for service bills, but asks another model for the items of a restaurant bill', () => {
    const totalOnly = (category: string | null, merchant: string | null = null) => ({ isBill: true, merchant, category, items: [], total: 1230 })
    for (const category of ['utilities', 'transport', 'travel', 'rent', 'subscription', 'health', 'entertainment', 'gift', 'other']) {
      expect(isAcceptableReply(totalOnly(category))).toBe(true)
    }
    for (const category of ['food', 'groceries', 'shopping', null]) expect(isAcceptableReply(totalOnly(category))).toBe(false)
    // No category from the model, but the merchant says what it is.
    expect(isAcceptableReply(totalOnly(null, 'BESCOM'))).toBe(true)
    expect(isAcceptableReply(totalOnly(null, 'Swiggy'))).toBe(false)
    // Still usable (and shown) when no model does better.
    expect(isUsable(scan(totalOnly('food')))).toBe(true)
  })
})

describe('categories', () => {
  it('keeps a category id, in any case', () => {
    expect(scan({ ...SAFFRON, category: 'transport' }).category).toBe('transport')
    expect(scan({ ...SAFFRON, category: ' Utilities ' }).category).toBe('utilities')
  })

  it('maps a free-text label onto a category, under any of its usual keys', () => {
    expect(scan({ ...SAFFRON, category: 'Dining' }).category).toBe('food')
    expect(scan({ ...SAFFRON, category: 'Electricity bill' }).category).toBe('utilities')
    const { category: _omit, ...rest } = SAFFRON
    expect(scan({ ...rest, bill_type: 'Taxi' }).category).toBe('transport')
    expect(scan({ ...rest, type: 'Hotel stay' }).category).toBe('travel')
  })

  it('falls back on the merchant, then the items, then null', () => {
    const { category: _omit, ...rest } = SAFFRON
    expect(scan({ ...rest, merchant: 'UBER INDIA' }).category).toBe('transport')
    expect(scan({ ...rest, merchant: 'Tata Power-DDL' }).category).toBe('utilities')
    expect(scan({ ...rest, merchant: 'Toit', items: [{ name: 'Craft Beer', amount: 400 }] }).category).toBe('food')
    expect(scan({ ...rest, category: 'misc', merchant: 'Shop 42', items: [{ name: 'Thing', amount: 400 }] }).category).toBeNull()
  })
})

describe('total-only bills', () => {
  it('keeps the totals with an empty item list and no mismatch warning', () => {
    const result = scan({
      isBill: true,
      merchant: 'BESCOM',
      category: 'utilities',
      date: '05/10/2026',
      currency: 'INR',
      items: [],
      subtotal: 1180,
      tax: 50,
      serviceCharge: null,
      discount: null,
      tip: null,
      total: 1230,
    })
    expect(result).toMatchObject({ merchant: 'BESCOM', category: 'utilities', items: [], subtotal: 1180, tax: 50, total: 1230, warnings: [] })
    expect(isUsable(result)).toBe(true)
  })

  it('still warns when there is no total at all', () => {
    expect(scan({ isBill: true, category: 'transport', items: [], total: null }).warnings).toEqual([WARNINGS.noTotal])
  })
})
