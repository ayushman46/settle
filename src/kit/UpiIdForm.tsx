import { useState, type FormEvent, type ReactNode } from 'react'
import { Button, TextField } from '../components'
import { ME_ID } from '../domain/types'
import { useT } from '../i18n'
import { cx } from '../lib/cx'
import { isValidUpiId, normalizeUpiId } from '../lib/upi'
import styles from './UpiIdForm.module.css'

export interface UpiIdFormProps {
  /** Whose ID it is: `ME_ID` for you, a friend's id, or null for someone who isn't one of your people. */
  ownerId: string | null
  /** Their name, for the field's label ("UPI ID for Riya"). */
  ownerName: string
  /** Called with a valid ID, normalized ("Riya@OkAxis " → "riya@okaxis"). */
  onSave: (upiId: string) => void
  /** One line above the field ("Riya hasn't added a UPI ID yet…"). */
  lead?: ReactNode
  /** Default "Save UPI ID". */
  submitLabel?: string
  autoFocus?: boolean
  className?: string
}

/** English only (kept for older callers): show `t('kit.upiForm.error')` instead. */
export const UPI_ID_ERROR = 'That doesn’t look like a UPI ID. It’s like name@bank.'

/**
 * Adds a UPI ID in place, where one is missing (a pay sheet, a share sheet asking for yours):
 * one field and a Save button. Only a valid ID is saved; a wrong one gets a friendly hint once
 * they've tried.
 */
export function UpiIdForm({
  ownerId,
  ownerName,
  onSave,
  lead,
  submitLabel,
  autoFocus = false,
  className,
}: UpiIdFormProps) {
  const t = useT()
  const [text, setText] = useState('')
  const [tried, setTried] = useState(false)
  const mine = ownerId === ME_ID
  const valid = isValidUpiId(text)
  const error = tried && text !== '' && !valid ? t('kit.upiForm.error') : undefined

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTried(true)
    if (valid) onSave(normalizeUpiId(text))
  }

  return (
    <form className={cx(styles.form, className)} onSubmit={submit} noValidate>
      {lead != null && <p className={styles.lead}>{lead}</p>}
      <TextField
        label={mine ? t('kit.upiForm.label.mine') : t('kit.upiForm.label', { name: ownerName })}
        placeholder="name@okaxis"
        value={text}
        onChange={(event) => setText(event.target.value.replace(/\s+/g, ''))}
        onBlur={() => {
          if (text !== '') setTried(true)
        }}
        error={error}
        hint={mine ? t('kit.upiForm.hint.mine') : ownerId ? t('kit.upiForm.hint.saved', { name: ownerName }) : undefined}
        inputMode="email"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        autoFocus={autoFocus}
      />
      <Button type="submit" size="md" block disabled={text === ''}>
        {submitLabel ?? t('kit.upiForm.save.cta')}
      </Button>
    </form>
  )
}
