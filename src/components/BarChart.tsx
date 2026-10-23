import { useState, type CSSProperties } from 'react'
import { useT } from '../i18n'
import { cx } from '../lib/cx'
import { barHeights } from './chartMath'
import styles from './BarChart.module.css'

export interface BarDatum {
  key: string
  /** Short label under the bar ("Oct"). */
  label: string
  value: number
  /** Fuller name for the summary and table ("October 2026"). Defaults to `label`. */
  longLabel?: string
}

export interface BarChartProps {
  data: readonly BarDatum[]
  formatValue: (value: number) => string
  /** What the chart shows ("Spending by month") — names the image and captions the table. */
  ariaLabel?: string
  /** Header of the table's label column. Default "Period". */
  labelHeader?: string
  /** Header of the table's value column. Default "Amount". */
  valueHeader?: string
  /** Plot height in px (bars + value bubble; labels sit below). Default 168. */
  height?: number
  /** Highlighted bar (controlled). Default: the latest bar with a value, then whatever is tapped. */
  activeKey?: string | null
  onActiveChange?: (key: string) => void
  className?: string
}

/**
 * Column chart: rounded bars that grow in, one highlighted with its value in a bubble above
 * (tap another to move it). Exposed as an image with a spoken summary plus a visually hidden table.
 */
export function BarChart({
  data,
  formatValue,
  ariaLabel: ariaLabelProp,
  labelHeader,
  valueHeader,
  height = 168,
  activeKey,
  onActiveChange,
  className,
}: BarChartProps) {
  const t = useT()
  const ariaLabel = ariaLabelProp ?? t('ui.chart.bar.aria')
  const latest = [...data].reverse().find((d) => d.value > 0)?.key ?? null
  const [picked, setPicked] = useState<string | null>(null)
  const current = activeKey !== undefined ? activeKey : (picked ?? latest)
  const heights = barHeights(data.map((d) => d.value))
  const count = data.length
  const max = data.reduce<BarDatum | null>((best, d) => (d.value > (best?.value ?? 0) ? d : best), null)
  const summary =
    count === 0 || !max
      ? t('ui.chart.bar.summary.empty', { label: ariaLabel })
      : t('ui.chart.bar.summary', { label: ariaLabel, count, name: max.longLabel ?? max.label, value: formatValue(max.value) })

  const pick = (key: string): void => {
    setPicked(key)
    onActiveChange?.(key)
  }

  return (
    <figure className={cx(styles.figure, className)}>
      <div role="img" aria-label={summary} className={styles.plot} style={{ height } as CSSProperties}>
        {data.map((d, i) => {
          const active = d.key === current
          const edge = i === 0 ? styles.first : i === count - 1 ? styles.last : undefined
          return (
            <div
              key={d.key}
              className={cx(styles.column, active && styles.active, edge)}
              style={{ '--bar': String(heights[i] ?? 0), '--i': String(i) } as CSSProperties}
              onClick={() => pick(d.key)}
            >
              {active && d.value > 0 && <span className={styles.bubble}>{formatValue(d.value)}</span>}
              <span className={cx(styles.bar, (heights[i] ?? 0) === 0 && styles.zero)} />
            </div>
          )
        })}
      </div>
      <div className={styles.labels} aria-hidden="true">
        {data.map((d) => (
          <span key={d.key} className={cx(styles.label, d.key === current && styles.labelActive)}>
            {d.label}
          </span>
        ))}
      </div>
      <table className="visually-hidden">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">{labelHeader ?? t('ui.chart.bar.period')}</th>
            <th scope="col">{valueHeader ?? t('ui.chart.bar.amount')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.longLabel ?? d.label}</th>
              <td>{formatValue(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
