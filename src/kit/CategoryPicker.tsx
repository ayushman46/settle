import { useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import { Sparkles } from 'lucide-react'
import { CategoryIcon } from '../components'
import { CATEGORY_IDS, type CategoryId } from '../domain/types'
import { CATEGORY_META } from '../engine/categories'
import { cx } from '../lib/cx'
import { haptic } from '../lib/haptics'
import styles from './CategoryPicker.module.css'

export interface CategoryPickerProps {
  value: CategoryId
  onChange: (category: CategoryId) => void
  /** What the title hints at (e.g. from `categoryFromText`) — marked with a sparkle until it's picked. */
  suggested?: CategoryId | null
  /** Names the group for assistive tech. Default "Category". */
  label?: string
  /** Let the row scroll edge to edge, past the screen's side gutter. Default true. */
  bleed?: boolean
  id?: string
  className?: string
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Scrolls `chip` to the middle of `scroller` when any part of it is hidden. */
function revealChip(scroller: HTMLElement, chip: HTMLElement, smooth: boolean): void {
  const viewStart = scroller.scrollLeft
  const viewEnd = viewStart + scroller.clientWidth
  const start = chip.offsetLeft
  const end = start + chip.offsetWidth
  const margin = 8
  if (start >= viewStart + margin && end <= viewEnd - margin) return
  const max = Math.max(0, scroller.scrollWidth - scroller.clientWidth)
  const left = Math.min(max, Math.max(0, start - (scroller.clientWidth - chip.offsetWidth) / 2))
  if (Math.abs(left - viewStart) < 1) return
  if (typeof scroller.scrollTo === 'function') {
    scroller.scrollTo({ left, behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' })
  } else {
    scroller.scrollLeft = left
  }
}

/**
 * Category chips in one swipeable row (radiogroup): the tinted icon tile plus its name. Arrow
 * keys move the choice, Home/End jump to the ends, and the chosen one is always scrolled into view.
 */
export function CategoryPicker({ value, onChange, suggested = null, label = 'Category', bleed = true, id, className }: CategoryPickerProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const mounted = useRef(false)
  const index = CATEGORY_IDS.indexOf(value)
  const focusable = index >= 0 ? index : 0

  useLayoutEffect(() => {
    const scroller = scrollerRef.current
    const chip = refs.current[index]
    if (scroller && chip) revealChip(scroller, chip, mounted.current)
    mounted.current = true
  }, [index])

  const select = (i: number, focus: boolean): void => {
    const next = CATEGORY_IDS[i]
    if (next === undefined) return
    if (focus) refs.current[i]?.focus()
    if (next === value) return
    haptic('select')
    onChange(next)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const n = CATEGORY_IDS.length
    const from = index >= 0 ? index : 0
    let target: number
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        target = (from + 1) % n
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        target = (from - 1 + n) % n
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
    select(target, true)
  }

  return (
    <div
      ref={scrollerRef}
      id={id}
      role="radiogroup"
      aria-label={label}
      className={cx(styles.scroller, bleed && styles.bleed, className)}
      onKeyDown={onKeyDown}
    >
      {CATEGORY_IDS.map((category, i) => {
        const checked = i === index
        const hinted = category === suggested && !checked
        return (
          <button
            key={category}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={i === focusable ? 0 : -1}
            data-category={category}
            className={cx(styles.option, checked && styles.checked, hinted && styles.suggested)}
            onClick={() => select(i, false)}
          >
            <CategoryIcon category={category} size="sm" className={styles.icon} />
            <span className={styles.label}>{CATEGORY_META[category].label}</span>
            {hinted && (
              <span className={styles.spark}>
                <Sparkles aria-hidden="true" strokeWidth={2.5} />
                <span className="visually-hidden">, suggested</span>
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
