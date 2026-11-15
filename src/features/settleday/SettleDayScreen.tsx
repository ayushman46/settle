import { useRef, useState } from 'react'
import { BellRing, CalendarPlus, Check, CircleCheck, Share2, Wallet } from 'lucide-react'
import { goBack, useRoute } from '../../app/router'
import { Button, Card, Money, PageTitle, Screen, SectionHeader, SuccessCheck, TopBar, useToast } from '../../components'
import { DataError, deleteSettlement, recordSettlement, useExpenses, useFriendsById, useGroup, useProfile } from '../../data'
import { ME_ID, type Group, type Settlement } from '../../domain/types'
import type { Transfer } from '../../engine/balances'
import { useT } from '../../i18n'
import { FriendAvatar } from '../../kit/FriendAvatar'
import { friendLabel, friendObjectLabel } from '../../kit/friendName'
import { UpiPaySheet } from '../../kit/UpiPaySheet'
import { upiPaymentForTransfer } from '../../kit/upiPayment'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { shareResult } from '../../lib/share'
import { shareFile } from '../../share/shareFile'
import { GroupGone } from '../groups/GroupGone'
import { paymentSentence } from '../groups/groupView'
import { groupPath } from '../groups/paths'
import { DayPicker } from './DayPicker'
import { everyLabel } from './labels'
import { calendarFile, calendarFilename, remindText, tellGroupText } from './messages'
import { SETTLE_DAY_ROUTE } from './paths'
import { clearSettleDay, restoreSettleDay } from './store'
import { usePickSettleDay, useSettleDay } from './useSettleDay'
import styles from './SettleDay.module.css'

const ROUTES = [SETTLE_DAY_ROUTE] as const

/**
 * `/app/groups/:id/settle-day` — the group's day of the month to clear everything. Everything to
 * settle right now (the app's own fewest payments): yours first, with Pay and "Mark paid"; the
 * others' with a reminder to send. Plus the message that tells the group its day, and a calendar
 * file that repeats it every month.
 */
export function SettleDayScreen() {
  const { params } = useRoute(ROUTES)
  const group = useGroup(params.id)
  if (!group) return <GroupGone />
  return <SettleDay key={group.id} group={group} />
}

interface Paying {
  transfer: Transfer
  open: boolean
}

function SettleDay({ group }: { group: Group }) {
  const t = useT()
  const toast = useToast()
  const friendsById = useFriendsById()
  const profile = useProfile()
  const expenses = useExpenses({ groupId: group.id })
  const view = useSettleDay(group)
  const pick = usePickSettleDay(group)
  // The last payment stays with its sheet while it slides away.
  const [paying, setPaying] = useState<Paying | null>(null)
  const busy = useRef(false)

  const { entry, status, payments } = view
  const upi = group.currency === 'INR'
  const canPick = !group.archived && group.memberIds.length >= 2
  const mine = payments.filter((p) => p.fromId === ME_ID)
  const rest = payments.filter((p) => p.fromId !== ME_ID)
  const paidToday = group.settlements.filter((s) => s.date === view.today).sort((a, b) => b.createdAt - a.createdAt)
  const nameOf = (id: string): string => friendLabel(id, friendsById[id] ?? null)
  const money = (paise: number): string => formatMoney(paise, group.currency, { trimZeros: true })
  const sentence = (p: Pick<Transfer, 'fromId' | 'toId'>, tense: 'past' | 'present'): string =>
    paymentSentence(p.fromId, p.toId, nameOf(p.fromId), friendObjectLabel(p.toId, friendsById[p.toId] ?? null), tense)

  const record = (p: Transfer, method: Settlement['method']): void => {
    let settlement: Settlement
    try {
      settlement = recordSettlement(group.id, { fromId: p.fromId, toId: p.toId, amount: p.amount, date: view.today, method })
    } catch (error) {
      if (!(error instanceof DataError)) throw error
      haptic('error')
      toast(t('settleday.toast.error'), { tone: 'error' })
      return
    }
    haptic('success')
    toast(t('settleday.toast.paid', { sentence: sentence(p, 'past'), amount: money(p.amount) }), {
      tone: 'success',
      action: { label: t('common.action.undo'), onAction: () => deleteSettlement(group.id, settlement.id) },
    })
  }

  /** Opens the share sheet (or copies) with the text ready: nothing is sent from here. */
  const send = async (text: string, title: string, copied: string): Promise<void> => {
    if (busy.current) return
    busy.current = true
    try {
      const outcome = await shareResult(text, { title })
      if (outcome === 'shared' || outcome === 'copied') haptic('success')
      if (outcome === 'copied') toast(copied, { tone: 'success' })
      if (outcome === 'failed') {
        haptic('error')
        toast(t('settleday.share.failed'), { tone: 'error' })
      }
    } finally {
      busy.current = false
    }
  }

  const remind = (p: Transfer): void => {
    const name = nameOf(p.fromId)
    void send(remindText({ group, payment: p, phase: status?.phase ?? null, friendsById, profile }), t('settleday.remind.title', { name }), t('settleday.remind.copied', { name }))
  }

  const tellText = entry && status ? tellGroupText({ group, day: entry.day, status, payments, friendsById, profile }) : null

  const addToCalendar = async (): Promise<void> => {
    if (!entry || busy.current) return
    busy.current = true
    try {
      const blob = new Blob([calendarFile(group, entry.day, view.today, new Date())], { type: 'text/calendar;charset=utf-8' })
      const outcome = await shareFile(blob, calendarFilename(group), undefined, { title: t('settleday.cal.summary', { group: group.name }) })
      if (outcome === 'downloaded') toast(t('settleday.cal.saved'), { tone: 'success' })
      if (outcome === 'failed') {
        haptic('error')
        toast(t('settleday.cal.failed'), { tone: 'error' })
      }
    } finally {
      busy.current = false
    }
  }

  const remove = (): void => {
    const before = clearSettleDay(group.id)
    if (!before) return
    toast(t('settleday.remove.toast', { name: group.name }), { action: { label: t('common.action.undo'), onAction: () => restoreSettleDay(group.id, before) } })
  }

  const row = (p: Transfer) => {
    const payer = p.fromId === ME_ID
    const amount = money(p.amount)
    return (
      <li key={`${p.fromId}>${p.toId}`} className={styles.row}>
        <div className={styles.rowHead}>
          <FriendAvatar friendId={payer ? p.toId : p.fromId} size="sm" />
          <span className={styles.rowText}>{sentence(p, 'present')}</span>
          <Money value={p.amount} currency={group.currency} trimZeros strong />
        </div>
        <div className={styles.rowActions}>
          {payer && upi && (
            <Button size="md" iconStart={<Wallet />} onClick={() => setPaying({ transfer: p, open: true })} aria-label={t('settleday.row.pay.aria', { name: nameOf(p.toId), amount })}>
              {t('settleday.row.pay')}
            </Button>
          )}
          {!payer && (
            <Button size="md" variant="tonal" iconStart={<BellRing />} onClick={() => remind(p)} aria-label={t('settleday.row.remind.aria', { name: nameOf(p.fromId), amount })}>
              {t('settleday.row.remind')}
            </Button>
          )}
          <Button
            size="md"
            variant="secondary"
            iconStart={<Check />}
            onClick={() => record(p, 'other')}
            aria-label={t('settleday.row.paid.aria', { sentence: sentence(p, 'present'), amount })}
          >
            {t('settleday.row.paid')}
          </Button>
        </div>
      </li>
    )
  }

  const section = (id: string, title: string, description: string, list: readonly Transfer[]) =>
    list.length > 0 && (
      <section className={styles.block} aria-labelledby={id}>
        <SectionHeader id={id} title={title} description={description} />
        <Card padding="none">
          <ul className={styles.rows}>{list.map(row)}</ul>
        </Card>
      </section>
    )

  const subtitle = !entry || !status
    ? t('settleday.screen.intro')
    : status.phase === 'today'
      ? t('settleday.screen.sub.today')
      : status.phase === 'yesterday'
        ? t('settleday.screen.sub.yesterday')
        : t('settleday.screen.sub.waiting', { every: everyLabel(entry.day), count: status.daysToGo })
  const payment = paying ? upiPaymentForTransfer(paying.transfer, group.currency, friendsById, group.name) : null

  return (
    <Screen header={<TopBar onBack={() => goBack(groupPath(group.id))} />} contentClassName={styles.content}>
      <PageTitle eyebrow={`${group.emoji} ${group.name}`} title={t('settleday.screen.title')} subtitle={subtitle} />

      {canPick && !entry && (
        <section className={styles.block} aria-labelledby="settleday-pick">
          <SectionHeader id="settleday-pick" title={t('settleday.card.pick.title')} />
          <DayPicker value={null} onPick={pick} label={t('settleday.pick.aria', { name: group.name })} />
        </section>
      )}

      {payments.length === 0 ? (
        <div className={styles.square} role="status">
          <SuccessCheck size="md" />
          <h2 className={styles.squareTitle}>{t('settleday.square.title')}</h2>
          <p className={styles.fine}>{expenses.length > 0 ? t('settleday.square.body', { name: group.name }) : t('settleday.square.empty', { name: group.name })}</p>
        </div>
      ) : (
        <>
          {section('settleday-pay', t('settleday.pay.title'), upi ? t('settleday.pay.upi') : t('settleday.pay.other'), mine)}
          {section('settleday-rest', t('settleday.rest.title'), t('settleday.rest.body'), rest)}
        </>
      )}

      {paidToday.length > 0 && (
        <section className={styles.block} aria-labelledby="settleday-done">
          <SectionHeader id="settleday-done" title={t('settleday.done.title')} />
          <ul className={styles.doneList}>
            {paidToday.map((s) => (
              <li key={s.id} className={styles.doneItem}>
                <CircleCheck className={styles.tick} aria-hidden="true" />
                <span className={styles.rowText}>{sentence(s, 'past')}</span>
                <Money value={s.amount} currency={group.currency} trimZeros tone="positive" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {entry && tellText !== null && (
        <section className={styles.block} aria-labelledby="settleday-tell">
          <SectionHeader id="settleday-tell" title={t('settleday.tell.title')} description={t('settleday.tell.body')} />
          <Card className={styles.tell}>
            <p className={styles.message}>{tellText}</p>
            <Button
              block
              iconStart={<Share2 />}
              onClick={() => void send(tellText, t('settleday.cal.summary', { group: group.name }), t('settleday.tell.copied'))}
            >
              {t('settleday.tell.cta')}
            </Button>
            <Button block variant="secondary" iconStart={<CalendarPlus />} onClick={() => void addToCalendar()}>
              {t('settleday.cal.cta')}
            </Button>
            <p className={styles.fine}>{t('settleday.cal.body')}</p>
          </Card>
        </section>
      )}

      {canPick && entry && (
        <section className={styles.block} aria-labelledby="settleday-change">
          <SectionHeader id="settleday-change" title={t('settleday.change.title')} />
          <DayPicker value={entry.day} onPick={pick} label={t('settleday.pick.aria', { name: group.name })} />
          <Button variant="ghost" size="md" className={styles.remove} onClick={remove}>
            {t('settleday.remove.cta')}
          </Button>
        </section>
      )}

      {payment && paying && (
        <UpiPaySheet
          open={paying.open}
          onClose={() => setPaying((p) => p && { ...p, open: false })}
          {...payment}
          onMarkPaid={() => record(paying.transfer, 'upi')}
        />
      )}
    </Screen>
  )
}
