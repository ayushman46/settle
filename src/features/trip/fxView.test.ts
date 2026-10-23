import { describe, expect, it } from 'vitest'
import type { Expense, FxSnapshot } from '../../domain/types'
import type { Conversion } from '../split/splitForm'
import { convertPath, fxNoteText, proseName, rateText, shortDate, sourceText, typedRate, unavailableText } from './fxView'

type Ok = Extract<Conversion, { status: 'ok' }>

const ok = (patch: Partial<Ok> = {}): Ok => ({
  status: 'ok',
  settle: 'INR',
  total: 301_344,
  fx: null,
  rate: '2.410751226',
  rateDate: '2026-10-21',
  source: 'ecb',
  frozen: false,
  stale: false,
  ...patch,
})

function paidAbroad(fx: FxSnapshot, total: number): Pick<Expense, 'fx' | 'currency' | 'total' | 'date'> {
  return { fx, currency: 'INR', total, date: '2026-10-21' }
}

describe('fxView', () => {
  it('writes dates and currency names the way a sentence needs them', () => {
    expect(shortDate('2026-10-21')).toBe('21 Oct')
    expect(shortDate('2026-01-05')).toBe('5 Jan')
    expect(proseName('THB')).toBe('Thai baht')
    expect(proseName('LKR')).toBe('Sri Lankan rupee')
    expect(proseName('EUR')).toBe('Euro')
  })

  it('shows rates to 4 decimals, and tiny ones the other way round (spec 06 §2.2)', () => {
    expect(rateText('2.410751226', 'THB', 'INR')).toBe('1 THB = ₹2.4108')
    expect(rateText('0.625', 'NPR', 'INR')).toBe('1 NPR = ₹0.625')
    expect(rateText('83.64049205', 'USD', 'INR')).toBe('1 USD = ₹83.6405')
    expect(rateText('0.005315626745', 'IDR', 'INR')).toBe('₹1 = 188.12 IDR')
  })

  it('says where a rate came from', () => {
    expect(sourceText(ok())).toBe('ECB rate for 21 Oct')
    expect(sourceText(ok({ source: 'pegged', peg: { code: 'AED', to: 'USD', peg: 3.6725 } }))).toBe('pegged to USD (3.6725)')
    expect(sourceText(ok({ source: 'manual_rate', rateDate: null }))).toBe('your rate')
    expect(sourceText(ok({ source: 'manual_total', rateDate: null }))).toBe('what your bank charged')
    expect(sourceText(ok({ stale: true, rateDate: '2026-10-18' }))).toBe('rate from 18 Oct — you’re offline')
    expect(sourceText(ok({ frozen: true }))).toBe('Rate frozen on 21 Oct')
  })

  it('says why there is no rate', () => {
    expect(unavailableText('error', 'THB', '2026-10-21')).toBe('No rate for THB on 21 Oct — add it')
    expect(unavailableText('offline', 'THB', '2026-10-21')).toBe('No rate for THB on 21 Oct — add it')
    expect(unavailableText('not_covered', 'LKR', '2026-10-21')).toBe(
      'ECB doesn’t publish Sri Lankan rupee rates — add the rate from your receipt or bank SMS.',
    )
  })

  it('writes the expense page’s note (spec 06 §2.3)', () => {
    expect(fxNoteText(paidAbroad({ amount: 125_000, currency: 'THB', rate: '2.410751226', rateDate: '2026-10-21', source: 'ecb' }, 301_344))).toBe(
      'Paid ฿1,250 · 1 THB = ₹2.4108 (ECB, 21 Oct)',
    )
    expect(fxNoteText(paidAbroad({ amount: 125_000, currency: 'THB', rate: '2.48336', rateDate: null, source: 'manual_total' }, 310_420))).toBe(
      'Paid ฿1,250 · 1 THB = ₹2.4834 (your bank: ₹3,104.20)',
    )
    expect(fxNoteText(paidAbroad({ amount: 125_000, currency: 'THB', rate: '2.5', rateDate: null, source: 'manual_rate' }, 312_500))).toBe(
      'Paid ฿1,250 · 1 THB = ₹2.5 (your rate)',
    )
    expect(fxNoteText(paidAbroad({ amount: 8_550, currency: 'AED', rate: '22.77481063', rateDate: '2026-10-21', source: 'pegged' }, 194_725))).toBe(
      'Paid AED 85.50 · 1 AED = ₹22.7748 (pegged to USD, 21 Oct)',
    )
    expect(fxNoteText({ fx: null, currency: 'INR', total: 1, date: '2026-10-21' })).toBeNull()
  })

  it('reads a typed rate', () => {
    expect(typedRate('2.4108')).toBe('2.4108')
    expect(typedRate('02.50')).toBe('2.5')
    expect(typedRate('3.')).toBe('3')
    expect(typedRate('0')).toBeNull()
    expect(typedRate('')).toBeNull()
    expect(typedRate('.')).toBeNull()
  })

  it('links "Convert to ₹" to the edit screen with the switch on', () => {
    expect(convertPath('e 1')).toBe('/app/split/e%201/edit?convert=1')
  })
})
