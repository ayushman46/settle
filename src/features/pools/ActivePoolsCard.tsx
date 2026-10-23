import { navigate } from '../../app/router'
import { SectionHeader } from '../../components'
import { usePools } from '../../data'
import type { Pool } from '../../domain/types'
import { poolProgress } from '../../engine/pools'
import { useT } from '../../i18n'
import { POOLS_PATH, poolPath } from './paths'
import { poolHomeLine } from './poolView'
import styles from './ActivePoolsCard.module.css'

/** Most open collections Home shows. */
export const HOME_POOLS_SHOWN = 2

/** Home's open collections ("🎁 Riya's farewell · ₹3,500 of ₹5,000 · 3 to go"), at most two; nothing when none are open. */
export function ActivePoolsCard() {
  const t = useT()
  const open = usePools().filter((p) => p.closedAt === null)
  if (open.length === 0) return null
  return (
    <section className={styles.section} aria-labelledby="home-pools">
      <SectionHeader
        id="home-pools"
        title={t('pools.home.title')}
        action={{ label: t('pools.home.seeAll'), href: POOLS_PATH, 'aria-label': t('pools.home.seeAllLabel') }}
      />
      <ul role="list" className={styles.list}>
        {open.slice(0, HOME_POOLS_SHOWN).map((pool) => (
          <li key={pool.id} className={styles.item}>
            <PoolLine pool={pool} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function PoolLine({ pool }: { pool: Pool }) {
  const progress = poolProgress(pool)
  const line = poolHomeLine(pool, progress)
  const width = progress.goal ? `${Math.min(100, (progress.collected / progress.goal) * 100)}%` : null
  return (
    <button type="button" className={styles.row} onClick={() => navigate(poolPath(pool.id))}>
      <span className={styles.emoji} aria-hidden="true">
        {pool.emoji}
      </span>
      <span className={styles.text}>
        <span className={styles.title}>{pool.title}</span>{' '}
        <span className={styles.line}>{line}</span>
        {width !== null && (
          <span className={styles.bar} aria-hidden="true">
            <span className={styles.fill} style={{ width }} />
          </span>
        )}
      </span>
    </button>
  )
}
