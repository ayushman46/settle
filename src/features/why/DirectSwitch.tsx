import { Card, Switch } from '../../components'
import { useT } from '../../i18n'
import type { SettlePlan } from './engine'
import { setDirectMode, useDirectMode } from './store'

export interface DirectSwitchProps {
  groupId: string
  /** From `useSettlePlan` (or `settlePlan`) for that group. */
  plan: SettlePlan
  className?: string
}

/**
 * "Pay only people I actually owe", remembered for the group: on, Settle up lists what each two
 * people directly owe each other; off, the fewest payments. Says how many payments each way.
 * Null when nobody owes anything, or when both ways are the same payments and it is off.
 */
export function DirectSwitch({ groupId, plan, className }: DirectSwitchProps) {
  const t = useT()
  const on = useDirectMode(groupId)
  const simple = plan.simple.length
  const direct = plan.direct.length
  if (simple === 0 && direct === 0) return null
  if (!on && !plan.differs) return null

  const compare = simple === direct ? t('why.direct.compare.same', { count: direct }) : t('why.direct.compare', { direct, simple })
  const description = !on ? t('why.direct.off', { compare }) : plan.differs ? t('why.direct.on', { compare }) : t('why.direct.on.same')
  return (
    <Card className={className}>
      <Switch checked={on} onChange={(next) => setDirectMode(groupId, next)} label={t('why.direct.label')} description={description} />
    </Card>
  )
}
