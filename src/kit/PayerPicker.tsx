import { useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import { BottomSheet } from '../components'
import { useFriendsById } from '../data'
import { cx } from '../lib/cx'
import { haptic } from '../lib/haptics'
import { FriendAvatar } from './FriendAvatar'
import { friendLabel } from './friendName'
import styles from './PayerPicker.module.css'

export interface PayerPickerProps {
  /** friendId of who paid. */
  value: string
  onChange: (friendId: string) => void
  /** Everyone who could have paid, in display order (usually the people in the split). */
  candidates: readonly string[]
  /** Words before the name on the chip. Default "Paid by". */
  label?: string
  disabled?: boolean
  className?: string
}

/** Unique ids, in order, with the current payer kept even if they're no longer a candidate. */
function payerOptions(candidates: readonly string[], value: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const id of candidates) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  if (value && !seen.has(value)) out.unshift(value)
  return out
}

/**
 * "Paid by You ▾" — a chip that opens a sheet of big avatars to pick who paid. With nobody else
 * to choose from it's a plain label.
 */
export function PayerPicker({ value, onChange, candidates, label = 'Paid by', disabled = false, className }: PayerPickerProps) {
  const [open, setOpen] = useState(false)
  const friendsById = useFriendsById()
  const options = payerOptions(candidates, value)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const selectedRef = useRef<HTMLButtonElement | null>(null)
  const name = friendLabel(value, friendsById[value] ?? null)
  const choosable = options.length > 1 && !disabled

  const chipBody = (
    <>
      <span className={styles.lead}>{label}</span>{' '}
      <FriendAvatar friendId={value} size="xs" />
      <span className={styles.name}>{name}</span>
    </>
  )

  if (!choosable) {
    return <span className={cx(styles.chip, styles.static, disabled && styles.disabled, className)}>{chipBody}</span>
  }

  const choose = (id: string): void => {
    if (id !== value) {
      haptic('select')
      onChange(id)
    }
    setOpen(false)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const current = optionRefs.current.findIndex((el) => el === document.activeElement)
    const n = options.length
    let target: number
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        target = (Math.max(current, 0) + 1) % n
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        target = (Math.max(current, 0) - 1 + n) % n
        break
      case 'Home':
        target = 0
        break
      case 'End':
        target = n - 1
        break
      default:
        return
    }
    event.preventDefault()
    optionRefs.current[target]?.focus()
  }

  const selectedIndex = Math.max(0, options.indexOf(value))

  return (
    <>
      <button
        type="button"
        className={cx(styles.chip, className)}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          haptic('tap')
          setOpen(true)
        }}
      >
        {chipBody}
        <ChevronDown className={styles.chevron} aria-hidden="true" strokeWidth={2.5} />
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Who paid?"
        description="Everyone else pays them back."
        initialFocus={selectedRef}
      >
        <div role="radiogroup" aria-label="Who paid" className={styles.grid} onKeyDown={onKeyDown}>
          {options.map((id, i) => {
            const checked = id === value
            return (
              <button
                key={id}
                ref={(el) => {
                  optionRefs.current[i] = el
                  if (checked) selectedRef.current = el
                }}
                type="button"
                role="radio"
                aria-checked={checked}
                tabIndex={i === selectedIndex ? 0 : -1}
                className={cx(styles.option, checked && styles.checked)}
                onClick={() => choose(id)}
              >
                <FriendAvatar friend={friendsById[id] ?? null} friendId={id} size="lg" showName selected={checked} />
              </button>
            )
          })}
        </div>
      </BottomSheet>
    </>
  )
}
