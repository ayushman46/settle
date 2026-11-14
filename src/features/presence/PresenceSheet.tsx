import { useMemo } from 'react'
import { BottomSheet, Button, Chip } from '../../components'
import { useExpenses, useFriendsById } from '../../data'
import { ME_ID, type Group } from '../../domain/types'
import { daysBetween, isIsoDate, today } from '../../engine/dates'
import { useT } from '../../i18n'
import { DateField } from '../../kit/DateField'
import { FriendAvatar } from '../../kit/FriendAvatar'
import { friendLabel } from '../../kit/friendName'
import { stayText } from './actions'
import { usableStay } from './engine'
import { setStay, useStays } from './store'
import styles from './Presence.module.css'

/**
 * Who was there when: for each member, the first and last day they were there. Each date picker
 * starts at the trip's own first or last day (worked out from its expenses), so setting someone
 * who joined late is one tap and a date. Saved as you go, on this phone.
 */
export function PresenceSheet({ group, open, onClose }: { group: Group; open: boolean; onClose: () => void }) {
  const t = useT()
  const friendsById = useFriendsById()
  const expenses = useExpenses({ groupId: group.id })
  const stays = useStays(group.id)

  // The trip's days, from its expenses (today when there are none yet).
  const trip = useMemo(() => {
    const dates = expenses.filter((e) => e.kind !== 'loan' && isIsoDate(e.date)).map((e) => e.date)
    if (dates.length === 0) {
      const now = today()
      return { from: now, to: now }
    }
    return {
      from: dates.reduce((a, b) => (b < a ? b : a)),
      to: dates.reduce((a, b) => (b > a ? b : a)),
    }
  }, [expenses])

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      eyebrow={group.name}
      title={t('presence.sheet.title')}
      description={t('presence.sheet.description')}
      size="tall"
      footer={
        <Button block onClick={onClose}>
          {t('presence.sheet.done')}
        </Button>
      }
    >
      <ul className={styles.people}>
        {group.memberIds.map((id) => {
          const name = friendLabel(id, friendsById[id])
          const stay = usableStay(stays[id])
          const from = stay?.from ?? null
          const to = stay?.to ?? null
          const shownFrom = from ?? (to !== null && to < trip.from ? to : trip.from)
          const shownTo = to ?? (from !== null && from > trip.to ? from : trip.to)
          return (
            <li key={id} className={styles.person}>
              <div className={styles.personHead}>
                <FriendAvatar friendId={id} size="sm" />
                <span className={styles.personText}>
                  <span className={styles.name}>{name}</span>
                  <span className={styles.fine}>
                    {from !== null && to !== null
                      ? t('presence.sheet.stayNights', { stay: stayText(stay), count: daysBetween(from, to) })
                      : stayText(stay)}
                  </span>
                </span>
                <Chip
                  size="lg"
                  selected={stay === null}
                  onClick={() => setStay(group.id, id, { from: null, to: null })}
                  aria-label={id === ME_ID ? t('presence.sheet.whole.aria.you') : t('presence.sheet.whole.aria', { name })}
                >
                  {t('presence.sheet.whole')}
                </Chip>
              </div>
              <div className={styles.dates}>
                <div className={styles.dateField}>
                  <span className={styles.fine}>{t('presence.sheet.from')}</span>
                  <DateField
                    value={shownFrom}
                    max={to ?? null}
                    label={t('presence.sheet.from.aria', { name })}
                    onChange={(next) =>
                      setStay(group.id, id, {
                        from: next,
                        to: to !== null && to < next ? next : to,
                      })
                    }
                  />
                </div>
                <div className={styles.dateField}>
                  <span className={styles.fine}>{t('presence.sheet.to')}</span>
                  <DateField
                    value={shownTo}
                    max={null}
                    min={from ?? undefined}
                    label={t('presence.sheet.to.aria', { name })}
                    onChange={(next) =>
                      setStay(group.id, id, {
                        from: from !== null && from > next ? next : from,
                        to: next,
                      })
                    }
                  />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      <p className={styles.fine}>{t('presence.sheet.note')}</p>
    </BottomSheet>
  )
}
