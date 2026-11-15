import { useRef, useState } from 'react'
import { BellRing, Check, Dices, HandCoins, QrCode as QrIcon, Share2, Trash2, Wallet } from 'lucide-react'
import { goBack, navigate, useRoute } from '../../app/router'
import { Badge, Banner, Button, Card, IconButton, PageTitle, Progress, Screen, SegmentedControl, TopBar, useToast } from '../../components'
import { useFriendsById, useProfile } from '../../data'
import { ME_ID } from '../../domain/types'
import { toIsoDate, today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { DateField } from '../../kit/DateField'
import { FriendAvatar } from '../../kit/FriendAvatar'
import { friendLabel } from '../../kit/friendName'
import { UpiPaySheet } from '../../kit/UpiPaySheet'
import { haptic } from '../../lib/haptics'
import { shareResult } from '../../lib/share'
import { isValidUpiId, normalizeUpiId } from '../../lib/upi'
import { friendFallback } from '../../share/fallbacks'
import { outsideName } from '../../share/names'
import { firstName } from '../../share/text'
import {
  currentIndex,
  eligibleHands,
  emptyMonth,
  isFinished,
  markAllPaid,
  markHanded,
  markPaid,
  monthView,
  pickFair,
  putMonth,
  recordDraw,
  undoDraw,
  type Committee,
  type HandoverHow,
  type HandView,
} from './engine'
import { COMMITTEE_DETAIL_PATTERN, COMMITTEE_PATH } from './paths'
import { next32 } from './random'
import { DrawSheet, HandoverSheet } from './Sheets'
import { committeeById, putCommittee, removeCommittee, replaceCommittee, useCommittee } from './store'
import { PeopleTab, ScheduleTab } from './Tabs'
import { dayLabel, money, monthLabel, monthMessage, ordinal, paidLine, remindMessage, timeLabel } from './text'
import styles from './Committee.module.css'

const ROUTES = [COMMITTEE_DETAIL_PATTERN] as const
type Tab = 'month' | 'people' | 'schedule'

/**
 * `/app/committee/:id` — one committee. "Month" is the job: who takes the pot (or the draw), who
 * has paid in (a tick each, dated; Remind; the organiser's UPI or QR), late payers in red, "Pot
 * handed over", and the month as a message for the group. "People" is everyone's position and
 * "Schedule" every month. Every change can be undone from its toast.
 */
export function CommitteeDetailScreen() {
  const t = useT()
  const toast = useToast()
  const { params } = useRoute(ROUTES)
  const committee = useCommittee(params.id)
  const friendsById = useFriendsById()
  const profile = useProfile()
  const [day] = useState(() => todayIso())
  const [tab, setTab] = useState<Tab>('month')
  const [picked, setPicked] = useState<number | null>(null)
  const [tickDate, setTickDate] = useState(day)
  const [drawOpen, setDrawOpen] = useState(false)
  const [handover, setHandover] = useState({ round: 0, open: false })
  const [paying, setPaying] = useState<{ handId: string; open: boolean } | null>(null)
  /** A draw made while the sheet is open: its Undo is offered when the sheet closes. */
  const drewNow = useRef(false)
  const header = (onDelete?: () => void) => (
    <TopBar
      onBack={() => goBack(COMMITTEE_PATH)}
      right={
        onDelete ? (
          <IconButton label={t('committee.delete')} onClick={onDelete}>
            <Trash2 />
          </IconButton>
        ) : undefined
      }
    />
  )

  if (!committee) {
    return (
      <Screen header={header()} contentClassName={styles.content}>
        <PageTitle title={t('committee.gone.title')} subtitle={t('committee.gone.body')} />
        <Button variant="secondary" onClick={() => navigate(COMMITTEE_PATH, { replace: true })}>
          {t('committee.gone.cta')}
        </Button>
      </Screen>
    )
  }

  const c: Committee = committee
  const index = Math.min(picked ?? currentIndex(c) ?? c.months.length - 1, c.months.length - 1)
  const view = monthView(c, index, day)
  const month = monthLabel(view.period, day)
  const pot = money(view.pot, c.currency)
  const label = (id: string): string => friendLabel(id, friendsById[id] ?? null)
  const first = (id: string): string => firstName(label(id))
  /** Names as people outside this phone read them: never "You". */
  const outside = (id: string): string => firstName(outsideName(id, friendsById, profile, friendFallback()))
  const who = (id: string): 'me' | 'other' => (id === ME_ID ? 'me' : 'other')
  const handLabel = (h: HandView): string => (h.of > 1 ? t('committee.row.hand', { name: label(h.hand.friendId), n: h.nth }) : label(h.hand.friendId))
  const handName = (handId: string): string => {
    const h = view.hands.find((v) => v.hand.id === handId)
    return h ? handLabel(h) : t('common.people.someone')
  }
  const rawUpi = c.organiserId === ME_ID ? profile.upiId : (friendsById[c.organiserId]?.upiId ?? null)
  const organiserUpi = c.currency === 'INR' && rawUpi && isValidUpiId(rawUpi) ? normalizeUpiId(rawUpi) : null
  const before = c.months[index] ?? emptyMonth()

  /** Saves a change and offers Undo, which puts things back on the committee as it is by then. */
  const save = (next: Committee, message: string, undo: (now: Committee) => Committee): void => {
    if (next === c) return
    replaceCommittee(next)
    haptic('success')
    const closedNow = !view.closed && monthView(next, index, day).closed
    toast(closedNow ? t('committee.toast.closed', { month }) : message, {
      tone: closedNow ? 'success' : undefined,
      action: {
        label: t('committee.undo'),
        onAction: () => {
          const now = committeeById(next.id)
          if (now) replaceCommittee(undo(now))
        },
      },
    })
  }
  const restore = (now: Committee): Committee => putMonth(now, index, before)

  const tick = (h: HandView, on: string = tickDate): void => {
    const name = handLabel(h)
    if (h.paid) save(markPaid(c, index, h.hand.id, null), t('committee.toast.unpaid', { name }), restore)
    else save(markPaid(c, index, h.hand.id, { on, at: Date.now() }), t('committee.toast.paid', { name, month }), restore)
  }
  const tickAll = (): void => save(markAllPaid(c, index, { on: tickDate, at: Date.now() }), t('committee.toast.all', { month }), restore)
  const handOver = (on: string, how: HandoverHow): void => save(markHanded(c, index, { on, how, at: Date.now() }), t('committee.toast.handed'), restore)
  const notHanded = (): void => save(markHanded(c, index, null), t('committee.toast.notHanded'), restore)

  const hat = eligibleHands(c)
  const draw = (): void => {
    const next = recordDraw(c, index, pickFair(hat.length, next32), Date.now())
    if (next === c) return
    replaceCommittee(next)
    haptic('success')
    drewNow.current = true
  }
  const closeDraw = (): void => {
    setDrawOpen(false)
    if (!drewNow.current) return
    drewNow.current = false
    const now = committeeById(c.id)
    const taker = now ? monthView(now, index, day).taker : null
    if (!taker) return
    toast(t('committee.toast.drawn', { name: first(taker.friendId), month }), {
      action: {
        label: t('committee.undo'),
        onAction: () => {
          const latest = committeeById(c.id)
          if (!latest) return
          replaceCommittee(undoDraw(latest, index))
          toast(t('committee.toast.drawUndone'))
        },
      },
    })
  }

  const share = async (text: string, title: string): Promise<void> => {
    const outcome = await shareResult(text, { title })
    if (outcome === 'copied') toast(t('committee.toast.copied'), { tone: 'success' })
    else if (outcome === 'failed') toast(t('committee.toast.shareFailed'), { tone: 'error' })
  }
  const remind = (friendId: string): void =>
    void share(
      remindMessage(c, view, friendId, { name: outside, today: day, mine: c.organiserId === ME_ID, upi: organiserUpi }),
      t('committee.remind.title', { name: first(friendId) }),
    )

  const remove = (): void => {
    const gone = removeCommittee(c.id)
    if (!gone) return
    navigate(COMMITTEE_PATH, { replace: true })
    toast(t('committee.deleted', { name: gone.name }), { action: { label: t('committee.undo'), onAction: () => void putCommittee(gone) } })
  }

  const status = (h: HandView): { text: string; late: boolean } => {
    if (h.paid) {
      const date = dayLabel(h.paid.on, day)
      return { text: h.daysLate > 0 ? t('committee.row.paidLate', { date, days: h.daysLate }) : t('committee.row.paid', { date }), late: false }
    }
    if (h.daysLate > 0) return { text: t('committee.row.late', { days: h.daysLate }), late: true }
    return { text: view.due === day ? t('committee.row.dueToday') : t('committee.row.due', { date: dayLabel(view.due, day) }), late: false }
  }

  const payingHand = paying ? (view.hands.find((h) => h.hand.id === paying.handId) ?? null) : null
  const takerId = view.taker?.friendId ?? null

  return (
    <Screen header={header(remove)} contentClassName={styles.content}>
      <PageTitle
        title={c.name}
        subtitle={t('committee.detail.subtitle', { amount: money(c.amount, c.currency), day: ordinal(c.day), who: who(c.organiserId), name: first(c.organiserId) })}
      />
      {isFinished(c) && <Banner tone="success">{t('committee.finished')}</Banner>}
      <SegmentedControl
        ariaLabel={t('committee.tabs.aria')}
        value={tab}
        onChange={setTab}
        options={[
          { value: 'month', label: t('committee.tabs.month') },
          { value: 'people', label: t('committee.tabs.people') },
          { value: 'schedule', label: t('committee.tabs.schedule') },
        ]}
      />

      {tab === 'people' && <PeopleTab committee={c} today={day} label={label} />}
      {tab === 'schedule' && (
        <ScheduleTab
          committee={c}
          today={day}
          label={first}
          onPick={(i) => {
            setPicked(i)
            setTab('month')
          }}
        />
      )}

      {tab === 'month' && (
        <section className={styles.section} aria-label={month}>
          <Card className={styles.pot}>
            <h2 className={styles.potTitle}>{t('committee.month.title', { month, n: index + 1, count: c.months.length, date: dayLabel(view.due, day) })}</h2>
            <p className={styles.potLine}>{takerId ? t('committee.month.taker', { who: who(takerId), name: first(takerId), pot }) : t('committee.month.noTaker', { pot })}</p>
            {view.takerHow === 'draw' && view.draw && (
              <p className={styles.fine}>
                {t('committee.month.how.draw', { date: dayLabel(toIsoDate(new Date(view.draw.at)), day), time: timeLabel(view.draw.at), count: view.draw.among.length })}
                {view.draws > 1 && ` ${t('committee.month.how.redrawn', { count: view.draws })}`}
              </p>
            )}
            {view.takerHow === 'last' && <p className={styles.fine}>{t('committee.month.how.last')}</p>}
            {!takerId && (
              <Button iconStart={<Dices />} onClick={() => setDrawOpen(true)}>
                {t('committee.month.draw')}
              </Button>
            )}
            <Progress current={view.paidCount} total={view.hands.length} label={paidLine(c, view)} />
            <p className={view.late.length > 0 ? styles.late : styles.fine} role="status">
              {paidLine(c, view)}
              {view.late.length > 0 && `. ${t('committee.month.late', { count: view.late.length })}`}
            </p>
          </Card>

          {view.closed && <Banner tone="success">{t('committee.month.closed', { month })}</Banner>}

          {!view.allPaid && (
            <div className={styles.field}>
              <p className={styles.fieldLabel}>{t('committee.month.paidOn')}</p>
              <DateField value={tickDate} onChange={setTickDate} label={t('committee.month.paidOn')} max={day} />
            </div>
          )}

          <Card padding="none">
            <ul className={styles.hands} aria-label={t('committee.month.hands', { month })}>
              {view.hands.map((h) => {
                const id = h.hand.friendId
                const s = status(h)
                const name = handLabel(h)
                const canPay = !h.paid && c.currency === 'INR' && id !== c.organiserId
                return (
                  <li key={h.hand.id} className={styles.hand}>
                    <FriendAvatar friendId={id} size="sm" />
                    <div className={styles.who}>
                      <p className={styles.name}>
                        {name} {id === c.organiserId && <Badge size="sm">{t('committee.row.collects')}</Badge>}
                      </p>
                      <p className={s.late ? styles.late : styles.fine}>{s.text}</p>
                    </div>
                    {!h.paid && id !== ME_ID && id !== c.organiserId && (
                      <IconButton label={t('committee.row.remind', { name })} onClick={() => remind(id)}>
                        <BellRing />
                      </IconButton>
                    )}
                    {canPay && (
                      <IconButton
                        label={id === ME_ID ? t('committee.row.pay', { name: first(c.organiserId) }) : t('committee.row.qr', { name })}
                        onClick={() => setPaying({ handId: h.hand.id, open: true })}
                      >
                        {id === ME_ID ? <Wallet /> : <QrIcon />}
                      </IconButton>
                    )}
                    <IconButton label={t('committee.row.tick', { name })} variant={h.paid ? 'primary' : 'secondary'} aria-pressed={h.paid !== null} onClick={() => tick(h)}>
                      <Check />
                    </IconButton>
                  </li>
                )
              })}
            </ul>
          </Card>

          <div className={styles.actions}>
            {view.unpaid.length > 1 && (
              <Button variant="secondary" block iconStart={<Check />} onClick={tickAll}>
                {t('committee.tickAll')}
              </Button>
            )}
            {takerId && !view.handed && (
              <Button variant={view.allPaid ? 'primary' : 'secondary'} block iconStart={<HandCoins />} onClick={() => setHandover((s) => ({ round: s.round + 1, open: true }))}>
                {t('committee.handover.cta')}
              </Button>
            )}
            {takerId && !view.handed && !view.allPaid && <p className={styles.fine}>{t('committee.handover.waiting')}</p>}
            {takerId && view.handed && (
              <>
                <p className={styles.body}>
                  {t('committee.handover.done', { who: who(takerId), name: first(takerId), date: dayLabel(view.handed.on, day), how: view.handed.how })}
                </p>
                <Button variant="ghost" block onClick={notHanded}>
                  {t('committee.handover.undo')}
                </Button>
              </>
            )}
            <Button variant="secondary" block iconStart={<Share2 />} onClick={() => void share(monthMessage(c, view, outside, day), t('committee.share.title', { name: c.name, month }))}>
              {t('committee.share')}
            </Button>
          </div>
          <p className={styles.fine}>{t('committee.tick.honest')}</p>
        </section>
      )}

      <DrawSheet
        open={drawOpen}
        onClose={closeDraw}
        month={month}
        view={view}
        hat={hat.map((h) => ({ id: h.id, name: handName(h.id) }))}
        handName={handName}
        takerLine={takerId ? t('committee.draw.result', { who: who(takerId), name: first(takerId), pot }) : ''}
        onDraw={draw}
      />
      {takerId && (
        <HandoverSheet
          key={handover.round}
          open={handover.open}
          onClose={() => setHandover((s) => ({ ...s, open: false }))}
          description={t('committee.handover.description', { pot, name: label(takerId) })}
          today={day}
          onSave={handOver}
        />
      )}
      {paying && payingHand && (
        <UpiPaySheet
          open={paying.open}
          onClose={() => setPaying({ ...paying, open: false })}
          payee={{ id: c.organiserId, name: outsideName(c.organiserId, friendsById, profile, friendFallback()), upiId: rawUpi }}
          payer={{ id: payingHand.hand.friendId, name: label(payingHand.hand.friendId), color: friendsById[payingHand.hand.friendId]?.color ?? 0 }}
          amount={c.amount}
          currency={c.currency}
          note={c.name}
          onMarkPaid={() => tick(payingHand, day)}
        />
      )}
    </Screen>
  )
}
