import { useId, useState } from 'react'
import { BottomSheet, Button } from '../../components'
import { useT } from '../../i18n'
import { navigate } from '../../app/router'
import { haptic } from '../../lib/haptics'
import { CLAIM_REPLY_PATH, replyFragmentIn } from '../../share/claim'
import styles from './PasteReplySheet.module.css'

export interface PasteReplySheetProps {
  open: boolean
  onClose: () => void
}

/**
 * "Paste a reply": for a reply that opened in the browser instead of the app (iOS), or one that
 * came by SMS. Takes the first reply link (or bare fragment) in the text and opens it.
 */
export function PasteReplySheet({ open, onClose }: PasteReplySheetProps) {
  const t = useT()
  const id = useId()
  const [text, setText] = useState('')
  const [error, setError] = useState(false)
  const close = () => {
    setText('')
    setError(false)
    onClose()
  }

  const read = () => {
    const fragment = replyFragmentIn(text)
    if (!fragment) {
      haptic('error')
      setError(true)
      return
    }
    close()
    navigate(`${CLAIM_REPLY_PATH}${fragment.startsWith('#') ? fragment : `#${fragment}`}`)
  }

  return (
    <BottomSheet
      open={open}
      onClose={close}
      title={t('claim.paste.title')}
      footer={
        <Button block disabled={text.trim() === ''} onClick={read}>
          {t('claim.paste.read')}
        </Button>
      }
    >
      <label htmlFor={id} className={styles.label}>
        {t('claim.paste.label')}
      </label>
      <textarea
        id={id}
        className={styles.area}
        rows={5}
        value={text}
        aria-invalid={error || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          setText(event.target.value)
          setError(false)
        }}
      />
      {error && (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {t('claim.paste.none')}
        </p>
      )}
    </BottomSheet>
  )
}
