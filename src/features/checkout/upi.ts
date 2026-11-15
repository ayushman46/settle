import { ME_ID, type Friend, type Profile } from '../../domain/types'
import { isValidUpiId, normalizeUpiId } from '../../lib/upi'

/** The UPI ID money for `id` goes to (the owner's is on their profile), cleaned; null when there's no valid one. */
export function receiverUpi(id: string, friendsById: Readonly<Record<string, Friend>>, profile: Pick<Profile, 'upiId'>): string | null {
  const raw = id === ME_ID ? profile.upiId : (friendsById[id]?.upiId ?? null)
  return raw && isValidUpiId(raw) ? normalizeUpiId(raw) : null
}
