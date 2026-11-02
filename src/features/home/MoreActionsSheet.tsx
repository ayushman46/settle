import { useId, type ReactNode } from 'react'
import { BadgeIndianRupee, BanknoteArrowDown, Building2, CircleCheck, ListChecks, Zap } from 'lucide-react'
import { navigate } from '../../app/router'
import { BottomSheet, QuickAction, QuickActionGrid } from '../../components'
import { useT } from '../../i18n'
import { BIJLI_PATH } from '../bijli/paths'
import { COLLECT_PATH } from '../collect/paths'
import { PROOF_ENABLED, PROOF_PATH } from '../proof/enabled'
import { RENT_ENABLED, RENT_PATH } from '../rent/enabled'
import { STUCK_PATH } from '../stuck/paths'
import { WHOS_PAID_PATH } from '../whospaid/paths'
import { overflowActions, templateActionDefs, type GridOptions } from './quickActions'
import styles from './HomeScreen.module.css'

export interface MoreActionsSheetProps extends GridOptions {
  open: boolean
  onClose: () => void
}

/**
 * Behind Home's More tile, in three groups: money back from friends (to collect, who's paid,
 * paid? drop the screenshot), money back from banks and shops (stuck money), then starting a
 * split — the grid's actions that didn't fit, rent and electricity, and the everyday templates
 * (Trip, Subscription, Utilities, Cab; Rent when the rent feature isn't there to do it better).
 */
export function MoreActionsSheet({ open, onClose, stuckCard = false }: MoreActionsSheetProps) {
  const t = useT()
  const go = (path: string) => () => {
    onClose()
    navigate(path)
  }
  const templates = templateActionDefs().filter((a) => !(RENT_ENABLED && a.id === 'template:rent'))
  return (
    <BottomSheet open={open} onClose={onClose} title={t('home.more.title')} description={t('home.more.subtitle')}>
      <div className={styles.more}>
        <MoreGroup title={t('home.more.back')}>
          <QuickAction key="collect" icon={<BadgeIndianRupee />} label={t('collect.title')} tone="accent" onClick={go(COLLECT_PATH)} />
          <QuickAction key="whospaid" icon={<ListChecks />} label={t('whospaid.more.title')} tone="accent" onClick={go(WHOS_PAID_PATH)} />
          {PROOF_ENABLED && <QuickAction key="proof" icon={<CircleCheck />} label={t('home.more.proof')} tone="accent" onClick={go(PROOF_PATH)} />}
        </MoreGroup>
        <MoreGroup title={t('home.more.banks')}>
          <QuickAction key="stuck" icon={<BanknoteArrowDown />} label={t('home.quick.stuck')} tone="accent" onClick={go(STUCK_PATH)} />
        </MoreGroup>
        <MoreGroup title={t('home.more.split')}>
          {overflowActions({ stuckCard }).map(({ id, label, icon: Icon, tone, run }) => (
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
          {RENT_ENABLED && <QuickAction key="rent" icon={<Building2 />} label={t('rent.more.title')} tone="rent" onClick={go(RENT_PATH)} />}
          <QuickAction key="bijli" icon={<Zap />} label={t('bijli.more.title')} tone="utilities" onClick={go(BIJLI_PATH)} />
          {templates.map(({ id, label, icon: Icon, tone, run }) => (
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
        </MoreGroup>
      </div>
    </BottomSheet>
  )
}

/** A titled group of tiles in the sheet. */
function MoreGroup({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <section className={styles.moreGroup} aria-labelledby={id}>
      <h3 id={id} className={styles.moreHeading}>
        {title}
      </h3>
      <QuickActionGrid>{children}</QuickActionGrid>
    </section>
  )
}
