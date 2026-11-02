import { describe, expect, it } from 'vitest'
import { clearAllData } from '../../data'
import { STORAGE_KEYS } from '../../data/stores'
import { emailKey, letterMeStore, setLetterEmail, setLetterMe, setMandateRevoked } from './letterMe'
import { stuckPayment } from './testKit'

describe('letterMe', () => {
  it('starts empty, and keeps what you type for every letter', () => {
    expect(letterMeStore.get()).toEqual({ mobile: '', place: '', address: '', emails: {}, revoked: {} })
    setLetterMe({ mobile: '98200 12345' })
    setLetterMe({ place: 'Pune, Maharashtra ' })
    expect(letterMeStore.get()).toMatchObject({ mobile: '98200 12345', place: 'Pune, Maharashtra ', address: '' })
  })

  it('remembers where letters go: per bank, per wallet, per business', () => {
    const hdfc = stuckPayment({ bank: 'HDFC' })
    expect(emailKey('bank', hdfc)).toBe('bank:hdfc')
    expect(emailKey('bank', stuckPayment({ rail: 'wallet', app: 'net.one97.paytm' }), 'paytm')).toBe('wallet:paytm')
    expect(emailKey('merchant', stuckPayment({ kind: 'refund', merchant: 'amazon' }))).toBe('merchant:amazon')
    expect(emailKey('merchant', stuckPayment({ kind: 'refund', merchant: null, party: ' Sharma Electronics ' }))).toBe('merchant:sharma electronics')
    expect(emailKey('bank', stuckPayment({ bank: null }))).toBeNull()
    expect(emailKey('nch', hdfc)).toBeNull()

    setLetterEmail('bank:hdfc', ' grievance@hdfc.example ')
    expect(letterMeStore.get().emails).toEqual({ 'bank:hdfc': 'grievance@hdfc.example' })
    setLetterEmail('bank:hdfc', '')
    expect(letterMeStore.get().emails).toEqual({})
  })

  it('keeps a few dozen addresses at most, dropping the oldest', () => {
    for (let i = 0; i < 45; i++) setLetterEmail(`bank:b${i}`, `b${i}@bank.example`)
    const keys = Object.keys(letterMeStore.get().emails)
    expect(keys).toHaveLength(40)
    expect(keys[0]).toBe('bank:b5')
  })

  it('notes a NACH mandate revoked before the debit, and forgets it on "No"', () => {
    setMandateRevoked('s1', '')
    setMandateRevoked('s1', '2026-10-15')
    expect(letterMeStore.get().revoked).toEqual({ s1: '2026-10-15' })
    setMandateRevoked('s1', null)
    expect(letterMeStore.get().revoked).toEqual({})
  })

  it('is cleared with everything else, from storage and from memory', () => {
    setLetterMe({ mobile: '98200 12345' })
    letterMeStore.flush()
    expect(window.localStorage.getItem(STORAGE_KEYS.letterMe)).not.toBeNull()
    clearAllData()
    expect(window.localStorage.getItem(STORAGE_KEYS.letterMe)).toBeNull()
    expect(letterMeStore.get().mobile).toBe('')
  })
})
