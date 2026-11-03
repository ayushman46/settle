/**
 * Pasting your bank's SMS: one message or a whole thread, each charge in it read on the phone
 * (src/features/fees/sms.ts) and kept — and a charge put back ("reversal of AMB charges") noted on
 * the one it reverses. With Undo.
 */
import { useId, useState } from 'react'
import { ClipboardPaste } from 'lucide-react'
import { BottomSheet, Button, useToast } from '../../components'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { trackChargeSms } from './track'
import styles from './Fees.module.css'

export function FeePasteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const toast = useToast()
  const id = useId()
  const [text, setText] = useState('')
  const [none, setNone] = useState(false)
  const check = (): void => {
    const result = trackChargeSms([text], 'sms', todayIso())
    if (result.added.length + result.reversed === 0 && result.known === 0) {
      haptic('error')
      setNone(true)
      return
    }
    if (result.added.length + result.reversed === 0) {
      // Only charges already kept: nothing to undo.
      haptic('tap')
      toast(t('fees.paste.known'))
    } else {
      haptic('success')
      toast(t('fees.paste.found', { count: result.added.length, back: result.reversed }), { tone: 'success', action: { label: t('common.action.undo'), onAction: result.undo } })
    }
    setText('')
    setNone(false)
    onClose()
  }
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('fees.paste.title')}
      description={t('fees.paste.text')}
      footer={
        <Button block disabled={text.trim().length < 10} onClick={check}>
          {t('fees.paste.check')}
        </Button>
      }
    >
      <div className={styles.paste}>
        <div className={styles.pasteHead}>
          <label htmlFor={`${id}-sms`} className={styles.pasteLabel}>
            {t('fees.paste.label')}
          </label>
          {canReadClipboard() && (
            <Button
              size="sm"
              variant="secondary"
              iconStart={<ClipboardPaste />}
              onClick={() =>
                void navigator.clipboard
                  .readText()
                  .then((value) => {
                    if (value.trim()) setText((current) => (current.trim() ? `${current.trim()}\n\n${value.trim()}` : value.trim()))
                  })
                  .catch(() => undefined)
              }
            >
              {t('fees.paste.fromClipboard')}
            </Button>
          )}
        </div>
        <textarea
          id={`${id}-sms`}
          className={styles.area}
          value={text}
          placeholder={t('fees.paste.placeholder')}
          maxLength={20_000}
          onChange={(event) => {
            setText(event.currentTarget.value)
            setNone(false)
          }}
          aria-describedby={none ? `${id}-none` : undefined}
        />
        {none && (
          <p id={`${id}-none`} className={styles.error} role="status">
            {t('fees.paste.none')}
          </p>
        )}
      </div>
    </BottomSheet>
  )
}

/** The browser can read the clipboard here (asked on the tap). */
function canReadClipboard(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function'
}
