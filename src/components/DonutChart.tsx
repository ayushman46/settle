import { useState, type CSSProperties, type ReactNode } from 'react'
import { cx } from '../lib/cx'
import { ARC_UNITS, donutSegments, summarize, wholePercents } from './chartMath'
import styles from './DonutChart.module.css'

export interface DonutDatum {
  key: string
  value: number
  /** Any CSS colour — usually a token, e.g. `categoryColor('food')`. */
  color: string
  label: string
}

export interface DonutChartProps {
  data: readonly DonutDatum[]
  /** Small line in the middle (e.g. "Spent"). Replaced by the picked slice's name. */
  centerLabel?: ReactNode
  /** Big line in the middle (e.g. a `Money`). Replaced by the picked slice's value. */
  centerValue?: ReactNode
  /** Formats values for the legend, the summary and the table. Default: the plain number. */
  formatValue?: (value: number) => string
  /** What the chart shows ("Spending by category") — names the image and captions the table. */
  ariaLabel?: string
  /** Diameter in px (shrinks to fit). Default 208. */
  size?: number
  /** Ring thickness in px. Default 22. */
  thickness?: number
  /** Show a legend under the ring (tap an entry to spotlight its slice). */
  legend?: boolean
  className?: string
}

/** Gap between slices, in px along the ring. */
const GAP_PX = 3

/**
 * Ring chart with rounded, gently separated slices that sweep in. Tap a slice (or a legend entry)
 * to spotlight it in the middle. Accessible as an image with a spoken summary, plus the full
 * numbers as a legend list or, without a legend, a visually hidden table.
 */
export function DonutChart({
  data,
  centerLabel,
  centerValue,
  formatValue = String,
  ariaLabel = 'Breakdown',
  size = 208,
  thickness = 22,
  legend = false,
  className,
}: DonutChartProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const values = data.map((d) => d.value)
  const percents = wholePercents(values)
  const r = (size - thickness) / 2
  const circumference = 2 * Math.PI * r
  const toUnits = (px: number): number => (px / circumference) * ARC_UNITS
  const segments = donutSegments(values, toUnits(thickness), toUnits(GAP_PX))
  const active = data.find((d) => d.key === activeKey && d.value > 0) ?? null
  const activeIndex = active ? data.indexOf(active) : -1
  const summary = `${ariaLabel}: ${summarize(data.map((d, i) => ({ label: d.label, percent: percents[i] ?? 0 })))}`
  const toggle = (key: string): void => setActiveKey((current) => (current === key ? null : key))

  return (
    <figure className={cx(styles.figure, className)}>
      <div className={styles.chart} style={{ maxWidth: size } as CSSProperties}>
        <svg role="img" aria-label={summary} viewBox={`0 0 ${size} ${size}`} className={styles.svg}>
          <circle className={styles.track} cx={size / 2} cy={size / 2} r={r} strokeWidth={thickness} />
          {segments.map((seg, order) => {
            const datum = data[seg.index]
            if (!datum) return null
            return (
              <circle
                key={datum.key}
                className={cx(styles.slice, active && datum.key !== active.key && styles.dim)}
                cx={size / 2}
                cy={size / 2}
                r={r}
                strokeWidth={thickness}
                pathLength={ARC_UNITS}
                strokeDasharray={`${seg.length} ${ARC_UNITS - seg.length}`}
                strokeDashoffset={-seg.start}
                style={{ stroke: datum.color, animationDelay: `${order * 70}ms` }}
                onClick={() => toggle(datum.key)}
              />
            )
          })}
        </svg>
        {/* Visual only: the legend (or the table) carries the same numbers for assistive tech. */}
        <div className={styles.center} aria-hidden="true">
          {active ? (
            <span key={active.key} className={styles.centerSwap}>
              <span className={styles.centerLabel}>{active.label}</span>
              <span className={styles.centerValue}>{formatValue(active.value)}</span>
              <span className={styles.centerPercent}>{percents[activeIndex] ?? 0}%</span>
            </span>
          ) : (
            <span className={styles.centerSwap}>
              {centerLabel != null && <span className={styles.centerLabel}>{centerLabel}</span>}
              {centerValue != null && <span className={styles.centerValue}>{centerValue}</span>}
            </span>
          )}
        </div>
      </div>
      {legend ? (
        <ul role="list" className={styles.legend} aria-label={ariaLabel}>
          {data.map((d, i) => (
            <li key={d.key}>
              <button
                type="button"
                className={cx(styles.entry, activeKey === d.key && styles.entryActive)}
                aria-pressed={activeKey === d.key}
                disabled={d.value <= 0}
                onClick={() => toggle(d.key)}
              >
                <span className={styles.swatch} style={{ background: d.color }} aria-hidden="true" />
                <span className={styles.entryLabel}>{d.label}</span>
                <span className={styles.entryValue}>{formatValue(d.value)}</span>
                <span className={styles.entryPercent}>{percents[i] ?? 0}%</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <table className="visually-hidden">
          <caption>{ariaLabel}</caption>
          <tbody>
            {data.map((d, i) => (
              <tr key={d.key}>
                <th scope="row">{d.label}</th>
                <td>{formatValue(d.value)}</td>
                <td>{percents[i] ?? 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  )
}
