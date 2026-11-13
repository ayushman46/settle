/**
 * Between this phone's group and the copy that travels: `buildWire` writes the group as it stands
 * here (noticing what was added, edited or deleted since the last copy), `applyWire` makes the
 * group here match a merged copy (new people become your people, new expenses appear, deleted ones
 * go), and `syncLocal` does both around a copy from someone else.
 */
import * as z from 'zod/mini'
import { addFriend, updateFriend } from '../../data/friends'
import { expenseSchema } from '../../data/schemas'
import { expensesStore, friendsStore, groupsStore, profileStore } from '../../data/stores'
import { ME_ID, type Expense, type Friend, type Group, type Settlement } from '../../domain/types'
import { newId, randomB64u } from '../../lib/ids'
import { nameKey } from '../../lib/people'
import { putShared, sharedFor, type MemberSeen, type SharedGroup } from './store'
import { canonical, mergeWire, normalize, WIRE_VERSION, wireDiff, type WireExpense, type WireGroup, type WireMember, type WireSettlement } from './wire'

/** A new member id. */
export const newMemberId = (): string => randomB64u(6)

function groupOf(shared: SharedGroup): Group | null {
  return groupsStore.get().find((g) => g.id === shared.groupId) ?? null
}

/** The group's expenses that travel: in the group's own currency. */
function sharedExpenses(group: Group): Expense[] {
  return expensesStore.get().filter((e) => e.groupId === group.id && e.currency === group.currency)
}

/* ------------------------------------------------------------------ this phone → a copy */

/**
 * The group as it stands on this phone, as a copy to send, and this phone's record brought up to
 * date (new people given member ids, deletions noted). Null when the group is gone.
 */
export function buildWire(shared: SharedGroup, now: number = Date.now()): { wire: WireGroup; shared: SharedGroup } | null {
  const group = groupOf(shared)
  if (!group) return null
  const friends = new Map(friendsStore.get().map((f) => [f.id, f]))
  const profile = profileStore.get()
  const members = { ...shared.members, [shared.me]: ME_ID }
  const midOf = new Map<string, string>()
  for (const [mid, friendId] of Object.entries(members)) midOf.set(friendId, mid)
  const mid = (friendId: string): string => {
    let m = midOf.get(friendId)
    if (!m) {
      m = newMemberId()
      midOf.set(friendId, m)
      members[m] = friendId
    }
    return m
  }

  const expenses = sharedExpenses(group)
  for (const friendId of group.memberIds) mid(friendId)
  for (const e of expenses) {
    mid(e.payerId)
    for (const who of Object.keys(e.shares)) mid(who)
  }
  for (const s of group.settlements) {
    mid(s.fromId)
    mid(s.toId)
  }

  const gone = { ...shared.gone }
  const revived = { ...shared.revived }
  const known = new Set(shared.known)
  /** Here now: back after a deletion (an undo) gets a fresh version; returns the version to send. */
  const present = (id: string, version: number): number => {
    if (id in gone) {
      delete gone[id]
      revived[id] = now
    }
    return Math.max(version, revived[id] ?? 0)
  }

  const inGroup = new Set(group.memberIds)
  const m: WireMember[] = []
  for (const [memberId, friendId] of Object.entries(members)) {
    const friend = friendId === ME_ID ? { name: profile.name, upiId: profile.upiId, color: friends.get(ME_ID)?.color ?? 0 } : friends.get(friendId)
    if (!friend) continue
    const seen = shared.seen[memberId]
    const isMe = memberId === shared.me
    let entry: WireMember
    if (isMe) {
      const same = seen !== undefined && seen.n === friend.name && seen.u === friend.upiId
      entry = { i: memberId, n: friend.name, u: friend.upiId, c: seen?.c ?? friend.color, v: same ? seen.v : now, j: seen?.j || now }
    } else if (!seen) {
      entry = { i: memberId, n: friend.name, u: friend.upiId, c: friend.color, v: now, j: 0 }
    } else if (seen.j === 0 && (friend.name !== seen.ln || friend.upiId !== seen.lu)) {
      // Not on their own phone yet: a name or UPI ID fixed here goes to everyone.
      entry = { i: memberId, n: friend.name, u: friend.upiId, c: seen.c, v: now, j: 0 }
    } else {
      entry = { i: memberId, n: seen.n, u: seen.u, c: seen.c, v: seen.v, j: seen.j }
    }
    if (inGroup.has(friendId)) entry.v = present(memberId, entry.v)
    else if (known.has(memberId) && !(memberId in gone)) gone[memberId] = now
    m.push(entry)
  }

  const by = { ...shared.by }
  const here = new Set<string>()
  const x: WireExpense[] = expenses.map((e) => {
    here.add(e.id)
    const s: Record<string, number> = {}
    const q: Record<string, number | null> = {}
    for (const [who, share] of Object.entries(e.shares)) s[mid(who)] = share
    const mode = e.mode === 'items' ? 'exact' : e.mode
    for (const p of e.participants) if (p.friendId in e.shares) q[mid(p.friendId)] = e.mode === 'items' ? (e.shares[p.friendId] ?? 0) : mode === 'equal' ? null : p.input
    by[e.id] ??= shared.me
    return {
      i: e.id,
      t: e.title,
      a: e.total,
      d: e.date,
      p: mid(e.payerId),
      s,
      g: e.category,
      k: e.kind === 'loan' ? 'loan' : 'split',
      m: mode,
      q,
      o: e.note,
      c: e.createdAt,
      u: present(e.id, e.updatedAt),
      b: by[e.id] ?? null,
    }
  })
  const s: WireSettlement[] = group.settlements.map((p) => {
    here.add(p.id)
    return { i: p.id, f: mid(p.fromId), t: mid(p.toId), a: p.amount, d: p.date, m: p.method, c: p.createdAt, u: present(p.id, p.createdAt) }
  })
  // In the last copy and not here any more: deleted on this phone.
  for (const id of known) if (!here.has(id) && !(id in members) && !(id in gone)) gone[id] = now

  const sameMeta = shared.meta.n === group.name && shared.meta.e === group.emoji && shared.meta.k === group.kind
  const meta = { n: group.name, e: group.emoji, k: group.kind, u: sameMeta ? shared.meta.u : now }
  const wire = normalize({ v: WIRE_VERSION, id: shared.id, n: meta.n, e: meta.e, k: group.kind, c: group.currency, u: meta.u, m, x, s, z: gone })
  return { wire, shared: { ...shared, members, gone, revived, by, meta } }
}

/* ------------------------------------------------------------------ a copy → this phone */

function sameMoney(a: Expense, w: WireExpense, shares: Record<string, number>): boolean {
  if (a.total !== w.a) return false
  const keys = Object.keys(shares)
  return keys.length === Object.keys(a.shares).length && keys.every((k) => a.shares[k] === shares[k])
}

/** The expense a copy describes, as this phone keeps it (keeping the bill and trip details it already has when the money is the same). */
function expenseFrom(w: WireExpense, currency: string, groupId: string, friendOf: (mid: string) => string, local: Expense | undefined): Expense | null {
  const shares: Record<string, number> = {}
  for (const [who, share] of Object.entries(w.s)) shares[friendOf(who)] = share
  const createdAt = Math.min(w.c || w.u, w.u) || w.u
  const base: Expense = {
    id: w.i,
    kind: w.k,
    title: w.t,
    category: w.g,
    currency,
    total: w.a,
    date: w.d,
    createdAt,
    updatedAt: w.u,
    payerId: friendOf(w.p),
    mode: w.m,
    participants: Object.keys(w.s).map((who) => ({ friendId: friendOf(who), input: w.m === 'equal' ? null : (w.q[who] ?? w.s[who] ?? 0) })),
    shares,
    roundedToWhole: false,
    note: w.o,
    groupId,
    bill: null,
    paidBack: {},
    recurringId: null,
    source: 'manual',
  }
  const next: Expense =
    local && sameMoney(local, w, shares) && local.payerId === base.payerId
      ? { ...local, title: w.t, category: w.g, date: w.d, note: w.o, updatedAt: w.u }
      : local
        ? { ...base, createdAt: local.createdAt, source: local.source, recurringId: local.recurringId }
        : base
  const parsed = z.safeParse(expenseSchema, next)
  return parsed.success ? { ...parsed.data, updatedAt: w.u } : null
}

/**
 * Makes the group on this phone match `wire` (a copy that already includes everything here):
 * members become your people, expenses and payments are added, changed or removed. Returns this
 * phone's record for the copy, saved.
 */
export function applyWire(shared: SharedGroup, wire: WireGroup, now: number = Date.now()): SharedGroup {
  const group = groupOf(shared)
  if (!group) return shared

  // 1. People.
  const members: Record<string, string> = { ...shared.members, [shared.me]: ME_ID }
  const seen: Record<string, MemberSeen> = {}
  const taken = new Set<string>()
  for (const member of wire.m) if (members[member.i]) taken.add(members[member.i] as string)
  for (const member of wire.m) {
    const isMe = member.i === shared.me
    let friend: Friend | null = isMe ? null : (friendsStore.get().find((f) => f.id === members[member.i]) ?? null)
    if (!isMe && !friend) {
      // Someone new here: your person of that name, unless that person is already someone else in this group.
      let name = member.n
      for (let n = 2; n < 50; n++) {
        const match = friendsStore.get().find((f) => f.id !== ME_ID && nameKey(f.name) === nameKey(name))
        if (!match || !taken.has(match.id)) break
        name = `${member.n} ${n}`
      }
      try {
        friend = addFriend({ name, upiId: member.u })
      } catch {
        continue
      }
      members[member.i] = friend.id
      taken.add(friend.id)
    } else if (friend) {
      const before = shared.seen[member.i]
      const renamed = friend.name !== member.n && (!before || before.n !== member.n)
      const upi = member.u !== null && member.u !== friend.upiId
      if (renamed || upi) {
        try {
          friend = updateFriend(friend.id, { ...(renamed ? { name: member.n } : {}), ...(upi ? { upiId: member.u } : {}) })
        } catch {
          // Another of your people has that name: keep yours, take the UPI ID.
          if (upi) friend = updateFriend(friend.id, { upiId: member.u })
        }
      }
    }
    const profile = profileStore.get()
    seen[member.i] = { n: member.n, u: member.u, c: member.c, v: member.v, j: member.j, ln: isMe ? profile.name : (friend?.name ?? member.n), lu: isMe ? profile.upiId : (friend?.upiId ?? null) }
  }
  const friendOf = (mid: string): string => members[mid] ?? ME_ID

  // 2. Expenses: the ones in the copy, at its versions; the rest of this group's are deleted.
  const local = new Map(sharedExpenses(group).map((e) => [e.id, e]))
  const next: Expense[] = []
  let changed = local.size !== wire.x.length
  for (const w of wire.x) {
    const mine = local.get(w.i)
    if (mine && Math.max(mine.updatedAt, shared.revived[w.i] ?? 0) === w.u) {
      next.push(mine)
      continue
    }
    const made = expenseFrom(w, wire.c, group.id, friendOf, mine)
    if (made) next.push(made)
    else if (mine) next.push(mine)
    changed = true
  }
  if (changed) {
    const byId = new Map(next.map((e) => [e.id, e]))
    expensesStore.update((list) => {
      const placed = new Set<string>()
      const kept: Expense[] = []
      for (const e of list) {
        const mine = byId.get(e.id)
        if (mine) {
          kept.push(mine)
          placed.add(e.id)
        } else if (!local.has(e.id)) kept.push(e)
      }
      return [...next.filter((e) => !placed.has(e.id)), ...kept]
    })
  }

  // 3. The group: its name, who's in it, the payments.
  const wanted = wire.m.map((member) => friendOf(member.i))
  const memberIds = [ME_ID, ...group.memberIds.filter((id) => id !== ME_ID && wanted.includes(id)), ...wanted.filter((id) => id !== ME_ID && !group.memberIds.includes(id))]
  const settlements: Settlement[] = wire.s.map((p) => ({ id: p.i, fromId: friendOf(p.f), toId: friendOf(p.t), amount: p.a, date: p.d, createdAt: p.c || p.u, method: p.m }))
  const kind = wire.k
  const same =
    group.name === wire.n &&
    group.emoji === wire.e &&
    group.kind === kind &&
    JSON.stringify(group.memberIds) === JSON.stringify(memberIds) &&
    JSON.stringify(group.settlements) === JSON.stringify(settlements)
  if (!same) {
    groupsStore.update((groups) => groups.map((g) => (g.id === group.id ? { ...g, name: wire.n, emoji: wire.e, kind, memberIds, settlements, updatedAt: now } : g)))
  }

  // 4. This phone's record of the copy.
  const present = new Set([...wire.x.map((e) => e.i), ...wire.s.map((p) => p.i), ...wire.m.map((member) => member.i)])
  const by: Record<string, string> = {}
  for (const w of wire.x) if (w.b) by[w.i] = w.b
  const kept: Record<string, string> = {}
  for (const [mid, friendId] of Object.entries(members)) if (present.has(mid) || mid === shared.me) kept[mid] = friendId
  const record: SharedGroup = {
    ...shared,
    members: kept,
    seen,
    meta: { n: wire.n, e: wire.e, k: wire.k, u: wire.u },
    gone: { ...wire.z },
    revived: {},
    known: [...present],
    by,
  }
  putShared(record)
  return record
}

/* ------------------------------------------------------------------ both */

export interface SyncOutcome {
  /** The copy this phone now holds (what to send on). */
  wire: WireGroup
  /** Its text, for comparing with what the other side has. */
  text: string
  /** What the other copy brought here. */
  news: ReturnType<typeof wireDiff>
}

/**
 * Brings a shared group up to date with another copy of it (or just writes this phone's copy when
 * there's none): what's here and what's there become one, on this phone. Null when the group isn't
 * shared or is gone.
 */
export function syncLocal(groupId: string, remote: WireGroup | null, now: number = Date.now()): SyncOutcome | null {
  const shared = sharedFor(groupId)
  if (!shared) return null
  const built = buildWire(shared, now)
  if (!built) return null
  const usable = remote && remote.id === shared.id ? remote : null
  const merged = usable ? mergeWire(built.wire, usable) : built.wire
  const record = applyWire(built.shared, merged, now)
  // People who were new in the other copy now have their own entries here: say so in what goes out.
  const again = usable ? buildWire(record, now) : null
  const final = again ? mergeWire(again.wire, merged) : merged
  if (again && canonical(final) !== canonical(merged)) applyWire(again.shared, final, now)
  return { wire: final, text: canonical(final), news: wireDiff(built.wire, final) }
}

/* ------------------------------------------------------------------ starting and joining */

/** Starts sharing a group from this phone. Returns its record (the existing one when it's shared already). */
export function shareGroup(groupId: string, now: number = Date.now()): SharedGroup | null {
  const existing = sharedFor(groupId)
  if (existing) return existing
  const group = groupsStore.get().find((g) => g.id === groupId)
  if (!group) return null
  const me = newMemberId()
  const shared: SharedGroup = {
    groupId,
    id: randomB64u(12),
    key: randomB64u(24),
    me,
    members: { [me]: ME_ID },
    seen: {},
    meta: { n: group.name, e: group.emoji, k: group.kind, u: now },
    gone: {},
    revived: {},
    known: [],
    by: {},
    createdAt: now,
    sent: null,
    synced: null,
  }
  putShared(shared)
  syncLocal(groupId, null, now)
  return sharedFor(groupId)
}

/**
 * Joins a shared group from its invite: the group appears on this phone with you as `as` (one of
 * the names on the list) or as a new member under your own name. Returns the new group's id.
 */
export function joinGroup(wire: WireGroup, key: string, as: string | null, now: number = Date.now()): string {
  const profile = profileStore.get()
  const me = as !== null && wire.m.some((member) => member.i === as) ? as : newMemberId()
  const groupId = newId()
  const group: Group = {
    id: groupId,
    name: wire.n,
    emoji: wire.e,
    kind: wire.k,
    currency: wire.c,
    memberIds: [ME_ID],
    settlements: [],
    createdAt: now,
    updatedAt: now,
    archived: false,
    travelCurrency: null,
    roundSize: null,
  }
  groupsStore.update((groups) => [group, ...groups])
  const myColor = friendsStore.get().find((f) => f.id === ME_ID)?.color ?? 0
  const withMe: WireGroup = wire.m.some((member) => member.i === me)
    ? wire
    : normalize({ ...wire, m: [...wire.m, { i: me, n: profile.name, u: profile.upiId, c: myColor, v: now, j: now }] })
  const shared: SharedGroup = {
    groupId,
    id: wire.id,
    key,
    me,
    members: { [me]: ME_ID },
    seen: {},
    meta: { n: wire.n, e: wire.e, k: wire.k, u: wire.u },
    gone: {},
    revived: {},
    known: [],
    by: {},
    createdAt: now,
    sent: null,
    synced: null,
  }
  putShared(shared)
  applyWire(shared, withMe, now)
  // Your own name and UPI ID, as this phone has them, go into the copy.
  syncLocal(groupId, null, now)
  return groupId
}
