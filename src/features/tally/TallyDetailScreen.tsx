import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, Share2, Trash2 } from 'lucide-react'
import { goBack, navigate, useRoute } from '../../app/router'
import { Badge, Button, Card, Chip, IconButton, Money, PageTitle, Screen, Stepper, TopBar, useToast } from '../../components'
import { useFriendsById, useGroups, useMe } from '../../data'
import { ME_ID } from '../../domain/types'
import { addMonths, dateInPeriod, periodOf, today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/friendName'
import { UpiPaySheet } from '../../kit/UpiPaySheet'
import { copyText, shareResult } from '../../lib/share'
import { closeMonth, expenseGroupId, reopenMonth } from './actions'
import {
  countOn,
  dayCount,
  differsFromUsual,
  formatQty,
  isClosed,
  keysOf,
  MAX_DAY_UNITS,
  monthBill,
  monthDates,
  Q,
  rateOn,
  SHARED,
  stepOf,
  usualOn,
  type Tally,
} from './engine'
import { billLines, billText, dayName, money, monthName, qtyLabel, rateLabel, weekdayLetter } from './labels'
import { TALLY_DETAIL_PATTERN, TALLY_PATH } from './paths'
import { deleteTally, putTally, setCount, setMonth, setUsual, useTallies } from './store'
import { TallyEditSheet } from './TallyEditSheet'
import styles from './Tally.module.css'

const ROUTES = [TALLY_DETAIL_PATTERN] as const

/**
 * `/app/tally/:id` — one tally's month: a strip of days with the usual already filled in, one tap
 * to change a day, and the month's bill with each person's part, paying the vendor and adding it
 * as an expense.
 */
export function TallyDetailScreen() {
  const t = useT()
  const { params } = useRoute(ROUTES)
  const tally = useTallies().find((x) => x.id === params.id) ?? null
  if (!tally) {
    return (
      <Screen header={<TopBar onBack={() => goBack(TALLY_PATH)} />}>
        <PageTitle title={t('tally.gone.title')} subtitle={t('tally.gone.body')} />
      </Screen>
    )
  }
  return <TallyMonth key={tally.id} tally={tally} />
}

function TallyMonth({ tally }: { tally: Tally }) {
  const t = useT()
  const toast = useToast()
  const me = useMe()
  const friendsById = useFriendsById()
  const groups = useGroups()
  const [today] = useState(() => todayIso())
  const [period, setPeriod] = useState(() => periodOf(today))
  const [picked, setPicked] = useState(today)
  const [payer, setPayer] = useState<string>(tally.memberIds.includes(ME_ID) ? ME_ID : (tally.memberIds[0] ?? ME_ID))
  const [editing, setEditing] = useState<{ opened: number; open: boolean } | null>(null)
  const [paying, setPaying] = useState(false)
  const stripRef = useRef<HTMLOListElement>(null)

  const nameOf = (id: string): string => friendLabel(id, friendsById[id] ?? null)
  const bill = useMemo(() => monthBill(tally, period, today, (id) => friendsById[id]?.name ?? ''), [tally, period, today, friendsById])
  const month = monthName(period, today)
  const firstPeriod = periodOf(tally.start)
  const thisPeriod = periodOf(today)
  const dates = monthDates(period)
  const last = dateInPeriod(period, 31)
  const first = `${period}-01`
  // The day being changed: the one tapped, kept inside the month on show and the days that count.
  const lowest = tally.start > first ? tally.start : first
  const highest = today < last ? today : last
  const day = picked < lowest ? lowest : picked > highest ? highest : picked
  const closed = isClosed(tally, period)
  const keys = keysOf(tally)
  const step = stepOf(tally.unit)
  const shared = tally.memberIds.length > 1
  const paid = (tally.months[period]?.paidAt ?? null) !== null
  const hasExpense = (tally.months[period]?.expenseId ?? null) !== null
  const group = groups.find((g) => g.id === expenseGroupId(tally, tally.memberIds)) ?? null

  useEffect(() => {
    const el = stripRef.current?.querySelector('[aria-current="date"]')
    if (el instanceof HTMLElement && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [period])

  const undoTo = (before: Tally) => ({ label: t('common.action.undo'), onAction: () => putTally(before) })

  const didntCome = () => {
    for (const key of keys) setCount(tally.id, day, key, 0)
    toast(t('tally.day.none.toast', { date: dayName(day) }), { action: undoTo(tally) })
  }
  const backToUsual = () => {
    for (const key of keys) setCount(tally.id, day, key, usualOn(tally, day, key))
  }
  const makeUsual = () => {
    for (const key of keys) setUsual(tally.id, day, key, countOn(tally, day, key))
    toast(t('tally.day.makeUsual.toast', { date: dayName(day) }), { action: undoTo(tally) })
  }

  const share = async () => {
    const outcome = await shareResult(billText(tally, bill, today, nameOf))
    if (outcome === 'copied') toast(t('tally.share.copied'), { tone: 'success' })
    else if (outcome === 'failed') toast(t('tally.share.failed'), { tone: 'error' })
  }

  const close = (payerId: string | null) => {
    const done = closeMonth(tally.id, period, payerId, today)
    if (!done) return toast(t('tally.close.failed'), { tone: 'error' })
    toast(t(done.expense ? 'tally.closed.toast' : 'tally.closed.toast.plain', { month }), {
      tone: 'success',
      action: { label: t('common.action.undo'), onAction: done.undo },
    })
  }

  const reopen = () => {
    const done = reopenMonth(tally.id, period)
    if (!done) return
    toast(t(done.hadExpense ? 'tally.reopened.toast.expense' : 'tally.reopened.toast', { month }), {
      action: { label: t('common.action.undo'), onAction: done.undo },
    })
  }

  const markPaid = () => {
    setMonth(tally.id, period, { paidAt: Date.now() })
    // A tally nobody shares has nothing to split: paying the vendor is the whole of closing it.
    const alsoClosed = !shared && closeMonth(tally.id, period, null, today) !== null
    toast(t(alsoClosed ? 'tally.paid.toast.closed' : 'tally.paid.toast', { month }), { tone: 'success', action: undoTo(tally) })
  }

  const remove = () => {
    const removed = deleteTally(tally.id)
    if (!removed) return
    navigate(TALLY_PATH, { replace: true })
    toast(t('tally.deleted', { name: removed.name }), { action: { label: t('common.action.undo'), onAction: () => putTally(removed) } })
  }

  const copyNumber = async () => {
    if (tally.vendor?.phone && (await copyText(tally.vendor.phone))) toast(t('tally.pay.copied'), { tone: 'success' })
  }

  const usualAll = keys.reduce((sum, key) => sum + usualOn(tally, today, key), 0)
  const rateNow = rateLabel(tally, rateOn(tally, today))
  const lines = billLines(tally, bill)
  const canClose = bill.ended && !closed && bill.total > 0

  return (
    <Screen header={<TopBar onBack={() => goBack(TALLY_PATH)} />} contentClassName={styles.content}>
      <PageTitle
        title={tally.name}
        subtitle={tally.split === 'own' ? t('tally.detail.rate.own', { rate: rateNow }) : t('tally.detail.rate', { rate: rateNow, qty: qtyLabel(tally.unit, usualAll) })}
      />
      <p className={styles.fine}>{t('tally.detail.explain')}</p>

      <div className={styles.monthBar}>
        <IconButton label={t('tally.month.prev')} disabled={period <= firstPeriod} onClick={() => setPeriod(addMonths(period, -1))}>
          <ChevronLeft />
        </IconButton>
        <h2 className={styles.monthName}>{month}</h2>
        <IconButton label={t('tally.month.next')} disabled={period >= thisPeriod} onClick={() => setPeriod(addMonths(period, 1))}>
          <ChevronRight />
        </IconButton>
      </div>

      <ol ref={stripRef} className={styles.strip} aria-label={t('tally.days.label', { month })}>
        {dates.map((date) => {
          const counts = date >= tally.start && date <= today
          const qty = counts ? dayCount(tally, date) : 0
          const changed = counts && differsFromUsual(tally, date)
          const label = t(changed ? 'tally.day.aria.changed' : 'tally.day.aria', { date: dayName(date), qty: qtyLabel(tally.unit, qty) })
          return (
            <li key={date}>
              <button
                type="button"
                className={styles.day}
                data-changed={changed || undefined}
                aria-current={date === day ? 'date' : undefined}
                aria-label={label}
                disabled={!counts}
                onClick={() => setPicked(date)}
              >
                <span className={styles.dayWeek}>{weekdayLetter(date)}</span>
                <span className={styles.dayNum}>{Number(date.slice(8, 10))}</span>
                <span className={styles.dayQty}>{counts ? formatQty(qty) : ''}</span>
              </button>
            </li>
          )
        })}
      </ol>

      {lowest <= highest && (
        <Card className={styles.card}>
          <h3 className={styles.cardTitle}>{t(day === today ? 'tally.day.heading.today' : 'tally.day.heading', { date: dayName(day) })}</h3>
          {closed ? (
            <p className={styles.fine}>{t('tally.day.locked', { month })}</p>
          ) : (
            <>
              {keys.map((key) => (
                <div key={key} className={styles.fieldRow}>
                  <span className={styles.body}>{key === SHARED ? tally.name : nameOf(key)}</span>
                  <Stepper
                    label={key === SHARED ? t('tally.day.count', { date: dayName(day) }) : t('tally.day.count.person', { name: nameOf(key) })}
                    size="md"
                    value={countOn(tally, day, key)}
                    min={0}
                    max={MAX_DAY_UNITS * Q}
                    step={step}
                    onChange={(n) => setCount(tally.id, day, key, n)}
                    formatValue={(n) => qtyLabel(tally.unit, n)}
                  />
                </div>
              ))}
              <div className={styles.chips}>
                {dayCount(tally, day) > 0 && (
                  <Chip size="lg" onClick={didntCome}>
                    {t('tally.day.none')}
                  </Chip>
                )}
                {differsFromUsual(tally, day) && (
                  <>
                    <Chip size="lg" onClick={backToUsual}>
                      {t('tally.day.usual')}
                    </Chip>
                    <Chip size="lg" onClick={makeUsual}>
                      {t('tally.day.makeUsual', { date: dayName(day) })}
                    </Chip>
                  </>
                )}
              </div>
            </>
          )}
        </Card>
      )}

      <Card className={styles.card} role="region" aria-label={t('tally.bill.heading', { month })}>
        <div className={styles.cardHead}>
          <h3 className={styles.cardTitle}>{t(bill.ended ? 'tally.bill.heading' : 'tally.bill.heading.sofar', { month })}</h3>
          {closed && <Badge tone="positive">{t('tally.bill.closed')}</Badge>}
        </div>
        <div role="status" className={styles.block}>
          {bill.qty === 0 ? (
            <p className={styles.body}>{t('tally.bill.empty', { month })}</p>
          ) : lines.length === 1 ? (
            <p className={styles.sum}>{`${month}: ${lines[0] ?? ''}`}</p>
          ) : (
            <>
              {lines.map((line) => (
                <p key={line} className={styles.body}>
                  {line}
                </p>
              ))}
              <p className={styles.sum}>{t('tally.bill.total', { amount: money(bill.total, tally.currency) })}</p>
            </>
          )}
          {bill.from > first && <p className={styles.fine}>{t('tally.bill.from', { date: dayName(bill.from) })}</p>}
        </div>

        {shared && bill.total > 0 && (
          <div className={styles.block}>
            <h4 className={styles.heading}>{t('tally.bill.parts')}</h4>
            <ul className={styles.parts}>
              {bill.parts.map((part) => (
                <li key={part.id} className={styles.part}>
                  <span className={styles.partName}>
                    {nameOf(part.id)}
                    {part.qty !== null && <span className={styles.fine}>{qtyLabel(tally.unit, part.qty)}</span>}
                  </span>
                  <Money value={part.amount} currency={tally.currency} trimZeros />
                </li>
              ))}
            </ul>
          </div>
        )}

        {closed && <p className={styles.fine}>{t(hasExpense ? 'tally.bill.closed.expense' : 'tally.bill.closed.plain', { month })}</p>}
        {paid && <p className={styles.fine}>{t('tally.bill.paid')}</p>}
        {!bill.ended && bill.qty > 0 && <p className={styles.fine}>{t('tally.bill.wait', { month, date: dayName(last) })}</p>}

        {canClose && shared && (
          <div className={styles.block}>
            <h4 id="tally-payer" className={styles.heading}>
              {t('tally.payer.label')}
            </h4>
            <div className={styles.chips} role="radiogroup" aria-labelledby="tally-payer">
              {bill.parts.map((part) => (
                <Chip key={part.id} size="lg" role="radio" selected={payer === part.id} onClick={() => setPayer(part.id)}>
                  {nameOf(part.id)}
                </Chip>
              ))}
            </div>
          </div>
        )}

        <div className={styles.actions}>
          {canClose && (
            <Button size="md" block onClick={() => close(shared ? payer : ME_ID)}>
              {group ? t('tally.addExpense', { group: group.name }) : t('tally.addExpense.plain')}
            </Button>
          )}
          {bill.ended && bill.total > 0 && !paid && (
            <>
              {tally.vendor?.upiId ? (
                <Button size="md" variant="secondary" block onClick={() => setPaying(true)}>
                  {t('tally.pay', { vendor: tally.vendor.name })}
                </Button>
              ) : tally.vendor?.phone ? (
                <>
                  <p className={styles.fine}>{t('tally.pay.number', { amount: money(bill.total, tally.currency), phone: tally.vendor.phone })}</p>
                  <Button size="md" variant="secondary" block onClick={() => void copyNumber()}>
                    {t('tally.pay.copy')}
                  </Button>
                </>
              ) : (
                <Button size="md" variant="secondary" block onClick={() => setEditing({ opened: Date.now(), open: true })}>
                  {t('tally.pay.novendor')}
                </Button>
              )}
              <Button size="md" variant="ghost" block onClick={markPaid}>
                {t('tally.markPaid')}
              </Button>
            </>
          )}
          {canClose && shared && (
            <Button size="md" variant="ghost" block onClick={() => close(null)}>
              {t('tally.close.plain')}
            </Button>
          )}
          {closed && (
            <Button size="md" variant="secondary" block onClick={reopen}>
              {t('tally.reopen', { month })}
            </Button>
          )}
          {bill.qty > 0 && (
            <Button size="md" variant="ghost" block iconStart={<Share2 />} onClick={() => void share()}>
              {t('tally.share')}
            </Button>
          )}
        </div>
      </Card>

      <div className={styles.actions}>
        <Button size="md" variant="secondary" iconStart={<Pencil />} onClick={() => setEditing({ opened: Date.now(), open: true })}>
          {t('tally.edit')}
        </Button>
        <Button size="md" variant="ghost" iconStart={<Trash2 />} onClick={remove}>
          {t('tally.delete')}
        </Button>
      </div>

      {editing && <TallyEditSheet key={editing.opened} tally={tally} today={today} open={editing.open} onClose={() => setEditing({ ...editing, open: false })} />}
      {tally.vendor?.upiId && (
        <UpiPaySheet
          open={paying}
          onClose={() => setPaying(false)}
          payee={{ name: tally.vendor.name, upiId: tally.vendor.upiId }}
          payer={{ id: ME_ID, name: me.name, color: me.color }}
          amount={bill.total}
          currency={tally.currency}
          note={t('tally.pay.note', { name: tally.name, month })}
          onMarkPaid={markPaid}
        />
      )}
    </Screen>
  )
}
