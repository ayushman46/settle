/**
 * Turns what was read from a chat into the real thing: the people (matched to the ones you
 * already have by name), the group, an equal split for every expense between whoever the message
 * said, and the payments people made to each other. One call, and one call undoes it.
 */
import { addFriend, createGroup, deleteExpense, deleteGroup, deleteSettlement, recordSettlement, removeFriend, saveExpense, updateGroup } from '../../data'
import { cleanPhone, fallbackTitle } from '../../data/schemas'
import { friendsStore, groupsStore, profileStore } from '../../data/stores'
import { ME_ID, type GroupKind } from '../../domain/types'
import { categoryFromText } from '../../engine/categories'
import { daysBetween } from '../../engine/dates'
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
}

export interface ChatResult {
  groupId: string
  madeGroup: boolean
  madeFriends: string[]
  expenseIds: string[]
  settlementIds: string[]
  shown: string[]
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

/** Adds the plan to the app. Throws what the data layer throws (too many people, say). */
export function applyChat(plan: ChatPlan): ChatResult {
  const before = new Set(friendsStore.get().map((f) => f.id))
  const idOf = new Map<string, string>()
  for (const name of plan.members) {
    if (name === plan.me) {
      idOf.set(name, ME_ID)
      continue
    }
    const friend = addFriend({ name, phone: PHONE_NAME.test(name) ? cleanPhone(name) : null })
    idOf.set(name, friend.id)
  }
  const madeFriends = friendsStore.get().filter((f) => !before.has(f.id)).map((f) => f.id)
  const memberIds = [ME_ID, ...new Set([...idOf.values()].filter((id) => id !== ME_ID))]

  let groupId = plan.groupId
  let madeGroup = false
  const existing = groupId ? groupsStore.get().find((g) => g.id === groupId) : undefined
  if (existing) {
    const missing = memberIds.filter((id) => !existing.memberIds.includes(id))
    if (missing.length > 0) updateGroup(existing.id, { memberIds: [...existing.memberIds, ...missing] })
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
      settlementIds.push(recordSettlement(groupId, { fromId: payerId, toId, amount: row.amount, date: row.date, method: 'upi' }).id)
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
  return { groupId, madeGroup, madeFriends, expenseIds, settlementIds, shown: [...plan.shown] }
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
  for (const id of result.madeFriends) removeFriend(id)
  forgetChat(result.groupId, result.shown, result.madeGroup)
}
