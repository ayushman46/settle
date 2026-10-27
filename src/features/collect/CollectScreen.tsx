import { useMemo, useState } from 'react'
import { BellRing, Check, HandCoins, ListChecks } from 'lucide-react'
import { goBack, navigate } from '../../app/router'
import { Banner, Button, Card, EmptyState, Money, PageTitle, Screen, TopBar, useToast } from '../../components'
import { useExpenses, useFriends, useGroups, useProfile, useStore } from '../../data'
import { daysSince, isQuietHour, nextTone, tooSoon } from '../../data/reminders'
import { remindersStore } from '../../data/stores'
import { today } from '../../engine/dates'
import { useT } from '../../i18n'
import { FriendAvatar, friendLabel } from '../../kit/index-a'
import { NudgeSheet } from '../../kit/index-b'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { settleWithFriend } from '../friends/friendBalance'
import { friendPath } from '../groups/paths'
import { AutoSettleCard } from '../autosettle/AutoSettleCard'
import { WHOS_PAID_PATH } from '../whospaid/paths'
import { toCollect, type CollectRow } from './toCollect'
import styles from './Collect.module.css'

/**
 * `/app/collect` — "To collect": everyone who owes you, the longest wait first, each with what
 * it's for, how long it's been and when you last asked. Remind opens the message in the tone that
 * comes next (friendly, then light-hearted, then firm) and remembers it went; asked today, it says
 * to give it a day; late at night, it says the reminder can wait. Paid ticks them off, with Undo.
 */
export function CollectScreen() {
  const t = useT()
  const toast = useToast()
  const profile = useProfile()
  const friends = useFriends()
  const expenses = useExpenses()
  const groups = useGroups()
  const reminders = useStore(remindersStore, (all) => all)
  const [now] = useState(() => Date.now())
  const rows = useMemo(() => toCollect(friends, expenses, groups, profile.currency, reminders, now), [friends, expenses, groups, profile.currency, reminders, now])
  // Keyed per opening, so the sheet starts on that person's next tone.
  const [remind, setRemind] = useState<{ row: CollectRow; opened: number; open: boolean } | null>(null)
  const total = rows.reduce((sum, row) => sum + row.amount, 0)
  const money = (minor: number) => formatMoney(minor, profile.currency, { trimZeros: true })

  const markPaid = (row: CollectRow) => {
    const name = friendLabel(row.friend.id, row.friend)
    const undo = settleWithFriend(row.friend.id, row.sources, { method: 'other', date: today() })
    haptic('success')
    toast(t('collect.paid.toast', { name }), { tone: 'success', action: { label: t('common.action.undo'), onAction: undo } })
  }

  if (rows.length === 0) {
    return (
      <Screen header={<TopBar onBack={() => goBack('/app')} />}>
        <PageTitle title={t('collect.title')} />
        <EmptyState icon={<Check />} title={t('collect.empty.title')} text={t('collect.empty.text')} action={<Button onClick={() => navigate('/app')}>{t('collect.home')}</Button>} />
      </Screen>
    )
  }

  return (
    <Screen header={<TopBar onBack={() => goBack('/app')} />} contentClassName={styles.content}>
      <PageTitle title={t('collect.title')} subtitle={t('collect.subtitle', { amount: money(total), count: rows.length })} />
      {isQuietHour(new Date(now)) && (
        <Banner tone="info" title={t('collect.quiet.title')}>
          {t('collect.quiet.text')}
        </Banner>
      )}
      <AutoSettleCard />
      <Card padding="none">
        <ul className={styles.list}>
          {rows.map((row) => (
            <Person key={row.friend.id} row={row} now={now} onRemind={() => setRemind({ row, opened: Date.now(), open: true })} onPaid={() => markPaid(row)} />
          ))}
        </ul>
      </Card>
      <Button variant="ghost" block iconStart={<ListChecks />} onClick={() => navigate(WHOS_PAID_PATH)}>
        {t('whospaid.expense.cta')}
      </Button>
      {remind && (
        <NudgeSheet
          key={`${remind.row.friend.id}:${remind.opened}`}
          open={remind.open}
          onClose={() => setRemind({ ...remind, open: false })}
          friend={remind.row.friend}
          amount={remind.row.amount}
          currency={profile.currency}
          title={remind.row.title}
          link={null}
          initialTone={nextTone(remind.row.reminders)}
        />
      )}
    </Screen>
  )
}

function Person({ row, now, onRemind, onPaid }: { row: CollectRow; now: number; onRemind: () => void; onPaid: () => void }) {
  const t = useT()
  const name = friendLabel(row.friend.id, row.friend)
  const waited = row.since !== null ? daysSince(new Date(`${row.since}T12:00:00`).getTime(), now) : null
  // "our splits" opens a line here.
  const title = row.title.charAt(0).toUpperCase() + row.title.slice(1)
  const what = waited === null ? title : `${title} · ${waited === 0 ? t('collect.age.today') : t('collect.age.days', { count: waited })}`
  const sent = row.reminders
  const last = sent.at(-1)
  const lastDays = last ? daysSince(last.at, now) : 0
  const asked =
    last === undefined
      ? t('collect.reminded.never')
      : sent.length === 1
        ? lastDays === 0
          ? t('collect.reminded.once.today')
          : t('collect.reminded.once.days', { days: lastDays })
        : lastDays === 0
          ? t('collect.reminded.many.today', { count: sent.length })
          : t('collect.reminded.many.days', { count: sent.length, days: lastDays })
  const soon = tooSoon(sent, now)
  const next = soon ? t('collect.soon') : sent.length > 0 ? t(`collect.next.${nextTone(sent)}`) : null

  return (
    <li className={styles.row}>
      <button type="button" className={styles.person} onClick={() => navigate(friendPath(row.friend.id))}>
        <FriendAvatar friendId={row.friend.id} size="md" />
        <span className={styles.text}>
          <span className={styles.name}>{name}</span>
          <span className={styles.meta}>{what}</span>
          <span className={styles.meta}>
            {asked}
            {next && ` · ${next}`}
          </span>
        </span>
        <Money value={row.amount} currency={row.sources[0]?.currency ?? 'INR'} strong trimZeros className={styles.amount} />
      </button>
      <div className={styles.actions}>
        <Button size="sm" variant={soon ? 'secondary' : 'tonal'} iconStart={<BellRing />} onClick={onRemind} aria-label={t('collect.remind.aria', { name })}>
          {t('collect.remind.cta')}
        </Button>
        <Button size="sm" variant="ghost" iconStart={<HandCoins />} onClick={onPaid} aria-label={t('collect.paid.aria', { name })}>
          {t('collect.paid.cta')}
        </Button>
      </div>
    </li>
  )
}
