/**
 * Nicknames: what you call someone when you speak ("Adi", "Bhaiya", "Sid") → which of your
 * people that is. Learnt when you pick someone in the "Who's that?" list under a voice split, so
 * next time the same word goes straight to them. Kept with your other data (it syncs to your
 * account like every `settle.*` key).
 */
import * as z from 'zod/mini'
import { fold } from '../../../shared/nameMatch'
import { createStore, useStore } from '../../data/store'
import { STORAGE_KEYS } from '../../data/stores'

/** Folded nickname → friend id. */
export type Nicknames = Record<string, string>

const MAX_NICKNAMES = 400

export const nicknamesStore = createStore<Nicknames>({
  key: STORAGE_KEYS.nicknames,
  schema: z.record(z.string(), z.string()),
  initial: () => ({}),
  version: 1,
})

export function useNicknames(): Nicknames {
  return useStore(nicknamesStore, (state) => state)
}

/**
 * Remembers that `said` means `friendId` ("Adi" → Aditya; "Rahul" → Rahul Verma when you have
 * two Rahuls). Nothing is kept when `said` is their whole name anyway; the newest nicknames win
 * when the list is full.
 */
export function rememberNickname(said: string, friendId: string, friendName: string): void {
  const key = fold(said)
  if (!key || key.length > 40) return
  const name = fold(friendName)
  if (key === name) {
    forgetNickname(said)
    return
  }
  const state = nicknamesStore.get()
  if (state[key] === friendId) return
  const next: Nicknames = { ...state }
  delete next[key]
  next[key] = friendId
  const keys = Object.keys(next)
  for (const old of keys.slice(0, Math.max(0, keys.length - MAX_NICKNAMES))) delete next[old]
  nicknamesStore.set(next)
}

export function forgetNickname(said: string): void {
  const key = fold(said)
  const state = nicknamesStore.get()
  if (!(key in state)) return
  const next = { ...state }
  delete next[key]
  nicknamesStore.set(next)
}

/** Every nickname for one person (for showing "also called Adi"). */
export function nicknamesFor(friendId: string, all: Nicknames): string[] {
  return Object.entries(all)
    .filter(([, id]) => id === friendId)
    .map(([nick]) => nick)
}
