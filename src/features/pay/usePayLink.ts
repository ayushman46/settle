import { useEffect, useState } from 'react'
import { decodePayLink, type PayLinkPayload } from '../../share/payLink'

export type PayLinkState =
  /** No `#fragment` at all (someone opened `/pay` by hand). */
  | { status: 'empty' }
  | { status: 'loading'; fragment: string }
  /** Corrupt, cut short, too big, or not a pay link. */
  | { status: 'invalid'; fragment: string }
  | { status: 'ok'; fragment: string; payload: PayLinkPayload }

interface Decoded {
  fragment: string
  payload: PayLinkPayload | null
}

/**
 * The pay link in `hash` (the URL's `#…`), decoded. Re-decodes when the hash changes (a new link
 * pasted into the same tab); a stale answer for an older hash is never shown.
 */
export function usePayLink(hash: string): PayLinkState {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  const [decoded, setDecoded] = useState<Decoded | null>(null)

  useEffect(() => {
    if (!fragment) return
    let live = true
    void decodePayLink(fragment).then((payload) => {
      if (live) setDecoded({ fragment, payload })
    })
    return () => {
      live = false
    }
  }, [fragment])

  if (!fragment) return { status: 'empty' }
  if (!decoded || decoded.fragment !== fragment) return { status: 'loading', fragment }
  return decoded.payload ? { status: 'ok', fragment, payload: decoded.payload } : { status: 'invalid', fragment }
}
