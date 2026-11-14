import { useMemo, useState } from 'react'
import { Banknote, Check, CircleCheck, SkipForward, Wallet } from 'lucide-react'
import { goBack, navigate } from '../../app/router'
import { Button, Card, EmptyState, Money, PageTitle, Progress, Screen, SuccessBurst, TopBar, useToast } from '../../components'
import { useExpenses, useFriendsById, useGroups, useMe, useSummary } from '../../data'
import { ME_ID, type Settlement } from '../../domain/types'
import { today } from '../../engine/dates'
import { useT } from '../../i18n'
import { FriendAvatar, friendLabel } from '../../kit/index-a'
import { UpiPaySheet } from '../../kit/UpiPaySheet'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { firstName } from '../../share/text'
import { friendBalance, settleWithFriend, singleSourceTitle, sourcesTitle } from '../friends/friendBalance'
import { payQueue, queueTotal, type QueueEntry } from './engine'
import styles from './Queue.module.css'

interface Done {
  friendId: string
  name: string
  amount: number
}

/**
 * `/app/pay-all` — "Clear everything": everyone you owe, one at a time, the largest first. Pay
 * opens the same UPI payment as anywhere else; once it's recorded, the person is ticked and the
 * next one comes up by itself. Skip moves on without recording; "Paid in cash" records it as
 * cash. What's left is always worked out from your balances, so coming back from the UPI app
 * (or reopening the page) picks up where you are.
 */
export function QueueScreen() {
  const t = useT()
  const toast = useToast()
  const me = useMe()
  const summary = useSummary()
  const friendsById = useFriendsById()
  const expenses = useExpenses()
  const groups = useGroups()
  const currency = summary.currency
  const queue = useMemo(() => payQueue(summary.byFriend, friendsById), [summary.byFriend, friendsById])
  const [skipped, setSkipped] = useState<readonly string[]>([])
  const [done, setDone] = useState<readonly Done[]>([])
  const [paying, setPaying] = useState<{ entry: QueueEntry; open: boolean } | null>(null)
  const [burst, setBurst] = useState<{ name: string; next: string | null; key: number } | null>(null)

  const pending = queue.filter((e) => !skipped.includes(e.friendId))
  const passed = queue.filter((e) => skipped.includes(e.friendId))
  const current = pending[0] ?? null
  const money = (minor: number): string => formatMoney(minor, currency, { trimZeros: true })
  const nameOf = (entry: { friendId: string; name: string }): string => firstName(friendLabel(entry.friendId, friendsById[entry.friendId] ?? { name: entry.name }))

  const sourcesFor = (friendId: string) => friendBalance(friendId, expenses, groups, currency).sources.filter((s) => s.currency === currency)
  const currentSources = useMemo(
    () => (current ? friendBalance(current.friendId, expenses, groups, currency).sources.filter((s) => s.currency === currency) : []),
    [current, expenses, groups, currency],
  )

  const record = (entry: QueueEntry, method: Settlement['method']): void => {
    const name = nameOf(entry)
    const undo = settleWithFriend(entry.friendId, sourcesFor(entry.friendId), { method, date: today() })
    haptic('success')
    setDone((list) => [...list.filter((d) => d.friendId !== entry.friendId), { friendId: entry.friendId, name, amount: entry.amount }])
    const next = pending.find((e) => e.friendId !== entry.friendId) ?? null
    setBurst({ name, next: next ? nameOf(next) : null, key: Date.now() })
    toast(method === 'cash' ? t('queue.toast.cash', { name, amount: money(entry.amount) }) : t('queue.toast.paid', { name, amount: money(entry.amount) }), {
      tone: 'success',
      action: {
        label: t('common.action.undo'),
        onAction: () => {
          undo()
          setDone((list) => list.filter((d) => d.friendId !== entry.friendId))
        },
      },
    })
  }

  const skip = (entry: QueueEntry): void => setSkipped((list) => [...list.filter((id) => id !== entry.friendId), entry.friendId])

  const sheet = paying && (
    <UpiPaySheet
      key={paying.entry.friendId}
      open={paying.open}
      onClose={() => setPaying({ ...paying, open: false })}
      payee={{ id: paying.entry.friendId, name: nameOf(paying.entry), upiId: friendsById[paying.entry.friendId]?.upiId ?? null }}
      payer={{ id: ME_ID, name: t('common.people.you'), color: me.color }}
      amount={paying.entry.amount}
      currency={currency}
      // The UPI note stays in English: banks and UPI apps show it as is.
      note={singleSourceTitle(sourcesFor(paying.entry.friendId)) ?? 'Settle up'}
      onMarkPaid={() => record(paying.entry, 'upi')}
    />
  )
  const celebration = burst && (
    <SuccessBurst
      key={burst.key}
      title={t('queue.burst', { name: burst.name })}
      subtitle={burst.next ? t('queue.burst.next', { name: burst.next }) : t('queue.burst.last')}
      onDone={() => setBurst(null)}
    />
  )
  const header = <TopBar onBack={() => goBack('/app')} />

  if (queue.length === 0) {
    return (
      <Screen header={header} contentClassName={styles.content}>
        <PageTitle title={t('queue.title')} />
        <EmptyState
          icon={<Check />}
          title={t('queue.empty.title')}
          text={t('queue.empty.body')}
          action={<Button onClick={() => navigate('/app')}>{t('queue.empty.home')}</Button>}
        />
        <DoneList done={done} currency={currency} />
        {sheet}
        {celebration}
      </Screen>
    )
  }

  const total = done.length + queue.length
  const position = Math.min(total, done.length + passed.length + 1)

  return (
    <Screen header={header} contentClassName={styles.content}>
      <PageTitle title={t('queue.title')} subtitle={t('queue.subtitle', { count: queue.length, amount: money(queueTotal(queue)) })} />
      {current ? (
        <>
          <div className={styles.progress}>
            <Progress current={position} total={total} label={t('queue.progress', { current: position, total })} />
            <p className={styles.step} aria-hidden="true">
              {t('queue.progress', { current: position, total })}
            </p>
          </div>
          <Card className={styles.now}>
            <section aria-label={t('queue.now.aria')} className={styles.nowInner}>
              <div className={styles.who}>
                <FriendAvatar friendId={current.friendId} size="lg" />
                <div className={styles.whoText}>
                  <h2 className={styles.name}>{nameOf(current)}</h2>
                  <p className={styles.fine}>{t('queue.for', { what: sourcesTitle(currentSources) })}</p>
                </div>
              </div>
              <Money value={current.amount} currency={currency} size="xl" trimZeros className={styles.amount} />
              <p className={styles.fine}>
                {current.hasUpi
                  ? t('queue.upi', { upi: friendsById[current.friendId]?.upiId ?? '' })
                  : t('queue.noUpi', { name: nameOf(current) })}
              </p>
              <div className={styles.actions}>
                <Button block iconStart={<Wallet />} onClick={() => setPaying({ entry: current, open: true })}>
                  {t('queue.pay', { amount: money(current.amount) })}
                </Button>
                <div className={styles.row}>
                  <Button
                    variant="secondary"
                    iconStart={<Banknote />}
                    onClick={() => record(current, 'cash')}
                    aria-label={t('queue.cash.aria', { amount: money(current.amount), name: nameOf(current) })}
                  >
                    {t('queue.cash')}
                  </Button>
                  <Button variant="ghost" iconStart={<SkipForward />} onClick={() => skip(current)} aria-label={t('queue.skip.aria', { name: nameOf(current) })}>
                    {t('queue.skip')}
                  </Button>
                </div>
              </div>
            </section>
          </Card>
          {pending.length > 1 && (
            <section aria-labelledby="queue-next" className={styles.block}>
              <h2 id="queue-next" className={styles.heading}>
                {t('queue.next.title')}
              </h2>
              <ul className={styles.list}>
                {pending.slice(1).map((e) => (
                  <li key={e.friendId} className={styles.item}>
                    <FriendAvatar friendId={e.friendId} size="sm" />
                    <span className={styles.itemName}>{nameOf(e)}</span>
                    <Money value={e.amount} currency={currency} trimZeros />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <Card className={styles.now}>
          <div className={styles.nowInner}>
            <h2 className={styles.name}>{t('queue.skipped.title', { count: passed.length })}</h2>
            <p className={styles.fine}>{t('queue.skipped.body', { names: passed.map(nameOf).join(', '), amount: money(queueTotal(passed)) })}</p>
            <Button block onClick={() => setSkipped([])}>
              {t('queue.skipped.again')}
            </Button>
          </div>
        </Card>
      )}
      <DoneList done={done.filter((d) => !queue.some((e) => e.friendId === d.friendId))} currency={currency} />
      {sheet}
      {celebration}
    </Screen>
  )
}

function DoneList({ done, currency }: { done: readonly Done[]; currency: string }) {
  const t = useT()
  if (done.length === 0) return null
  return (
    <section aria-label={t('queue.done.aria')} className={styles.block}>
      <h2 className={styles.heading}>{t('queue.done.title')}</h2>
      <ul className={styles.list}>
        {done.map((d) => (
          <li key={d.friendId} className={styles.item}>
            <CircleCheck className={styles.tick} aria-hidden="true" />
            <span className={styles.itemName}>{d.name}</span>
            <Money value={d.amount} currency={currency} trimZeros tone="positive" />
          </li>
        ))}
      </ul>
    </section>
  )
}
