/** The device owner's profile and settings. The owner's friend entry (ME) mirrors name and UPI ID. */
import { ME_ID, type AccentId, type Profile, type ThemePref } from '../domain/types'
import { normalizeName } from '../lib/people'
import { cleanCurrency, cleanUpiId } from './schemas'
import { friendsStore, profileStore } from './stores'

const THEMES: readonly ThemePref[] = ['system', 'light', 'dark']
const ACCENTS: readonly AccentId[] = ['lime', 'mint', 'sky', 'violet', 'coral']

/**
 * A UPI ID patch: null or blank clears it, a valid ID replaces it, anything else (half-typed)
 * keeps what was there.
 */
export function patchUpiId(prev: string | null, next: string | null | undefined): string | null {
  if (next === undefined) return prev
  if (next === null || next.trim() === '') return null
  return cleanUpiId(next) ?? prev
}

/** Keeps the owner's friend entry in step with the profile. */
export function syncMeFriend(profile: Profile): void {
  friendsStore.update((friends) => {
    let changed = false
    const next = friends.map((f) => {
      if (f.id !== ME_ID) return f
      const name = profile.name || 'Me'
      if (f.name === name && f.upiId === profile.upiId) return f
      changed = true
      return { ...f, name, upiId: profile.upiId }
    })
    return changed ? next : friends
  })
}

export function updateProfile(patch: Partial<Profile>): Profile {
  const prev = profileStore.get()
  const name = patch.name === undefined ? prev.name : normalizeName(patch.name)
  const next: Profile = {
    name,
    upiId: patchUpiId(prev.upiId, patch.upiId),
    currency: patch.currency === undefined ? prev.currency : cleanCurrency(patch.currency, prev.currency),
    theme: patch.theme !== undefined && THEMES.includes(patch.theme) ? patch.theme : prev.theme,
    accent: patch.accent !== undefined && ACCENTS.includes(patch.accent) ? patch.accent : prev.accent,
    haptics: typeof patch.haptics === 'boolean' ? patch.haptics : prev.haptics,
    onboarded: typeof patch.onboarded === 'boolean' ? patch.onboarded : prev.onboarded,
    createdAt: prev.createdAt,
  }
  const same = (Object.keys(next) as Array<keyof Profile>).every((k) => Object.is(next[k], prev[k]))
  if (same) return prev
  profileStore.set(next)
  syncMeFriend(next)
  return next
}
