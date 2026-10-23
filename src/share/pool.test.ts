import { describe, expect, it } from 'vitest'
import { ME_ID, type Contribution, type Friend, type Pool, type Profile } from '../domain/types'
import { defaultProfile } from '../data/schemas'
import {
  decodePoolLink,
  decodePoolReply,
  encodePoolLink,
  encodePoolReply,
  matchByName,
  normalizePoolLink,
  poolLinkFromPool,
  poolLinkGoal,
  poolLinkPeopleLeft,
  poolReplyCanonical,
  poolReplyId,
  signPoolReply,
  verifyPoolReply,
  type PoolLinkPayload,
} from './pool'

const SECRET = 'q83vEjRWZq7XJ8sQ2b5r0w'
const ORIGIN = 'https://settle.example'

function friend(id: string, name: string, extra: Partial<Friend> = {}): Friend {
  return { id, name, color: 1, upiId: null, phone: null, createdAt: 1, lastUsedAt: 1, ...extra }
}

const FRIENDS: Record<string, Friend> = {
  [ME_ID]: friend(ME_ID, 'Ayush', { phone: '98765 43210' }),
  sam: friend('sam', 'Sam'),
  kabir: friend('kabir', 'Kabir'),
  neha: friend('neha', 'Neha'),
}
const PROFILE: Profile = { ...defaultProfile(), name: 'Ayush', upiId: 'ayush@okicici', currency: 'INR' }

let seq = 0
function chip(friendId: string | null, amount: number, name: string): Contribution {
  seq++
  return { id: `c${seq}`, friendId, name, amount, date: '2026-10-21', method: 'upi', via: 'tick', replyId: null, createdAt: seq }
}

function farewell(partial: Partial<Pool> = {}): Pool {
  return {
    id: 'pool-1',
    title: "Riya's farewell",
    occasion: 'farewell',
    emoji: '👋',
    currency: 'INR',
    mode: 'fixed',
    perPerson: 50000,
    target: null,
    memberIds: ['sam', 'kabir', 'neha'],
    expectedCount: null,
    deadline: '2026-10-30',
    note: 'A Kindle for Riya 🎁',
    showAmounts: true,
    contributions: [],
    secret: SECRET,
    createdAt: 1_760_000_000_000,
    updatedAt: 1_761_200_000_000,
    closedAt: null,
    ...partial,
  }
}

describe('collection links', () => {
  it('round-trips a pool link exactly', async () => {
    const payload = poolLinkFromPool(farewell({ contributions: [chip('kabir', 50000, 'Kabir')] }), FRIENDS, PROFILE)
    expect(payload).toEqual({
      v: 1,
      k: 'pool',
      id: 'pool-1',
      s: SECRET,
      t: "Riya's farewell",
      e: '👋',
      o: 'farewell',
      c: 'INR',
      to: { n: 'Ayush', u: 'ayush@okicici', ph: '919876543210' },
      m: 'fixed',
      pp: 50000,
      dl: '2026-10-30',
      no: 'A Kindle for Riya 🎁',
      // Unpaid first, then who's in.
      p: [{ n: 'Sam' }, { n: 'Neha' }, { n: 'Kabir', ok: 1, a: 50000 }],
      ex: 3,
      col: 50000,
      cnt: 1,
      at: 1_761_200_000,
    })
    const url = await encodePoolLink(payload, ORIGIN)
    expect(url.startsWith(`${ORIGIN}/pool#`)).toBe(true)
    expect(await decodePoolLink(url)).toEqual(payload)
    expect(poolLinkGoal(payload)).toBe(150000)
    expect(poolLinkPeopleLeft(payload)).toBe(2)
  })

  it('hides amounts unless the organiser shows them; guests are listed by name', async () => {
    const pool = farewell({
      mode: 'target',
      perPerson: null,
      target: 1000000,
      showAmounts: false,
      memberIds: [],
      expectedCount: 15,
      contributions: [chip(null, 30000, 'Priya from HR'), chip(null, 5000, 'priya from hr ')],
    })
    const payload = poolLinkFromPool(pool, FRIENDS, PROFILE)
    expect(payload.p).toEqual([{ n: 'Priya from HR', ok: 1 }])
    expect(payload.m).toBe('target')
    expect(payload.tg).toBe(1000000)
    expect(payload.pp).toBeUndefined()
    expect(payload.ex).toBe(15)
    expect(payload.col).toBe(35000)
    expect(poolLinkPeopleLeft(payload)).toBe(14)
    expect(await decodePoolLink(await encodePoolLink(payload, ORIGIN))).toEqual(payload)
  })

  it('normalizes: names ≤ 24 characters, amounts clamped, bad UPI dropped, fixed without amount → target', () => {
    const raw = {
      v: 1,
      k: 'pool',
      id: 'x',
      s: SECRET,
      t: '  Goa‮   trip  ',
      e: '',
      o: 'nope',
      c: 'inr',
      to: { n: '', u: 'not a upi id' },
      m: 'fixed',
      pp: -5,
      tg: 12.4,
      p: [{ n: 'A'.repeat(40), a: -1 }, { n: '   ' }],
      col: 1e20,
      cnt: -3,
      at: 12.6,
    } as unknown as PoolLinkPayload
    const n = normalizePoolLink(raw)
    expect(n.t).toBe('Goa trip')
    expect(n.e).toBe('✨')
    expect(n.o).toBe('other')
    expect(n.c).toBe('INR')
    expect(n.to).toEqual({ n: 'Your friend', u: null })
    expect(n.m).toBe('target')
    expect(n.pp).toBeUndefined()
    expect(n.tg).toBe(12)
    expect(n.p).toEqual([{ n: 'A'.repeat(24) }, { n: 'Person 2' }])
    expect(n.col).toBe(1e12)
    expect(n.cnt).toBe(0)
    expect(n.at).toBe(13)
    expect(normalizePoolLink(n)).toEqual(n)
  })

  it('caps the names at 60 (+ more 240) for 300 people', async () => {
    const ids = Array.from({ length: 300 }, (_, i) => `f${i}`)
    const friends: Record<string, Friend> = { ...FRIENDS }
    for (const id of ids) friends[id] = friend(id, `Person ${id}`)
    const pool = farewell({ memberIds: ids.slice(0, 200), contributions: ids.slice(200).map((id) => chip(id, 50000, id)) })
    const payload = poolLinkFromPool(pool, friends, PROFILE)
    expect(payload.p).toHaveLength(60)
    expect(payload.more).toBe(240)
    expect(payload.p.every((p) => !p.ok)).toBe(true)
    const url = await encodePoolLink(payload, ORIGIN)
    expect(await decodePoolLink(url)).toEqual(payload)
  })

  it('returns null for garbled, truncated or foreign fragments', async () => {
    const url = await encodePoolLink(poolLinkFromPool(farewell(), FRIENDS, PROFILE), ORIGIN)
    expect(await decodePoolLink('')).toBeNull()
    expect(await decodePoolLink('#!!!')).toBeNull()
    expect(await decodePoolLink(url.slice(0, url.length - 20))).toBeNull()
    expect(await decodePoolLink('#j.e30')).toBeNull()
    // A reply is not a pool link.
    const reply = await encodePoolReply(signPoolReply(SECRET, { v: 1, k: 'chip', id: 'pool-1', w: 0, n: 'Sam', a: 50000, at: 1 }), ORIGIN)
    expect(await decodePoolLink(reply)).toBeNull()
  })
})

describe('signed replies', () => {
  const base = { v: 1 as const, k: 'chip' as const, id: 'pool-1', w: 0, n: 'Sam', a: 50000, at: 1_761_210_000 }

  it('round-trips and verifies; the MAC covers every field', async () => {
    const reply = signPoolReply(SECRET, base)
    expect(reply.m).toMatch(/^[A-Za-z0-9_-]{16}$/)
    expect(poolReplyCanonical(reply)).toBe('pool-1|0|Sam|50000|1761210000')
    const url = await encodePoolReply(reply, ORIGIN)
    expect(url.startsWith(`${ORIGIN}/app/pools/in#`)).toBe(true)
    const back = await decodePoolReply(`Chipped in ₹500 — Sam\nTick me off: ${url}`)
    expect(back).toEqual(reply)
    expect(verifyPoolReply(SECRET, reply)).toBe(true)
    expect(verifyPoolReply('AAAAAAAAAAAAAAAAAAAAAA', reply)).toBe(false)
    for (const tampered of [{ a: 5000 }, { n: 'Kabir' }, { w: 1 }, { w: null }, { at: 1 }, { id: 'pool-2' }]) {
      expect(verifyPoolReply(SECRET, { ...reply, ...tampered })).toBe(false)
    }
  })

  it('"not on the list" signs an empty index slot', () => {
    const reply = signPoolReply(SECRET, { ...base, w: null, n: '  Priya   from HR ' })
    expect(reply.n).toBe('Priya from HR')
    expect(poolReplyCanonical(reply)).toBe('pool-1||Priya from HR|50000|1761210000')
    expect(verifyPoolReply(SECRET, reply)).toBe(true)
  })

  it('reply id is stable and depends on the MAC', () => {
    const reply = signPoolReply(SECRET, base)
    expect(poolReplyId(reply)).toBe(poolReplyId(signPoolReply(SECRET, base)))
    expect(poolReplyId(reply)).toMatch(/^[A-Za-z0-9_-]{16}$/)
    expect(poolReplyId(reply)).not.toBe(poolReplyId(signPoolReply(SECRET, { ...base, a: 50001 })))
  })

  it('rejects malformed replies', async () => {
    const reply = signPoolReply(SECRET, base)
    for (const bad of [{ ...reply, a: 0 }, { ...reply, a: 1.5 }, { ...reply, w: 99 }, { ...reply, m: 'short' }, { ...reply, k: 'pool' }]) {
      const url = await encodePoolReply(bad as typeof reply, ORIGIN)
      expect(await decodePoolReply(url)).toBeNull()
    }
    expect(await decodePoolReply('#garbage')).toBeNull()
  })
})

describe('matchByName', () => {
  it('matches one person by name, ignoring case and accents', () => {
    const people = [{ name: 'Sam' }, { name: 'José' }, { name: 'Neha' }, { name: 'neha ' }]
    expect(matchByName('sam', people)).toEqual({ name: 'Sam' })
    expect(matchByName('jose', people)).toEqual({ name: 'José' })
    expect(matchByName('Neha', people)).toBeNull()
    expect(matchByName('', people)).toBeNull()
  })
})
