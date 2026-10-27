import { BadgeIndianRupee, Building2, CircleCheck, ListChecks, Zap } from 'lucide-react'
import { navigate } from '../../app/router'
import { BottomSheet, QuickAction, QuickActionGrid } from '../../components'
import { useT } from '../../i18n'
import { BIJLI_PATH } from '../bijli/paths'
import { COLLECT_PATH } from '../collect/paths'
import { PROOF_ENABLED, PROOF_PATH } from '../proof/enabled'
import { RENT_ENABLED, RENT_PATH } from '../rent/enabled'
import { WHOS_PAID_PATH } from '../whospaid/paths'
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
        <QuickAction
          key="collect"
          icon={<BadgeIndianRupee />}
          label={t('collect.title')}
          tone="accent"
          onClick={() => {
            onClose()
            navigate(COLLECT_PATH)
          }}
        />
        <QuickAction
          key="whospaid"
          icon={<ListChecks />}
          label={t('whospaid.more.title')}
          tone="accent"
          onClick={() => {
            onClose()
            navigate(WHOS_PAID_PATH)
          }}
        />
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
        {RENT_ENABLED && (
          <QuickAction
            key="rent"
            icon={<Building2 />}
            label={t('rent.more.title')}
            tone="rent"
            onClick={() => {
              onClose()
              navigate(RENT_PATH)
            }}
          />
        )}
        <QuickAction
          key="bijli"
          icon={<Zap />}
          label={t('bijli.more.title')}
          tone="utilities"
          onClick={() => {
            onClose()
            navigate(BIJLI_PATH)
          }}
        />
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
