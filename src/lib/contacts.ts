/**
 * The phone's own contact picker (Android Chrome and the Android app): the person chooses who to
 * share, and only those names and numbers reach Settle. Nothing is read in the background, and
 * nothing leaves the phone. Not on iPhone or computers: there the typed form stays the way.
 */

export interface PickedContact {
  name: string
  phone: string | null
}

interface ContactsManager {
  select: (properties: string[], options?: { multiple?: boolean }) => Promise<Array<{ name?: string[]; tel?: string[] }>>
}

function manager(): ContactsManager | null {
  if (typeof navigator === 'undefined') return null
  const contacts = (navigator as Navigator & { contacts?: Partial<ContactsManager> }).contacts
  return contacts && typeof contacts.select === 'function' ? (contacts as ContactsManager) : null
}

export function canPickContacts(): boolean {
  return manager() !== null
}

/** Opens the phone's contact picker. Empty when the person picks nobody, or it isn't there. */
export async function pickContacts(): Promise<PickedContact[]> {
  const contacts = manager()
  if (!contacts) return []
  try {
    const picked = await contacts.select(['name', 'tel'], { multiple: true })
    const out: PickedContact[] = []
    const seen = new Set<string>()
    for (const person of picked) {
      const name = (person.name?.find((n) => typeof n === 'string' && n.trim() !== '') ?? '').trim()
      if (!name || seen.has(name.toLowerCase())) continue
      seen.add(name.toLowerCase())
      const phone = person.tel?.find((n) => typeof n === 'string' && n.replace(/\D/g, '').length >= 7) ?? null
      out.push({ name, phone })
    }
    return out
  } catch {
    return []
  }
}
