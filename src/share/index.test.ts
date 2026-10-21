import { describe, expect, it } from 'vitest'
import type { CategoryId, Expense, Friend, Minor, Profile } from '../domain/types'
import { CATEGORY_IDS } from '../domain/types'
import { CATEGORY_META } from '../engine/categories'
import * as share from './index'
import type { NudgeTone, PayLinkPayload, ShareCardInput } from './index'

/* Compile-time checks that the public API matches the v3 contract (spec §5.4). */
const contract: {
  encodePayLink: (payload: PayLinkPayload, origin?: string) => Promise<string>
  decodePayLink: (hash: string) => Promise<PayLinkPayload | null>
  payLinkFromExpense: (e: Expense, friendsById: Record<string, Friend>, profile: Profile) => PayLinkPayload
  renderShareCard: (input: ShareCardInput, opts: { watermark: boolean; theme: 'light' | 'dark' }) => Promise<Blob>
  nudgeText: (input: {
    tone: NudgeTone
    toName: string
    amount: Minor
    currency: string
    title: string
    payeeName: string
    payeeUpi: string | null
    link: string | null
  }) => string
  whatsappUrl: (text: string, phone?: string | null) => string
  smsUrl: (text: string, phone?: string | null) => string
  shareFile: (blob: Blob, filename: string, text?: string) => Promise<'shared' | 'downloaded' | 'cancelled' | 'failed'>
} = share

const payloadShape: PayLinkPayload = {
  v: 1,
  t: 'Chai',
  cat: 'food' satisfies CategoryId,
  c: 'INR',
  d: '2026-10-18',
  to: { n: 'Riya', u: null },
  tot: 4_000,
  p: [{ n: 'Sam', a: 2_000, paid: true }],
  note: 'optional',
  items: [{ n: 'Chai', a: 4_000, who: [0] }],
}

const cardShape: ShareCardInput = {
  title: 'Chai',
  category: 'food',
  currency: 'INR',
  date: '2026-10-18',
  total: 4_000,
  payerName: 'Riya',
  people: [{ name: 'Sam', color: 1, amount: 2_000, paid: false, isPayer: false }],
}

describe('share kit entry point', () => {
  it('exports the whole contract', () => {
    const names = ['encodePayLink', 'decodePayLink', 'payLinkFromExpense', 'renderShareCard', 'nudgeText', 'whatsappUrl', 'smsUrl', 'shareFile'] as const
    for (const name of names) expect(typeof contract[name], name).toBe('function')
    expect(payloadShape.v).toBe(1)
    expect(cardShape.people).toHaveLength(1)
    for (const extra of [share.payLinkMessage, share.summaryText, share.payLinkDebtors, share.payLinkItemLines, share.shareCardInputFromExpense, share.renderGroupCard, share.groupCardInputFromGroup]) {
      expect(typeof extra).toBe('function')
    }
    expect(typeof share.copyText).toBe('function')
    expect(typeof share.shareResult).toBe('function')
    expect(share.NUDGE_TONES.map((t) => t.tone)).toEqual(['friendly', 'funny', 'firm'])
  })

  it('labels categories exactly as the app does', () => {
    for (const id of CATEGORY_IDS) expect(share.categoryLabel(id)).toBe(CATEGORY_META[id].label)
  })
})
