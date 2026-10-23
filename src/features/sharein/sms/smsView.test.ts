/** What the "From SMS" screen shows and hands on: messages of a paste, AI text, meta line, note, prefill. */
import { describe, expect, it } from 'vitest'
import { DESCRIBE_LIMITS } from '../../../../shared/api'
import { relativeDateLabel } from '../../../kit/dateLabel'
import { CORPUS_TODAY, SMS_CORPUS } from './corpus'
import { cleanSms, parseSms, type SmsTxn } from './parseSms'
import {
  accountLabel,
  readPaste,
  skippedLine,
  smsForAi,
  splitMessages,
  txnMetaLine,
  txnNote,
  txnPrefill,
  txnTitle,
} from './smsView'

const today = CORPUS_TODAY
const text = (id: string): string => SMS_CORPUS.find(([cid]) => cid === id)?.[1] ?? ''
const txn = (id: string): SmsTxn => {
  const got = parseSms(text(id), { today })
  if (got.kind !== 'txn') throw new Error(`${id} is not a txn`)
  return got
}

describe('splitMessages', () => {
  it('keeps every corpus message whole', () => {
    for (const [id, message] of SMS_CORPUS) {
      expect(splitMessages(message), id).toEqual([cleanSms(message)])
    }
  })

  it('splits two alerts pasted on consecutive lines', () => {
    expect(splitMessages(`${text('hdfc-01')}\n${text('icici-01')}`)).toEqual([cleanSms(text('hdfc-01')), cleanSms(text('icici-01'))])
  })

  it('splits every pair of corpus alerts pasted one after the other', () => {
    const ids = SMS_CORPUS.map(([id]) => id)
    let pairs = 0
    const wrong: string[] = []
    for (let i = 0; i + 1 < ids.length; i++) {
      const a = text(ids[i] ?? '')
      const b = text(ids[i + 1] ?? '')
      // Only alerts with an amount can be told apart without a blank line.
      if (!/(?:rs\.?|inr|₹)\s?\d|(?:debited|credited) by\s?\d/i.test(cleanSms(a))) continue
      if (splitMessages(`${a}\n${b}`).length !== 2) wrong.push(`${ids[i]} + ${ids[i + 1]}`)
      pairs++
    }
    expect(wrong).toEqual([])
    expect(pairs).toBeGreaterThan(150)
  })

  it('splits on blank lines', () => {
    expect(splitMessages(`${text('hdfc-09')}\n\n${text('hdfc-01')}`)).toHaveLength(2)
  })

  it('an OTP and a debit → 2', () => {
    const got = splitMessages(`${text('hdfc-09')}\n${text('sbi-01')}`)
    expect(got).toHaveLength(2)
    expect(parseSms(got[0] ?? '', { today })).toEqual({ kind: 'ignored', reason: 'otp' })
    expect(parseSms(got[1] ?? '', { today })).toMatchObject({ kind: 'txn', name: 'Swiggy' })
  })

  it('reads at most five', () => {
    expect(splitMessages(Array.from({ length: 8 }, () => text('sbi-01')).join('\n\n'))).toHaveLength(5)
  })

  it('drops empty and punctuation-only pieces', () => {
    expect(splitMessages('  \n\n …  \n\n')).toEqual([])
  })
})

describe('smsForAi', () => {
  it('drops OTP lines', () => {
    const got = smsForAi('Your Uber trip cost ₹1,280.\n481923 is your OTP for login. Do not share.\nRate your driver.')
    expect(got).toBe('Your Uber trip cost ₹1,280. Rate your driver.')
    expect(got).not.toContain('481923')
  })

  it('collapses spaces and keeps 500 characters at most', () => {
    expect(smsForAi('a   b\n\nc')).toBe('a b c')
    expect(Array.from(smsForAi('₹'.repeat(900))).length).toBe(DESCRIBE_LIMITS.maxTextChars)
  })
})

describe('labels', () => {
  it('meta line: date, bank and account, how', () => {
    expect(txnMetaLine(txn('hdfc-01'), today)).toBe(`${relativeDateLabel('2026-10-21', today)} · HDFC ••4821 · UPI`)
    expect(txnMetaLine(txn('ho-13'), today)).toBe('Kotak ••7702 · GPay')
    expect(txnMetaLine(txn('sbi-06'), today)).toBe(`${relativeDateLabel('2026-10-15', today)} · SBI ••3367`)
  })

  it('account label', () => {
    expect(accountLabel({ bank: 'bob', account: 'XX8812' })).toBe('Bank of Baroda ••8812')
    expect(accountLabel({ bank: null, account: 'XX902' })).toBe('••902')
    expect(accountLabel({ bank: 'idfc', account: null })).toBe('IDFC FIRST')
    expect(accountLabel({ bank: null, account: null })).toBeNull()
  })

  it('note: the reference and the account', () => {
    expect(txnNote(txn('hdfc-01'))).toBe('UPI ref 629420113457 · HDFC ••4821')
    expect(txnNote(txn('hdfc-06'))).toBe('NEFT ref HDFCN52026100145871 · HDFC ••4821')
    expect(txnNote(txn('icici-05'))).toBe('IMPS ref 628517003318 · ICICI ••902')
    expect(txnNote(txn('hdfc-04'))).toBe('HDFC ••7712')
    expect(txnNote({ ...txn('hdfc-04'), ref: 'T2610231201991234567' })).toBe('Txn ID T2610231201991234567 · HDFC ••7712')
    expect(txnNote({ ...txn('hdfc-04'), ref: null, account: null, bank: null })).toBeNull()
  })

  it('title falls back on how it was paid', () => {
    expect(txnTitle({ name: 'Swiggy', via: 'upi' })).toBe('Swiggy')
    expect(txnTitle({ name: null, via: 'upi' })).toBe('UPI payment')
    expect(txnTitle({ name: null, via: 'card' })).toBe('Card payment')
    expect(txnTitle({ name: null, via: null })).toBe('Payment')
  })
})

describe('txnPrefill', () => {
  it('a debit: amount, title, category, date, note, payer me, source sms, the SMS banner', () => {
    expect(txnPrefill(txn('hdfc-01'), { today, meId: 'me' })).toEqual({
      title: 'Swiggy',
      category: 'food',
      total: 25000,
      currency: 'INR',
      date: '2026-10-21',
      payerId: 'me',
      mode: 'equal',
      participants: [{ friendId: 'me', input: null }],
      note: 'UPI ref 629420113457 · HDFC ••4821',
      source: 'sms',
      banner: { icon: 'message', title: 'Filled in from your SMS', body: "Add who's in, check it, then save." },
    })
  })

  it('category from the UPI ID when there is no name, else other', () => {
    const viaVpa = { ...txn('hdfc-03'), name: null }
    expect(txnPrefill(viaVpa, { today, meId: 'me' }).category).toBe('food')
    expect(txnPrefill({ ...txn('sbi-06') }, { today, meId: 'me' })).toMatchObject({ title: 'Payment', category: 'other' })
  })

  it('no date printed → today; a title can be given', () => {
    const got = txnPrefill(txn('ho-13'), { today, meId: 'me', title: 'Kabir' })
    expect(got.date).toBe(today)
    expect(got.title).toBe('Kabir')
  })
})

describe('readPaste', () => {
  it('one message', () => {
    const view = readPaste(text('hdfc-01'), today)
    expect(view.txns).toHaveLength(1)
    expect(view.primary?.parse).toMatchObject({ kind: 'txn', name: 'Swiggy' })
    expect(view.skipped).toEqual([])
  })

  it('several: transactions offered, the rest skipped with reasons', () => {
    const view = readPaste([text('hdfc-01'), text('hdfc-09'), text('icici-01'), text('hdfc-10')].join('\n\n'), today)
    expect(view.txns.map((m) => (m.parse.kind === 'txn' ? m.parse.name : null))).toEqual(['Swiggy', 'Blinkit'])
    expect(skippedLine(view.skipped)).toBe('2 messages skipped (OTP, offer)')
  })

  it('no transaction: the first unclear one is shown, else the first message', () => {
    expect(readPaste(`${text('hdfc-09')}\n\n${text('neg-13')}`, today).primary?.parse).toEqual({ kind: 'unknown' })
    const ignored = readPaste(`${text('hdfc-09')}\n\n${text('hdfc-10')}`, today)
    expect(ignored.primary?.parse).toEqual({ kind: 'ignored', reason: 'otp' })
    expect(skippedLine(ignored.skipped)).toBe('1 message skipped (offer)')
  })

  it('nothing pasted', () => {
    expect(readPaste('   ', today)).toEqual({ messages: [], txns: [], primary: null, skipped: [] })
  })
})
