import { useMemo, useState } from 'react'
import { BellRing, Check, Share2, Trash2, Wallet } from 'lucide-react'
import { goBack, navigate, useRoute } from '../../app/router'
import { Banner, Button, Card, PageTitle, Screen, TopBar, useToast } from '../../components'
import { useExpenses, useFriendsById, useGroups, useMe, useProfile } from '../../data'
import { ME_ID, type Settlement } from '../../domain/types'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { FriendAvatar, friendLabel } from '../../kit/index-a'
import { UpiPaySheet } from '../../kit/UpiPaySheet'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { shareResult } from '../../lib/share'
import { isValidUpiId, normalizeUpiId } from '../../lib/upi'
import { firstName } from '../../share/text'
import { countOutside, deletePlan, finishPlan, fitPlan, payNextPart, payOffPlan, planView, type PlanChange } from './actions'
import type { PartView } from './engine'
import { KIST_PATH, KIST_PLAN_PATTERN } from './paths'
import { usePlan, usePlans } from './store'
import { dayLabel, planMessage, remindMessage } from './text'
import styles from './Kist.module.css'

const ROUTES = [KIST_PLAN_PATTERN] as const

/**
 * `/app/kist/:id` — one plan: how much is paid, the part to pay next (Pay opens the UPI sheet
 * when you are the one paying; "Got it" when the money comes to you; either way one real payment
 * is recorded and the part is ticked, with Undo), paying it all off, every part with its date,
 * and the plan or a reminder as a message. When what is owed no longer matches the plan, it says
 * so in plain numbers and offers the one fix; a payment made elsewhere can be counted as a part
 * instead of being paid twice.
 */
export function KistPlanScreen() {
  const t = useT()
  const toast = useToast()
  const { params } = useRoute(ROUTES)
  const plan = usePlan(params.id)
  const plans = usePlans()
  const expenses = useExpenses()
  const groups = useGroups()
  const friendsById = useFriendsById()
  const profile = useProfile()
  const me = useMe()
  const [day] = useState(() => todayIso())
  const [paying, setPaying] = useState<{ all: boolean; amount: number; open: boolean } | null>(null)
  const view = useMemo(() => (plan ? planView(plan, plans, { expenses, groups }, day) : null), [plan, plans, expenses, groups, day])
  const header = <TopBar onBack={() => goBack(KIST_PATH)} />

  if (!plan || !view) {
    return (
      <Screen header={header} contentClassName={styles.content}>
        <PageTitle title={t('kist.plan.gone.title')} subtitle={t('kist.plan.gone.body')} />
        <Button variant="secondary" onClick={() => navigate(KIST_PATH, { replace: true })}>
          {t('kist.plan.gone.cta')}
        </Button>
      </Screen>
    )
  }

  const paysOut = plan.direction === 'pay'
  const friend = friendsById[plan.friendId] ?? null
  const name = firstName(friendLabel(plan.friendId, friend))
  const money = (minor: number): string => formatMoney(minor, plan.currency, { trimZeros: true })
  const myUpi = profile.upiId && isValidUpiId(profile.upiId) ? normalizeUpiId(profile.upiId) : null
  const next: PartView | null = view.parts[view.next] ?? null
  const partNo = view.next + 1
  const percent = view.total > 0 ? Math.round((view.paid / view.total) * 100) : 0

  const done = (change: PlanChange | null, message: (c: PlanChange) => string): void => {
    if (!change) {
      haptic('error')
      toast(t('kist.toast.failed'), { tone: 'error' })
      return
    }
    haptic('success')
    toast(message(change), { tone: 'success', action: { label: t('common.action.undo'), onAction: change.undo } })
  }

  const pay = (all: boolean, method: Settlement['method']): void => {
    if (all) {
      done(payOffPlan(plan.id, method), (c) => t(paysOut ? 'kist.toast.paidOff' : 'kist.toast.gotAll', { amount: money(c.amount), name }))
    } else {
      done(payNextPart(plan.id, method), (c) => t(paysOut ? 'kist.toast.paid' : 'kist.toast.got', { part: partNo, amount: money(c.amount), name }))
    }
  }

  const count = (): void => done(countOutside(plan.id, view.countable), () => t('kist.toast.counted', { count: view.countable }))
  const fit = (): void => done(fitPlan(plan.id), () => t('kist.toast.fitted', { amount: money(view.owed) }))
  const finish = (): void => done(finishPlan(plan.id), () => t('kist.toast.finished'))

  const remove = (): void => {
    const undo = deletePlan(plan.id)
    if (!undo) return
    navigate(KIST_PATH, { replace: true })
    toast(t('kist.toast.deleted'), { action: { label: t('common.action.undo'), onAction: undo } })
  }

  const share = async (text: string): Promise<void> => {
    if (!text) return
    const outcome = await shareResult(text, { title: t('kist.share.title') })
    if (outcome === 'copied') toast(t('kist.share.copied'), { tone: 'success' })
    else if (outcome === 'failed') toast(t('kist.share.failed'), { tone: 'error' })
  }

  const partLine = (p: PartView): string => {
    switch (p.state) {
      case 'paid':
        return t('kist.part.paid', { date: dayLabel(p.paidOn ?? p.due, day) })
      case 'counted':
        return t('kist.part.counted', { date: dayLabel(p.paidOn ?? p.due, day) })
      case 'late':
        return t('kist.part.late', { date: dayLabel(p.due, day), days: p.daysLate })
      case 'today':
        return t('kist.part.today')
      case 'dropped':
        return t('kist.part.dropped')
      default:
        return t('kist.part.due', { date: dayLabel(p.due, day) })
    }
  }

  const drift = ((): { tone: 'info' | 'warning'; text: string } | null => {
    const vars = { name, owed: money(view.owed), left: money(view.left) }
    if (view.drift === 'more') return { tone: 'info', text: t(paysOut ? 'kist.drift.more.pay' : 'kist.drift.more.receive', vars) }
    if (view.drift === 'less') return { tone: 'warning', text: t(paysOut ? 'kist.drift.less.pay' : 'kist.drift.less.receive', vars) }
    if (view.drift === 'clear') return { tone: 'warning', text: t(paysOut ? 'kist.drift.clear.pay' : 'kist.drift.clear.receive', vars) }
    return null
  })()

  return (
    <Screen header={header} contentClassName={styles.content}>
      <PageTitle
        leading={<FriendAvatar friendId={plan.friendId} size="lg" />}
        title={t(paysOut ? 'kist.plan.pay.title' : 'kist.plan.receive.title', { name })}
        subtitle={t('kist.plan.subtitle', { amount: money(view.total), count: view.count, every: plan.every })}
      />

      <Card className={styles.hero}>
        <p className={styles.big}>{t('kist.plan.progress', { paid: money(view.paid), total: money(view.total) })}</p>
        <div className={styles.meter} role="progressbar" aria-label={t('kist.plan.progress.aria')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <span style={{ width: `${percent}%` }} />
        </div>
        <p className={styles.fine}>{t('kist.plan.progress.fine', { done: view.paidCount, count: view.count, left: money(view.left) })}</p>
      </Card>

      {view.state === 'done' && (
        <Banner tone="success" title={t('kist.done.title', { count: view.count })}>
          {t('kist.done.body', { amount: money(view.paid) })}
        </Banner>
      )}
      {view.state === 'ended' && (
        <Banner tone="success" title={t('kist.ended.title')}>
          {t('kist.ended.body', { amount: money(view.paid) })}
        </Banner>
      )}

      {drift && (
        <Banner
          tone={drift.tone}
          actions={
            <div className={styles.row}>
              {view.countable > 0 && (
                <Button size="md" onClick={count}>
                  {view.countable === 1
                    ? t('kist.drift.count.cta', { part: partNo })
                    : t('kist.drift.count.cta.several', { from: partNo, to: partNo + view.countable - 1 })}
                </Button>
              )}
              {view.drift === 'clear' ? (
                <Button size="md" variant={view.countable > 0 ? 'secondary' : 'primary'} onClick={finish}>
                  {t('kist.drift.finish.cta')}
                </Button>
              ) : view.drift === 'more' ? (
                <Button size="md" variant="secondary" onClick={fit}>
                  {t('kist.drift.more.cta', { amount: money(view.gap) })}
                </Button>
              ) : (
                <Button size="md" variant={view.countable > 0 ? 'secondary' : 'primary'} onClick={fit}>
                  {t('kist.drift.fit.cta', { amount: money(view.owed) })}
                </Button>
              )}
            </div>
          }
        >
          {drift.text}
          {view.countable > 0 ? ` ${t('kist.drift.count.body', { amount: money(view.countAmount) })}` : ''}
        </Banner>
      )}

      {next && view.payNow > 0 && (
        <Card>
          <section aria-label={t('kist.next.aria')} className={styles.next}>
            <div className={styles.nextHead}>
              <div className={styles.nextText}>
                <h2 className={styles.nextTitle}>{t('kist.next.title', { part: partNo, count: view.count })}</h2>
                {next.state === 'late' ? (
                  <p className={styles.late}>{t('kist.next.late', { date: dayLabel(next.due, day), days: next.daysLate })}</p>
                ) : (
                  <p className={styles.fine}>{next.state === 'today' ? t('kist.next.today') : t('kist.next.due', { date: dayLabel(next.due, day) })}</p>
                )}
              </div>
              <span className={styles.big}>{money(next.amount)}</span>
            </div>
            {view.payNow < next.amount && <p className={styles.fine}>{t('kist.next.less', { amount: money(view.payNow) })}</p>}
            <div className={styles.actions}>
              {paysOut ? (
                <>
                  <Button block iconStart={<Wallet />} onClick={() => setPaying({ all: false, amount: view.payNow, open: true })}>
                    {t('kist.next.pay', { amount: money(view.payNow) })}
                  </Button>
                  <Button block variant="secondary" onClick={() => pay(false, 'other')} aria-label={t('kist.next.other.aria', { part: partNo, amount: money(view.payNow) })}>
                    {t('kist.next.other')}
                  </Button>
                </>
              ) : (
                <>
                  <Button block iconStart={<Check />} onClick={() => pay(false, 'other')}>
                    {t('kist.next.got', { amount: money(view.payNow) })}
                  </Button>
                  <Button block variant="secondary" iconStart={<BellRing />} onClick={() => void share(remindMessage(plan, view, day, myUpi))}>
                    {t('kist.next.remind')}
                  </Button>
                </>
              )}
              {view.payOff > view.payNow && (
                <Button block variant="ghost" size="md" onClick={() => (paysOut ? setPaying({ all: true, amount: view.payOff, open: true }) : pay(true, 'other'))}>
                  {t(paysOut ? 'kist.off.pay' : 'kist.off.receive', { amount: money(view.payOff) })}
                </Button>
              )}
            </div>
            <p className={styles.fine}>{t(paysOut ? 'kist.next.fine.pay' : 'kist.next.fine.receive')}</p>
          </section>
        </Card>
      )}

      <section className={styles.block} aria-labelledby="kist-parts-title">
        <h2 id="kist-parts-title" className={styles.heading}>
          {t('kist.schedule.title')}
        </h2>
        <Card padding="none">
          <ol className={styles.parts} aria-labelledby="kist-parts-title">
            {view.parts.map((p) => {
              const ticked = p.state === 'paid' || p.state === 'counted'
              return (
                <li key={p.index} className={styles.part} data-state={p.state}>
                  <span className={styles.mark} aria-hidden="true">
                    {ticked ? <Check strokeWidth={2.5} /> : p.index + 1}
                  </span>
                  <span className={styles.partText}>
                    <span className={styles.partName}>{t('kist.part.name', { part: p.index + 1 })}</span>
                    <span className={styles.partLine}>{partLine(p)}</span>
                  </span>
                  <span className={styles.partAmount}>{money(p.amount)}</span>
                </li>
              )
            })}
          </ol>
        </Card>
      </section>

      <Button block variant="secondary" iconStart={<Share2 />} onClick={() => void share(planMessage(plan, day, myUpi))}>
        {t('kist.share.cta')}
      </Button>

      <div className={styles.end}>
        <Button variant="ghost" size="md" iconStart={<Trash2 />} onClick={remove}>
          {t('kist.delete.cta')}
        </Button>
        <p className={styles.fine}>{t('kist.delete.fine')}</p>
      </div>

      {paying && (
        <UpiPaySheet
          open={paying.open}
          onClose={() => setPaying((p) => p && { ...p, open: false })}
          payee={{ id: plan.friendId, name, upiId: friend?.upiId ?? null }}
          payer={{ id: ME_ID, name: t('common.people.you'), color: me.color }}
          amount={paying.amount}
          currency={plan.currency}
          // The UPI note stays in English: banks and UPI apps show it as is.
          note={paying.all ? 'Paying off the rest' : `Part ${partNo} of ${view.count}`}
          onMarkPaid={() => {
            setPaying((p) => p && { ...p, open: false })
            pay(paying.all, 'upi')
          }}
        />
      )}
    </Screen>
  )
}
