import { useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { cx } from '../lib/cx'
import { haptic } from '../lib/haptics'
import { GROUP_EMOJIS } from './emoji'
import styles from './EmojiPicker.module.css'

export interface EmojiPickerProps {
  value: string
  onChange: (emoji: string) => void
  /** Choices. Default: 24 curated group emojis. A `value` that isn't listed is shown first. */
  options?: readonly string[]
  /** Names the group. Default "Emoji". */
  label?: string
  /** Columns in the grid (arrow keys move by rows of this size). Default 6. */
  columns?: number
  className?: string
}

/**
 * Compact emoji grid (radiogroup): tap to pick; arrow keys move in two dimensions, Home/End jump
 * to the ends. Only the picked emoji is in the tab order.
 */
export function EmojiPicker({ value, onChange, options = GROUP_EMOJIS, label = 'Emoji', columns = 6, className }: EmojiPickerProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const unique = Array.from(new Set(options))
  const choices = value !== '' && !unique.includes(value) ? [value, ...unique] : unique
  const selected = choices.indexOf(value)
  const tabbable = selected >= 0 ? selected : 0
  const cols = Math.max(1, Math.floor(columns))

  const pick = (i: number, focus: boolean): void => {
    const emoji = choices[i]
    if (emoji === undefined) return
    if (focus) refs.current[i]?.focus()
    if (emoji === value) return
    haptic('select')
    onChange(emoji)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const from = selected >= 0 ? selected : 0
    const last = choices.length - 1
    const moves: Record<string, number> = {
      ArrowRight: Math.min(last, from + 1),
      ArrowLeft: Math.max(0, from - 1),
      ArrowDown: from + cols <= last ? from + cols : from,
      ArrowUp: from - cols >= 0 ? from - cols : from,
      Home: 0,
      End: last,
    }
    const target = moves[event.key]
    if (target === undefined) return
    event.preventDefault()
    pick(target, true)
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(styles.grid, className)}
      style={{ '--cols': String(cols) } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      {choices.map((emoji, i) => (
        <button
          key={emoji}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="button"
          role="radio"
          aria-checked={i === selected}
          tabIndex={i === tabbable ? 0 : -1}
          className={cx(styles.option, i === selected && styles.selected)}
          onClick={() => pick(i, false)}
        >
          <span className={styles.glyph}>{emoji}</span>
        </button>
      ))}
    </div>
  )
}
