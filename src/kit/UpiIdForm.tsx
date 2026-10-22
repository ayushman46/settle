import { useState, type FormEvent } from 'react'
import { Button, TextField } from '../components'
import { cx } from '../lib/cx'
import { isValidUpiId, normalizeUpiId } from '../lib/upi'
import styles from './UpiIdForm.module.css'

export interface UpiIdFormProps {
  /** Names the field: "Your UPI ID", "UPI ID for Riya". */
  label: string
  /** Called with a valid ID, normalized ("Riya@OkAxis " → "riya@okaxis"). */
  onSave: (upiId: string) => void
  /** Helper text under the field. */
  hint?: string
  /** Default "Save". */
  submitLabel?: string
  autoFocus?: boolean
  className?: string
}

export const UPI_ID_ERROR = 'That doesn’t look like a UPI ID. It’s usually like name@okaxis.'

/**
 * Adds a UPI ID in place (a sheet that needs one, a card asking for yours): one field and a
 * Save button. Only a valid ID is saved; a wrong one gets a friendly hint, after a first try.
 */
export function UpiIdForm({ label, onSave, hint, submitLabel = 'Save', autoFocus = false, className }: UpiIdFormProps) {
  const [text, setText] = useState('')
  const [tried, setTried] = useState(false)
  const valid = isValidUpiId(text)
  const error = tried && text.trim() !== '' && !valid ? UPI_ID_ERROR : undefined

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTried(true)
    if (valid) onSave(normalizeUpiId(text))
  }

  return (
    <form className={cx(styles.form, className)} onSubmit={submit} noValidate>
      <TextField
        label={label}
        placeholder="name@okaxis"
        value={text}
        onChange={(event) => setText(event.target.value.replace(/\s+/g, ''))}
        onBlur={() => {
          if (text.trim() !== '') setTried(true)
        }}
        error={error}
        hint={hint}
        inputMode="email"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        // eslint-disable-next-line jsx-a11y/no-autofocus -- opened on purpose to type the ID
        autoFocus={autoFocus}
        containerClassName={styles.field}
        className={styles.input}
      />
      <Button type="submit" size="md" disabled={text.trim() === ''} className={styles.save}>
        {submitLabel}
      </Button>
    </form>
  )
}
