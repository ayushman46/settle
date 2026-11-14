import { useId, useState } from 'react'
import { ClipboardPaste } from 'lucide-react'
import { Button, Chip, TextField } from '../components'
import { useT } from '../i18n'
import { haptic } from '../lib/haptics'
import { GUESS_APPS, guessUpiId, mobileOf, upiIdIn, type GuessApp } from '../lib/upiGuess'
import styles from './UpiGuess.module.css'

export interface UpiGuessProps {
  /** A number already known (yours, from an earlier form): the field starts with it. */
  phone?: string | null
  /** Called with the ID to put in the field. */
  onPick: (upiId: string) => void
}

/**
 * Your UPI ID without typing it: your mobile number (the keyboard offers it in one tap) and the
 * app you use on it give the ID for PhonePe, BHIM and Amazon Pay; or paste the ID you copied in
 * your UPI app. The typed field stays the fallback, and Save is still the person's own tap.
 */
export function UpiGuess({ phone = null, onPick }: UpiGuessProps) {
  const t = useT()
  const id = useId()
  const [number, setNumber] = useState(() => mobileOf(phone) ?? '')
  const [picked, setPicked] = useState<{ app: GuessApp; upi: string } | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const mobile = mobileOf(number)
  const canPaste = typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function'

  const pick = (app: GuessApp): void => {
    const upi = guessUpiId(number, app)
    if (!upi) return
    haptic('tap')
    setProblem(null)
    setPicked({ app, upi })
    onPick(upi)
  }

  const paste = async (): Promise<void> => {
    let found: string | null
    try {
      found = upiIdIn(await navigator.clipboard.readText())
    } catch {
      found = null
    }
    if (!found) {
      haptic('error')
      setProblem(t('kit.guess.paste.none'))
      return
    }
    haptic('success')
    setProblem(null)
    setPicked(null)
    onPick(found)
  }

  const app = picked ? GUESS_APPS.find((a) => a.id === picked.app) : undefined
  return (
    <div className={styles.guess}>
      <TextField
        label={t('kit.guess.phone.label')}
        value={number}
        onChange={(event) => {
          setNumber(event.target.value.replace(/[^\d+\s-]/g, '').slice(0, 16))
          setPicked(null)
        }}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="98765 43210" /* i18n-ignore: an example number */
        hint={t('kit.guess.phone.hint')}
      />
      <div className={styles.apps} role="group" aria-label={t('kit.guess.apps.aria')}>
        {GUESS_APPS.map((a) => (
          <Chip key={a.id} selected={picked?.app === a.id} disabled={!mobile} onClick={() => pick(a.id)} aria-describedby={`${id}-said`}>
            {a.name}
          </Chip>
        ))}
      </div>
      {canPaste && (
        <Button type="button" variant="ghost" size="sm" iconStart={<ClipboardPaste />} onClick={() => void paste()}>
          {t('kit.guess.paste')}
        </Button>
      )}
      <p id={`${id}-said`} className={problem ? styles.problem : styles.said} role="status">
        {problem ?? (picked && app ? t('kit.guess.made', { app: app.name, upi: picked.upi }) : t('kit.guess.gpay'))}
      </p>
    </div>
  )
}
