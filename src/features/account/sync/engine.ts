/**
 * Keeping the phone and the account's database in step, as plain functions (the runner does the
 * I/O). The phone's stores stay the app's working copy, so everything works offline; a "shadow"
 * remembers, per row, the version last agreed with the server (a hash) and when it was saved.
 *
 * - Push: anything whose hash differs from its shadow changed here — send it, stamped now; anything
 *   in the shadow but gone from the phone was deleted here — send a deletion.
 * - Pull: take the server's rows, except where this phone has its own unsent change (that change
 *   goes up next and, being newer, wins) or the row is the echo of this phone's own push.
 * - The first sync on a phone pulls first and lets the account win, so signing in on a new phone
 *   brings everything down instead of overwriting the account with an empty phone.
 */
import type { Expense, Friend, Group } from '../../../domain/types'

export type RowKind = 'friends' | 'groups' | 'expenses'

export interface ShadowEntry {
  /** Hash of the version last agreed with the server. */
  h: string
  /** Its updatedAt on the server. */
  t: number
}

export interface Shadow {
  /** The account this phone's data belongs to; null before the first sync. */
  owner: string | null
  /** Where the next pull starts. */
  cursor: number
  friends: Record<string, ShadowEntry>
  groups: Record<string, ShadowEntry>
  expenses: Record<string, ShadowEntry>
  stores: Record<string, ShadowEntry>
}

export function emptyShadow(): Shadow {
  return { owner: null, cursor: 0, friends: {}, groups: {}, expenses: {}, stores: {} }
}

export interface LocalData {
  friends: readonly Friend[]
  groups: readonly Group[]
  expenses: readonly Expense[]
  /** Every other store by key, as stored (`{ v, data }`); undefined when the phone has none. */
  stores: Readonly<Record<string, unknown>>
}

/** JSON with every object's keys sorted, so the same data always hashes the same. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? 'null' : canonical(v))).join(',')}]`
  const keys = Object.keys(value)
    .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
    .sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`
}

/** cyrb53: a fast 53-bit string hash, as 14 hex digits. */
export function hashText(text: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0')
}

export type Hasher = (value: unknown) => string
export const hashOf: Hasher = (value) => hashText(canonical(value))

/* ------------------------------------------------------------------ push */

export type Row = Record<string, unknown>

export interface PushPlan {
  payload: { friends: Row[]; groups: Row[]; expenses: Row[]; stores: Row[] }
  /** The shadow entries to record once the server has the payload (null: forget the row). */
  entries: Array<{ kind: RowKind | 'stores'; id: string; entry: ShadowEntry | null }>
}

const KINDS: readonly RowKind[] = ['friends', 'groups', 'expenses']

export function planPush(shadow: Shadow, local: LocalData, now: number, hash: Hasher = hashOf): PushPlan {
  const plan: PushPlan = { payload: { friends: [], groups: [], expenses: [], stores: [] }, entries: [] }
  for (const kind of KINDS) {
    const known = shadow[kind]
    const seen = new Set<string>()
    for (const item of local[kind] as ReadonlyArray<{ id: string }>) {
      seen.add(item.id)
      const h = hash(item)
      if (known[item.id]?.h === h) continue
      plan.payload[kind].push({ ...item, updatedAt: now, deleted: false })
      plan.entries.push({ kind, id: item.id, entry: { h, t: now } })
    }
    for (const id of Object.keys(known)) {
      if (seen.has(id)) continue
      plan.payload[kind].push({ id, updatedAt: now, deleted: true })
      plan.entries.push({ kind, id, entry: null })
    }
  }
  for (const [key, value] of Object.entries(local.stores)) {
    if (value === undefined) continue
    const h = hash(value)
    if (shadow.stores[key]?.h === h) continue
    plan.payload.stores.push({ key, data: value, updatedAt: now, deleted: false })
    plan.entries.push({ kind: 'stores', id: key, entry: { h, t: now } })
  }
  for (const key of Object.keys(shadow.stores)) {
    if (local.stores[key] !== undefined) continue
    plan.payload.stores.push({ key, data: null, updatedAt: now, deleted: true })
    plan.entries.push({ kind: 'stores', id: key, entry: null })
  }
  return plan
}

/** Splits a plan into batches the server accepts (by count and rough size). */
export function batches(plan: PushPlan, maxItems = 400, maxChars = 700_000): PushPlan[] {
  const out: PushPlan[] = []
  let current: PushPlan = { payload: { friends: [], groups: [], expenses: [], stores: [] }, entries: [] }
  let chars = 0
  const all: Array<{ kind: RowKind | 'stores'; row: Row; entry: PushPlan['entries'][number] }> = []
  const index = { friends: 0, groups: 0, expenses: 0, stores: 0 }
  for (const entry of plan.entries) {
    const row = plan.payload[entry.kind][index[entry.kind]++]!
    all.push({ kind: entry.kind, row, entry })
  }
  for (const { kind, row, entry } of all) {
    const size = JSON.stringify(row).length
    if (current.entries.length > 0 && (current.entries.length >= maxItems || chars + size > maxChars)) {
      out.push(current)
      current = { payload: { friends: [], groups: [], expenses: [], stores: [] }, entries: [] }
      chars = 0
    }
    current.payload[kind].push(row)
    current.entries.push(entry)
    chars += size
  }
  if (current.entries.length > 0) out.push(current)
  return out
}

export function recordPushed(shadow: Shadow, entries: PushPlan['entries']): Shadow {
  const next: Shadow = { ...shadow, friends: { ...shadow.friends }, groups: { ...shadow.groups }, expenses: { ...shadow.expenses }, stores: { ...shadow.stores } }
  for (const { kind, id, entry } of entries) {
    if (entry) next[kind][id] = entry
    else delete next[kind][id]
  }
  return next
}

/* ------------------------------------------------------------------ pull */

export interface Pulled {
  friends: Row[]
  groups: Row[]
  expenses: Row[]
  stores: Row[]
  cursor: number
  more: boolean
}

export interface Parsers {
  friend(value: unknown): Friend | null
  group(value: unknown): Group | null
  expense(value: unknown): Expense | null
}

export interface PullResult {
  shadow: Shadow
  /** Collections that changed (absent: leave as is). */
  friends?: Friend[]
  groups?: Group[]
  expenses?: Expense[]
  /** Stores to write (`null`: remove from the phone). */
  stores: Record<string, unknown>
}

/** A server row as the app's own record: sync bookkeeping removed, empty optional parts left out. */
export function fromRow(kind: RowKind, row: Row): Record<string, unknown> {
  const { rev: _rev, deleted: _deleted, ...rest } = row
  if (kind === 'friends') {
    const { updatedAt: _updatedAt, ...friend } = rest
    return friend
  }
  if (kind === 'expenses') {
    if (rest.partPaid === null) delete rest.partPaid
    if (rest.fx === null) delete rest.fx
  }
  return rest
}

/**
 * `accept`: which store keys this phone takes from the account (default: ones it already lists).
 */
export function planPull(
  shadow: Shadow,
  local: LocalData,
  pulled: Pulled,
  mode: 'normal' | 'serverWins',
  parse: Parsers,
  hash: Hasher = hashOf,
  accept: (key: string) => boolean = (key) => key in local.stores,
): PullResult {
  const next = recordPushed(shadow, [])
  const result: PullResult = { shadow: next, stores: {} }
  const parsers: Record<RowKind, (v: unknown) => { id: string } | null> = { friends: parse.friend, groups: parse.group, expenses: parse.expense }

  for (const kind of KINDS) {
    const rows = pulled[kind]
    if (rows.length === 0) continue
    const items = new Map((local[kind] as ReadonlyArray<{ id: string }>).map((item) => [item.id, item]))
    let changed = false
    for (const row of rows) {
      const id = row.id
      const t = row.updatedAt
      if (typeof id !== 'string' || typeof t !== 'number') continue
      const known = next[kind][id]
      const item = items.get(id)
      const dirty = item ? hash(item) !== known?.h : known !== undefined
      if (mode === 'normal' && (dirty || known?.t === t)) continue
      if (row.deleted === true) {
        if (item) {
          items.delete(id)
          changed = true
        }
        delete next[kind][id]
        continue
      }
      const parsed = parsers[kind](fromRow(kind, row))
      if (!parsed) continue
      items.set(id, parsed)
      next[kind][id] = { h: hash(parsed), t }
      changed = true
    }
    if (changed) (result as unknown as Record<RowKind, unknown[]>)[kind] = [...items.values()]
  }

  for (const row of pulled.stores) {
    const key = row.key
    const t = row.updatedAt
    if (typeof key !== 'string' || typeof t !== 'number' || !accept(key)) continue
    const value = local.stores[key]
    const known = next.stores[key]
    const dirty = value !== undefined ? hash(value) !== known?.h : known !== undefined
    if (mode === 'normal' && (dirty || known?.t === t)) continue
    if (row.deleted === true || row.data === null || row.data === undefined) {
      if (value !== undefined) result.stores[key] = null
      delete next.stores[key]
      continue
    }
    result.stores[key] = row.data
    next.stores[key] = { h: hash(row.data), t }
  }
  return result
}
