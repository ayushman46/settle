import { useSyncExternalStore, type Ref } from 'react'
import { Mic } from 'lucide-react'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import styles from './MicButton.module.css'

function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/** `navigator.onLine` is only trustworthy when it says false. */
const isOnline = (): boolean => typeof navigator === 'undefined' || navigator.onLine !== false

export interface MicButtonProps {
  /** Accessible name: "Speak to split" (Home) or "Speak instead" (in the sheet). */
  label: string
  /** True while listening: pressed, and the mic pulses (a still ring with reduced motion). */
  listening?: boolean
  onClick: () => void
  /** `pill`: the 44 px round button beside Home's pill; `inline`: inside the sheet's field. */
  variant?: 'pill' | 'inline'
  buttonRef?: Ref<HTMLButtonElement>
  className?: string
}

/**
 * The round mic for "Speak to split". Offline it stays visible but disabled, saying voice needs
 * the internet (the browser's speech service is online).
 */
export function MicButton({ label, listening = false, onClick, variant = 'pill', buttonRef, className }: MicButtonProps) {
  const t = useT()
  const online = useSyncExternalStore(subscribeOnline, isOnline, () => true)
  const offlineNote = t('voice.mic.offline')
  return (
    <button
      ref={buttonRef}
      type="button"
      className={cx(styles.mic, styles[variant], listening && styles.listening, className)}
      aria-label={online ? label : `${label} — ${offlineNote}`}
      aria-pressed={listening}
      title={online ? undefined : offlineNote}
      disabled={!online}
      onClick={onClick}
    >
      <span className={styles.ring} aria-hidden="true" />
      <Mic aria-hidden="true" className={styles.icon} strokeWidth={2.25} />
    </button>
  )
}
