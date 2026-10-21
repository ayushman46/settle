import { useState, type FormEvent } from 'react'
import { ActionBar, BottomSheet, Button, TextField } from '../components'
import { haptic } from '../lib/haptics'
import { MAX_MERCHANT } from '../state/reducer'

export interface MerchantSheetProps {
  open: boolean
  /** Current name (null when the bill has none). Mount with a fresh `key` per opening. */
  merchant: string | null
  onClose: () => void
  /** The typed name; empty clears it. */
  onSave: (name: string) => void
}

/** Names the bill (restaurant or shop) — it heads the split people get. */
export function MerchantSheet({ open, merchant, onClose, onSave }: MerchantSheetProps) {
  const [name, setName] = useState(merchant ?? '')

  const save = (event?: FormEvent): void => {
    event?.preventDefault()
    haptic('success')
    onSave(name)
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={merchant ? 'Rename this bill' : 'Name this bill'}
      description="It heads the split you share."
      footer={
        <ActionBar>
          <Button block onClick={() => save()}>
            Save
          </Button>
        </ActionBar>
      }
    >
      <form onSubmit={save} noValidate>
        <TextField
          label="Restaurant or shop"
          placeholder="e.g. Saffron Table"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          maxLength={MAX_MERCHANT}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="done"
        />
      </form>
    </BottomSheet>
  )
}
