/**
 * What this phone remembers about chats it has read: which group a chat became, and which of its
 * messages have already been looked at, so adding the same chat again next week offers only what
 * is new. Addresses of messages only (`ChatRow.key`), never their words.
 */
import * as z from 'zod/mini'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'

export interface ChatMemory {
  /** A chat's name, lower-cased → the group it became. */
  byChat: Record<string, string>
  /** Group → the messages already looked at. */
  seen: Record<string, string[]>
}

const MAX_CHATS = 100
const MAX_SEEN = 6000

export const chatSchema = z.object({
  byChat: z.record(z.string(), z.string()),
  seen: z.record(z.string(), z.array(z.string())),
})

export const chatStore = createStore<ChatMemory>({
  key: STORAGE_KEYS.chat,
  schema: chatSchema,
  initial: () => ({ byChat: {}, seen: {} }),
  version: 1,
})

export const chatKey = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, ' ')

export function useChatMemory(): ChatMemory {
  return useStore(chatStore, (state) => state)
}

/** The group this chat became last time, if it's still remembered. */
export function groupForChat(name: string | null): string | null {
  if (!name) return null
  return chatStore.get().byChat[chatKey(name)] ?? null
}

/**
 * The group these messages were already added to, whatever the file is called this time (an
 * iPhone names every export "_chat.txt"; pasted messages have no name at all).
 */
export function groupForRows(keys: readonly string[]): string | null {
  if (keys.length === 0) return null
  const mine = new Set(keys)
  let best: string | null = null
  let most = 0
  for (const [groupId, seen] of Object.entries(chatStore.get().seen)) {
    let hits = 0
    for (const key of seen) if (mine.has(key)) hits++
    if (hits > most) {
      most = hits
      best = groupId
    }
  }
  return most >= Math.min(3, keys.length) ? best : null
}

export function seenIn(groupId: string | null): ReadonlySet<string> {
  return new Set(groupId ? (chatStore.get().seen[groupId] ?? []) : [])
}

/** Remembers that `keys` of the chat called `name` have been looked at for `groupId`. */
export function rememberChat(name: string | null, groupId: string, keys: readonly string[]): void {
  const state = chatStore.get()
  const byChat = { ...state.byChat }
  if (name) {
    byChat[chatKey(name)] = groupId
    const names = Object.keys(byChat)
    for (const old of names.slice(0, Math.max(0, names.length - MAX_CHATS))) delete byChat[old]
  }
  const merged = [...new Set([...(state.seen[groupId] ?? []), ...keys])].slice(-MAX_SEEN)
  chatStore.set({ byChat, seen: { ...state.seen, [groupId]: merged } })
}

/** Forgets `keys` for a group (an Undo), and the group itself when `all`. */
export function forgetChat(groupId: string, keys: readonly string[], all: boolean): void {
  const state = chatStore.get()
  const seen = { ...state.seen }
  const byChat = { ...state.byChat }
  if (all) {
    delete seen[groupId]
    for (const [name, id] of Object.entries(byChat)) if (id === groupId) delete byChat[name]
  } else {
    const gone = new Set(keys)
    seen[groupId] = (seen[groupId] ?? []).filter((k) => !gone.has(k))
  }
  chatStore.set({ byChat, seen })
}
