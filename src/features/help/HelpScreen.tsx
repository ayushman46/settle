import { useState } from 'react'
import { Plus, User } from 'lucide-react'
import { goBack, navigate } from '../../app/router'
import { Button, Card, EmptyState, IconButton, ListRow, Money, PageTitle, Screen, TopBar } from '../../components'
import { useT } from '../../i18n'
import { today as todayIso } from '../../engine/dates'
import { monthSheet, workingPeriod } from './engine'
import { useHelpers } from './store'
import { monthName, workLabel } from './text'
import { helpPersonPath } from './paths'
import { HelpSetupSheet } from './HelpSetupSheet'

/**
 * `/app/help` — list of house helpers: maid, cook, driver, nanny. Each one shows this month's
 * salary at a glance. Empty state explains what it's for.
 */
export function HelpScreen() {
  const t = useT()
  const helpers = useHelpers()
  const [setupOpen, setSetupOpen] = useState(false)
  const today = todayIso()

  const header = (
    <TopBar
      onBack={() => goBack('/app')}
      right={
        helpers.length > 0 ? (
          <IconButton label={t('help.add')} onClick={() => setSetupOpen(true)}>
            <Plus />
          </IconButton>
        ) : undefined
      }
    />
  )

  if (helpers.length === 0) {
    return (
      <Screen header={header}>
        <PageTitle title={t('help.title')} subtitle={t('help.subtitle')} />
        <EmptyState
          icon={<User />}
          title={t('help.empty.title')}
          text={t('help.empty.text')}
          action={
            <Button iconStart={<Plus />} onClick={() => setSetupOpen(true)}>
              {t('help.empty.cta')}
            </Button>
          }
        />
        <HelpSetupSheet open={setupOpen} onClose={() => setSetupOpen(false)} onSaved={(id) => navigate(helpPersonPath(id))} />
      </Screen>
    )
  }

  return (
    <Screen header={header}>
      <PageTitle title={t('help.title')} subtitle={t('help.subtitle')} />
      <Card>
        <ul>
          {helpers.map((helper) => {
            const period = workingPeriod(helper, today)
            const sheet = monthSheet(helper, period)
            const work = workLabel(helper.work)
            const month = monthName(period, today)
            return (
              <li key={helper.id}>
                <ListRow
                  title={helper.name}
                  subtitle={`${work} · ${month}`}
                  trailing={sheet ? <Money value={sheet.toPay} currency={helper.currency} strong /> : undefined}
                  onClick={() => navigate(helpPersonPath(helper.id))}
                  chevron
                />
              </li>
            )
          })}
        </ul>
      </Card>
      <HelpSetupSheet open={setupOpen} onClose={() => setSetupOpen(false)} onSaved={(id) => navigate(helpPersonPath(id))} />
    </Screen>
  )
}
