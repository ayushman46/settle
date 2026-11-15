import { useMemo, useState } from 'react'
import { HandCoins, Plus } from 'lucide-react'
import { goBack, navigate } from '../../app/router'
import { Button, Card, EmptyState, List, ListRow, PageTitle, Screen, TopBar, useToast } from '../../components'
import { useFriendsById } from '../../data'
import { ME_ID } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { firstName } from '../../share/text'
import { currentIndex, dueAt, isFinished, monthView, potOf, type Committee } from './engine'
import { committeePath } from './paths'
import { SetupSheet } from './SetupSheet'
import { useCommittees } from './store'
import { dayLabel, money, monthLabel, paidLine } from './text'
import styles from './Committee.module.css'

/**
 * `/app/committee` — your committees (kitty, BC): each with this month in one line. Empty, it says
 * what a committee is in a sentence and starts one. What is typed in the set-up stays if the sheet
 * is closed half way.
 */
export function CommitteeScreen() {
  const t = useT()
  const toast = useToast()
  const committees = useCommittees()
  const friendsById = useFriendsById()
  const [day] = useState(() => todayIso())
  const [setup, setSetup] = useState({ round: 0, open: false })
  const running = useMemo(() => committees.filter((c) => !isFinished(c)), [committees])
  const finished = useMemo(() => committees.filter(isFinished), [committees])

  const line = (c: Committee): string => {
    const pot = money(potOf(c), c.currency)
    const index = currentIndex(c)
    if (index === null) return t('committee.row.finished', { pot })
    const view = monthView(c, index, day)
    if (!view.started && view.paidCount === 0) return t('committee.row.upcoming', { date: dayLabel(dueAt(c, index), day), pot })
    const month = monthLabel(view.period, day)
    const paid = paidLine(c, view)
    if (!view.taker) return t('committee.row.noTaker', { month, paid })
    const id = view.taker.friendId
    return t('committee.row.taker', { month, who: id === ME_ID ? 'me' : 'other', name: firstName(friendLabel(id, friendsById[id] ?? null)), pot, paid })
  }

  const start = () => setSetup((s) => ({ ...s, open: true }))
  const sheet = (
    <SetupSheet
      key={setup.round}
      open={setup.open}
      onClose={() => setSetup((s) => ({ ...s, open: false }))}
      onSaved={(c) => {
        // A fresh, empty set-up next time; this one is saved.
        setSetup((s) => ({ round: s.round + 1, open: false }))
        toast(t('committee.setup.saved', { name: c.name }), { tone: 'success' })
        navigate(committeePath(c.id))
      }}
    />
  )
  const header = <TopBar onBack={() => goBack('/app')} />

  if (committees.length === 0) {
    return (
      <Screen header={header}>
        <PageTitle title={t('committee.title')} />
        <EmptyState
          icon={<HandCoins />}
          title={t('committee.empty.title')}
          text={t('committee.empty.text')}
          action={
            <Button iconStart={<Plus />} onClick={start}>
              {t('committee.empty.cta')}
            </Button>
          }
        />
        {sheet}
      </Screen>
    )
  }

  const rows = (list: Committee[]) => (
    <Card padding="none">
      <List>
        {list.map((c) => (
          <ListRow key={c.id} title={c.name} subtitle={line(c)} onClick={() => navigate(committeePath(c.id))} chevron />
        ))}
      </List>
    </Card>
  )

  return (
    <Screen header={header} contentClassName={styles.content}>
      <PageTitle title={t('committee.title')} subtitle={t('committee.subtitle')} />
      {running.length > 0 && (
        <section className={styles.section} aria-label={t('committee.running.heading')}>
          <h2 className={styles.heading}>{t('committee.running.heading')}</h2>
          {rows(running)}
        </section>
      )}
      {finished.length > 0 && (
        <section className={styles.section} aria-label={t('committee.finished.heading')}>
          <h2 className={styles.heading}>{t('committee.finished.heading')}</h2>
          {rows(finished)}
        </section>
      )}
      <Button variant="secondary" block iconStart={<Plus />} onClick={start}>
        {t('committee.add')}
      </Button>
      <p className={styles.fine}>{t('committee.honest')}</p>
      {sheet}
    </Screen>
  )
}
