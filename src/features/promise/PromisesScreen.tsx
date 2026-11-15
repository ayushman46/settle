import { useMemo, useState } from 'react'
import { BellRing, CalendarCheck, Check, Wallet } from 'lucide-react'
import { goBack, navigate } from '../../app/router'
import { Button, Card, EmptyState, List, ListRow, PageTitle, Screen, TopBar, useToast } from '../../components'
import { useFriendsById, useMe, useSummary } from '../../data'
import { ME_ID, type Settlement } from '../../domain/types'
import { useT } from '../../i18n'
import { FriendAvatar, friendLabel } from '../../kit/index-a'
import { UpiPaySheet } from '../../kit/UpiPaySheet'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { shareResult } from '../../lib/share'
import { firstName } from '../../share/text'
import { COLLECT_PATH } from '../collect/paths'
import { recordBetween } from '../kist/actions'
import { dayLabel } from '../kist/text'
import { setOutcome } from './actions'
import { sortHistory, sortOpen, statsOf, type PromiseView } from './engine'
import { PromiseSheet } from './PromiseSheet'
import { usePromises } from './store'
import { askMessage } from './text'
import { usePromiseViews } from './usePromiseViews'
import styles from './Promise.module.css'

/** People offered for a new promise: the largest amounts first. */
const MAX_CANDIDATES = 8
/** Ended promises shown (the latest). */
const MAX_HISTORY = 50

/**
 * `/app/promises` — every promise: the open ones first (pay yours from here, tick or ask about
 * theirs), then how the past ones went and each person's count ("Kept 3 of 4"), and the people a
 * new promise can be noted with. Kept or broken comes from the payments on record; a payment
 * written down late can be put right by hand.
 */
export function PromisesScreen() {
  const t = useT()
  const toast = useToast()
  const me = useMe()
  const friendsById = useFriendsById()
  const summary = useSummary()
  const promises = usePromises()
  const { views, today } = usePromiseViews(promises)
  const [sheet, setSheet] = useState<{ friendId: string; open: boolean } | null>(null)
  const [paying, setPaying] = useState<{ view: PromiseView; open: boolean } | null>(null)
  const nameOf = (id: string): string => firstName(friendLabel(id, friendsById[id] ?? null))

  const lists = useMemo(() => {
    const name = (id: string): string => friendsById[id]?.name ?? ''
    const byFriend = new Map<string, PromiseView[]>()
    for (const v of views) byFriend.set(v.promise.friendId, [...(byFriend.get(v.promise.friendId) ?? []), v])
    const people = [...byFriend.entries()]
      .map(([id, list]) => ({ id, stats: statsOf(list.map((v) => v.state)) }))
      .filter((p) => p.stats.total > 0)
      .sort((a, b) => (name(a.id).toLocaleLowerCase() < name(b.id).toLocaleLowerCase() ? -1 : 1))
    return {
      open: sortOpen(views.filter((v) => v.state === 'open'), name),
      history: sortHistory(views.filter((v) => v.state !== 'open')).slice(0, MAX_HISTORY),
      people,
    }
  }, [views, friendsById])

  const candidates = useMemo(() => {
    const busy = new Set(views.filter((v) => v.state === 'open').map((v) => v.promise.friendId))
    return Object.entries(summary.byFriend)
      .filter(([id, amount]) => id !== ME_ID && friendsById[id] !== undefined && !busy.has(id) && amount !== 0)
      .map(([id, amount]) => ({ id, amount, name: friendsById[id]?.name ?? '' }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount) || (a.name.toLocaleLowerCase() < b.name.toLocaleLowerCase() ? -1 : 1))
      .slice(0, MAX_CANDIDATES)
  }, [views, summary.byFriend, friendsById])

  const record = (view: PromiseView, method: Settlement['method']): void => {
    const p = view.promise
    const done = recordBetween(p.friendId, p.direction, view.payable, p.currency, method)
    if (!(done.amount > 0)) {
      done.undo()
      haptic('error')
      toast(t('promise.toast.failed'), { tone: 'error' })
      return
    }
    haptic('success')
    const vars = { name: nameOf(p.friendId), amount: formatMoney(done.amount, p.currency, { trimZeros: true }) }
    toast(p.direction === 'pay' ? t('promise.toast.paid', vars) : t('promise.toast.got', vars), {
      tone: 'success',
      action: { label: t('common.action.undo'), onAction: done.undo },
    })
  }

  const ask = async (view: PromiseView): Promise<void> => {
    const outcome = await shareResult(askMessage(view, today), { title: t('promise.share.title') })
    if (outcome === 'copied') toast(t('promise.share.copied'), { tone: 'success' })
    else if (outcome === 'failed') toast(t('promise.share.failed'), { tone: 'error' })
  }

  const wasKept = (view: PromiseView): void => {
    const undo = setOutcome(view.promise.id, 'kept')
    if (!undo) return
    toast(t('promise.toast.kept'), { tone: 'success', action: { label: t('common.action.undo'), onAction: undo } })
  }

  const header = <TopBar onBack={() => goBack('/app')} />
  const sheetEl = sheet && <PromiseSheet key={sheet.friendId} friendId={sheet.friendId} open={sheet.open} onClose={() => setSheet({ ...sheet, open: false })} />

  if (promises.length === 0 && candidates.length === 0) {
    return (
      <Screen header={header} contentClassName={styles.content}>
        <PageTitle title={t('promise.title')} />
        <EmptyState
          icon={<CalendarCheck />}
          title={t('promise.empty.title')}
          text={t('promise.empty.body')}
          action={<Button onClick={() => navigate(COLLECT_PATH)}>{t('promise.empty.cta')}</Button>}
        />
      </Screen>
    )
  }

  const payingPromise = paying?.view.promise ?? null

  return (
    <Screen header={header} contentClassName={styles.content}>
      <PageTitle title={t('promise.title')} subtitle={t('promise.subtitle')} />

      {lists.open.length > 0 && (
        <section className={styles.block} aria-labelledby="promise-open">
          <h2 id="promise-open" className={styles.heading}>
            {t('promise.open.heading')}
          </h2>
          <Card padding="none">
            <ul className={styles.rows} aria-labelledby="promise-open">
              {lists.open.map((view) => {
                const p = view.promise
                const mine = p.direction === 'pay'
                const name = nameOf(p.friendId)
                const money = (minor: number): string => formatMoney(minor, p.currency, { trimZeros: true })
                const by = p.due === today ? t('promise.row.by.today') : t('promise.row.by', { date: dayLabel(p.due, today) })
                return (
                  <li key={p.id} className={styles.row} data-state="open">
                    <div className={styles.person}>
                      <FriendAvatar friendId={p.friendId} size="md" />
                      <span className={styles.text}>
                        <span className={styles.name}>{t(mine ? 'promise.row.mine' : 'promise.row.theirs', { name, amount: money(p.amount) })}</span>
                        <span className={styles.meta}>
                          {view.unmet > 0 && view.unmet < p.amount ? `${by} · ${t('promise.row.left', { amount: money(view.unmet) })}` : by}
                        </span>
                      </span>
                    </div>
                    <div className={styles.rowActions}>
                      {view.payable > 0 && mine && (
                        <Button size="md" iconStart={<Wallet />} onClick={() => setPaying({ view, open: true })}>
                          {t('promise.row.pay', { amount: money(view.payable) })}
                        </Button>
                      )}
                      {view.payable > 0 && !mine && (
                        <>
                          <Button size="md" iconStart={<Check />} onClick={() => record(view, 'other')}>
                            {t('promise.row.got', { amount: money(view.payable) })}
                          </Button>
                          <Button size="md" variant="secondary" iconStart={<BellRing />} onClick={() => void ask(view)}>
                            {t('promise.row.ask', { name })}
                          </Button>
                        </>
                      )}
                      <Button size="md" variant="ghost" onClick={() => setSheet({ friendId: p.friendId, open: true })} aria-label={t('promise.row.change.aria', { name })}>
                        {t('promise.row.change')}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        </section>
      )}

      {candidates.length > 0 && (
        <section className={styles.block} aria-labelledby="promise-new">
          <h2 id="promise-new" className={styles.heading}>
            {t('promise.new.heading')}
          </h2>
          <p className={styles.fine}>{t('promise.new.fine')}</p>
          <Card padding="none">
            <List aria-labelledby="promise-new">
              {candidates.map((c) => {
                const amount = formatMoney(Math.abs(c.amount), summary.currency, { trimZeros: true })
                const line = c.amount > 0 ? t('promise.candidate.owesYou', { amount }) : t('promise.candidate.youOwe', { amount })
                return (
                  <ListRow
                    key={c.id}
                    leading={<FriendAvatar friendId={c.id} size="md" />}
                    title={friendLabel(c.id, friendsById[c.id] ?? null)}
                    subtitle={line}
                    onClick={() => setSheet({ friendId: c.id, open: true })}
                    chevron
                    aria-label={t('promise.candidate.aria', { name: friendLabel(c.id, friendsById[c.id] ?? null), line })}
                  />
                )
              })}
            </List>
          </Card>
        </section>
      )}

      {lists.people.length > 0 && (
        <section className={styles.block} aria-labelledby="promise-people">
          <h2 id="promise-people" className={styles.heading}>
            {t('promise.people.heading')}
          </h2>
          <Card padding="none">
            <List aria-labelledby="promise-people">
              {lists.people.map((person) => (
                <ListRow
                  key={person.id}
                  leading={<FriendAvatar friendId={person.id} size="md" />}
                  title={friendLabel(person.id, friendsById[person.id] ?? null)}
                  trailing={<span className={styles.stat}>{t('promise.stats', { kept: person.stats.kept, total: person.stats.total })}</span>}
                />
              ))}
            </List>
          </Card>
        </section>
      )}

      {lists.history.length > 0 && (
        <section className={styles.block} aria-labelledby="promise-history">
          <h2 id="promise-history" className={styles.heading}>
            {t('promise.history.heading')}
          </h2>
          <Card padding="none">
            <ul className={styles.rows} aria-labelledby="promise-history">
              {lists.history.map((view) => {
                const p = view.promise
                const name = nameOf(p.friendId)
                const vars = { name, amount: formatMoney(p.amount, p.currency, { trimZeros: true }) }
                const date = dayLabel(p.due, today)
                return (
                  <li key={p.id} className={styles.row} data-state={view.state}>
                    <div className={styles.person}>
                      <FriendAvatar friendId={p.friendId} size="md" />
                      <span className={styles.text}>
                        <span className={styles.name}>{t(p.direction === 'pay' ? 'promise.row.mine.past' : 'promise.row.theirs.past', vars)}</span>
                        <span className={`${styles.meta} ${styles.state}`}>{t(view.state === 'kept' ? 'promise.row.kept' : 'promise.row.broken', { date })}</span>
                      </span>
                    </div>
                    {view.state === 'broken' && (
                      <div className={styles.rowActions}>
                        <Button size="md" variant="ghost" onClick={() => wasKept(view)} aria-label={t('promise.row.wasKept.aria', { name, date })}>
                          {t('promise.row.wasKept')}
                        </Button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>
          <p className={styles.fine}>{t('promise.history.fine')}</p>
        </section>
      )}

      {sheetEl}
      {paying && payingPromise && (
        <UpiPaySheet
          open={paying.open}
          onClose={() => setPaying((p) => p && { ...p, open: false })}
          payee={{ id: payingPromise.friendId, name: nameOf(payingPromise.friendId), upiId: friendsById[payingPromise.friendId]?.upiId ?? null }}
          payer={{ id: ME_ID, name: t('common.people.you'), color: me.color }}
          amount={paying.view.payable}
          currency={payingPromise.currency}
          // The UPI note stays in English: banks and UPI apps show it as is.
          note="As promised"
          onMarkPaid={() => {
            setPaying((p) => p && { ...p, open: false })
            record(paying.view, 'upi')
          }}
        />
      )}
    </Screen>
  )
}
