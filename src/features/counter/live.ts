/**
 * The live list of who has paid at the counter. Every phone at the table (the pay page each friend
 * opened, and the screen of whoever set it up) keeps one small encrypted note in a room on Settle's
 * relay (the one shared groups use, src/features/groupsync/transport.ts): person → when they paid
 * and how. The secret travels only in the link's `#fragment`, so the server can't read the note.
 * The latest word on each person wins, and a phone whose word is missing from the note writes it
 * again, so two phones writing at once lose nothing for long.
 *
 * Where the relay is off (no storage connected), there's no live list: the pay page falls back to
 * the "I've paid" message, as on any pay link.
 */
import { useEffect, useRef, useState } from 'react'
import type { SyncGetResponse, SyncPutResponse } from '../../../shared/api'
import { roomOf, seal, unsealText, writeTokenOf } from '../groupsync/transport'

/** How a share was paid, or 'no': taken back (ticked by mistake). */
export type MarkHow = 'upi' | 'cash' | 'no'

export interface Mark {
  /** When (epoch ms): the latest word on a person wins. */
  t: number
  h: MarkHow
}

/** Person (their index in the link, as a string) → the latest word on them. */
export type Marks = Readonly<Record<string, Mark>>

const MAX_PEOPLE = 60
/** How often an open page asks the room for news. */
export const COUNTER_POLL_MS = 4000

export const isPaid = (mark: Mark | undefined): boolean => mark !== undefined && mark.h !== 'no'

/** Marks from anywhere, checked field by field (anything odd is dropped). */
export function readMarks(value: unknown): Marks {
  const out: Record<string, Mark> = {}
  if (typeof value !== 'object' || value === null) return out
  for (const [index, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^\d{1,2}$/.test(index) || Number(index) >= MAX_PEOPLE || typeof raw !== 'object' || raw === null) continue
    const { t, h } = raw as Record<string, unknown>
    if (typeof t !== 'number' || !Number.isFinite(t) || t <= 0) continue
    if (h !== 'upi' && h !== 'cash' && h !== 'no') continue
    out[String(Number(index))] = { t, h }
  }
  return out
}

/** Both lists as one: per person, the latest word. */
export function mergeMarks(a: Marks, b: Marks): Marks {
  const out: Record<string, Mark> = { ...a }
  for (const [index, mark] of Object.entries(b)) {
    const had = out[index]
    if (!had || mark.t > had.t) out[index] = mark
  }
  return out
}

/** Does `a` say everything `b` says? */
export function sameMarks(a: Marks, b: Marks): boolean {
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every((k) => b[k] !== undefined && b[k].t === a[k]?.t && b[k].h === a[k]?.h)
}

export type PulledMarks = { kind: 'off' } | { kind: 'failed' } | { kind: 'same'; v: string | null } | { kind: 'marks'; marks: Marks; v: string }

/** Asks the room for the list (nothing when it's still the version `have`). Never throws. */
export async function pullMarks(key: string, have: string | null, signal?: AbortSignal): Promise<PulledMarks> {
  try {
    const response = await fetch(`/api/sync/${roomOf(key)}${have ? `?have=${encodeURIComponent(have)}` : ''}`, { headers: { Accept: 'application/json' }, signal })
    if (response.status === 503) return { kind: 'off' }
    if (!response.ok) return { kind: 'failed' }
    const body = (await response.json()) as SyncGetResponse
    if (body.data === null || !body.v) return { kind: 'same', v: body.v ?? null }
    const text = await unsealText(body.data, key)
    if (text === null) return { kind: 'marks', marks: {}, v: body.v }
    const parsed = JSON.parse(text) as { p?: unknown }
    return { kind: 'marks', marks: readMarks(parsed.p), v: body.v }
  } catch {
    return { kind: 'failed' }
  }
}

/** Leaves the list in the room. Returns its version, or null when it couldn't. Never throws. */
export async function pushMarks(key: string, marks: Marks, signal?: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch(`/api/sync/${roomOf(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ data: await seal(JSON.stringify({ v: 1, p: marks }), key), write: writeTokenOf(key) }),
      signal,
    })
    if (!response.ok) return null
    return ((await response.json()) as SyncPutResponse).v
  } catch {
    return null
  }
}

export type CounterLiveState = 'connecting' | 'live' | 'off'

export interface CounterLive {
  /** Everything known: the room's list and this phone's own words. */
  marks: Marks
  state: CounterLiveState
}

/**
 * The live list for the counter with secret `key`, kept up to date while the page is open. `mine`
 * is what this phone says (its own payment, or — on the screen of whoever set it up — everyone it
 * has ticked): it's written to the room whenever the room doesn't say it yet.
 */
export function useCounterMarks(key: string | null, mine: Marks): CounterLive {
  const [remote, setRemote] = useState<Marks>({})
  const [state, setState] = useState<CounterLiveState>('connecting')
  const mineRef = useRef(mine)
  const kick = useRef<() => void>(() => undefined)
  useEffect(() => {
    mineRef.current = mine
    kick.current()
  }, [mine])

  useEffect(() => {
    if (!key) return
    let live = true
    let running = false
    let again = false
    let version: string | null = null
    let known: Marks = {}
    const controller = new AbortController()
    const run = async (): Promise<void> => {
      if (running) {
        again = true
        return
      }
      running = true
      try {
        const pulled = await pullMarks(key, version, controller.signal)
        if (!live) return
        if (pulled.kind === 'off') {
          setState('off')
          return
        }
        if (pulled.kind === 'failed') return
        if (pulled.kind === 'marks') {
          known = pulled.marks
          version = pulled.v
        }
        const merged = mergeMarks(known, mineRef.current)
        if (!sameMarks(merged, known)) {
          const pushed = await pushMarks(key, merged, controller.signal)
          if (!live) return
          if (pushed) {
            known = merged
            version = pushed
          }
        }
        setState('live')
        setRemote((had) => (sameMarks(had, known) ? had : known))
      } finally {
        running = false
        if (again && live) {
          again = false
          void run()
        }
      }
    }
    kick.current = () => void run()
    void run()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void run()
    }, COUNTER_POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      live = false
      kick.current = () => undefined
      controller.abort()
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [key])

  const marks = mergeMarks(remote, mine)
  return { marks, state: key ? state : 'off' }
}

/** A pay link's people with the live list laid over them: whoever it says has paid is paid. */
export function withMarks<P extends { p: ReadonlyArray<{ paid?: true }> }>(payload: P, marks: Marks): P {
  if (Object.keys(marks).length === 0) return payload
  return {
    ...payload,
    p: payload.p.map((person, i) => {
      const mark = marks[String(i)]
      if (!mark) return person
      if (isPaid(mark)) return person.paid ? person : { ...person, paid: true as const }
      const { paid: _paid, ...rest } = person
      return rest
    }),
  }
}
