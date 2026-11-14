/**
 * Turns what was read from a chat into the real thing: the people (matched to the ones you
 * already have by name), the group, an equal split for every expense between whoever the message
 * said, and the payments people made to each other. One call, and one call undoes it.
 */
import { addFriend, createGroup, deleteExpense, deleteGroup, deleteSettlement, recordSettlement, removeFriend, saveExpense, updateGroup } from '../../data'
import { cleanPhone, fallbackTitle } from '../../data/schemas'
import { friendsStore, groupsStore, profileStore } from '../../data/stores'
import { ME_ID, type Friend, type GroupKind } from '../../domain/types'
import { categoryFromText } from '../../engine/categories'
import { daysBetween } from '../../engine/dates'
import { nameKey } from '../../lib/people'
import type { ChatRow } from './read'
import { forgetChat, rememberChat } from './store'

export interface ChatPlan {
  /** The chat's name (to recognise it next time), if it has one. */
  chatName: string | null
  /** The group to add to, or null to make a new one called `groupName`. */
  groupId: string | null
  groupName: string
  /** Everyone in the chat. */
  members: readonly string[]
  /** Which of them is you; null when you never wrote in it (you're added to the group all the same). */
  me: string | null
  /** The rows to add. */
  rows: readonly ChatRow[]
  /** Every row that was shown, added or not (they aren't offered again). */
  shown: readonly string[]
  /** Who a chat name is: the id of someone you already have, or null for someone new. Names not listed are matched by exact name. */
  people?: Readonly<Record<string, string | null>>
}

export interface ChatResult {
  groupId: string
  madeGroup: boolean
  madeFriends: string[]
  expenseIds: string[]
  settlementIds: string[]
  shown: string[]
  /** People this added to a group that already existed. */
  joined: string[]
}

const TRIP = /trip|goa|manali|tour|travel|vacation|holiday|trek|ladakh|kerala|shimla|jaipur|pondy|coorg|ooty|kasol|rishikesh|leh|spiti|bali|thailand|dubai|vietnam|getaway|weekend|roadtrip|road trip|yatra/i
const HOME = /flat|home|house|room(?:ies|mates?)?|pg\b|apartment|ghar|hostel|society/i

/** What kind of group a chat is, from its name and how long the money runs. */
export function groupKindFor(name: string, rows: readonly Pick<ChatRow, 'date'>[]): { kind: GroupKind; emoji: string } {
  if (HOME.test(name)) return { kind: 'home', emoji: '🏠' }
  if (TRIP.test(name)) return { kind: 'trip', emoji: '✈️' }
  const dates = rows.map((r) => r.date).sort()
  const first = dates[0]
  const last = dates[dates.length - 1]
  if (first && last && daysBetween(first, last) <= 21) return { kind: 'trip', emoji: '✈️' }
  return { kind: 'other', emoji: '👥' }
}

/** Which member is the phone's owner: the same name, or the same first name when only one has it. */
export function guessMe(members: readonly string[], profileName: string): string | null {
  const mine = profileName.trim().toLowerCase()
  if (!mine) return null
  const exact = members.find((m) => m.trim().toLowerCase() === mine)
  if (exact) return exact
  const first = mine.split(/\s+/)[0] ?? ''
  const sameFirst = members.filter((m) => (m.trim().toLowerCase().split(/\s+/)[0] ?? '') === first)
  return sameFirst.length === 1 ? (sameFirst[0] ?? null) : null
}

const PHONE_NAME = /^\+?[\d\s()-]{7,}$/

export interface PersonMatch {
  /** The name in the chat. */
  name: string
  /** People you already have that this could be: one is a likely match, several need a look. */
  options: Friend[]
  /** True when the name is the same (or the same number): nothing to ask. */
  exact: boolean
}

const last10 = (value: string | null | undefined): string => (value ?? '').replace(/\D/g, '').slice(-10)

/** "Riya Sharma" and "Riya", "Sam" and "Sam K", "Sam K" and "Sam Kapoor": the same first name, and nothing that says otherwise. */
function couldBe(chatName: string, friendName: string): boolean {
  const a = nameKey(chatName).split(/\s+/).filter(Boolean)
  const b = nameKey(friendName).split(/\s+/).filter(Boolean)
  if (a.length === 0 || b.length === 0 || a[0] !== b[0] || (a[0]?.length ?? 0) < 2) return false
  if (a.length === 1 || b.length === 1) return true
  const x = a[a.length - 1] ?? ''
  const y = b[b.length - 1] ?? ''
  return x.startsWith(y) || y.startsWith(x)
}

/**
 * Who each person in the chat is among the people you already have. An exact name (or the same phone
 * number) is that person. A first-name match is offered: one candidate is taken unless you say otherwise;
 * two or more ("Rahul" with Rahul Mehta and Rahul S) are never guessed.
 */
export function matchPeople(members: readonly string[], me: string | null, friends: readonly Friend[] = friendsStore.get()): PersonMatch[] {
  const others = friends.filter((f) => f.id !== ME_ID)
  const taken = new Set<string>()
  const out: PersonMatch[] = []
  const rest: string[] = []
  for (const name of members) {
    if (name === me) continue
    const key = nameKey(name)
    const digits = PHONE_NAME.test(name) ? last10(name) : null
    const exact = others.find((f) => nameKey(f.name) === key || (digits !== null && digits.length === 10 && (last10(f.phone) === digits || (PHONE_NAME.test(f.name) && last10(f.name) === digits))))
    if (exact) {
      taken.add(exact.id)
      out.push({ name, options: [exact], exact: true })
    } else rest.push(name)
  }
  for (const name of rest) {
    const options = PHONE_NAME.test(name) ? [] : others.filter((f) => !taken.has(f.id) && !PHONE_NAME.test(f.name) && couldBe(name, f.name))
    out.push({ name, options, exact: false })
  }
  // Two chat names that could both be the same saved person: neither is taken for granted.
  for (const match of out) {
    if (match.exact || match.options.length !== 1) continue
    const id = match.options[0]?.id
    if (out.some((other) => other !== match && !other.exact && other.options.some((f) => f.id === id))) match.options = [...match.options]
  }
  return members.filter((n) => n !== me).map((n) => out.find((m) => m.name === n)).filter((m): m is PersonMatch => m !== undefined)
}

/** The choice made for you: the one likely person, or someone new when there are none or several. */
export function defaultPeople(matches: readonly PersonMatch[]): Record<string, string | null> {
  const out: Record<string, string | null> = {}
  const used = new Map<string, number>()
  for (const m of matches) if (!m.exact && m.options.length === 1 && m.options[0]) used.set(m.options[0].id, (used.get(m.options[0].id) ?? 0) + 1)
  for (const m of matches) {
    if (m.exact) continue
    const only = m.options.length === 1 ? m.options[0] : undefined
    out[m.name] = only && used.get(only.id) === 1 ? only.id : null
  }
  return out
}

/** Adds the plan to the app. Throws what the data layer throws (too many people, say). */
export function applyChat(plan: ChatPlan): ChatResult {
  const before = new Set(friendsStore.get().map((f) => f.id))
  const idOf = new Map<string, string>()
  for (const name of plan.members) {
    if (name === plan.me) {
      idOf.set(name, ME_ID)
      continue
    }
    const chosen = plan.people?.[name]
    const picked = chosen ? friendsStore.get().find((f) => f.id === chosen && f.id !== ME_ID) : undefined
    // The same number written another way is the person you already have.
    const digits = PHONE_NAME.test(name) ? last10(name) : null
    const sameNumber = !picked && digits && digits.length === 10 ? friendsStore.get().find((f) => f.id !== ME_ID && (last10(f.phone) === digits || (PHONE_NAME.test(f.name) && last10(f.name) === digits))) : undefined
    const friend = picked ?? sameNumber ?? addFriend({ name, phone: PHONE_NAME.test(name) ? cleanPhone(name) : null })
    idOf.set(name, friend.id)
  }
  const madeFriends = friendsStore.get().filter((f) => !before.has(f.id)).map((f) => f.id)
  const memberIds = [ME_ID, ...new Set([...idOf.values()].filter((id) => id !== ME_ID))]

  let groupId = plan.groupId
  let madeGroup = false
  let joined: string[] = []
  const existing = groupId ? groupsStore.get().find((g) => g.id === groupId) : undefined
  if (existing) {
    const missing = memberIds.filter((id) => !existing.memberIds.includes(id))
    if (missing.length > 0) {
      updateGroup(existing.id, { memberIds: [...existing.memberIds, ...missing] })
      joined = missing
    }
  } else {
    const { kind, emoji } = groupKindFor(plan.groupName, plan.rows)
    groupId = createGroup({ name: plan.groupName, emoji, kind, currency: profileStore.get().currency, memberIds }).id
    madeGroup = true
  }
  if (!groupId) throw new Error('no group')
  const currency = groupsStore.get().find((g) => g.id === groupId)?.currency ?? profileStore.get().currency

  const expenseIds: string[] = []
  const settlementIds: string[] = []
  // Oldest first, so the newest ends up on top of the group.
  for (const row of plan.rows) {
    const payerId = idOf.get(row.payer)
    if (!payerId) continue
    if (row.kind === 'payment') {
      const toId = row.to ? idOf.get(row.to) : undefined
      if (!toId || toId === payerId) continue
      settlementIds.push(recordSettlement(groupId, { fromId: payerId, toId, amount: row.amount, date: row.date, method: 'other' }).id)
      continue
    }
    const among = new Set(row.among.map((name) => idOf.get(name)).filter((id): id is string => id !== undefined))
    // "Everyone" includes you even when you never wrote in the chat.
    if (plan.me === null && row.everyone) among.add(ME_ID)
    if (among.size === 0) continue
    const category = categoryFromText(row.title) ?? 'other'
    const saved = saveExpense({
      kind: 'split',
      title: row.title || fallbackTitle(category),
      category,
      currency,
      total: row.amount,
      date: row.date,
      payerId,
      mode: 'equal',
      participants: [...among].map((friendId) => ({ friendId, input: null })),
      roundedToWhole: false,
      note: `“${row.quote}”`,
      groupId,
      bill: null,
      recurringId: null,
      source: 'chat',
    })
    expenseIds.push(saved.id)
  }
  rememberChat(plan.chatName, groupId, plan.shown)
  return { groupId, madeGroup, madeFriends, expenseIds, settlementIds, shown: [...plan.shown], joined }
}

/** Takes back what `applyChat` added: the expenses and payments, and the group and people it made. */
export function undoChat(result: ChatResult): void {
  if (result.madeGroup) {
    if (groupsStore.get().some((g) => g.id === result.groupId)) deleteGroup(result.groupId)
  } else {
    for (const id of result.expenseIds) deleteExpense(id)
    for (const id of result.settlementIds) {
      try {
        deleteSettlement(result.groupId, id)
      } catch {
        // Already gone.
      }
    }
  }
  // The group goes back to who was in it (anyone who still has money in it stays, as everywhere).
  if (!result.madeGroup && result.joined.length > 0) {
    const group = groupsStore.get().find((g) => g.id === result.groupId)
    if (group) {
      const gone = new Set(result.joined)
      try {
        updateGroup(group.id, { memberIds: group.memberIds.filter((id) => !gone.has(id)) })
      } catch {
        // Left as it is.
      }
    }
  }
  for (const id of result.madeFriends) removeFriend(id)
  forgetChat(result.groupId, result.shown, result.madeGroup)
}
