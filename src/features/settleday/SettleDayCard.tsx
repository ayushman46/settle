import { memo } from 'react'
import { CalendarCheck, ChevronRight } from 'lucide-react'
import { navigate } from '../../app/router'
import { Button } from '../../components'
import { useGroup } from '../../data'
import type { Group } from '../../domain/types'
import { useT } from '../../i18n'
import { DayPicker } from './DayPicker'
import { dayLabel, openLine, weekdayDate } from './labels'
import { settleDayPath } from './paths'
import { usePickSettleDay, useSettleDay } from './useSettleDay'
import styles from './SettleDay.module.css'

/**
 * The group's settle day, on the group page. No day yet: one quiet line with day chips. A day
 * set: the countdown, opening the settle-day page. On the day (and the day after, while money is
 * still open): "Today is settle day" with the way in. Null for archived groups and groups of one.
 */
export const SettleDayCard = memo(function SettleDayCard({ group: given }: { group: Group }) {
  const t = useT()
  const group = useGroup(given.id) ?? given
  const view = useSettleDay(group)
  const pick = usePickSettleDay(group)
  if (group.archived || group.memberIds.length < 2) return null
  const open = (): void => navigate(settleDayPath(group.id))

  if (!view.entry || !view.status) {
    return (
      <section className={styles.pick} aria-labelledby={`settleday-pick-${group.id}`}>
        <h2 id={`settleday-pick-${group.id}`} className={styles.pickTitle}>
          <CalendarCheck aria-hidden="true" />
          {t('settleday.card.pick.title')}
        </h2>
        <p className={styles.fine}>{t('settleday.card.pick.body', { name: group.name })}</p>
        <DayPicker value={null} onPick={pick} label={t('settleday.pick.aria', { name: group.name })} />
      </section>
    )
  }

  const { status } = view
  if (status.phase === 'waiting') {
    const line = t('settleday.card.countdown', { day: dayLabel(view.entry.day), count: status.daysToGo })
    const next = t('settleday.card.next', { date: weekdayDate(status.next) })
    return (
      <button type="button" className={styles.card} onClick={open} aria-label={`${line}. ${next}. ${t('settleday.card.open')}`}>
        <CalendarCheck aria-hidden="true" className={styles.cardIcon} />
        <span className={styles.cardText}>
          <span className={styles.cardTitle}>{line}</span>
          <span className={styles.fine}>{next}</span>
        </span>
        <ChevronRight aria-hidden="true" className={styles.chevron} />
      </button>
    )
  }

  const title = status.phase === 'today' ? t('settleday.card.today.title') : t('settleday.card.yesterday.title')
  const square = view.payments.length === 0
  return (
    <section className={styles.due} aria-labelledby={`settleday-due-${group.id}`}>
      <div className={styles.dueHead}>
        <CalendarCheck aria-hidden="true" className={styles.dueIcon} />
        <div className={styles.cardText}>
          <h2 id={`settleday-due-${group.id}`} className={styles.dueTitle}>
            {title}
          </h2>
          <p className={styles.dueBody}>{square ? t('settleday.card.square', { name: group.name }) : openLine(view.open, group)}</p>
        </div>
      </div>
      <Button size="md" variant={square ? 'secondary' : 'primary'} block onClick={open}>
        {square ? t('settleday.card.open') : t('settleday.card.cta')}
      </Button>
    </section>
  )
})
