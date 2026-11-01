import { useId, useState } from 'react'
import { ClipboardPaste, PenLine } from 'lucide-react'
import { navigate } from '../../app/router'
import { ActionBar, Banner, BottomSheet, Button, useToast } from '../../components'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { readStuckMessage } from './detect'
import { STUCK_NEW_PATH } from './paths'
import { openStuckAdd, prefillFromSignal } from './prefill'
import { useTickBack } from './useTickBack'
import styles from './Stuck.module.css'

export interface StuckPasteSheetProps {
  open: boolean
  onClose: () => void
}

/**
 * "Paste the bank SMS or app message": a failed or pending payment, or a refund a business has
 * started, opens Add with it filled in; money that came back ticks off the stuck payment it
 * belongs to (with Undo); anything else says so kindly, with "Add it yourself". Read on the phone.
 */
export function StuckPasteSheet({ open, onClose }: StuckPasteSheetProps) {
  const t = useT()
  const toast = useToast()
  const fieldId = useId()
  const [text, setText] = useState('')
  const [missed, setMissed] = useState(false)
  const tickBack = useTickBack()
  const canPaste = typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function'

  const close = (): void => {
    setMissed(false)
    onClose()
  }

  const read = (value: string): void => {
    const signal = readStuckMessage(value, { today: todayIso() })
    if (signal && (signal.type === 'reversal' || signal.type === 'refund_credited')) {
      close()
      setText('')
      tickBack(signal)
      return
    }
    const prefill = signal ? prefillFromSignal(signal, 'sms') : null
    if (!prefill) {
      haptic('tap')
      setMissed(true)
      return
    }
    haptic('success')
    close()
    setText('')
    openStuckAdd(prefill)
  }

  const paste = async (): Promise<void> => {
    try {
      const clip = await navigator.clipboard.readText()
      if (!clip.trim()) {
        toast(t('stuck.paste.empty'))
        return
      }
      setText(clip)
      read(clip)
    } catch {
      toast(t('stuck.paste.denied'), { tone: 'warning' })
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={close}
      title={t('stuck.paste.title')}
      description={t('stuck.paste.text')}
      footer={
        <ActionBar>
          <Button block disabled={text.trim() === ''} onClick={() => read(text)}>
            {t('stuck.paste.read')}
          </Button>
        </ActionBar>
      }
    >
      <div className={styles.paste}>
        <label htmlFor={fieldId} className={styles.pasteLabel}>
          {t('stuck.paste.label')}
        </label>
        <textarea
          id={fieldId}
          className={styles.area}
          rows={5}
          value={text}
          placeholder={t('stuck.paste.placeholder')}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(event) => {
            setText(event.target.value)
            setMissed(false)
          }}
        />
        {canPaste && (
          <Button variant="ghost" size="md" iconStart={<ClipboardPaste />} className={styles.pasteButton} onClick={() => void paste()}>
            {t('stuck.paste.clipboard')}
          </Button>
        )}
        {missed && (
          <Banner
            tone="info"
            title={t('stuck.paste.missed.title')}
            actions={
              <Button
                size="sm"
                variant="secondary"
                iconStart={<PenLine />}
                onClick={() => {
                  close()
                  navigate(STUCK_NEW_PATH)
                }}
              >
                {t('stuck.paste.missed.cta')}
              </Button>
            }
          >
            {t('stuck.paste.missed.text')}
          </Banner>
        )}
        <p className={styles.fine}>{t('stuck.paste.private')}</p>
      </div>
    </BottomSheet>
  )
}
