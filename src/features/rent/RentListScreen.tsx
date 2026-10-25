import { Building2, Plus } from 'lucide-react'
import { goBack, navigate, Redirect } from '../../app/router'
import { Button, Card, EmptyState, List, ListRow, PageTitle, Screen, TopBar } from '../../components'
import { useT } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { RENT_ENABLED, RENT_NEW_PATH, rentPath } from './enabled'
import { useRents } from './store'
import styles from './Rent.module.css'

/** `/app/rent` — the flats you share rent for, or what this is before the first one. */
export function RentListScreen() {
  if (!RENT_ENABLED) return <Redirect to="/app" />
  return <RentList />
}

function RentList() {
  const t = useT()
  const rents = useRents()
  const add = () => navigate(RENT_NEW_PATH)
  return (
    <Screen
      header={
        <TopBar
          onBack={() => goBack('/app')}
          right={
            rents.length > 0 ? (
              <Button size="sm" variant="tonal" iconStart={<Plus />} onClick={add}>
                {t('rent.list.new')}
              </Button>
            ) : undefined
          }
        />
      }
      contentClassName={styles.content}
    >
      <PageTitle title={t('rent.list.title')} subtitle={t('rent.list.subtitle')} />
      {rents.length === 0 ? (
        <EmptyState
          icon={<Building2 />}
          title={t('rent.list.empty.title')}
          text={t('rent.list.empty.text')}
          action={<Button onClick={add}>{t('rent.list.empty.cta')}</Button>}
        />
      ) : (
        <Card padding="none">
          <List aria-label={t('rent.list.title')}>
            {rents.map((rent) => (
              <ListRow
                key={rent.id}
                leading={<Building2 aria-hidden="true" />}
                title={rent.name}
                subtitle={t('rent.row.line', { amount: formatMoney(rent.monthly, 'INR', { trimZeros: true }), count: rent.tenants.length })}
                onClick={() => navigate(rentPath(rent.id))}
                chevron
              />
            ))}
          </List>
        </Card>
      )}
    </Screen>
  )
}
