import { useState } from 'react'
import { QuickAction, QuickActionGrid } from '../../components'
import { useT } from '../../i18n'
import { MoreActionsSheet } from './MoreActionsSheet'
import { homeGridActions } from './quickActions'

/**
 * Home's grid of colourful quick actions: scan, split and what's switched on (lend, collect, SMS,
 * food order), a group, everyday templates to fill two rows, and More for the rest (see
 * `quickActions.ts`).
 */
export function HomeQuickActions() {
  const t = useT()
  const [moreOpen, setMoreOpen] = useState(false)
  const actions = homeGridActions(() => setMoreOpen(true))
  return (
    <>
      <QuickActionGrid label={t('home.quick.label')}>
        {actions.map(({ id, label, icon: Icon, tone, run }) => (
          <QuickAction key={id} icon={<Icon />} label={label} tone={tone} onClick={run} />
        ))}
      </QuickActionGrid>
      <MoreActionsSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  )
}
