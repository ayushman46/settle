import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildUpiLink,
  buildUpiRequestText,
  getSavedUpiId,
  isPhoneUpiId,
  isValidUpiId,
  LEGACY_UPI_ID_KEY,
  MAX_SAVED_UPI_IDS,
  normalizeUpiId,
  saveUpiId,
  UPI_IDS_KEY,
} from './upi'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('isValidUpiId / normalizeUpiId', () => {
  it('accepts name@bank shapes', () => {
    for (const id of ['aisha@okaxis', 'aisha.k-1_2@ybl', '9876543210@paytm', ' Aisha@OkAxis ', 'ab@upi']) {
      expect(isValidUpiId(id)).toBe(true)
    }
  })

  it('rejects everything else', () => {
    for (const id of ['', 'aisha', '@okaxis', 'a@okaxis', 'aisha@', 'aisha@1bank', 'ai sha@ok axis!', 'a@b@c', 'aisha@o']) {
      expect(isValidUpiId(id)).toBe(false)
    }
  })

  it('normalises', () => {
    expect(normalizeUpiId(' Aisha@OkAxis ')).toBe('aisha@okaxis')
  })
})

describe('buildUpiLink', () => {
  it('builds an encoded upi://pay link', () => {
    const link = buildUpiLink({ vpa: 'Aisha@OkAxis', payeeName: 'Aisha Khan', amountMinor: 53010, note: 'Saffron Table' })
    expect(link).toBe('upi://pay?pa=aisha%40okaxis&pn=Aisha%20Khan&am=530.10&cu=INR&tn=Saffron%20Table')
    const url = new URL(link)
    expect(url.protocol).toBe('upi:')
    expect(url.searchParams.get('pa')).toBe('aisha@okaxis')
    expect(url.searchParams.get('am')).toBe('530.10')
  })

  it('defaults the note and leaves out a zero amount', () => {
    const link = buildUpiLink({ vpa: 'a.b@ybl', payeeName: 'Ben', amountMinor: 0 })
    expect(link).toBe('upi://pay?pa=a.b%40ybl&pn=Ben&cu=INR&tn=Bill%20split')
  })

  it('strips characters UPI apps reject and caps lengths', () => {
    const link = buildUpiLink({
      vpa: 'x@ybl',
      payeeName: 'Aisha 🎉 #1',
      amountMinor: 100,
      note: `Café & Bar's "best" ${'x'.repeat(80)}`,
    })
    const url = new URL(link)
    expect(url.searchParams.get('pn')).toBe('Aisha 1')
    const note = url.searchParams.get('tn') ?? ''
    expect(note.startsWith("Café & Bar's best")).toBe(true)
    expect(Array.from(note).length).toBeLessThanOrEqual(50)
    expect(url.searchParams.get('am')).toBe('1.00')
  })

  it('drops a name that has nothing usable', () => {
    expect(buildUpiLink({ vpa: 'x@ybl', payeeName: '🎉', amountMinor: 1 })).toBe('upi://pay?pa=x%40ybl&am=0.01&cu=INR&tn=Bill%20split')
  })
})

describe('buildUpiRequestText', () => {
  it('writes a friendly request with a copyable UPI ID — and no upi:// link, which UPI apps refuse for a person', () => {
    const text = buildUpiRequestText({
      debtorName: 'Aisha',
      payerName: 'Ben',
      vpa: 'ben@okaxis',
      amountMinor: 53010,
      merchant: ' Saffron Table ',
    })
    expect(text.split('\n')).toEqual(['Hi Aisha, your share for Saffron Table is ₹530.10.', 'Pay Ben on UPI: ben@okaxis'])
    expect(text).not.toContain('upi://')
  })

  it('normalises the UPI ID and words a bill without a merchant', () => {
    const text = buildUpiRequestText({ debtorName: 'Ben', payerName: 'A', vpa: ' Ben@OkAxis ', amountMinor: 100, merchant: null })
    expect(text).toContain('your share of the bill is ₹1.00.')
    expect(text).toContain('Pay A on UPI: ben@okaxis')
    expect(buildUpiRequestText({ debtorName: 'Ben', payerName: 'A', vpa: 'a@ybl', amountMinor: 100, merchant: '  ' })).toContain(
      'your share of the bill is',
    )
  })
})

describe('saved UPI ids (one per payee)', () => {
  it('saves only valid ids, per name, and forgets on null/blank', () => {
    expect(getSavedUpiId('Aisha')).toBeNull()
    saveUpiId('Aisha', ' Aisha@OkAxis ')
    expect(getSavedUpiId('Aisha')).toBe('aisha@okaxis')
    // Someone else's ID is never handed to a different payer.
    expect(getSavedUpiId('Ben')).toBeNull()
    saveUpiId('Aisha', 'half-typed@')
    expect(getSavedUpiId('Aisha')).toBe('aisha@okaxis')
    saveUpiId('Ben', 'ben@ybl')
    expect(getSavedUpiId('Ben')).toBe('ben@ybl')
    expect(getSavedUpiId('Aisha')).toBe('aisha@okaxis')
    saveUpiId('Aisha', '')
    expect(getSavedUpiId('Aisha')).toBeNull()
    expect(getSavedUpiId('Ben')).toBe('ben@ybl')
    saveUpiId('Ben', null)
    expect(window.localStorage.getItem(UPI_IDS_KEY)).toBeNull()
  })

  it('matches names ignoring case, accents and spacing — and never a blank name', () => {
    saveUpiId('José  Ramos', 'jose@ybl')
    expect(getSavedUpiId(' jose ramos ')).toBe('jose@ybl')
    saveUpiId('   ', 'x@ybl')
    expect(getSavedUpiId('')).toBeNull()
    expect(getSavedUpiId('   ')).toBeNull()
  })

  it('keeps the most recent payees only', () => {
    for (let i = 0; i <= MAX_SAVED_UPI_IDS; i++) saveUpiId(`P${i}`, `p${i}@ybl`)
    expect(getSavedUpiId('P0')).toBeNull()
    expect(getSavedUpiId('P1')).toBe('p1@ybl')
    expect(getSavedUpiId(`P${MAX_SAVED_UPI_IDS}`)).toBe(`p${MAX_SAVED_UPI_IDS}@ybl`)
  })

  it('never uses the old ownerless v1 ID, and clears it on the next save', () => {
    window.localStorage.setItem(LEGACY_UPI_ID_KEY, 'aisha@okaxis')
    expect(getSavedUpiId('Aisha')).toBeNull()
    expect(getSavedUpiId('Ben')).toBeNull()
    saveUpiId('Ben', 'ben@ybl')
    expect(window.localStorage.getItem(LEGACY_UPI_ID_KEY)).toBeNull()
  })

  it('ignores corrupt or tampered storage, and recovers on the next save', () => {
    window.localStorage.setItem(UPI_IDS_KEY, '{not json')
    expect(getSavedUpiId('Aisha')).toBeNull()
    window.localStorage.setItem(UPI_IDS_KEY, JSON.stringify({ aisha: 'aisha@okaxis' }))
    expect(getSavedUpiId('Aisha')).toBeNull()
    window.localStorage.setItem(
      UPI_IDS_KEY,
      JSON.stringify([['aisha', 'not an id'], ['ben', 42], 'junk', ['chen', 'Chen@YBL']]),
    )
    expect(getSavedUpiId('Aisha')).toBeNull()
    expect(getSavedUpiId('Ben')).toBeNull()
    expect(getSavedUpiId('Chen')).toBe('chen@ybl')
    saveUpiId('Aisha', 'aisha@okaxis')
    expect(getSavedUpiId('Aisha')).toBe('aisha@okaxis')
    expect(getSavedUpiId('Chen')).toBe('chen@ybl')
  })

  it('never throws when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(getSavedUpiId('Aisha')).toBeNull()
    expect(() => saveUpiId('Aisha', 'a@ybl')).not.toThrow()
  })
})

describe('isPhoneUpiId', () => {
  it('spots a UPI ID made of a mobile number', () => {
    expect(isPhoneUpiId('9876543210@ybl')).toBe(true)
    expect(isPhoneUpiId(' 919876543210@paytm ')).toBe(true)
    expect(isPhoneUpiId('ayush@okaxis')).toBe(false)
    expect(isPhoneUpiId('ayush9876543210@okaxis')).toBe(false)
    expect(isPhoneUpiId('1234567890@ybl')).toBe(false)
    expect(isPhoneUpiId('9876543210')).toBe(false)
  })
})
