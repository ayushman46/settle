import { useId } from 'react'
import { Chip } from '../../components'
import { useProfile } from '../../data'
import { ME_ID, type Group } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { formatMoney } from '../../lib/money'
import { CHHUTTA_OPTIONS, unitsToMinor, yearTotals } from './engine'
import { setChhuttaRule, useChhuttaLog, useChhuttaRule } from './store'
import styles from './Chhutta.module.css'

/**
 * The group's small change setting: ignore dues under ₹5, ₹10, ₹20 or ₹50, or off. Below it, what
 * you've let go and been let off this year. Null for an archived group or a group of one.
 */
export function ChhuttaRow({ group }: { group: Group }) {
  const t = useT()
  const titleId = useId()
  const rule = useChhuttaRule(group.id)
  if (group.archived || group.memberIds.length < 2) return null
  const money = (units: number): string => formatMoney(unitsToMinor(units, group.currency), group.currency, { trimZeros: true })
  const on = rule !== null && rule > 0

  return (
    <section className={styles.setting} aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.title}>
        {t('chhutta.row.title')}
      </h3>
      <p className={styles.fine}>{t('chhutta.row.body')}</p>
      <div className={styles.chips} role="group" aria-labelledby={titleId}>
        <Chip size="lg" selected={rule === 0} onClick={() => setChhuttaRule(group.id, 0)}>
          {t('chhutta.row.off')}
        </Chip>
        {CHHUTTA_OPTIONS.map((units) => (
          <Chip key={units} size="lg" selected={rule === units} onClick={() => setChhuttaRule(group.id, units)}>
            {money(units)}
          </Chip>
        ))}
      </div>
      <p className={styles.fine} role="status">
        {on ? t('chhutta.row.hint.on', { amount: money(rule) }) : rule === 0 ? t('chhutta.row.hint.off') : t('chhutta.row.hint.unset')}
      </p>
      <ChhuttaLog currency={group.currency} />
    </section>
  )
}

/**
 * "You’ve let ₹34 go this year, and been let off ₹21." In `currency` (default: yours). Null when
 * nothing was let go either way this year.
 */
export function ChhuttaLog({ currency }: { currency?: string }) {
  const t = useT()
  const profile = useProfile()
  const log = useChhuttaLog()
  const code = currency ?? profile.currency
  const totals = yearTotals(log, todayIso().slice(0, 4), code, ME_ID)
  if (totals.letGo === 0 && totals.letOff === 0) return null
  const letGo = formatMoney(totals.letGo, code, { trimZeros: true })
  const letOff = formatMoney(totals.letOff, code, { trimZeros: true })
  return (
    <p className={styles.fine}>
      {totals.letGo > 0 && totals.letOff > 0
        ? t('chhutta.log.both', { letGo, letOff })
        : totals.letGo > 0
          ? t('chhutta.log.letGo', { letGo })
          : t('chhutta.log.letOff', { letOff })}
    </p>
  )
}
