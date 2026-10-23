import { ListRow, ProgressRing } from '../../components'
import type { Pool } from '../../domain/types'
import { poolProgress } from '../../engine/pools'
import { t } from '../../i18n'
import { cx } from '../../lib/cx'
import { navigate } from '../../app/router'
import { poolPath } from './paths'
import { deadlineView, poolRowSubtitle } from './poolView'
import styles from './PoolRow.module.css'

/** The occasion's emoji on a soft tile. */
export function PoolEmoji({ emoji, size = 'md' }: { emoji: string; size?: 'md' | 'lg' }) {
  return (
    <span className={cx(styles.tile, size === 'lg' && styles.tileLg)} aria-hidden="true">
      {emoji}
    </span>
  )
}

/** A deadline chip: `by 30 Oct` (warning within 2 days) or `Ended`. */
export function DeadlineChip({ deadline, today }: { deadline: string | null; today: string }) {
  const view = deadlineView(deadline, today)
  if (!view) return null
  return <span className={cx(styles.chip, view.tone === 'soon' && styles.soon, view.tone === 'ended' && styles.ended)}>{view.label}</span>
}

/** One collection in a list: emoji, title, "₹3,500 of ₹5,000 · 7 of 10 in", ring and deadline. */
export function PoolRow({ pool, today }: { pool: Pool; today: string }) {
  const progress = poolProgress(pool)
  const fraction = progress.goal ? Math.min(1, progress.collected / progress.goal) : 0
  return (
    <ListRow
      leading={<PoolEmoji emoji={pool.emoji} />}
      title={pool.title}
      subtitle={<span className={styles.subtitle}>{poolRowSubtitle(pool, progress)}</span>}
      trailing={
        <span className={styles.trailing}>
          {progress.goal !== null && (
            <ProgressRing value={fraction} size={36} stroke={4} label={t('pools.progress.label')}>
              <span className={styles.ring}>{progress.percent}</span>
            </ProgressRing>
          )}
          {pool.closedAt === null && <DeadlineChip deadline={pool.deadline} today={today} />}
        </span>
      }
      onClick={() => navigate(poolPath(pool.id))}
      chevron
    />
  )
}
