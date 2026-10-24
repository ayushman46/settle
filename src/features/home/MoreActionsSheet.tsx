import { CircleCheck } from 'lucide-react'
import { navigate } from '../../app/router'
import { BottomSheet, QuickAction, QuickActionGrid } from '../../components'
import { useT } from '../../i18n'
import { PROOF_ENABLED, PROOF_PATH } from '../proof/enabled'
import { templateActionDefs } from './quickActions'

export interface MoreActionsSheetProps {
  open: boolean
  onClose: () => void
}

/**
 * Behind Home's More tile: one-tap starts for everyday splits (Rent, Trip, Subscription, Utilities, Cab),
 * and the switched-on features that didn't fit the grid (paid? drop the screenshot).
 */
export function MoreActionsSheet({ open, onClose }: MoreActionsSheetProps) {
  const t = useT()
  return (
    <BottomSheet open={open} onClose={onClose} title={t('home.more.title')} description={t('home.more.subtitle')}>
      <QuickActionGrid label={t('home.more.title')}>
        {PROOF_ENABLED && (
          <QuickAction
            key="proof"
            icon={<CircleCheck />}
            label={t('proof.more.title')}
            tone="accent"
            onClick={() => {
              onClose()
              navigate(PROOF_PATH)
            }}
          />
        )}
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
