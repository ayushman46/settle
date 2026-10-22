import { useId } from 'react'
import { Check } from 'lucide-react'
import { Badge, Skeleton } from '../../components'
import type { PlanId } from '../../domain/types'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { planSpokenLabel, type PlanOption } from './plans'
import styles from './PlanPicker.module.css'

export interface PlanPickerProps {
  /** The passes on sale; null while the prices are loading (shimmering cards, never guessed prices). */
  options: readonly PlanOption[] | null
  value: PlanId | null
  onChange: (plan: PlanId) => void
  /** Names the group for assistive tech. Default "Choose your pass". */
  legend?: string
  /** Shows the legend as a visible heading. Default false (the screen's section title names it). */
  showLegend?: boolean
  disabled?: boolean
  /** Tighter cards for the paywall sheet. */
  compact?: boolean
  className?: string
}

/**
 * The Pro passes as big tappable cards — native radio buttons underneath, so arrow keys, screen
 * readers and form semantics all just work. Each card states the term, the price, what it
 * comes to per month and the honest saving.
 */
export function PlanPicker({
  options,
  value,
  onChange,
  legend = 'Choose your pass',
  showLegend = false,
  disabled = false,
  compact = false,
  className,
}: PlanPickerProps) {
  const name = useId()

  if (options === null) {
    return (
      <div className={cx(styles.plans, compact && styles.compact, className)} role="status">
        <span className="visually-hidden">Loading prices…</span>
        {[0, 1, 2].map((i) => (
          <div key={i} className={cx(styles.plan, styles.placeholder)} aria-hidden="true">
            <Skeleton shape="circle" width={22} height={22} />
            <span className={styles.text}>
              <Skeleton width="40%" />
              <Skeleton width="64%" height={12} />
            </span>
            <Skeleton width={48} height={20} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <fieldset className={cx(styles.plans, compact && styles.compact, className)} disabled={disabled}>
      <legend className={showLegend ? styles.legend : 'visually-hidden'}>{legend}</legend>
      {options.map((option) => {
        const checked = option.id === value
        const detail = option.perMonth ? `${option.term} · ${option.perMonth}` : option.term
        return (
          <label key={option.id} className={cx(styles.plan, checked && styles.checked)}>
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={checked}
              aria-label={planSpokenLabel(option)}
              className={styles.input}
              onChange={() => {
                haptic('select')
                onChange(option.id)
              }}
            />
            <span className={styles.dot} aria-hidden="true">
              <Check className={styles.tick} strokeWidth={3.25} />
            </span>
            <span className={styles.text}>
              <span className={styles.nameRow}>
                <span className={styles.name}>{option.name}</span>
                {option.badge && (
                  <Badge tone={option.id === 'pro_yearly' ? 'pro' : 'neutral'} className={styles.badge}>
                    {option.badge}
                  </Badge>
                )}
              </span>
              <span className={styles.detail}>{detail}</span>
            </span>
            <span className={styles.priceBox}>
              <span className={styles.price}>{option.price}</span>
              {option.savingsPercent !== null && (
                <Badge tone="positive" className={styles.save}>
                  Save {option.savingsPercent}%
                </Badge>
              )}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
