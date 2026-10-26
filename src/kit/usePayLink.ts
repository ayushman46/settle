/** The pay link for an expense, ready to share or to put in a nudge. */
import { useEffect, useMemo, useState } from 'react'
import { useFriendsById, useProfile } from '../data'
import type { Expense } from '../domain/types'
import { encodePayLink, payLinkFromExpense, type PayLinkPayload } from '../share'

export interface PayLink<P extends PayLinkPayload | null = PayLinkPayload | null> {
  /** What the link carries (null without an expense) — also what summaries and messages are built from. */
  payload: P
  /** `https://…/pay#…`, or null while it's being packed (a few milliseconds) or when disabled. */
  link: string | null
}

export interface PayLinkOptions {
  /** Pack the link (default true). Pass false to skip the work, e.g. while a sheet is closed. */
  enabled?: boolean
  /** A personal copy for this person: it opens straight on their share. */
  forId?: string | null
}

/**
 * `expense` as a pay link: names as friends know them, the payer's UPI ID (live — adding one
 * updates the link), each share and who has paid. Packing is async, so `link` starts null and
 * keeps its value while the content stays the same.
 */
export function usePayLink(expense: Expense, opts?: PayLinkOptions): PayLink<PayLinkPayload>
export function usePayLink(expense: Expense | null, opts?: PayLinkOptions): PayLink
export function usePayLink(expense: Expense | null, { enabled = true, forId = null }: PayLinkOptions = {}): PayLink {
  const friendsById = useFriendsById()
  const profile = useProfile()
  const payload = useMemo(
    () => (expense ? payLinkFromExpense(expense, friendsById, profile, forId ?? undefined) : null),
    [expense, friendsById, profile, forId],
  )
  // Same content, same link: a re-render with an equal payload keeps the link it has.
  const key = useMemo(() => (payload ? JSON.stringify(payload) : ''), [payload])
  const [packed, setPacked] = useState<{ key: string; link: string } | null>(null)
  const ready = packed !== null && packed.key === key ? packed.link : null

  useEffect(() => {
    if (!enabled || payload === null || ready !== null) return
    let live = true
    void encodePayLink(payload).then((url) => {
      if (live) setPacked({ key, link: url })
    })
    return () => {
      live = false
    }
  }, [enabled, payload, key, ready])

  return { payload, link: enabled ? ready : null }
}

/**
 * Each of `ids`' own pay link (see `forId`): for asking everyone one by one, each message
 * opening straight on that person's share. Links arrive together once packed.
 */
export function usePersonalPayLinks(expense: Expense, ids: readonly string[], enabled: boolean): Readonly<Record<string, PayLink<PayLinkPayload>>> {
  const friendsById = useFriendsById()
  const profile = useProfile()
  const idsKey = ids.join('\u0000')
  const payloads = useMemo(
    () => (idsKey === '' ? [] : idsKey.split('\u0000')).map((id) => ({ id, payload: payLinkFromExpense(expense, friendsById, profile, id) })),
    [expense, friendsById, profile, idsKey],
  )
  const key = useMemo(() => JSON.stringify(payloads), [payloads])
  const [packed, setPacked] = useState<{ key: string; links: Record<string, string> } | null>(null)
  const ready = packed !== null && packed.key === key ? packed.links : null

  useEffect(() => {
    if (!enabled || ready !== null || payloads.length === 0) return
    let live = true
    void Promise.all(payloads.map(({ id, payload }) => encodePayLink(payload).then((url) => [id, url] as const))).then((pairs) => {
      if (live) setPacked({ key, links: Object.fromEntries(pairs) })
    })
    return () => {
      live = false
    }
  }, [enabled, payloads, key, ready])

  const out: Record<string, PayLink<PayLinkPayload>> = {}
  for (const { id, payload } of payloads) out[id] = { payload, link: enabled ? (ready?.[id] ?? null) : null }
  return out
}
