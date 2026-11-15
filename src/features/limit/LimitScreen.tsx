import { useMemo, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { goBack, navigate } from '../../app/router'
import { BottomSheet, Button, Card, EmptyState, List, ListRow, PageTitle, Screen, TopBar } from '../../components'
import { useFriends, useProfile, useSummary } from '../../data'
import { ME_ID, type Minor } from '../../domain/types'
import { useT } from '../../i18n'
import { FriendAvatar } from '../../kit/FriendAvatar'
import { friendLabel } from '../../kit/friendName'
import { formatMoney } from '../../lib/money'
import { FRIENDS_PATH } from '../groups/paths'
import { limitStanding, sortStandings } from './engine'
import { LimitBadge } from './LimitBadge'
import { LimitEveryoneRow, LimitRow } from './LimitRow'
import { useLimitState } from './store'
import styles from './Limit.module.css'

/** People listed before the rest are left to their own pages (those who matter come first). */
const MAX_PEOPLE = 60

/**
 * `/app/limit`: udhaar limits in one place. A limit for everyone, then your people (over their
 * limit first, then whoever owes you most): tap one to set theirs. Nothing here blocks a split;
 * it only decides when Settle speaks up.
 */
export function LimitScreen() {
  const t = useT()
  const friends = useFriends()
  const profile = useProfile()
  const summary = useSummary()
  const state = useLimitState()
  const [open, setOpen] = useState<{ friendId: string; shown: boolean } | null>(null)
  const currency = profile.currency
  const money = (minor: Minor): string => formatMoney(minor, currency, { trimZeros: true })

  const rows = useMemo(
    () =>
      sortStandings(
        friends.filter((f) => f.id !== ME_ID).map((f) => ({ ...limitStanding(state, f.id, summary.byFriend), name: friendLabel(f.id, f) })),
      ).slice(0, MAX_PEOPLE),
    [friends, state, summary.byFriend],
  )
  const header = <TopBar onBack={() => goBack('/app')} />

  if (rows.length === 0) {
    return (
      <Screen header={header} contentClassName={styles.content}>
        <PageTitle title={t('limit.title')} subtitle={t('limit.subtitle')} />
        <EmptyState
          icon={<ShieldCheck />}
          title={t('limit.empty.title')}
          text={t('limit.empty.text')}
          action={<Button onClick={() => navigate(FRIENDS_PATH)}>{t('limit.empty.cta')}</Button>}
        />
      </Screen>
    )
  }

  const picked = open ? rows.find((r) => r.friendId === open.friendId) : undefined

  return (
    <Screen header={header} contentClassName={styles.content}>
      <PageTitle title={t('limit.title')} subtitle={t('limit.subtitle')} />
      <Card>
        <LimitEveryoneRow />
      </Card>
      <section className={styles.block} aria-labelledby="limit-people">
        <h2 id="limit-people" className={styles.heading}>
          {t('limit.people.title')}
        </h2>
        <Card padding="none">
          <List>
            {rows.map((r) => {
              const owes = r.owed > 0 ? t('limit.people.owes', { owed: money(r.owed) }) : t('limit.people.nothing')
              const limit = !r.limit
                ? t('limit.people.noLimit')
                : t(r.limit.own ? 'limit.people.limit' : 'limit.people.limit.everyone', { amount: money(r.limit.amount) })
              return (
                <ListRow
                  key={r.friendId}
                  leading={<FriendAvatar friendId={r.friendId} size="md" />}
                  title={r.name}
                  subtitle={t('limit.people.line', { owes, limit })}
                  trailing={<LimitBadge friendId={r.friendId} />}
                  chevron
                  onClick={() => setOpen({ friendId: r.friendId, shown: true })}
                />
              )
            })}
          </List>
        </Card>
      </section>
      <BottomSheet open={open?.shown === true && picked !== undefined} onClose={() => setOpen((o) => (o ? { ...o, shown: false } : o))} title={picked?.name ?? ''}>
        {picked && <LimitRow key={picked.friendId} friendId={picked.friendId} />}
      </BottomSheet>
    </Screen>
  )
}
