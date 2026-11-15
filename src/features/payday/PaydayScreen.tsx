import { useMemo, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { goBack, navigate } from '../../app/router'
import { Button, Card, EmptyState, List, ListRow, Money, PageTitle, Screen, SectionHeader, TopBar } from '../../components'
import { useFriends, useFriendsById, useSummary } from '../../data'
import { ME_ID, type Friend } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { FriendAvatar } from '../../kit/FriendAvatar'
import { friendLabel } from '../../kit/friendName'
import { formatMoney } from '../../lib/money'
import { firstName } from '../../share/text'
import { friendPath, newSplitPath } from '../groups/paths'
import { shortDate } from '../recurring/recurringLabels'
import { askList, nextPayday } from './engine'
import { askWords, paydayLabel } from './labels'
import { PaydayChips } from './PaydayChips'
import { PaydayGuessCard } from './PaydayGuessCard'
import { PaydayPickSheet } from './PaydayPickSheet'
import { PaydaySheet } from './PaydaySheet'
import { useFriendPaydays, useMyPayday } from './store'
import { useSetFriendPayday, useSetMyPayday } from './usePaydayActions'
import styles from './Payday.module.css'

/** Friends shown before "Show all". */
const FRIENDS_SHOWN = 8

/**
 * `/app/payday`: your payday (one tap), who to ask when (everyone who owes you, the soonest day
 * to ask first), and your friends' paydays (tap a name to set or change it). Everything is saved
 * on the tap, with Undo.
 */
export function PaydayScreen() {
  const t = useT()
  const today = todayIso()
  const mine = useMyPayday()
  const paydays = useFriendPaydays()
  const friends = useFriends()
  const friendsById = useFriendsById()
  const summary = useSummary()
  const setMine = useSetMyPayday()
  const setFriend = useSetFriendPayday()
  const [mineOpen, setMineOpen] = useState(false)
  const [editing, setEditing] = useState<{ friendId: string; open: boolean } | null>(null)
  const [all, setAll] = useState(false)

  const rows = useMemo(() => askList(summary.byFriend, friendsById, paydays, today), [summary.byFriend, friendsById, paydays, today])
  // Your people by name: every phone lists them the same way.
  const people = useMemo(
    () =>
      friends
        .filter((f) => f.id !== ME_ID)
        .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || (a.id < b.id ? -1 : 1)),
    [friends],
  )
  const shown = all ? people : people.slice(0, FRIENDS_SHOWN)
  const nameOf = (friend: Pick<Friend, 'id' | 'name'>): string => firstName(friendLabel(friend.id, friend))
  const edited = editing ? (friendsById[editing.friendId] ?? null) : null

  return (
    <Screen header={<TopBar onBack={() => goBack('/app')} />} contentClassName={styles.content}>
      <PageTitle title={t('payday.title')} subtitle={t('payday.subtitle')} />

      <PaydayGuessCard />

      <section className={styles.block} aria-labelledby="payday-mine">
        <Card className={styles.card}>
          <h2 id="payday-mine" className={styles.heading}>
            {t('payday.mine.title')}
          </h2>
          <p className={styles.fine} role="status">
            {mine === null ? t('payday.mine.unset') : t('payday.mine.set', { payday: paydayLabel(mine), date: shortDate(nextPayday(mine, today)) })}
          </p>
          <PaydayChips value={mine} label={t('payday.mine.chips.aria')} onPick={setMine} onOther={() => setMineOpen(true)} />
        </Card>
      </section>

      <section className={styles.block} aria-labelledby="payday-ask">
        <SectionHeader id="payday-ask" title={t('payday.ask.title')} description={rows.length > 0 ? t('payday.ask.description') : undefined} />
        {rows.length === 0 ? (
          <Card>
            <EmptyState
              size="sm"
              icon={<CalendarClock />}
              title={t('payday.ask.empty.title')}
              text={t('payday.ask.empty.body')}
              headingLevel={3}
              action={
                <Button variant="tonal" onClick={() => navigate(newSplitPath())}>
                  {t('payday.ask.empty.cta')}
                </Button>
              }
            />
          </Card>
        ) : (
          <Card padding="none">
            <List>
              {rows.map((row) => {
                const friend = friendsById[row.friendId] ?? { id: row.friendId, name: row.name }
                const name = nameOf(friend)
                const words = askWords(row.ask)
                const now = row.ask?.inDays === 0
                return (
                  <ListRow
                    key={row.friendId}
                    leading={<FriendAvatar friendId={row.friendId} size="md" />}
                    title={<span className={styles.rowText}>{name}</span>}
                    subtitle={
                      <span className={styles.rowText}>
                        <span className={now ? styles.now : undefined}>{words.when}</span>
                        {` · ${words.why}`}
                      </span>
                    }
                    trailing={<Money value={row.amount} currency={summary.currency} trimZeros strong tone="positive" />}
                    aria-label={t('payday.ask.row.aria', {
                      name,
                      amount: formatMoney(row.amount, summary.currency, { trimZeros: true }),
                      when: words.when,
                      why: words.why,
                    })}
                    // Known: on to their page, where the reminder is. Not known: add it here.
                    onClick={() => (row.ask ? navigate(friendPath(row.friendId)) : setEditing({ friendId: row.friendId, open: true }))}
                    chevron={row.ask !== null}
                  />
                )
              })}
            </List>
          </Card>
        )}
      </section>

      {people.length > 0 && (
        <section className={styles.block} aria-labelledby="payday-friends">
          <SectionHeader id="payday-friends" title={t('payday.friends.title')} description={t('payday.friends.description')} />
          <Card padding="none">
            <List>
              {shown.map((friend) => {
                const payday = paydays[friend.id] ?? null
                const value = payday === null ? t('payday.friends.unset') : t('payday.friends.set', { payday: paydayLabel(payday) })
                return (
                  <ListRow
                    key={friend.id}
                    leading={<FriendAvatar friend={friend} size="sm" />}
                    title={<span className={styles.rowText}>{friendLabel(friend.id, friend)}</span>}
                    subtitle={value}
                    aria-label={t('payday.friends.row.aria', { name: friendLabel(friend.id, friend), payday: value })}
                    onClick={() => setEditing({ friendId: friend.id, open: true })}
                  />
                )
              })}
            </List>
          </Card>
          {!all && people.length > FRIENDS_SHOWN && (
            <Button variant="ghost" size="md" className={styles.more} onClick={() => setAll(true)}>
              {t('payday.friends.more', { count: people.length })}
            </Button>
          )}
        </section>
      )}

      <PaydaySheet open={mineOpen} onClose={() => setMineOpen(false)} />
      {editing && edited && (
        <PaydayPickSheet
          key={editing.friendId}
          open={editing.open}
          onClose={() => setEditing({ ...editing, open: false })}
          title={t('payday.sheet.friend.title', { name: nameOf(edited) })}
          description={t('payday.sheet.friend.description')}
          value={paydays[editing.friendId] ?? null}
          onPick={(next) => setFriend(editing.friendId, nameOf(edited), next)}
        />
      )}
    </Screen>
  )
}
