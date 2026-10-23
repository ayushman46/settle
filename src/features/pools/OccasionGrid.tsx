import { useRef, type KeyboardEvent } from 'react'
import type { PoolOccasion } from '../../domain/types'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { OCCASION_ORDER, occasionLabel, POOL_TEMPLATES } from './poolTemplates'
import styles from './OccasionGrid.module.css'

export interface OccasionGridProps {
  value: PoolOccasion | null
  onPick: (occasion: PoolOccasion) => void
  /** Names the radio group (the step's heading id). */
  labelledBy: string
}

const COLUMNS = 2

/**
 * The ten occasions as a radio group of big tiles (emoji + label). Arrow keys move between tiles
 * (roving focus); a tap, Enter or Space picks one.
 */
export function OccasionGrid({ value, onPick, labelledBy }: OccasionGridProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const focusIndex = Math.max(0, value ? OCCASION_ORDER.indexOf(value) : 0)

  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    const last = OCCASION_ORDER.length - 1
    let next: number | null = null
    if (event.key === 'ArrowRight') next = index === last ? 0 : index + 1
    else if (event.key === 'ArrowLeft') next = index === 0 ? last : index - 1
    else if (event.key === 'ArrowDown') next = Math.min(last, index + COLUMNS)
    else if (event.key === 'ArrowUp') next = Math.max(0, index - COLUMNS)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    if (next === null) return
    event.preventDefault()
    refs.current[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className={styles.grid}>
      {OCCASION_ORDER.map((id, index) => {
        const selected = value === id
        return (
          <button
            key={id}
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={index === focusIndex ? 0 : -1}
            className={cx(styles.tile, selected && styles.selected)}
            onKeyDown={(event) => move(event, index)}
            onClick={() => {
              haptic('select')
              onPick(id)
            }}
          >
            <span className={styles.emoji} aria-hidden="true">
              {POOL_TEMPLATES[id].emoji}
            </span>
            <span className={styles.label}>{occasionLabel(id)}</span>
          </button>
        )
      })}
    </div>
  )
}
