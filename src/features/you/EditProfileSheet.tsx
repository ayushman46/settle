import { useId, useRef, useState, type FormEvent } from 'react'
import { BottomSheet, Button, TextField, useToast } from '../../components'
import { updateProfile, useProfile } from '../../data'
import { useT } from '../../i18n'
import { MAX_NAME_LENGTH, normalizeName } from '../../lib/people'
import { isPhoneUpiId, isValidUpiId, normalizeUpiId } from '../../lib/upi'
import styles from './EditProfileSheet.module.css'

export type ProfileField = 'name' | 'upi'

export interface EditProfileSheetProps {
  open: boolean
  onClose: () => void
  /** The field to start in (the one the person tapped). */
  focus: ProfileField
}

const NAME_ERROR = 'Add your name — friends see it on pay links and share cards.'

/**
 * Your name and UPI ID, edited together. The UPI ID is optional (clearing it removes it); a
 * mistyped one gets a friendly hint instead of being saved.
 */
export function EditProfileSheet({ open, onClose, focus }: EditProfileSheetProps) {
  const t = useT()
  const profile = useProfile()
  const toast = useToast()
  const formId = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const upiRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(profile.name)
  const [upi, setUpi] = useState(profile.upiId ?? '')
  const [errors, setErrors] = useState<{ name?: string; upi?: string }>({})

  // Each opening starts from what's saved now.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setName(profile.name)
      setUpi(profile.upiId ?? '')
      setErrors({})
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const cleanName = normalizeName(name)
    const cleanUpi = upi.trim()
    const next = {
      name: cleanName ? undefined : NAME_ERROR,
      upi: cleanUpi === '' || isValidUpiId(cleanUpi) ? undefined : t('kit.upiForm.error'),
    }
    if (next.name || next.upi) {
      setErrors(next)
      const first = next.name ? nameRef : upiRef
      first.current?.focus()
      return
    }
    const before = { name: profile.name, upiId: profile.upiId }
    const saved = updateProfile({ name: cleanName, upiId: cleanUpi === '' ? null : normalizeUpiId(cleanUpi) })
    onClose()
    if (saved.name !== before.name || saved.upiId !== before.upiId) {
      toast(before.upiId && !saved.upiId ? t('you.edit.removed') : t('you.edit.saved'), { tone: 'success' })
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('you.edit.title')}
      description={t('you.edit.body')}
      initialFocus={focus === 'upi' ? upiRef : nameRef}
      footer={
        <Button block type="submit" form={formId}>
          {t('you.edit.save')}
        </Button>
      }
    >
      <form id={formId} className={styles.form} onSubmit={submit} noValidate>
        <TextField
          ref={nameRef}
          label={t('you.edit.name')}
          value={name}
          maxLength={MAX_NAME_LENGTH * 2}
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="next"
          error={errors.name}
          onChange={(event) => {
            setName(event.target.value)
            if (errors.name) setErrors((e) => ({ ...e, name: undefined }))
          }}
        />
        <TextField
          ref={upiRef}
          label={t('you.edit.upi')}
          placeholder={t('you.edit.upi.placeholder')}
          value={upi}
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          className={styles.upi}
          hint={isPhoneUpiId(upi) ? t('kit.upiForm.hint.phone') : t('you.edit.upi.hint')}
          error={errors.upi}
          onChange={(event) => {
            setUpi(event.target.value.replace(/\s+/g, ''))
            if (errors.upi) setErrors((e) => ({ ...e, upi: undefined }))
          }}
        />
      </form>
    </BottomSheet>
  )
}
