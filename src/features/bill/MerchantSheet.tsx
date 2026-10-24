import { useState, type FormEvent } from 'react'
import { ActionBar, BottomSheet, Button, TextField } from '../../components'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { MAX_MERCHANT } from '../../state/reducer'

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
  const t = useT()
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
      title={t(merchant ? 'bill.merchant.rename.title' : 'bill.merchant.name.title')}
      description={t('bill.merchant.description')}
      footer={
        <ActionBar>
          <Button block onClick={() => save()}>
            {t('bill.merchant.save.cta')}
          </Button>
        </ActionBar>
      }
    >
      <form onSubmit={save} noValidate>
        <TextField
          label={t('bill.merchant.label')}
          placeholder={t('bill.merchant.placeholder')}
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
