import { useState } from 'react'
import { navigate } from '../../app/router'
import { ActionBar, BottomSheet, Button, TextField } from '../../components'
import { useT } from '../../i18n'
import { fragmentOf } from '../../share/fragment'
import { PAID_REPLY_PATH } from '../../share/paidReply'

/**
 * Pastes a friend's "I've paid" reply link and opens it — for when the link opened somewhere
 * your splits aren't (the installed app on iPhone keeps its own data, apart from Safari).
 */
export function PastePaidReplySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const [text, setText] = useState('')
  const [error, setError] = useState(false)
  const submit = (): void => {
    const fragment = fragmentOf(text)
    // A payment reply link (or its bare fragment) — not some other Settle link.
    const linkLike = text.includes('://') || text.includes('/')
    if (!fragment || (linkLike && !text.includes(PAID_REPLY_PATH))) {
      setError(true)
      return
    }
    onClose()
    setText('')
    navigate(`${PAID_REPLY_PATH}#${fragment}`)
  }
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('expense.paidReply.paste.title')}
      description={t('expense.paidReply.paste.text')}
      footer={
        <ActionBar>
          <Button block disabled={text.trim() === ''} onClick={submit}>
            {t('expense.paidReply.paste.open')}
          </Button>
        </ActionBar>
      }
    >
      <TextField
        label={t('expense.paidReply.paste.label')}
        value={text}
        error={error ? t('expense.paidReply.paste.invalid') : undefined}
        autoFocus
        onChange={(event) => {
          setText(event.target.value)
          setError(false)
        }}
      />
    </BottomSheet>
  )
}
