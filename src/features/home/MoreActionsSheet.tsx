import { BottomSheet, QuickAction, QuickActionGrid } from '../../components'
import { useT } from '../../i18n'
import { templateActionDefs } from './quickActions'

export interface MoreActionsSheetProps {
  open: boolean
  onClose: () => void
}

/** Behind Home's More tile: one-tap starts for everyday splits (Rent, Trip, Subscription, Utilities, Cab). */
export function MoreActionsSheet({ open, onClose }: MoreActionsSheetProps) {
  const t = useT()
  return (
    <BottomSheet open={open} onClose={onClose} title={t('home.more.title')} description={t('home.more.subtitle')}>
      <QuickActionGrid label={t('home.more.title')}>
        {templateActionDefs().map(({ id, label, icon: Icon, tone, run }) => (
          <QuickAction
            key={id}
            icon={<Icon />}
            label={label}
            tone={tone}
            onClick={() => {
              onClose()
              run()
            }}
          />
        ))}
      </QuickActionGrid>
    </BottomSheet>
  )
}
