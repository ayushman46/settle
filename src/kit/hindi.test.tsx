/**
 * The kit in Hindi: real components and helpers switch language as a whole (no English left on
 * these surfaces, no keys showing), while money keeps Indian grouping with Latin digits.
 */
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetDataForTests } from '../data'
import { ME_ID } from '../domain/types'
import { registerCatalog, resetI18nForTests, setLanguage, t } from '../i18n'
import HI from '../i18n/hi'
import { nudgeText } from '../share'
import { summaryText } from '../share/summary'
import { amountInWords } from './amountWords'
import { balanceHeadline, otherCurrenciesLine } from './balanceLabels'
import { paidCountLabel, waitingOnLabel } from './collectLabels'
import { relativeDateLabel } from './dateLabel'
import { friendLabel } from './friendName'
import { splitStatus } from './splitInputs'
import { TransferRow } from './TransferRow'
import { seedPeople } from './testPeople'

async function hindi(): Promise<void> {
  registerCatalog('hi', HI)
  await act(async () => {
    expect(await setLanguage('hi')).toBe(true)
  })
}

beforeEach(async () => {
  resetDataForTests()
  seedPeople()
  await hindi()
})

afterEach(() => {
  resetI18nForTests()
  resetDataForTests()
})

describe('the kit in Hindi', () => {
  it('names people and dates in Hindi', () => {
    expect(friendLabel(ME_ID, null)).toBe('आप')
    expect(friendLabel('gone', null)).toBe('कोई')
    expect(relativeDateLabel('2026-10-24', '2026-10-24')).toBe('आज')
    expect(relativeDateLabel('2026-10-23', '2026-10-24')).toBe('कल')
    expect(relativeDateLabel('not a date')).toBe('तारीख़ चुनें')
    // Other dates: the Hindi month, Latin digits.
    expect(relativeDateLabel('2026-03-18', '2026-10-24')).toMatch(/^18 /)
  })

  it('reads balances and collections in Hindi with Indian money', () => {
    const summary = { currency: 'INR', owedToMe: 245_000, iOwe: 0, byFriend: {}, otherCurrencies: { USD: { owedToMe: 4_000, iOwe: 0 } } }
    expect(balanceHeadline(summary).label).toBe('आपको मिलने हैं')
    expect(otherCurrenciesLine(summary)).toMatch(/^साथ ही .*40 आपको मिलने हैं$/)
    expect(paidCountLabel(1, 3)).toBe('3 में से 1 ने चुकाया')
    expect(waitingOnLabel(['Sam', 'Neha'])).toBe('Sam और Neha का इंतज़ार है')
  })

  it('says what the split editor needs in Hindi', () => {
    const status = splitStatus({
      total: 1_00_000,
      currency: 'INR',
      mode: 'exact',
      participants: [{ friendId: ME_ID, input: 40_000 }],
      result: { shares: { [ME_ID]: 40_000 }, ok: false, remainder: 60_000, percentRemainder: 0, issues: [] },
    })
    expect(status.message).toBe('₹600 बाँटना बाक़ी')
    expect(status.detail).toBe('₹1,000 में से ₹400')
  })

  it('renders a settle-up row in Hindi', () => {
    render(<TransferRow transfer={{ fromId: 'riya', toId: ME_ID, amount: 1_23_456_00 }} currency="INR" onRemind={() => undefined} />)
    expect(screen.getByRole('group', { name: 'Riya आपको देंगे ₹1,23,456' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Riya को ₹1,23,456 की याद दिलाएँ' })).toHaveTextContent('याद दिलाएँ')
  })

  it('sends nudges and summaries in the sender’s language', () => {
    const text = nudgeText({
      tone: 'firm',
      toName: 'Riya Sharma',
      amount: 50_000,
      currency: 'INR',
      title: 'Goa',
      payeeName: '',
      payeeUpi: 'ayush@okaxis',
      link: null,
      variant: 0,
    })
    expect(text).toBe('हाय Riya, याद दिला दूँ कि Goa के ₹500 अभी बाक़ी हैं। कृपया आज चुका दें।\nमेरी UPI: ayush@okaxis')
    const summary = summaryText({ v: 1, t: 'Dinner', cat: 'food', c: 'INR', d: '', to: { n: 'Ayush', u: null }, tot: 90_000, pi: 0, p: [{ n: 'Ayush', a: 30_000, paid: true }, { n: 'Riya', a: 30_000 }, { n: 'Sam', a: 30_000 }] })
    expect(summary).toContain('कुल ₹900 · 3 हिस्सों में बँटा')
    expect(summary).toContain('Ayush  ₹300 · बिल दिया')
    expect(summary.endsWith('— Settle से बाँटा')).toBe(true)
  })

  it('never shows a raw key', () => {
    for (const key of ['kit.balance.settled', 'share.category.food', 'ui.list.none', 'app.tab.home', 'api.scan.busy'] as const) {
      expect(t(key)).not.toBe(key)
      expect(t(key)).not.toMatch(/[A-Za-z]{4,}/)
    }
  })

  it('writes rupee amounts in Hindi words', () => {
    expect(amountInWords(2_40_000_00, 'INR')).toBe('दो लाख चालीस हज़ार रुपये')
    expect(amountInWords(1_00, 'INR')).toBe('एक रुपया')
    expect(amountInWords(2_400_50, 'INR')).toBe('दो हज़ार चार सौ रुपये और पचास पैसे')
  })
})
