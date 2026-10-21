import { afterEach, describe, expect, it, vi } from 'vitest'
import { ME_ID, type Expense } from '../domain/types'
import { bytesToBase64Url } from './base64url'
import {
  decodePayLink,
  encodePayLink,
  PAY_LINK_LIMITS,
  payLinkDebtors,
  payLinkFromExpense,
  payLinkItemLines,
  payLinkProgress,
  payLinkUpiRequest,
  type PayLinkPayload,
} from './payLink'
import { FRIENDS, makeExpense, makeFriend, makeProfile } from './testing'

const ORIGIN = 'https://settle.example'

function payload(extra: Partial<PayLinkPayload> = {}): PayLinkPayload {
  return {
    v: 1,
    t: 'Dinner at Toit',
    cat: 'food',
    c: 'INR',
    d: '2026-10-18',
    to: { n: 'Ayush', u: 'ayush@okaxis' },
    tot: 276_600,
    p: [
      { n: 'Ayush', a: 69_150, paid: true },
      { n: 'Riya', a: 69_150, paid: true },
      { n: 'Sam', a: 69_150 },
      { n: 'Neha Sharma', a: 69_150 },
    ],
    pi: 0,
    ...extra,
  }
}

function fragment(url: string): string {
  return url.slice(url.indexOf('#') + 1)
}

/** Packs arbitrary JSON the way the encoder would, to test what the decoder accepts. */
async function packJson(value: unknown, compress = true): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  if (!compress) return `j.${bytesToBase64Url(bytes)}`
  const stream = new CompressionStream('deflate-raw')
  const writer = stream.writable.getWriter()
  void writer.write(bytes)
  void writer.close()
  return bytesToBase64Url(new Uint8Array(await new Response(stream.readable).arrayBuffer()))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('encodePayLink / decodePayLink', () => {
  it('round-trips a payload through a compressed link', async () => {
    const url = await encodePayLink(payload(), ORIGIN)
    expect(url.startsWith(`${ORIGIN}/pay#`)).toBe(true)
    const hash = fragment(url)
    expect(hash.startsWith('j.')).toBe(false)
    expect(hash).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(await decodePayLink(`#${hash}`)).toEqual(payload())
  })

  it('keeps links short: a typical four-person split stays well under 300 characters', async () => {
    const url = await encodePayLink(payload(), ORIGIN)
    expect(url.length).toBeLessThan(300)
  })

  it('is deterministic for the same payload', async () => {
    expect(await encodePayLink(payload(), ORIGIN)).toBe(await encodePayLink(payload(), ORIGIN))
  })

  it('round-trips itemized bills with weights, notes and every category', async () => {
    const items = [
      { n: 'Paneer Tikka', a: 42_000, who: [0, 2] },
      { n: 'Beer', a: 90_000, who: [1, 2, 3], w: [2, 1, 1] },
      { n: 'Water', a: 4_000, who: [0, 1, 2, 3] },
    ]
    for (const cat of ['food', 'rent', 'travel', 'other'] as const) {
      const p = payload({ cat, note: 'Sorry for the late reminder!', items })
      expect(await decodePayLink(await encodePayLink(p, ORIGIN))).toEqual(p)
    }
  })

  it('falls back to plain base64url JSON with a "j." prefix without CompressionStream', async () => {
    vi.stubGlobal('CompressionStream', undefined)
    const url = await encodePayLink(payload(), ORIGIN)
    expect(fragment(url).startsWith('j.')).toBe(true)
    expect(await decodePayLink(url)).toEqual(payload())
  })

  it('falls back to plain JSON when compression fails', async () => {
    vi.stubGlobal(
      'CompressionStream',
      class {
        constructor() {
          throw new TypeError('Unsupported compression format')
        }
      },
    )
    const url = await encodePayLink(payload(), ORIGIN)
    expect(fragment(url).startsWith('j.')).toBe(true)
    expect(await decodePayLink(url)).toEqual(payload())
  })

  it('picks plain JSON when it is shorter than the compressed form', async () => {
    // A "compressor" that only makes things bigger.
    vi.stubGlobal(
      'CompressionStream',
      class extends TransformStream<Uint8Array, Uint8Array> {
        constructor() {
          super({
            transform(chunk, controller) {
              controller.enqueue(chunk)
              controller.enqueue(new Uint8Array(64))
            },
          })
        }
      },
    )
    const url = await encodePayLink(payload(), ORIGIN)
    expect(fragment(url).startsWith('j.')).toBe(true)
    expect(await decodePayLink(url)).toEqual(payload())
  })

  it('decodes compressed links without DecompressionStream (built-in inflate)', async () => {
    const url = await encodePayLink(payload({ items: [{ n: 'Thali', a: 30_000, who: [0, 1] }] }), ORIGIN)
    vi.stubGlobal('DecompressionStream', undefined)
    expect(await decodePayLink(url)).toEqual(payload({ items: [{ n: 'Thali', a: 30_000, who: [0, 1] }] }))
  })

  it('decodes when DecompressionStream lacks deflate-raw (older Safari)', async () => {
    const url = await encodePayLink(payload(), ORIGIN)
    vi.stubGlobal(
      'DecompressionStream',
      class {
        constructor() {
          throw new TypeError('Unsupported compression format')
        }
      },
    )
    expect(await decodePayLink(url)).toEqual(payload())
  })

  it('uses the page origin by default and trims trailing slashes', async () => {
    expect((await encodePayLink(payload())).startsWith(`${window.location.origin}/pay#`)).toBe(true)
    expect((await encodePayLink(payload(), 'https://x.example///')).startsWith('https://x.example/pay#')).toBe(true)
    expect((await encodePayLink(payload(), '')).startsWith('/pay#')).toBe(true)
  })

  it('accepts the whole URL, a bare fragment, and chat-app mangling', async () => {
    const url = await encodePayLink(payload(), ORIGIN)
    const hash = fragment(url)
    for (const input of [url, `#${hash}`, hash, `  ${url}  `, `${url}.`, `${url})`, `${url}!!`, `${url}?utm_source=wa`, `${url} see you!`, `#${encodeURIComponent(hash)}`]) {
      expect(await decodePayLink(input)).toEqual(payload())
    }
  })

  it('never throws and returns null for garbage', async () => {
    const inputs: unknown[] = [
      '',
      '#',
      '#j.',
      'not a link',
      '#@@@@',
      '#Zg',
      '#j.Zg',
      '#j.!!!!',
      '#%E0%A4%A',
      `#${'A'.repeat(PAY_LINK_LIMITS.maxFragmentLength + 10)}`,
      `#${'A'.repeat(PAY_LINK_LIMITS.maxFragmentLength * 4)}`,
      null,
      undefined,
      42,
      {},
    ]
    for (const input of inputs) {
      await expect(decodePayLink(input as string)).resolves.toBeNull()
    }
  })

  it('rejects JSON that is not a v1 payload', async () => {
    const good = payload()
    const bad: unknown[] = [
      [],
      'hello',
      { ...good, v: 2 },
      { ...good, c: 'rupees' },
      { ...good, tot: -5 },
      { ...good, tot: 1.5 },
      { ...good, p: 'Riya' },
      { ...good, p: [{ n: 'Riya', a: -1 }] },
      { ...good, p: Array.from({ length: PAY_LINK_LIMITS.people + 1 }, () => ({ n: 'X', a: 1 })) },
      { ...good, t: 'x'.repeat(PAY_LINK_LIMITS.title.units + 1) },
      { ...good, to: 'Riya' },
      { ...good, items: [{ n: 'Tea', a: 100, who: [-1] }] },
    ]
    for (const value of bad) {
      expect(await decodePayLink(await packJson(value))).toBeNull()
      expect(await decodePayLink(await packJson(value, false))).toBeNull()
    }
    expect(await decodePayLink(`j.${bytesToBase64Url(new TextEncoder().encode('{"v":1,'))}`)).toBeNull()
    expect(await decodePayLink(`j.${bytesToBase64Url(new Uint8Array([0xff, 0xfe, 0xfd]))}`)).toBeNull()
  })

  it('rejects anything over 16 KB once decoded (including zip bombs)', async () => {
    const huge = { ...payload(), t: 'Bomb', pad: 'a'.repeat(PAY_LINK_LIMITS.maxDecodedBytes) }
    const bomb = await packJson(huge)
    expect(bomb.length).toBeLessThan(1_000)
    expect(await decodePayLink(bomb)).toBeNull()
    vi.stubGlobal('DecompressionStream', undefined)
    expect(await decodePayLink(bomb)).toBeNull()
    expect(await decodePayLink(await packJson(huge, false))).toBeNull()
  })

  it('is lenient with fields that can be repaired, and ignores unknown keys', async () => {
    const decoded = await decodePayLink(
      await packJson({
        ...payload(),
        cat: 'spaceships',
        d: '18/10/2026',
        to: { n: '   ', u: 'not a upi id' },
        t: '‮toit‬  at   dinner ',
        p: [{ n: '', a: 100 }, { n: 'Sam\u0000', a: 200, paid: true }],
        pi: 7,
        future: { anything: true },
        items: [
          { n: '', a: 100, who: [1, 1, 5], w: [3, 3, 3] },
          { n: 'Ghost', a: 100, who: [] },
          { n: 'Tea', a: 50, who: [0, 1], w: [2] },
        ],
      }),
    )
    expect(decoded).toEqual({
      v: 1,
      t: 'toit at dinner',
      cat: 'other',
      c: 'INR',
      d: '',
      to: { n: 'Your friend', u: null },
      tot: 276_600,
      p: [
        { n: 'Person 1', a: 100 },
        { n: 'Sam', a: 200, paid: true },
      ],
      items: [
        { n: 'Item', a: 100, who: [1], w: [3] },
        { n: 'Tea', a: 50, who: [0, 1] },
      ],
    })
  })

  it('normalizes what it encodes, so the pay page sees exactly what was sent', async () => {
    const messy = payload({
      t: '  Dinner\n at   Toit  ',
      c: 'inr',
      to: { n: 'Ayush', u: '  Ayush@OkAxis ' },
      tot: 276_600.4,
      p: [{ n: ' Riya ', a: 100.6 }],
      pi: 3,
      note: '   ',
    })
    const decoded = await decodePayLink(await encodePayLink(messy, ORIGIN))
    expect(decoded).toEqual({
      v: 1,
      t: 'Dinner at Toit',
      cat: 'food',
      c: 'INR',
      d: '2026-10-18',
      to: { n: 'Ayush', u: 'ayush@okaxis' },
      tot: 276_600,
      p: [{ n: 'Riya', a: 101 }],
    })
  })

  it('caps titles, names and notes by characters without splitting emoji', async () => {
    const decoded = await decodePayLink(
      await encodePayLink(
        payload({
          t: '🍕'.repeat(100),
          p: [{ n: '👩‍👩‍👧‍👦'.repeat(30), a: 1 }],
          note: 'n'.repeat(500),
        }),
        ORIGIN,
      ),
    )
    expect(Array.from(decoded?.t ?? '')).toHaveLength(PAY_LINK_LIMITS.title.graphemes)
    expect(decoded?.p[0]?.n.length).toBeLessThanOrEqual(PAY_LINK_LIMITS.name.units)
    expect(decoded?.p[0]?.n.startsWith('👩‍👩‍👧‍👦')).toBe(true)
    expect(decoded?.p[0]?.n).not.toMatch(/[\uD800-\uDBFF]$/)
    expect(decoded?.note).toHaveLength(PAY_LINK_LIMITS.note.graphemes)
  })

  it('drops items (then the note) rather than exceed the size cap, so every link opens', async () => {
    // One user-perceived character, three UTF-16 units, nine UTF-8 bytes: the worst case per cap.
    const heavy = 'ङ़ं'
    const wide = heavy.repeat(PAY_LINK_LIMITS.name.units)
    const people = Array.from({ length: PAY_LINK_LIMITS.people }, (_, i) => ({ n: `${i}${wide}`, a: 99_999_999 }))
    const items = Array.from({ length: PAY_LINK_LIMITS.items }, (_, i) => ({
      n: `${i}${heavy.repeat(90)}`,
      a: 99_999_999,
      who: people.map((_, k) => k),
      w: people.map(() => 99),
    }))
    const big = payload({ t: heavy.repeat(200), to: { n: wide, u: `${'x'.repeat(250)}@bank` }, p: people, items, note: heavy.repeat(400), pi: 0 })
    const url = await encodePayLink(big, ORIGIN)
    const decoded = await decodePayLink(url)
    expect(decoded).not.toBeNull()
    expect(decoded?.items).toBeUndefined()
    expect(decoded?.p).toHaveLength(PAY_LINK_LIMITS.people)

    const fewer = payload({ p: people.slice(0, 8), items: items.slice(0, 5) })
    const kept = await decodePayLink(await encodePayLink(fewer, ORIGIN))
    expect(kept?.items).toHaveLength(5)
  })

  it('round-trips randomized payloads (seeded)', async () => {
    let s = 12345
    const rand = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0
      return s / 2 ** 32
    }
    const names = ['Riya', 'Sam', 'Neha', 'José', 'Zoë', 'Ankit 😎', 'Priya', 'Dev']
    for (let round = 0; round < 25; round++) {
      const count = 1 + Math.floor(rand() * names.length)
      const p = names.slice(0, count).map((n) => (rand() < 0.3 ? { n, a: Math.floor(rand() * 1e6), paid: true as const } : { n, a: Math.floor(rand() * 1e6) }))
      const items =
        rand() < 0.5
          ? Array.from({ length: 1 + Math.floor(rand() * 10) }, (_, i) => ({ n: `Item ${i}`, a: Math.floor(rand() * 1e5), who: [0] }))
          : undefined
      const pi = rand() < 0.5 ? 0 : undefined
      const original = payload({ p, items, pi })
      const decoded = await decodePayLink(await encodePayLink(original, ORIGIN))
      if (pi === 0 && p[0]) p[0] = { ...p[0], paid: true }
      expect(decoded).toEqual(pi === undefined ? { ...original, pi: undefined } : { ...original, p })
    }
  })
})

describe('payLinkFromExpense', () => {
  const profile = makeProfile()

  it('builds the payload for an equal split I paid', () => {
    expect(payLinkFromExpense(makeExpense(), FRIENDS, profile)).toEqual({
      v: 1,
      t: 'Dinner at Toit',
      cat: 'food',
      c: 'INR',
      d: '2026-10-18',
      to: { n: 'Ayush', u: 'ayush@okaxis' },
      tot: 276_600,
      p: [
        { n: 'Ayush', a: 69_150, paid: true },
        { n: 'Riya', a: 69_150, paid: true },
        { n: 'Sam', a: 69_150 },
        { n: 'Neha Sharma', a: 69_150 },
      ],
      pi: 0,
    })
  })

  it("uses the payer's own UPI ID when a friend paid", () => {
    const link = payLinkFromExpense(makeExpense({ payerId: 'riya', paidBack: {} }), FRIENDS, profile)
    expect(link.to).toEqual({ n: 'Riya', u: 'riya@okicici' })
    expect(link.pi).toBe(1)
    expect(link.p.map((p) => p.paid === true)).toEqual([false, true, false, false])
  })

  it('leaves the UPI ID out when the payee has none (or an invalid one)', () => {
    expect(payLinkFromExpense(makeExpense({ payerId: 'sam' }), FRIENDS, profile).to).toEqual({ n: 'Sam', u: null })
    const badMe = makeProfile({ upiId: 'nope' })
    expect(payLinkFromExpense(makeExpense(), FRIENDS, badMe).to.u).toBeNull()
    const friends = { ...FRIENDS, [ME_ID]: makeFriend(ME_ID, 'You', { upiId: 'me@ybl' }) }
    expect(payLinkFromExpense(makeExpense(), friends, makeProfile({ upiId: null })).to.u).toBe('me@ybl')
  })

  it('never calls the owner "You" or "Me" in a link', () => {
    for (const name of ['You', 'me', '  ', '']) {
      const link = payLinkFromExpense(makeExpense(), FRIENDS, makeProfile({ name }))
      expect(link.to.n).toBe('Your friend')
      expect(link.p[0]?.n).toBe('Your friend')
    }
    const friends = { ...FRIENDS, [ME_ID]: makeFriend(ME_ID, 'Ayush K') }
    expect(payLinkFromExpense(makeExpense(), friends, makeProfile({ name: 'You' })).to.n).toBe('Ayush K')
  })

  it('names people who are no longer in the friends list', () => {
    const link = payLinkFromExpense(makeExpense({ participants: [{ friendId: ME_ID, input: null }, { friendId: 'gone', input: null }] }), FRIENDS, profile)
    expect(link.p.map((p) => p.n)).toEqual(['Ayush', 'Person 2'])
  })

  it('handles a payer who is not part of the split', () => {
    const e = makeExpense({
      payerId: 'riya',
      participants: [{ friendId: 'sam', input: null }, { friendId: 'neha', input: null }],
      shares: { sam: 138_300, neha: 138_300 },
      paidBack: {},
    })
    const link = payLinkFromExpense(e, FRIENDS, profile)
    expect(link.pi).toBeUndefined()
    expect(link.to.n).toBe('Riya')
    expect(payLinkDebtors(link).map((d) => d.name)).toEqual(['Sam', 'Neha Sharma'])
  })

  it('carries the note and drops duplicate participants', () => {
    const e = makeExpense({
      note: 'Paid at the counter',
      participants: [ME_ID, 'riya', 'riya'].map((friendId) => ({ friendId, input: null })),
      shares: { [ME_ID]: 138_300, riya: 138_300 },
    })
    const link = payLinkFromExpense(e, FRIENDS, profile)
    expect(link.note).toBe('Paid at the counter')
    expect(link.p).toHaveLength(2)
  })

  it('includes bill items with who/weights; unticked items go to everyone', () => {
    const e = makeExpense({
      kind: 'bill',
      mode: 'items',
      bill: {
        meta: { merchant: 'Toit', date: null, subtotal: null, tax: null, serviceCharge: null, discount: null, tip: null, total: null },
        items: [
          { id: 'i1', name: 'Pizza', quantity: 1, amount: 60_000 },
          { id: 'i2', name: 'Beer', quantity: 3, amount: 90_000 },
          { id: 'i3', name: 'Water', quantity: 1, amount: 5_000 },
        ],
        assignments: { i1: { [ME_ID]: 1, sam: 1 }, i2: { riya: 2, neha: 1, stranger: 4, sam: 0 }, i3: {} },
        warnings: [],
      },
    })
    const link = payLinkFromExpense(e, FRIENDS, profile)
    expect(link.items).toEqual([
      { n: 'Pizza', a: 60_000, who: [0, 2] },
      { n: 'Beer', a: 90_000, who: [1, 3], w: [2, 1] },
      { n: 'Water', a: 5_000, who: [0, 1, 2, 3] },
    ])
  })

  it('omits items for plain splits and for bills with more than 40 lines', () => {
    expect(payLinkFromExpense(makeExpense(), FRIENDS, profile).items).toBeUndefined()
    const items = Array.from({ length: 41 }, (_, i) => ({ id: `i${i}`, name: `Line ${i}`, quantity: 1, amount: 100 }))
    const e = makeExpense({
      kind: 'bill',
      mode: 'items',
      bill: { meta: { merchant: null, date: null, subtotal: null, tax: null, serviceCharge: null, discount: null, tip: null, total: null }, items, assignments: {}, warnings: [] },
    })
    expect(payLinkFromExpense(e, FRIENDS, profile).items).toBeUndefined()
  })

  it('keeps the payer and the people who still owe when a split is too big for one link', () => {
    const ids = Array.from({ length: 70 }, (_, i) => `f${i}`)
    const friends = Object.fromEntries(ids.map((id) => [id, makeFriend(id, id.toUpperCase())]))
    const paidBack: Expense['paidBack'] = Object.fromEntries(ids.slice(0, 20).map((id) => [id, 1]))
    const e = makeExpense({
      payerId: 'f69',
      participants: ids.map((friendId) => ({ friendId, input: null })),
      shares: Object.fromEntries(ids.map((id) => [id, 100])),
      paidBack,
    })
    const link = payLinkFromExpense(e, friends, profile)
    expect(link.p).toHaveLength(PAY_LINK_LIMITS.people)
    const names = link.p.map((p) => p.n)
    expect(names).toContain('F69')
    for (const id of ids.slice(20)) expect(names).toContain(id.toUpperCase())
    expect(link.p[link.pi ?? -1]?.n).toBe('F69')
    expect(names).toEqual([...names].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))))
  })

  it('produces links that survive the round trip', async () => {
    const link = payLinkFromExpense(makeExpense({ payerId: 'riya' }), FRIENDS, profile)
    expect(await decodePayLink(await encodePayLink(link, ORIGIN))).toEqual(link)
  })
})

describe('reading a payload', () => {
  it('lists debtors without the payee', () => {
    expect(payLinkDebtors(payload())).toEqual([
      { index: 1, name: 'Riya', amount: 69_150, paid: true },
      { index: 2, name: 'Sam', amount: 69_150, paid: false },
      { index: 3, name: 'Neha Sharma', amount: 69_150, paid: false },
    ])
    expect(payLinkDebtors(payload({ pi: undefined }))).toHaveLength(4)
  })

  it('totals what is collected and outstanding, skipping people who owe nothing', () => {
    expect(payLinkProgress(payload())).toEqual({ collected: 69_150, outstanding: 138_300, paidCount: 1, peopleCount: 3 })
    const zero = payload({ p: [{ n: 'A', a: 100, paid: true }, { n: 'B', a: 0 }, { n: 'C', a: 50 }], pi: 0 })
    expect(payLinkProgress(zero)).toEqual({ collected: 0, outstanding: 50, paidCount: 0, peopleCount: 1 })
  })

  it("gives each person's exact item lines, adding up to every item's price", () => {
    const p = payload({
      items: [
        { n: 'Beer', a: 1_000, who: [1, 2, 3], w: [2, 1, 1] },
        { n: 'Cake', a: 1_000, who: [0, 1, 2] },
        { n: 'Tea', a: 500, who: [3] },
      ],
    })
    expect(payLinkItemLines(p, 1)).toEqual([
      { name: 'Beer', amount: 500, shares: 2, totalShares: 4, sharedWith: 3 },
      { name: 'Cake', amount: 333, shares: 1, totalShares: 3, sharedWith: 3 },
    ])
    expect(payLinkItemLines(p, 3)).toEqual([
      { name: 'Beer', amount: 250, shares: 1, totalShares: 4, sharedWith: 3 },
      { name: 'Tea', amount: 500, shares: 1, totalShares: 1, sharedWith: 1 },
    ])
    const cake = [0, 1, 2].map((i) => payLinkItemLines(p, i).find((l) => l.name === 'Cake')?.amount ?? 0)
    expect(cake.reduce((a, b) => a + b, 0)).toBe(1_000)
    expect(payLinkItemLines(payload(), 1)).toEqual([])
  })
})

describe('payLinkUpiRequest', () => {
  it("builds each friend's UPI payment: payee, their exact share, the title as the note", () => {
    const request = payLinkUpiRequest(payload(), 2)
    expect(request).toEqual({ uri: expect.stringMatching(/^upi:\/\/pay\?/), vpa: 'ayush@okaxis', amount: 69_150 })
    const params = new URLSearchParams(request?.uri.slice('upi://pay?'.length))
    expect(Object.fromEntries(params)).toEqual({ pa: 'ayush@okaxis', pn: 'Ayush', am: '691.50', cu: 'INR', tn: 'Dinner at Toit' })
    // Marked as paid still gets a request (the page shows them as paid).
    expect(payLinkUpiRequest(payload(), 1)?.amount).toBe(69_150)
  })

  it("returns null when UPI can't take it", () => {
    expect(payLinkUpiRequest(payload(), 0)).toBeNull() // the payee
    expect(payLinkUpiRequest(payload(), 9)).toBeNull() // nobody there
    expect(payLinkUpiRequest(payload({ to: { n: 'Ayush', u: null } }), 2)).toBeNull()
    expect(payLinkUpiRequest(payload({ to: { n: 'Ayush', u: 'not-upi' } }), 2)).toBeNull()
    expect(payLinkUpiRequest(payload({ c: 'USD' }), 2)).toBeNull()
    expect(payLinkUpiRequest(payload({ p: [{ n: 'A', a: 100, paid: true }, { n: 'B', a: 0 }] }), 1)).toBeNull()
  })

  it('works for a payee who is not part of the split', () => {
    expect(payLinkUpiRequest(payload({ pi: undefined }), 0)?.amount).toBe(69_150)
  })
})
