import { useId, useState } from 'react'
import { Check, Link2, Sparkles } from 'lucide-react'
import { Avatar, CategoryIcon, Money, SegmentedControl } from '../../components'
import { formatMoney } from '../../lib/money'
import { DEMO_CURRENCY, DEMO_MODES, DESCRIBE_TEXT, heroSplit, heroSummary, HERO_BILL, type DemoMode } from './demo'
import styles from './HeroDemo.module.css'

const MODE_OPTIONS = DEMO_MODES.map((m) => ({ value: m.value, label: m.label, 'aria-label': m.ariaLabel }))

/**
 * The hero's phone: a real split, live. Pick Equally / Exact / % / Shares and the engine
 * re-divides the dinner on the spot; the floating "paid" notification follows Sam's share.
 */
export function HeroDemo() {
  const [mode, setMode] = useState<DemoMode>('shares')
  const captionId = useId()
  const { rows, ok } = heroSplit(mode)
  const option = DEMO_MODES.find((m) => m.value === mode) ?? DEMO_MODES[0]
  const sam = rows.find((row) => row.id === 'sam')
  const total = formatMoney(HERO_BILL.total, DEMO_CURRENCY, { trimZeros: true })

  return (
    <figure className={styles.demo} aria-labelledby={captionId}>
      <figcaption id={captionId} className="visually-hidden">
        Try it: a {total} {HERO_BILL.title.toLowerCase()} split between you, Riya and Sam. Pick a way to split
        it.
      </figcaption>

      <div className={styles.phone}>
        <div className={styles.screen}>
          <div className={styles.island} aria-hidden="true" />
          <div className={styles.head}>
            <CategoryIcon category={HERO_BILL.category} size="sm" />
            <div className={styles.headText}>
              <p className={styles.title}>{HERO_BILL.title}</p>
              <p className={styles.sub}>Today · Paid by you</p>
            </div>
          </div>

          <div className={styles.amount}>
            <Money value={HERO_BILL.total} currency={DEMO_CURRENCY} size="xl" trimZeros />
          </div>

          <SegmentedControl
            options={MODE_OPTIONS}
            value={mode}
            onChange={setMode}
            ariaLabel="Split mode"
            size="sm"
            className={styles.modes}
          />
          <p className={styles.caption}>{option?.caption}</p>

          <div className={styles.rowsCard}>
          <ul className={styles.rows} role="list">
            {rows.map((row) => (
              <li key={row.id} className={styles.row}>
                <Avatar name={row.name} color={row.color} size="sm" />
                <span className={styles.name}>{row.name}</span>
                {row.hint && <span className={styles.hint}>{row.hint}</span>}
                <Money
                  key={`${mode}-${row.id}`}
                  value={row.amount}
                  currency={DEMO_CURRENCY}
                  trimZeros
                  strong
                  className={styles.share}
                />
              </li>
            ))}
          </ul>
          </div>

          {ok && (
            <p className={styles.status}>
              <Check aria-hidden="true" strokeWidth={3} />
              Adds up to {total}
            </p>
          )}
          <div className={styles.fakeAction} aria-hidden="true">
            <Link2 strokeWidth={2.25} />
            Share pay link
          </div>
        </div>
      </div>

      <div className={styles.sayIt} aria-hidden="true">
        <span className={styles.sparkle}>
          <Sparkles strokeWidth={2.25} />
        </span>
        <span className={styles.sayText}>
          {DESCRIBE_TEXT}
          <span className={styles.caret} />
        </span>
      </div>

      {sam && (
        <div className={styles.toast} aria-hidden="true">
          <Avatar name={sam.name} color={sam.color} size="sm" />
          <span className={styles.toastText}>
            <span className={styles.toastTitle}>
              {sam.name} paid you {formatMoney(sam.amount, DEMO_CURRENCY, { trimZeros: true })}
            </span>
            <span className={styles.toastSub}>via UPI · just now</span>
          </span>
          <span className={styles.toastCheck}>
            <Check strokeWidth={3} />
          </span>
        </div>
      )}

      <p className="visually-hidden" aria-live="polite">
        {heroSummary(mode)}
      </p>
    </figure>
  )
}
