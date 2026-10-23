import { useLayoutEffect, useRef } from 'react'
import { Chip } from '../../components'
import { useT } from '../../i18n'
import { ACTIVITY_FILTERS, type ActivityFilter } from './activityView'
import styles from './ActivityFilters.module.css'

export interface ActivityFiltersProps {
  value: ActivityFilter
  onChange: (filter: ActivityFilter) => void
  /** How many things each filter holds; "To collect" and "To pay" show theirs (splits plus groups that aren't square). */
  counts: Readonly<Record<ActivityFilter, number>>
}

/** Filters that carry a count bubble — the ones asking you to act. */
const COUNTED: ReadonlySet<ActivityFilter> = new Set(['collect', 'pay'])

/** Breathing room (px) left beside a chip scrolled into view. */
const EDGE = 16

/** The filter chips: one at a time, scrolling sideways on narrow phones. */
export function ActivityFilters({ value, onChange, counts }: ActivityFiltersProps) {
  const t = useT()
  const rowRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)

  // A filter remembered from earlier can sit past the edge on a 320px phone: slide the row (only
  // sideways — the page keeps its scroll position) so it shows.
  useLayoutEffect(() => {
    const row = rowRef.current
    const chip = selectedRef.current
    if (!row || !chip) return
    const start = chip.offsetLeft
    const end = start + chip.offsetWidth
    if (end > row.scrollLeft + row.clientWidth) row.scrollLeft = end - row.clientWidth + EDGE
    else if (start < row.scrollLeft) row.scrollLeft = Math.max(0, start - EDGE)
  }, [value])

  return (
    <div ref={rowRef} role="group" aria-label={t('activity.filters.aria')} className={styles.filters}>
      {ACTIVITY_FILTERS.map(({ id, label }) => {
        const count = COUNTED.has(id) ? counts[id] : 0
        const selected = id === value
        return (
          <Chip
            key={id}
            ref={selected ? selectedRef : undefined}
            selected={selected}
            aria-label={count > 0 ? t('activity.filter.counted.aria', { label, count }) : undefined}
            trailing={count > 0 ? <span className={styles.count}>{count > 99 ? '99+' : count}</span> : undefined}
            onClick={() => onChange(id)}
          >
            {label}
          </Chip>
        )
      })}
    </div>
  )
}
