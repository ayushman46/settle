import { useState } from 'react'
import { Contact } from 'lucide-react'
import { Button, useToast, type ButtonProps } from '../../components'
import { addFriend, DataError, removeFriend } from '../../data'
import { friendsStore } from '../../data/stores'
import { useT } from '../../i18n'
import { canPickContacts, pickContacts, type PickedContact } from '../../lib/contacts'
import { haptic } from '../../lib/haptics'

/** Adds the picked contacts as people (a name you already have just gains the number). Returns the ids that are new. */
export function addContacts(picked: readonly PickedContact[]): { added: string[]; full: boolean } {
  const before = new Set(friendsStore.get().map((f) => f.id))
  let full = false
  for (const person of picked) {
    try {
      addFriend({ name: person.name, phone: person.phone })
    } catch (error) {
      if (error instanceof DataError && error.code === 'limit') {
        full = true
        break
      }
    }
  }
  return { added: friendsStore.get().filter((f) => !before.has(f.id)).map((f) => f.id), full }
}

/**
 * "Add from contacts": opens the phone's contact picker and adds whoever is chosen, names and
 * numbers, with no typing. Only where the phone has that picker (Android); elsewhere it isn't shown.
 */
export function ContactsButton({ variant = 'secondary', size = 'md', block = false, onAdded }: Pick<ButtonProps, 'variant' | 'size' | 'block'> & { onAdded?: (ids: string[]) => void }) {
  const t = useT()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  if (!canPickContacts()) return null

  const run = async (): Promise<void> => {
    setBusy(true)
    const picked = await pickContacts()
    setBusy(false)
    if (picked.length === 0) return
    const { added, full } = addContacts(picked)
    if (full) toast(t('friends.contacts.full'), { tone: 'warning' })
    if (added.length === 0) {
      if (!full) toast(t('friends.contacts.known'))
      return
    }
    haptic('success')
    onAdded?.(added)
    toast(t('friends.contacts.toast', { count: added.length }), {
      tone: 'success',
      action: { label: t('common.action.undo'), onAction: () => added.forEach((id) => removeFriend(id)) },
    })
  }

  return (
    <Button type="button" variant={variant} size={size} block={block} iconStart={<Contact />} loading={busy} onClick={() => void run()}>
      {t('friends.contacts.cta')}
    </Button>
  )
}
