/**
 * Which of your people are on Settle: their saved phone number belongs to a Settle account. Asked
 * of the server once per visit (and again when you save new numbers), only while you're signed in.
 * Used by "Who's that?" under a voice split: someone on Settle is asked to pay in the app.
 */
import { useEffect, useState } from 'react'
import type { Friend } from '../../domain/types'
import { cloud } from './api'
import { useAccountPeek } from './store'

/** Friend id → the name on their Settle account. */
export type OnSettle = ReadonlyMap<string, string>

const EMPTY: OnSettle = new Map()
let cache: { key: string; result: OnSettle } | null = null
let inFlight: { key: string; promise: Promise<OnSettle> } | null = null

function phonesKey(friends: readonly Friend[]): string {
  return friends
    .filter((f) => f.phone)
    .map((f) => `${f.id}:${f.phone}`)
    .sort()
    .join('|')
}

async function lookUp(friends: readonly Friend[], key: string): Promise<OnSettle> {
  if (cache?.key === key) return cache.result
  if (inFlight?.key === key) return inFlight.promise
  const withPhone = friends.filter((f): f is Friend & { phone: string } => typeof f.phone === 'string' && f.phone !== '')
  const promise = (async () => {
    const res = await cloud<{ people: Array<{ phone: string; name: string }> }>('POST', '/people/on-settle', {
      phones: [...new Set(withPhone.map((f) => f.phone))].slice(0, 200),
    })
    if (!res.ok) return EMPTY
    const names = new Map(res.data.people.map((p) => [p.phone, p.name]))
    const result = new Map<string, string>()
    for (const f of withPhone) {
      const name = names.get(f.phone)
      if (name) result.set(f.id, name)
    }
    cache = { key, result }
    return result
  })()
  inFlight = { key, promise }
  try {
    return await promise
  } finally {
    if (inFlight?.key === key) inFlight = null
  }
}

/** Your people on Settle (empty while signed out, offline, or until the answer comes). */
export function useOnSettle(friends: readonly Friend[], enabled = true): OnSettle {
  const account = useAccountPeek()
  const signedIn = account.status === 'signedIn'
  const key = phonesKey(friends)
  const [result, setResult] = useState<OnSettle>(() => (cache?.key === key ? cache.result : EMPTY))
  useEffect(() => {
    if (!enabled || !signedIn || key === '') return
    let live = true
    void lookUp(friends, key).then((r) => {
      if (live) setResult(r)
    })
    return () => {
      live = false
    }
    // `key` stands for the friends' phones.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, signedIn, key])
  return signedIn ? result : EMPTY
}

/** For tests. */
export function resetOnSettleForTests(): void {
  cache = null
  inFlight = null
}
