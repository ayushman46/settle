import { useMemo, useState } from 'react'
import { Search, UserPlus, X } from 'lucide-react'
import { goBack, navigate, useSearchParams } from '../../app/router'
import {
  Button,
  Card,
  EmptyState,
  Fab,
  IconButton,
  Illustration,
  List,
  ListRow,
  PageTitle,
  Screen,
  TextField,
  TopBar,
} from '../../components'
import { useFriends, useSummary } from '../../data'
import { ME_ID, type Friend, type Minor } from '../../domain/types'
import { t as translate, useT } from '../../i18n'
import { alphabetical, FriendAvatar, newPersonName, searchPeople } from '../../kit/index-a'
import { cx } from '../../lib/cx'
import { formatMoney } from '../../lib/money'
import { nameKey } from '../../lib/people'
import { FRIENDS_PATH, friendPath, YOU_PATH } from '../groups/paths'
import { FriendSheet } from './FriendSheet'
import styles from './FriendsScreen.module.css'

/** "owes you", "you owe", or how to reach them when you're square. */
function personLine(friend: Friend, balance: Minor, currency: string): { text: string; tone: 'positive' | 'negative' | 'muted' } {
  if (balance > 0) return { text: translate('friends.line.owesYou', { amount: formatMoney(balance, currency, { trimZeros: true }) }), tone: 'positive' }
  if (balance < 0) return { text: translate('friends.line.youOwe', { amount: formatMoney(-balance, currency, { trimZeros: true }) }), tone: 'negative' }
  return { text: friend.upiId ?? translate('friends.line.settled'), tone: 'muted' }
}

/**
 * `/app/friends` — everyone you split with, A–Z, with where you stand with each. Search as you
 * type; a name that isn't here yet can be added straight from the search. Tap someone for
 * everything you share. `?new=1` (Home's "Add") opens the add sheet straight away.
 */
export function FriendsScreen() {
  const t = useT()
  const friends = useFriends()
  const summary = useSummary()
  const fromQuery = useSearchParams().get('new') === '1'
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState<{ name: string } | null>(() => (fromQuery ? { name: '' } : null))

  const people = useMemo(() => friends.filter((f) => f.id !== ME_ID), [friends])
  const searching = nameKey(query) !== ''
  const listed = useMemo(() => (searching ? searchPeople(people, query) : alphabetical(people)), [people, query, searching])
  const addName = searching && !listed.some((f) => nameKey(f.name) === nameKey(query)) ? newPersonName(query) : null

  return (
    <Screen header={<TopBar onBack={() => goBack(YOU_PATH)} />} contentClassName={styles.content}>
      <PageTitle title={t('friends.list.title')} subtitle={t('friends.list.subtitle')} />

      {people.length === 0 ? (
        <EmptyState
          illustration={<Illustration name="empty-groups" />}
          title={t('friends.list.empty.title')}
          text={t('friends.list.empty.body')}
          action={
            <Button size="md" iconStart={<UserPlus />} onClick={() => setAdding({ name: '' })}>
              {t('friends.list.empty.cta')}
            </Button>
          }
        />
      ) : (
        <>
          <TextField
            type="search"
            label={t('friends.list.search.label')}
            hideLabel
            placeholder={t('friends.list.search.placeholder')}
            value={query}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            startAdornment={<Search aria-hidden="true" className={styles.searchIcon} />}
            endAdornment={
              query ? (
                <IconButton label={t('friends.list.search.clear.aria')} size="sm" onClick={() => setQuery('')}>
                  <X />
                </IconButton>
              ) : undefined
            }
            onChange={(event) => setQuery(event.currentTarget.value)}
          />

          {(listed.length > 0 || addName) && (
            <Card padding="none">
              <List aria-label={searching ? t('friends.list.results.aria') : t('friends.list.all.aria')}>
                {addName && (
                  <ListRow
                    leading={
                      <span className={styles.addIcon} aria-hidden="true">
                        <UserPlus strokeWidth={2.25} />
                      </span>
                    }
                    title={t('friends.list.add.title', { name: addName })}
                    subtitle={t('friends.list.add.subtitle')}
                    onClick={() => setAdding({ name: addName })}
                  />
                )}
                {listed.map((friend) => {
                  const line = personLine(friend, summary.byFriend[friend.id] ?? 0, summary.currency)
                  return (
                    <ListRow
                      key={friend.id}
                      leading={<FriendAvatar friend={friend} size="md" />}
                      title={friend.name}
                      subtitle={<span className={cx(styles.line, styles[line.tone], line.tone === 'muted' && friend.upiId && styles.mono)}>{line.text}</span>}
                      onClick={() => navigate(friendPath(friend.id))}
                      chevron
                    />
                  )
                })}
              </List>
            </Card>
          )}
          {searching && listed.length === 0 && !addName && <p className={styles.none}>{t('friends.list.none', { query: query.trim() })}</p>}
          {!searching && (
            <p className={styles.count}>{t('friends.list.count', { count: people.length })}</p>
          )}
        </>
      )}

      <Fab extended icon={<UserPlus strokeWidth={2.25} />} label={t('friends.list.add.cta')} onClick={() => setAdding({ name: searching ? (newPersonName(query) ?? '') : '' })} />
      <FriendSheet
        open={adding !== null}
        initialName={adding?.name ?? ''}
        onClose={() => setAdding(null)}
        onSaved={() => setQuery('')}
        // Added or not: drop `?new=1`, so a reload or Back doesn't open the sheet again.
        onExited={dropNewQuery}
      />
    </Screen>
  )
}

/** Swaps `/app/friends?new=1` for `/app/friends` — only while that is the page on show. */
function dropNewQuery(): void {
  const { pathname, search } = window.location
  if (pathname === FRIENDS_PATH && new URLSearchParams(search).get('new') === '1') navigate(FRIENDS_PATH, { replace: true })
}
