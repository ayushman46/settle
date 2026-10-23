import { ChevronDown, Plus } from 'lucide-react'
import { goBack, navigate, Redirect } from '../../app/router'
import { Button, Card, EmptyState, Fab, Illustration, List, PageTitle, Screen, SectionHeader, TopBar } from '../../components'
import { usePools } from '../../data'
import { today } from '../../engine/dates'
import { useT } from '../../i18n'
import { POOLS_ENABLED } from './enabled'
import { NEW_POOL_PATH } from './paths'
import { PoolRow } from './PoolRow'
import styles from './PoolsScreen.module.css'

/**
 * `/app/pools` — collections: the open ones first (progress ring and deadline on each), the closed
 * ones folded away under a disclosure, and a big friendly start when there are none.
 */
export function PoolsScreen() {
  if (!POOLS_ENABLED) return <Redirect to="/app" />
  return <Pools />
}

function Pools() {
  const t = useT()
  const pools = usePools()
  const day = today()
  const open = pools.filter((p) => p.closedAt === null)
  const closed = pools.filter((p) => p.closedAt !== null)
  const startNew = (): void => navigate(NEW_POOL_PATH)

  return (
    <Screen header={<TopBar onBack={() => goBack('/app')} />} contentClassName={styles.content}>
      <PageTitle title={t('pools.list.title')} subtitle={t('pools.list.subtitle')} />

      {pools.length === 0 ? (
        <div className={styles.empty}>
          <EmptyState
            illustration={<Illustration name="empty-activity" />}
            title={t('pools.list.empty.title')}
            text={t('pools.list.empty.text')}
            action={
              <Button size="md" iconStart={<Plus />} onClick={startNew}>
                {t('pools.list.empty.action')}
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <section className={styles.section} aria-labelledby="pools-open">
              <SectionHeader id="pools-open" title={t('pools.list.open')} />
              <Card padding="none">
                <List>
                  {open.map((pool) => (
                    <PoolRow key={pool.id} pool={pool} today={day} />
                  ))}
                </List>
              </Card>
            </section>
          )}
          {closed.length > 0 && (
            <section className={styles.section} aria-labelledby="pools-closed">
              <SectionHeader id="pools-closed" title={t('pools.list.closed')} />
              <details className={styles.closed}>
                <summary>
                  <span>{t('pools.list.closedCount', { count: closed.length })}</span>
                  <ChevronDown className={styles.chevron} aria-hidden="true" />
                </summary>
                <List>
                  {closed.map((pool) => (
                    <PoolRow key={pool.id} pool={pool} today={day} />
                  ))}
                </List>
              </details>
            </section>
          )}
        </>
      )}
      <Fab extended icon={<Plus strokeWidth={2.5} />} label={t('pools.list.fab')} onClick={startNew} />
    </Screen>
  )
}
