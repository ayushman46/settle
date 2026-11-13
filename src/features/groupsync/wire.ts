/**
 * A shared group as it travels between phones: the group, its members, expenses and recorded
 * payments, each with a version, plus what was deleted. Two copies merge into one whatever the
 * order (newest version of each thing wins; a deletion beats anything older), so every phone that
 * has seen the same copies shows the same group — without a server deciding anything.
 *
 * People are named by a member id that is the same on every phone (each phone maps it to its own
 * "you" and its own friends). Everything here is plain data; anything read from a link or the
 * server goes through `parseWire` first.
 */
import { CATEGORY_IDS, type CategoryId } from '../../../shared/categories'
import type { GroupKind } from '../../domain/types'

export const WIRE_VERSION = 1
export const MAX_WIRE_MEMBERS = 100
export const MAX_WIRE_EXPENSES = 3000
export const MAX_WIRE_SETTLEMENTS = 2000
export const MAX_WIRE_GONE = 6000
const MAX_AMOUNT = 100_000_000_000
const KINDS: readonly GroupKind[] = ['trip', 'home', 'couple', 'event', 'other']
const MODES = ['equal', 'exact', 'percent', 'shares', 'had'] as const
const METHODS = ['upi', 'cash', 'other'] as const
const ID = /^[A-Za-z0-9_-]{4,64}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

export type WireMode = (typeof MODES)[number]

export interface WireMember {
  /** Member id, the same on every phone. */
  i: string
  /** Name. */
  n: string
  /** UPI ID, or null. */
  u: string | null
  /** Avatar colour. */
  c: number
  /** Version (epoch ms of the last change to the name or UPI ID). */
  v: number
  /** When this person joined on their own phone (0: not yet — only a name on the list). */
  j: number
}

export interface WireExpense {
  i: string
  /** Title. */
  t: string
  /** Total, minor units. */
  a: number
  /** YYYY-MM-DD. */
  d: string
  /** Who paid (member id). */
  p: string
  /** What each person owes of it (member id → minor units); adds up to the total. */
  s: Record<string, number>
  g: CategoryId
  k: 'split' | 'loan'
  m: WireMode
  /** What was typed for each person in that mode (member id → input), so it can be edited the same way. */
  q: Record<string, number | null>
  /** Note. */
  o: string | null
  /** Created (epoch ms). */
  c: number
  /** Version (epoch ms). */
  u: number
  /** Who added it (member id), or null. */
  b: string | null
}

export interface WireSettlement {
  i: string
  /** From → to (member ids). */
  f: string
  t: string
  a: number
  d: string
  m: (typeof METHODS)[number]
  c: number
  u: number
}

export interface WireGroup {
  v: typeof WIRE_VERSION
  /** The shared group's id. */
  id: string
  n: string
  e: string
  k: GroupKind
  /** Currency. */
  c: string
  /** Version of the name, emoji and kind. */
  u: number
  m: WireMember[]
  x: WireExpense[]
  s: WireSettlement[]
  /** Deleted things (expense, payment or member id → when). */
  z: Record<string, number>
}

/* ------------------------------------------------------------------ reading untrusted copies */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max: number): string | null => (typeof v === 'string' ? Array.from(v.replace(/\p{Cc}/gu, ' ').trim()).slice(0, max).join('') : null)
const stamp = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(Math.trunc(v), 8_640_000_000_000_000) : 0)
const amount = (v: unknown): number | null => (typeof v === 'number' && Number.isSafeInteger(v) && v > 0 && v <= MAX_AMOUNT ? v : null)
const id = (v: unknown): string | null => (typeof v === 'string' && ID.test(v) ? v : null)

function parseMember(raw: unknown): WireMember | null {
  if (!isObj(raw)) return null
  const i = id(raw.i)
  const n = str(raw.n, 40)
  if (!i || !n) return null
  const u = typeof raw.u === 'string' && /^[a-z0-9._-]{2,256}@[a-z][a-z0-9.-]{1,64}$/.test(raw.u) ? raw.u : null
  const c = typeof raw.c === 'number' && Number.isInteger(raw.c) && raw.c >= 0 && raw.c < 64 ? raw.c : 0
  return { i, n, u, c, v: stamp(raw.v), j: stamp(raw.j) }
}

function parseExpense(raw: unknown, members: ReadonlySet<string>): WireExpense | null {
  if (!isObj(raw)) return null
  const i = id(raw.i)
  const a = amount(raw.a)
  const p = id(raw.p)
  if (!i || a === null || !p || !members.has(p) || typeof raw.d !== 'string' || !DATE.test(raw.d) || !isObj(raw.s)) return null
  const s: Record<string, number> = {}
  let sum = 0
  for (const [who, share] of Object.entries(raw.s)) {
    if (!members.has(who) || typeof share !== 'number' || !Number.isSafeInteger(share) || share < 0 || share > a) return null
    s[who] = share
    sum += share
  }
  if (sum !== a || Object.keys(s).length === 0) return null
  const m = MODES.includes(raw.m as WireMode) ? (raw.m as WireMode) : 'exact'
  const q: Record<string, number | null> = {}
  if (isObj(raw.q)) {
    for (const who of Object.keys(s)) {
      const input = raw.q[who]
      q[who] = typeof input === 'number' && Number.isSafeInteger(input) && input >= 0 && input <= MAX_AMOUNT ? input : null
    }
  }
  // Without the inputs a mode can't be re-run: exact amounts (the shares themselves) always can.
  const usable = m === 'equal' || Object.keys(s).every((who) => q[who] !== null && q[who] !== undefined)
  const b = id(raw.b)
  return {
    i,
    t: str(raw.t, 80) || '',
    a,
    d: raw.d,
    p,
    s,
    g: CATEGORY_IDS.includes(raw.g as CategoryId) ? (raw.g as CategoryId) : 'other',
    k: raw.k === 'loan' ? 'loan' : 'split',
    m: usable ? m : 'exact',
    q: usable ? q : { ...s },
    o: str(raw.o, 500) || null,
    c: stamp(raw.c),
    u: stamp(raw.u),
    b: b && members.has(b) ? b : null,
  }
}

function parseSettlement(raw: unknown, members: ReadonlySet<string>): WireSettlement | null {
  if (!isObj(raw)) return null
  const i = id(raw.i)
  const f = id(raw.f)
  const t = id(raw.t)
  const a = amount(raw.a)
  if (!i || !f || !t || f === t || a === null || !members.has(f) || !members.has(t) || typeof raw.d !== 'string' || !DATE.test(raw.d)) return null
  return { i, f, t, a, d: raw.d, m: METHODS.includes(raw.m as 'upi') ? (raw.m as 'upi') : 'other', c: stamp(raw.c), u: stamp(raw.u) || stamp(raw.c) }
}

/** A copy read from a link or the server, with anything malformed dropped; null when it isn't a group at all. */
export function parseWire(raw: unknown): WireGroup | null {
  if (!isObj(raw) || raw.v !== WIRE_VERSION) return null
  const gid = id(raw.id)
  const n = str(raw.n, 40)
  const c = typeof raw.c === 'string' && /^[A-Z]{3}$/.test(raw.c) ? raw.c : null
  if (!gid || !n || !c || !Array.isArray(raw.m)) return null
  const m: WireMember[] = []
  const seen = new Set<string>()
  for (const entry of raw.m.slice(0, MAX_WIRE_MEMBERS)) {
    const member = parseMember(entry)
    if (member && !seen.has(member.i)) {
      seen.add(member.i)
      m.push(member)
    }
  }
  if (m.length === 0) return null
  const x: WireExpense[] = []
  const ids = new Set<string>()
  for (const entry of Array.isArray(raw.x) ? raw.x.slice(0, MAX_WIRE_EXPENSES) : []) {
    const expense = parseExpense(entry, seen)
    if (expense && !ids.has(expense.i)) {
      ids.add(expense.i)
      x.push(expense)
    }
  }
  const s: WireSettlement[] = []
  for (const entry of Array.isArray(raw.s) ? raw.s.slice(0, MAX_WIRE_SETTLEMENTS) : []) {
    const settlement = parseSettlement(entry, seen)
    if (settlement && !ids.has(settlement.i)) {
      ids.add(settlement.i)
      s.push(settlement)
    }
  }
  const z: Record<string, number> = {}
  if (isObj(raw.z)) {
    for (const [key, at] of Object.entries(raw.z).slice(0, MAX_WIRE_GONE)) if (ID.test(key) && stamp(at) > 0) z[key] = stamp(at)
  }
  const e = str(raw.e, 16) || '👥'
  return normalize({ v: WIRE_VERSION, id: gid, n, e, k: KINDS.includes(raw.k as GroupKind) ? (raw.k as GroupKind) : 'other', c, u: stamp(raw.u), m, x, s, z })
}

/* ------------------------------------------------------------------ one form for equal copies */

const byId = <T extends { i: string }>(a: T, b: T): number => (a.i < b.i ? -1 : a.i > b.i ? 1 : 0)

function sortKeys<T>(record: Record<string, T>): Record<string, T> {
  const out: Record<string, T> = {}
  for (const key of Object.keys(record).sort()) out[key] = record[key] as T
  return out
}

/**
 * The one form of a copy: lists by id, keys in order, deleted things left out, and nobody removed
 * who still appears in an expense or a payment. Two copies that say the same thing are equal as text.
 */
export function normalize(w: WireGroup): WireGroup {
  const x = w.x.filter((e) => !((w.z[e.i] ?? 0) >= e.u)).sort(byId)
  const s = w.s.filter((p) => !((w.z[p.i] ?? 0) >= p.u)).sort(byId)
  const used = new Set<string>()
  for (const e of x) {
    used.add(e.p)
    for (const who of Object.keys(e.s)) used.add(who)
  }
  for (const p of s) {
    used.add(p.f)
    used.add(p.t)
  }
  const m = w.m.filter((member) => used.has(member.i) || !((w.z[member.i] ?? 0) >= member.v)).sort(byId)
  // A deletion that lost to a newer version (or to someone still owed money) is forgotten.
  const live = new Set([...x.map((e) => e.i), ...s.map((p) => p.i), ...m.map((member) => member.i)])
  const z: Record<string, number> = {}
  for (const key of Object.keys(w.z).sort()) if (!live.has(key)) z[key] = w.z[key] as number
  return {
    v: WIRE_VERSION,
    id: w.id,
    n: w.n,
    e: w.e,
    k: w.k,
    c: w.c,
    u: w.u,
    m,
    x: x.map((e) => ({ ...e, s: sortKeys(e.s), q: sortKeys(e.q) })),
    s,
    z,
  }
}

/** A copy as text: equal copies give equal text (what's compared, sent and stored). */
export function canonical(w: WireGroup): string {
  return JSON.stringify(normalize(w))
}

/* ------------------------------------------------------------------ merging */

/** The newer of two versions of one thing; the same version twice is settled by their text, so every phone picks the same one. */
function newer<T extends object>(a: T, b: T, version: (item: T) => number): T {
  const va = version(a)
  const vb = version(b)
  if (va !== vb) return va > vb ? a : b
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b
}

function mergeList<T extends { i: string }>(a: readonly T[], b: readonly T[], version: (item: T) => number): T[] {
  const out = new Map<string, T>()
  for (const item of a) out.set(item.i, item)
  for (const item of b) {
    const mine = out.get(item.i)
    out.set(item.i, mine ? newer(mine, item, version) : item)
  }
  return [...out.values()]
}

/**
 * Two copies of the same group as one: the newest name, each member, expense and payment at its
 * newest version, and every deletion. The order doesn't matter and merging twice changes nothing.
 * Copies of different groups aren't merged: the first is returned.
 */
export function mergeWire(a: WireGroup, b: WireGroup): WireGroup {
  if (a.id !== b.id) return normalize(a)
  const meta = newer({ n: a.n, e: a.e, k: a.k, u: a.u }, { n: b.n, e: b.e, k: b.k, u: b.u }, (g) => g.u)
  const z: Record<string, number> = { ...a.z }
  for (const [key, at] of Object.entries(b.z)) z[key] = Math.max(z[key] ?? 0, at)
  const members = mergeList(a.m, b.m, (member) => member.v).map((member) => {
    // Once someone has joined on their own phone, they stay joined (from the first time).
    const joined = [a.m.find((o) => o.i === member.i)?.j ?? 0, b.m.find((o) => o.i === member.i)?.j ?? 0].filter((j) => j > 0)
    return { ...member, j: joined.length > 0 ? Math.min(...joined) : 0 }
  })
  return normalize({
    v: WIRE_VERSION,
    id: a.id,
    n: meta.n,
    e: meta.e,
    k: meta.k,
    c: a.c <= b.c ? a.c : b.c,
    u: meta.u,
    m: members,
    x: mergeList(a.x, b.x, (e) => e.u),
    s: mergeList(a.s, b.s, (p) => p.u),
    z,
  })
}

/** What a newer copy adds to an older one, for "2 new expenses": counts of what's new, changed and gone. */
export function wireDiff(before: WireGroup | null, after: WireGroup): { added: number; changed: number; removed: number; payments: number; joined: string[] } {
  const old = new Map((before?.x ?? []).map((e) => [e.i, e.u]))
  let added = 0
  let changed = 0
  for (const e of after.x) {
    const u = old.get(e.i)
    if (u === undefined) added++
    else if (u !== e.u) changed++
  }
  const now = new Set(after.x.map((e) => e.i))
  const removed = (before?.x ?? []).filter((e) => !now.has(e.i)).length
  const paid = new Set((before?.s ?? []).map((p) => p.i))
  const payments = after.s.filter((p) => !paid.has(p.i)).length
  const wasJoined = new Set((before?.m ?? []).filter((member) => member.j > 0).map((member) => member.i))
  const joined = after.m.filter((member) => member.j > 0 && !wasJoined.has(member.i)).map((member) => member.n)
  return { added, changed, removed, payments, joined }
}
