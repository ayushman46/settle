import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildUpiUri, computeShares, isUpiShaped, normalizeIndianPhone, rupeesText, simplifyDebts } from './cloud'

const sum = (xs: ReadonlyArray<{ sharePaise: number }>) => xs.reduce((s, x) => s + x.sharePaise, 0)

describe('normalizeIndianPhone', () => {
  it('accepts the usual ways a number is typed', () => {
    for (const typed of ['9876543210', '+91 98765 43210', '+919876543210', '919876543210', '098765-43210', '(+91) 98765.43210']) {
      expect(normalizeIndianPhone(typed)).toBe('+919876543210')
    }
  })
  it('rejects what is not an Indian mobile', () => {
    for (const typed of ['5876543210', '987654321', '98765432101', '+1 9876543210', 'abc', '']) {
      expect(normalizeIndianPhone(typed)).toBeNull()
    }
  })
})

describe('isUpiShaped', () => {
  it('takes name@bank in any case, with stray spaces', () => {
    expect(isUpiShaped('Ayush@OkSBI ')).toBe(true)
    expect(isUpiShaped('9876543210@ybl')).toBe(true)
  })
  it('rejects anything else', () => {
    for (const bad of ['ayush', '@oksbi', 'a@1bank', 'ayush@', 'a@b']) expect(isUpiShaped(bad)).toBe(false)
  })
})

describe('computeShares', () => {
  it('splits ₹1,500 three ways as ₹500 each (the spec example)', () => {
    const r = computeShares(150_000, 'equal', [{ userId: 'a', value: 0 }, { userId: 'r', value: 0 }, { userId: 'j', value: 0 }])
    expect(r).toEqual({ ok: true, shares: [{ userId: 'a', sharePaise: 50_000 }, { userId: 'j', sharePaise: 50_000 }, { userId: 'r', sharePaise: 50_000 }] })
  })

  it('hands leftover paise out one each, in a fixed order, and always adds up', () => {
    const r = computeShares(100, 'equal', [{ userId: 'c', value: 0 }, { userId: 'a', value: 0 }, { userId: 'b', value: 0 }])
    expect(r.ok && r.shares).toEqual([{ userId: 'a', sharePaise: 34 }, { userId: 'b', sharePaise: 33 }, { userId: 'c', sharePaise: 33 }])
    for (let amount = 1; amount < 400; amount += 7) {
      for (let n = 1; n <= 7; n += 1) {
        const people = Array.from({ length: n }, (_, i) => ({ userId: `u${i}`, value: 0 }))
        const res = computeShares(amount, 'equal', people)
        expect(res.ok && sum(res.shares)).toBe(amount)
      }
    }
  })

  it('takes exact amounts only when they add up to the bill', () => {
    expect(computeShares(1000, 'exact', [{ userId: 'a', value: 700 }, { userId: 'b', value: 300 }]).ok).toBe(true)
    expect(computeShares(1000, 'exact', [{ userId: 'a', value: 700 }, { userId: 'b', value: 299 }])).toEqual({ ok: false, error: 'exact_sum' })
  })

  it('splits by percent to the paisa, largest remainders first', () => {
    const r = computeShares(1001, 'percent', [{ userId: 'a', value: 3333 }, { userId: 'b', value: 3333 }, { userId: 'c', value: 3334 }])
    expect(r.ok).toBe(true)
    if (r.ok) expect(sum(r.shares)).toBe(1001)
    expect(computeShares(1000, 'percent', [{ userId: 'a', value: 5000 }, { userId: 'b', value: 4000 }])).toEqual({ ok: false, error: 'percent_sum' })
  })

  it('refuses bad input', () => {
    expect(computeShares(0, 'equal', [{ userId: 'a', value: 0 }])).toEqual({ ok: false, error: 'bad_amount' })
    expect(computeShares(10.5, 'equal', [{ userId: 'a', value: 0 }])).toEqual({ ok: false, error: 'bad_amount' })
    expect(computeShares(100, 'equal', [])).toEqual({ ok: false, error: 'no_people' })
    expect(computeShares(100, 'equal', [{ userId: 'a', value: 0 }, { userId: 'a', value: 0 }])).toEqual({ ok: false, error: 'duplicate_person' })
    expect(computeShares(100, 'exact', [{ userId: 'a', value: -1 }, { userId: 'b', value: 101 }])).toEqual({ ok: false, error: 'bad_value' })
  })
})

describe('simplifyDebts', () => {
  it('turns the dinner into two payments to Ayush', () => {
    expect(simplifyDebts([{ userId: 'ayush', net: 100_000 }, { userId: 'rahul', net: -50_000 }, { userId: 'rajeev', net: -50_000 }])).toEqual([
      { from: 'rahul', to: 'ayush', amountPaise: 50_000 },
      { from: 'rajeev', to: 'ayush', amountPaise: 50_000 },
    ])
  })

  it('settles every balance to zero with no more than n-1 payments', () => {
    const nets = [
      { userId: 'a', net: 7000 },
      { userId: 'b', net: -2500 },
      { userId: 'c', net: -4000 },
      { userId: 'd', net: 1500 },
      { userId: 'e', net: -2000 },
    ]
    const transfers = simplifyDebts(nets)
    expect(transfers.length).toBeLessThanOrEqual(nets.length - 1)
    const after = new Map(nets.map((n) => [n.userId, n.net]))
    for (const t of transfers) {
      after.set(t.from, (after.get(t.from) ?? 0) + t.amountPaise)
      after.set(t.to, (after.get(t.to) ?? 0) - t.amountPaise)
    }
    expect([...after.values()].every((v) => v === 0)).toBe(true)
  })

  it('has nothing to do when everyone is square', () => {
    expect(simplifyDebts([{ userId: 'a', net: 0 }, { userId: 'b', net: 0 }])).toEqual([])
  })
})

describe('buildUpiUri', () => {
  it('builds the spec example, safely encoded', () => {
    expect(rupeesText(50_000)).toBe('500.00')
    expect(rupeesText(5)).toBe('0.05')
    expect(buildUpiUri({ upiId: 'Ayush@OkSBI', payeeName: 'Ayush', amountPaise: 50_000, note: 'Dinner settlement' })).toBe(
      'upi://pay?pa=ayush%40oksbi&pn=Ayush&am=500.00&cu=INR&tn=Dinner%20settlement',
    )
  })
  it('drops characters UPI apps reject and keeps a short plain reference', () => {
    const uri = buildUpiUri({ upiId: 'a@ok', payeeName: 'Riya 🎉 & co', amountPaise: 1, note: 'pizza&pa=evil@x', reference: 'st-1234_abcd' })
    expect(uri).toContain('pn=Riya%20%26%20co')
    expect(uri).toContain('tn=pizza%26pa%20evil%20x')
    expect(uri).toContain('tr=st1234abcd')
    expect(uri.match(/[?&]pa=/g)).toHaveLength(1)
  })
})

describe('the Edge Function runs this exact file', () => {
  it('supabase/functions/settle-api/cloud.ts is an unchanged copy of shared/cloud.ts', () => {
    const source = readFileSync(new URL('./cloud.ts', import.meta.url), 'utf8')
    const copy = readFileSync(new URL('../supabase/functions/settle-api/cloud.ts', import.meta.url), 'utf8')
    expect(copy).toBe(source)
  })
})
