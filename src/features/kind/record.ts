/**
 * Recording a payment in kind: the due is settled through the same path as any other payment
 * between you and a friend (method "other"), and what it was is kept beside the records it made.
 */
import { expensesStore, groupsStore, profileStore } from '../../data'
import type { Minor } from '../../domain/types'
import { newId } from '../../lib/ids'
import { friendBalance, netIn } from '../friends/friendBalance'
import { payFriend } from '../swap/settle'
import { cleanKindText, findKindEntry, kindEntriesWith, recordedRefs, type KindDirection, type KindEntry, type KindWhat } from './engine'
import { addKindEntry, kindStore, removeKindEntry } from './store'

export interface KindInput {
  friendId: string
  direction: KindDirection
  /** Paise; more than what is open settles what is open. */
  amount: Minor
  currency: string
  what: KindWhat
  text: string
  /** YYYY-MM-DD. */
  date: string
}

export interface KindRecorded {
  entry: KindEntry
  /** What is still open between you in that currency afterwards (always 0 or more). */
  left: Minor
  /** Puts everything back exactly: the payments, the ticks and the note. */
  undo: () => void
}

function openNow(friendId: string, currency: string): Minor {
  return netIn(friendBalance(friendId, expensesStore.get(), groupsStore.get(), profileStore.get().currency), currency)
}

/**
 * Settles `amount` between you and a friend with something that isn't money. Null when nothing
 * was open in that direction (nothing is changed).
 */
export function recordKind(input: KindInput, now: number = Date.now()): KindRecorded | null {
  const before = { expenses: expensesStore.get(), groups: groupsStore.get() }
  const openBefore = openNow(input.friendId, input.currency)
  const undoPayment = payFriend(input.friendId, input.direction, input.amount, before.expenses, before.groups, input.currency, {
    method: 'other',
    date: input.date,
  })
  const after = { expenses: expensesStore.get(), groups: groupsStore.get() }
  const refs = recordedRefs(before, after, input.friendId)
  const openAfter = openNow(input.friendId, input.currency)
  const settled = Math.abs(openBefore - openAfter)
  if (refs.length === 0 || settled <= 0) {
    undoPayment()
    return null
  }
  const text = cleanKindText(input.text)
  const entry: KindEntry = {
    id: newId(),
    friendId: input.friendId,
    direction: input.direction,
    what: input.what,
    text: input.what === 'other' && text !== '' ? text : null,
    amount: settled,
    currency: input.currency,
    date: input.date,
    createdAt: now,
    refs,
  }
  addKindEntry(entry)
  return {
    entry,
    left: Math.abs(openAfter),
    undo: () => {
      undoPayment()
      removeKindEntry(entry.id)
    },
  }
}

/**
 * The payment in kind behind a record, or null: `id` is a group payment's id, or an expense's id
 * (with `debtorId` to say whose share). A payment deleted since, or a share unticked, has no note.
 */
export function kindNote(id: string, debtorId?: string): KindEntry | null {
  return findKindEntry(kindStore.get().entries, id, debtorId, { expenses: expensesStore.get(), groups: groupsStore.get() })
}

/** Every payment in kind with a friend that still stands, newest first. */
export function kindNotesWith(friendId: string): KindEntry[] {
  return kindEntriesWith(kindStore.get().entries, friendId, { expenses: expensesStore.get(), groups: groupsStore.get() })
}
