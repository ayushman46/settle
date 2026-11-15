import { useState } from 'react'
import { Milk, Plus } from 'lucide-react'
import { goBack, navigate } from '../../app/router'
import { Button, Card, EmptyState, List, ListRow, Money, PageTitle, Screen, TopBar } from '../../components'
import { useFriendsById } from '../../data'
import { periodOf, today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { monthBill, readyToClose } from './engine'
import { money, monthName, qtyLabel } from './labels'
import { tallyPath } from './paths'
import { useTallies } from './store'
import { TallyNewSheet } from './TallyNewSheet'
import styles from './Tally.module.css'

/**
 * `/app/tally` — every tally with where its month stands ("November so far: 14 litres, ₹840"), a
 * month that is ready to close first, and starting a new one.
 */
export function TallyScreen() {
  const t = useT()
  const tallies = useTallies()
  const friendsById = useFriendsById()
  const [day] = useState(() => todayIso())
  const [adding, setAdding] = useState<{ opened: number; open: boolean } | null>(null)
  const open = () => setAdding({ opened: Date.now(), open: true })
  const header = <TopBar onBack={() => goBack('/app')} />
  const sheet = adding && (
    <TallyNewSheet
      key={adding.opened}
      open={adding.open}
      onClose={() => setAdding({ ...adding, open: false })}
      onStarted={(tally) => {
        setAdding({ ...adding, open: false })
        navigate(tallyPath(tally.id))
      }}
    />
  )

  if (tallies.length === 0) {
    return (
      <Screen header={header} contentClassName={styles.content}>
        <PageTitle title={t('tally.title')} />
        <EmptyState icon={<Milk />} title={t('tally.empty.title')} text={t('tally.empty.body')} action={<Button onClick={open}>{t('tally.empty.cta')}</Button>} />
        {sheet}
      </Screen>
    )
  }

  const sortName = (id: string): string => friendsById[id]?.name ?? ''
  const rows = tallies
    .map((tally) => {
      const ready = readyToClose(tally, day)
      const period = ready ?? periodOf(day)
      const bill = monthBill(tally, period, day, sortName)
      const vars = { month: monthName(period, day), qty: qtyLabel(tally.unit, bill.qty), amount: money(bill.total, tally.currency) }
      const line = ready ? t('tally.row.ready', vars) : bill.qty > 0 ? t('tally.row.sofar', vars) : t('tally.row.nothing', vars)
      return { tally, ready: ready !== null, bill, line }
    })
    .sort((a, b) => Number(b.ready) - Number(a.ready) || a.tally.createdAt - b.tally.createdAt)

  return (
    <Screen header={header} contentClassName={styles.content}>
      <PageTitle title={t('tally.title')} subtitle={t('tally.subtitle')} />
      <section className={styles.block} aria-labelledby="tally-list">
        <h2 id="tally-list" className={styles.heading}>
          {t('tally.list.heading')}
        </h2>
        <Card padding="none">
          <List aria-labelledby="tally-list">
            {rows.map(({ tally, ready, bill, line }) => (
              <ListRow
                key={tally.id}
                title={tally.name}
                subtitle={line}
                trailing={bill.total > 0 ? <Money value={bill.total} currency={tally.currency} trimZeros strong /> : undefined}
                onClick={() => navigate(tallyPath(tally.id))}
                chevron
                pending={ready}
                aria-label={t('tally.row.aria', { name: tally.name, line })}
              />
            ))}
          </List>
        </Card>
      </section>
      <Button variant="secondary" iconStart={<Plus />} onClick={open}>
        {t('tally.new')}
      </Button>
      {sheet}
    </Screen>
  )
}
