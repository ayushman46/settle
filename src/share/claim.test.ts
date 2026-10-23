import { afterEach, describe, expect, it, vi } from 'vitest'
import { ME_ID, type ClaimRound, type Expense, type Friend, type Profile } from '../domain/types'
import * as hmac from './hmac'
import {
  CLAIM_LIMITS,
  claimLinkFromRound,
  currentItemsHash,
  decodeClaimLink,
  decodeClaimReply,
  encodeClaimLink,
  encodeClaimReply,
  itemsHash,
  picksForLink,
  replyCanonical,
  replyFragmentIn,
  replyId,
  signReply,
  verifyReply,
  type ClaimLinkPayload,
  type ClaimReplyPayload,
} from './claim'
import { JSON_PREFIX } from './fragment'

const ITEMS = [
  { n: 'Butter Chicken', a: 45000 },
  { n: 'Paneer Tikka', a: 38000 },
  { n: 'Butter Naan', a: 24000, q: 4 },
  { n: 'Kingfisher Beer', a: 90000, q: 3 },
  { n: 'Fresh Lime Soda', a: 12000 },
  { n: 'Gulab Jamun', a: 15000 },
]
const SECRET = 'k3J9vQ2mXe8Ls1Wd0PzR4A'

function link(extra: Partial<ClaimLinkPayload> = {}): ClaimLinkPayload {
  return {
    v: 1,
    k: 'claim',
    r: 'q7Lr2xVb9K',
    s: SECRET,
    t: 'Toit Brewpub',
    c: 'INR',
    d: '2026-10-18',
    to: { n: 'Ayush', u: 'ayush@okicici' },
    tot: 276600,
    it: ITEMS,
    p: ['Ayush', 'Riya', 'Sam', 'Kabir'],
    h: 'e2738144e47b',
    ...extra,
  }
}

const RIYA: Omit<ClaimReplyPayload, 'm'> = {
  v: 1,
  k: 'reply',
  r: 'q7Lr2xVb9K',
  h: 'e2738144e47b',
  w: 1,
  n: 'Riya',
  x: [
    [1, 1, 2],
    [2, 1, 4],
    [4, 1, 1],
    [5, 1, 2],
  ],
  pd: 54950,
  at: 1792748400,
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('canonical strings and vectors', () => {
  it('hashes the items', () => {
    expect(itemsHash('INR', 276600, ITEMS)).toBe('e2738144e47b')
  })

  it('signs a reply', () => {
    expect(replyCanonical(RIYA)).toBe('q7Lr2xVb9K|e2738144e47b|1|Riya|1:1/2,2:1/4,4:1/1,5:1/2||54950|1792748400')
    const signed = signReply(SECRET, RIYA)
    expect(signed.m).toBe('69uBM-ypy-Qpz3uu')
    expect(replyId(signed)).toBe('_Yf8WGpd0FRub0Qi')
  })

  it('verifies only an untouched reply under the right secret', () => {
    const signed = signReply(SECRET, RIYA)
    expect(verifyReply(SECRET, signed)).toBe(true)
    expect(verifyReply(SECRET, { ...signed, pd: 54949 })).toBe(false)
    expect(verifyReply(SECRET, { ...signed, x: [[1, 1, 1], ...signed.x.slice(1)] })).toBe(false)
    expect(verifyReply(SECRET, { ...signed, z: 1 })).toBe(false)
    expect(verifyReply('A'.repeat(22), signed)).toBe(false)
    expect(verifyReply(SECRET, { ...signed, m: 'short' })).toBe(false)
  })

  it('compares MACs in constant time', () => {
    const spy = vi.spyOn(hmac, 'timingSafeEqual')
    verifyReply(SECRET, signReply(SECRET, RIYA))
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe('claim link round trip', () => {
  it('encodes and decodes', async () => {
    const url = await encodeClaimLink(link(), 'https://settle.example/')
    expect(url.startsWith('https://settle.example/claim#')).toBe(true)
    expect(await decodeClaimLink(url)).toEqual(link())
  })

  it('normalizes: long names, bad quantities, fixed items and the UPI ID', async () => {
    const url = await encodeClaimLink(
      link({
        t: `  ${'Dinner '.repeat(20)}`,
        to: { n: '', u: 'not a upi', ph: '98765 43210' },
        it: [
          { n: 'Very long item name that goes on and on past forty characters', a: 1000.4, q: 2.5 },
          { n: '', a: -5, q: 3 },
          { n: 'Naan', a: 2000, q: 1 },
        ],
        p: ['Ayush', 'Riyaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', ''],
        fix: [
          [1, [[1, 1], [9, 1], [1, 2]]],
          [7, [[0, 1]]],
          [1, [[2, 1]]],
          [2, [[0, 0]]],
        ],
      }),
      '',
    )
    const back = (await decodeClaimLink(url))!
    expect(back.t.length).toBeLessThanOrEqual(CLAIM_LIMITS.title.graphemes)
    expect(back.to).toEqual({ n: 'Your friend', u: null, ph: '919876543210' })
    expect(back.it).toEqual([
      { n: 'Very long item name that goes on and on', a: 1000 },
      { n: 'Item', a: 0, q: 3 },
      { n: 'Naan', a: 2000 },
    ])
    expect(back.p).toEqual(['Ayush', 'Riyaaaaaaaaaaaaaaaaaaaaa', 'Person 3'])
    expect(back.fix).toEqual([[1, [[1, 1]]]])
  })

  it('drops picks for fixed or missing items, and duplicates', () => {
    expect(
      picksForLink({ it: ITEMS, fix: [[1, [[0, 1]]]] }, [
        [1, 1, 2],
        [2, 1, 4],
        [2, 1, 2],
        [9, 1, 1],
        [3, 3, 2],
        [4, 0, 1],
        [5, 1, 100],
        [0, 1, 1],
      ]),
    ).toEqual([
      [2, 1, 4],
      [0, 1, 1],
    ])
  })

  it('rejects anything cut short or garbled', async () => {
    const url = await encodeClaimLink(link(), '')
    const fragment = url.slice(url.indexOf('#') + 1)
    for (let cut = 1; cut < fragment.length; cut += 7) {
      expect(await decodeClaimLink(fragment.slice(0, cut))).toBeNull()
    }
    expect(await decodeClaimLink('')).toBeNull()
    expect(await decodeClaimLink('#!!!')).toBeNull()
    expect(await decodeClaimLink(`${JSON_PREFIX}${btoa('{"v":1}')}`)).toBeNull()
  })

  it('reads the j. form too', async () => {
    const json = JSON.stringify(link())
    const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(await decodeClaimLink(`#${JSON_PREFIX}${b64}`)).toEqual(link())
  })

  it('refuses more than 16 KB decoded', async () => {
    const huge = { ...link(), t: 'x'.repeat(17 * 1024) }
    const json = JSON.stringify(huge)
    const b64 = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(await decodeClaimLink(`${JSON_PREFIX}${b64}`)).toBeNull()
  })

  it('refuses a pay link and a reply', async () => {
    const reply = await encodeClaimReply(signReply(SECRET, RIYA), '')
    expect(await decodeClaimLink(reply)).toBeNull()
  })
})

describe('reply round trip', () => {
  it('encodes, decodes and still verifies', async () => {
    const signed = signReply(SECRET, RIYA)
    const url = await encodeClaimReply(signed, 'https://settle.example')
    expect(url.startsWith('https://settle.example/app/claims/in#')).toBe(true)
    const back = (await decodeClaimReply(url))!
    expect(back).toEqual(signed)
    expect(verifyReply(SECRET, back)).toBe(true)
  })

  it('carries "had nothing"', async () => {
    const signed = signReply(SECRET, { ...RIYA, x: [[1, 1, 2]], z: 1, pd: undefined })
    expect(signed.x).toEqual([])
    const back = (await decodeClaimReply(await encodeClaimReply(signed, '')))!
    expect(back.z).toBe(1)
    expect(verifyReply(SECRET, back)).toBe(true)
  })

  it('fails verification when one character changes', async () => {
    const url = await encodeClaimReply(signReply(SECRET, RIYA), '')
    const at = url.indexOf('#') + 12
    const swapped = url.slice(0, at) + (url[at] === 'A' ? 'B' : 'A') + url.slice(at + 1)
    const back = await decodeClaimReply(swapped)
    expect(back === null || !verifyReply(SECRET, back)).toBe(true)
  })

  it('finds the reply in a pasted message', () => {
    const text = "Riya's picks for Toit ✅\nAdd them to the bill: https://settle.example/app/claims/in#abcDEF123_-xyzabcdef"
    expect(replyFragmentIn(text)).toBe('#abcDEF123_-xyzabcdef')
    expect(replyFragmentIn('j.eyJ2IjoxfQabcdefghij')).toBe('j.eyJ2IjoxfQabcdefghij')
    expect(replyFragmentIn('hello there')).toBeNull()
  })
})

describe('claimLinkFromRound', () => {
  const now = 1_790_000_000_000
  const friend = (id: string, name: string, extra: Partial<Friend> = {}): Friend => ({ id, name, color: 1, upiId: null, phone: null, createdAt: now, lastUsedAt: now, ...extra })
  const friendsById: Record<string, Friend> = {
    [ME_ID]: friend(ME_ID, 'Ayush', { phone: '9876543210' }),
    riya: friend('riya', 'Riya'),
    sam: friend('sam', 'Sam'),
  }
  const profile = { name: 'Ayush', upiId: 'ayush@okicici' } as Profile
  const expense = {
    id: 'e1',
    kind: 'bill',
    title: 'Toit Brewpub',
    currency: 'INR',
    total: 276600,
    date: '2026-10-18',
    payerId: ME_ID,
    bill: {
      meta: {},
      items: ITEMS.map((it, i) => ({ id: `i${i}`, name: it.n, amount: it.a, quantity: it.q ?? 1 })),
      assignments: { i5: { riya: 1, sam: 1 } },
      warnings: [],
    },
  } as unknown as Expense
  const round: ClaimRound = {
    id: 'q7Lr2xVb9K',
    secret: SECRET,
    expenseId: 'e1',
    itemIds: ITEMS.map((_, i) => `i${i}`),
    itemsHash: 'e2738144e47b',
    peopleIds: [ME_ID, 'riya', 'sam'],
    fixedItemIds: ['i5'],
    ownPicks: [],
    replies: [],
    decisions: {},
    createdAt: now,
    updatedAt: now,
    appliedAt: null,
  }

  it('builds the link from the bill', () => {
    const payload = claimLinkFromRound(round, expense, friendsById, profile)
    expect(payload).toMatchObject({
      r: 'q7Lr2xVb9K',
      s: SECRET,
      t: 'Toit Brewpub',
      to: { n: 'Ayush', u: 'ayush@okicici', ph: '919876543210' },
      tot: 276600,
      p: ['Ayush', 'Riya', 'Sam'],
      fix: [[5, [[1, 1], [2, 1]]]],
      h: 'e2738144e47b',
    })
    expect(payload.it).toEqual(ITEMS)
    expect(currentItemsHash(round, expense)).toBe('e2738144e47b')
  })

  it('notices a changed bill', () => {
    const edited = { ...expense, total: 276500 } as Expense
    expect(currentItemsHash(round, edited)).not.toBe('e2738144e47b')
  })
})
