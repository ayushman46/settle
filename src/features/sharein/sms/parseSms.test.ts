/** The on-device SMS parser: every corpus message read field for field, plus clean-up, idempotence and fuzz. */
import { describe, expect, it } from 'vitest'
import { CORPUS_TODAY, SMS_CORPUS } from './corpus'
import { cleanSms, MAX_SMS_CHARS, parseSms, toPaise } from './parseSms'

/* The client tsconfig has no Node types: the two functions used are typed here (as in documentMeta.test.ts). */
interface Fs {
  readFileSync: (path: string, encoding: 'utf8') => string
}
interface NodeUrl {
  fileURLToPath: (url: string) => string
}
const [FS_MODULE, URL_MODULE] = ['node:fs', 'node:url']
const { readFileSync } = (await import(/* @vite-ignore */ FS_MODULE)) as Fs
const { fileURLToPath } = (await import(/* @vite-ignore */ URL_MODULE)) as NodeUrl

const today = CORPUS_TODAY

describe('the corpus', () => {
  it('has 179 messages with unique ids', () => {
    expect(SMS_CORPUS).toHaveLength(179)
    expect(new Set(SMS_CORPUS.map(([id]) => id)).size).toBe(179)
  })

  it.each(SMS_CORPUS)('%s', (_id, text, expected) => {
    expect(parseSms(text, { today })).toEqual(expected)
  })

  it('covers 12 banks and 7 UPI apps', () => {
    const banks = new Set<string>()
    const apps = new Set<string>()
    for (const [, , want] of SMS_CORPUS) {
      if (want.kind !== 'txn') continue
      if (want.bank) banks.add(want.bank)
      if (want.app) apps.add(want.app)
    }
    expect(banks.size).toBe(12)
    expect(apps.size).toBe(7)
  })
})

describe('cleanSms', () => {
  it('turns Indian digits into ASCII ones', () => {
    expect(cleanSms('₹२५०')).toBe('₹250')
    expect(cleanSms('Rs.১২০০')).toBe('Rs.1200')
    expect(cleanSms('₹௫௦௦')).toBe('₹500')
    expect(cleanSms('Rs.１２３')).toBe('Rs.123')
  })

  it('drops zero-width and bidi characters', () => {
    expect(cleanSms('Rs.2​50 paid‎ to‪SWIGGY‬﻿')).toBe('Rs.250 paid toSWIGGY')
  })

  it('tidies spaces but keeps line breaks', () => {
    expect(cleanSms('  Sent  Rs.250 \r\n  To\tSWIGGY  now \r')).toBe('Sent Rs.250\nTo SWIGGY now')
  })

  it('keeps the first 2,000 characters', () => {
    expect(cleanSms('a'.repeat(5000))).toHaveLength(MAX_SMS_CHARS)
  })

  it('reads Devanagari amounts in a real alert', () => {
    const got = parseSms('Sent Rs.२५०.००\nFrom HDFC Bank A/C *4821\nTo SWIGGY\nOn 21/10/26\nRef 629420113457', { today })
    expect(got).toMatchObject({ kind: 'txn', dir: 'debit', amount: 25000, name: 'Swiggy' })
  })
})

describe('toPaise', () => {
  it('reads Indian grouping and rounds half up past two decimals', () => {
    expect(toPaise('1,02,500.00')).toBe(10_250_000)
    expect(toPaise('250.0')).toBe(25_000)
    expect(toPaise('691.50')).toBe(69_150)
    expect(toPaise('0.005')).toBe(1)
    expect(toPaise('10.994')).toBe(1099)
    expect(toPaise('10.995')).toBe(1100)
    expect(toPaise('0')).toBeNull()
    expect(toPaise('')).toBeNull()
    expect(toPaise('1.2.3')).toBeNull()
  })
})

describe('parseSms', () => {
  it('is idempotent over cleanSms', () => {
    for (const [, text] of SMS_CORPUS) expect(parseSms(cleanSms(text), { today })).toEqual(parseSms(text, { today }))
  })

  it('never takes a date after tomorrow', () => {
    const text = 'Sent Rs.250.00\nFrom HDFC Bank A/C *4821\nTo SWIGGY\nOn 21/10/26\nRef 629420113457'
    expect(parseSms(text, { today: '2026-10-20' })).toMatchObject({ kind: 'txn', date: '2026-10-21' })
    expect(parseSms(text, { today: '2026-10-19' })).toMatchObject({ kind: 'txn', date: null })
  })

  it('an OTP is always an OTP, amount and merchant or not', () => {
    expect(parseSms('Use OTP 123456 to pay Rs.2,400.00 to SWIGGY. Sent from HDFC Bank. Debited after confirmation.', { today })).toEqual({
      kind: 'ignored',
      reason: 'otp',
    })
  })

  it('reads empty and blank text as not a payment', () => {
    expect(parseSms('', { today })).toEqual({ kind: 'ignored', reason: 'not_txn' })
    expect(parseSms(' \n​ ', { today })).toEqual({ kind: 'ignored', reason: 'not_txn' })
  })

  it('a non-rupee card spend is unknown (the AI reads it)', () => {
    expect(parseSms('USD 12.99 spent on your HDFC Bank Card x9034 at NETFLIX.COM on 21-10-26', { today })).toEqual({ kind: 'unknown' })
  })

  it('survives a bad `today`', () => {
    expect(parseSms('Sent Rs.250.00 To SWIGGY On 21/10/26', { today: 'not a day' })).toMatchObject({ kind: 'txn', date: '2026-10-21' })
  })

  it('never throws on 5,000 random strings', () => {
    let seed = 42
    const random = (): number => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648
      return seed / 2_147_483_648
    }
    const pieces = [
      'Rs.', 'INR ', '₹', '1,02,500.00', '250', 'debited', 'credited', 'from', 'to', 'A/C', 'XX4821', 'UPI', 'Ref',
      '629420113457', '21/10/26', '2026-10-21', '21-Oct-26', 'OTP', 'refund', 'failed', '@okaxis', 'riya.s@okaxis',
      'NEFT-HDFCN52026100145871-', 'On', '\n', ' ', '.', ';', 'Avl Bal', 'Mandate/', 'स', '२', '​', '(', ')', '*', '•',
    ]
    for (let i = 0; i < 5000; i++) {
      let text = ''
      const n = Math.floor(random() * 30)
      for (let j = 0; j < n; j++) {
        text += random() < 0.7 ? (pieces[Math.floor(random() * pieces.length)] ?? '') : String.fromCharCode(Math.floor(random() * 0x3000))
      }
      const got = parseSms(text, { today })
      expect(['txn', 'ignored', 'unknown']).toContain(got.kind)
      if (got.kind === 'txn') {
        expect(Number.isSafeInteger(got.amount)).toBe(true)
        expect(got.amount).toBeGreaterThan(0)
      }
    }
  })

  it('is fast: 179 messages × 20 in well under 1.5 s', () => {
    const start = performance.now()
    for (let loop = 0; loop < 20; loop++) for (const [, text] of SMS_CORPUS) parseSms(text, { today })
    expect(performance.now() - start).toBeLessThan(1500)
  })

  it('reads a 2,000-character paste quickly', () => {
    const text = SMS_CORPUS.map(([, t]) => t).join('\n\n').slice(0, 2000)
    const start = performance.now()
    for (let loop = 0; loop < 50; loop++) parseSms(text, { today })
    expect((performance.now() - start) / 50).toBeLessThan(20)
  })
})

describe('the source', () => {
  it('uses no regex lookbehind (Safari < 16.4 cannot parse it)', () => {
    for (const file of ['./parseSms.ts', './brands.ts', './smsView.ts', './matchFriend.ts']) {
      const source = readFileSync(fileURLToPath(new URL(file, import.meta.url).href), 'utf8')
      expect(source.includes('(?<=')).toBe(false)
      expect(source.includes('(?<!')).toBe(false)
    }
  })
})
