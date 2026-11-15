import { Badge, Card, List, ListRow } from '../../components'
import { ME_ID } from '../../domain/types'
import { useT } from '../../i18n'
import { FriendAvatar } from '../../kit/FriendAvatar'
import { periodAt, positions, potOf, schedule, type Committee } from './engine'
import { dayLabel, money, monthLabel, paidLine } from './text'
import styles from './Committee.module.css'

export interface TabProps {
  committee: Committee
  today: string
  /** The name to show for a person ("You" for the owner). */
  label: (friendId: string) => string
}

/** Everyone's position: paid in so far out of what they pay in all, the pot they got or when it comes. */
export function PeopleTab({ committee: c, today, label }: TabProps) {
  const t = useT()
  const rows = positions(c)
  const month = (index: number): string => monthLabel(periodAt(c, index), today)
  const paid = rows.reduce((sum, p) => sum + p.paidIn, 0)
  const handed = rows.reduce((sum, p) => sum + p.received, 0)
  return (
    <section className={styles.section} aria-label={t('committee.tabs.people')}>
      <p className={styles.fine}>{t('committee.people.total', { paid: money(paid, c.currency), handed: money(handed, c.currency) })}</p>
      <Card padding="none">
        <List>
          {rows.map((p) => {
            const lines = [t('committee.people.paid', { paid: money(p.paidIn, c.currency), total: money(p.toPay, c.currency) })]
            for (const i of p.gotMonths) lines.push(t('committee.people.got', { month: month(i) }))
            for (const i of p.potMonths) {
              if (p.gotMonths.includes(i)) continue
              lines.push(
                i === p.nextPot && p.monthsToGo !== null && p.monthsToGo > 0
                  ? t('committee.people.next', { month: month(i), count: p.monthsToGo })
                  : t('committee.people.takes', { month: month(i) }),
              )
            }
            if (p.undrawn > 0) lines.push(t('committee.people.undrawn', { count: p.undrawn }))
            return (
              <ListRow
                key={p.friendId}
                leading={<FriendAvatar friendId={p.friendId} size="sm" />}
                title={p.hands > 1 ? t('committee.name.hands', { name: label(p.friendId), count: p.hands }) : label(p.friendId)}
                subtitle={lines.join(' · ')}
              />
            )
          })}
        </List>
      </Card>
      <p className={styles.fine}>{t('committee.honest')}</p>
    </section>
  )
}


/** The whole schedule, a month a row: whose pot, and where the month stands. A tap opens the month. */
export function ScheduleTab({ committee: c, today, label, onPick }: TabProps & { onPick: (index: number) => void }) {
  const t = useT()
  const months = schedule(c, today)
  return (
    <section className={styles.section} aria-label={t('committee.tabs.schedule')}>
      <p className={styles.fine}>{t('committee.schedule.fine', { pot: money(potOf(c), c.currency), count: months.length })}</p>
      <Card padding="none">
        <List>
          {months.map((m) => {
            const who = m.taker
              ? t('committee.schedule.taker', { who: m.taker.friendId === ME_ID ? 'me' : 'other', name: label(m.taker.friendId) })
              : t('committee.schedule.draw')
            const status = m.closed ? null : m.paidCount > 0 || m.due <= today ? paidLine(c, m) : t('committee.row.due', { date: dayLabel(m.due, today) })
            return (
              <ListRow
                key={m.index}
                title={monthLabel(m.period, today)}
                subtitle={status ? `${who} · ${status}` : who}
                trailing={m.closed ? <Badge tone="positive">{t('committee.schedule.closed')}</Badge> : undefined}
                onClick={() => onPick(m.index)}
                chevron
              />
            )
          })}
        </List>
      </Card>
    </section>
  )
}
