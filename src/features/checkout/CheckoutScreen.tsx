import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Image as ImageIcon, Plus, QrCode as QrIcon, Share2, Wallet } from 'lucide-react'
import { goBack, navigate, useRoute } from '../../app/router'
import { Banner, Button, Card, EmptyState, Money, PageTitle, Progress, Screen, SuccessCheck, TopBar, useToast } from '../../components'
import { DataError, deleteSettlement, recordSettlement, useExpenses, useFriendsById, useGroup, useProfile } from '../../data'
import { ME_ID, type Group, type Settlement } from '../../domain/types'
import { groupBalances, type Transfer } from '../../engine/balances'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { FriendAvatar } from '../../kit/FriendAvatar'
import { friendLabel, friendObjectLabel } from '../../kit/friendName'
import { UpiPaySheet } from '../../kit/UpiPaySheet'
import { upiPaymentForTransfer } from '../../kit/upiPayment'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { shareResult } from '../../lib/share'
import { GroupGone } from '../groups/GroupGone'
import { GroupShareSheet } from '../groups/GroupShareSheet'
import { paymentSentence } from '../groups/groupView'
import { groupPath, newSplitPath } from '../groups/paths'
import { orderPayments } from '../settleday/engine'
import { checkoutProgress, reconcile, tripFacts, type CheckoutRow } from './engine'
import { CHECKOUT_ROUTE } from './paths'
import { QrSheet } from './QrSheet'
import { saveCheckout, untickCheckout, useCheckoutSession } from './store'
import { allSquareText, tripDates } from './text'
import { receiverUpi } from './upi'
import styles from './Checkout.module.css'

const ROUTES = [CHECKOUT_ROUTE] as const

/**
 * `/app/groups/:id/checkout` — the last day of a trip. One line per payment that squares
 * everyone: Pay when it is yours, a QR for the payer to scan off this phone when the receiver
 * has a UPI ID, and a tick that records the payment. The list stays put while it is ticked; when
 * the last one is done, an "All square" card to share.
 */
export function CheckoutScreen() {
  const { params } = useRoute(ROUTES)
  const group = useGroup(params.id)
  if (!group) return <GroupGone />
  return <Checkout key={group.id} group={group} />
}

interface Sheet {
  kind: 'pay' | 'qr'
  payment: Transfer
  open: boolean
}

function Checkout({ group }: { group: Group }) {
  const t = useT()
  const toast = useToast()
  const friendsById = useFriendsById()
  const profile = useProfile()
  const expenses = useExpenses({ groupId: group.id })
  const session = useCheckoutSession(group.id)
  // The last payment stays with its sheet while it slides away.
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [picture, setPicture] = useState<boolean | null>(null)
  const busy = useRef(false)

  const view = useMemo(() => {
    const nameOf = (id: string): string => friendLabel(id, friendsById[id] ?? null)
    return reconcile(session?.rows ?? [], groupBalances(group, expenses), new Set(group.settlements.map((s) => s.id)), (list) => orderPayments(list, ME_ID, nameOf))
  }, [session, group, expenses, friendsById])
  const startedAt = session && !view.fresh ? session.startedAt : null
  const revised = view.revised || (!view.fresh && (session?.revised ?? false))

  // Keep what is stored in step with what is shown (a first visit, or the group changed underneath).
  useEffect(() => {
    if (view.changed) saveCheckout(group.id, { rows: view.rows, startedAt, revised })
  }, [view, group.id, startedAt, revised])

  const { rows } = view
  const progress = checkoutProgress(rows)
  const facts = useMemo(() => tripFacts(group, expenses), [group, expenses])
  const upi = group.currency === 'INR'
  const nameOf = (id: string): string => friendLabel(id, friendsById[id] ?? null)
  const money = (paise: number): string => formatMoney(paise, group.currency, { trimZeros: true })
  const sentence = (p: Pick<Transfer, 'fromId' | 'toId'>, tense: 'past' | 'present'): string =>
    paymentSentence(p.fromId, p.toId, nameOf(p.fromId), friendObjectLabel(p.toId, friendsById[p.toId] ?? null), tense)
  const save = (next: CheckoutRow[], flag: boolean = revised): void => saveCheckout(group.id, { rows: next, startedAt, revised: flag })

  /** Records the payment in the group and ticks its line. Undo removes the payment and the tick. */
  const tick = (payment: Transfer, method: Settlement['method']): void => {
    const index = rows.findIndex((r) => r.settlementId === null && r.fromId === payment.fromId && r.toId === payment.toId && r.amount === payment.amount)
    if (index < 0) return
    let settlement: Settlement
    try {
      settlement = recordSettlement(group.id, { fromId: payment.fromId, toId: payment.toId, amount: payment.amount, date: todayIso(), method })
    } catch (error) {
      if (!(error instanceof DataError)) throw error
      haptic('error')
      toast(t('checkout.error'), { tone: 'error' })
      return
    }
    save(rows.map((r, i) => (i === index ? { ...r, settlementId: settlement.id } : r)))
    haptic('success')
    const last = rows.every((r, i) => i === index || r.settlementId !== null)
    toast(last ? t('checkout.toast.last') : t('checkout.toast.paid', { sentence: sentence(payment, 'past'), amount: money(payment.amount) }), {
      tone: 'success',
      action: { label: t('common.action.undo'), onAction: () => untick(settlement.id) },
    })
  }

  const untick = (settlementId: string): void => {
    deleteSettlement(group.id, settlementId)
    untickCheckout(group.id, settlementId)
  }

  const share = async (): Promise<void> => {
    if (busy.current) return
    busy.current = true
    try {
      const outcome = await shareResult(allSquareText(group, facts, progress.paid), { title: t('checkout.share.title', { name: group.name }) })
      if (outcome === 'shared' || outcome === 'copied') haptic('success')
      if (outcome === 'copied') toast(t('checkout.share.copied'), { tone: 'success' })
      if (outcome === 'failed') {
        haptic('error')
        toast(t('checkout.share.failed'), { tone: 'error' })
      }
    } finally {
      busy.current = false
    }
  }

  const row = (r: CheckoutRow, index: number) => {
    const paid = r.settlementId !== null
    const mine = r.fromId === ME_ID
    const amount = money(r.amount)
    const vpa = receiverUpi(r.toId, friendsById, profile)
    const payment: Transfer = { fromId: r.fromId, toId: r.toId, amount: r.amount }
    return (
      <li key={`${index}:${r.fromId}>${r.toId}`} className={styles.row} data-paid={paid || undefined}>
        <div className={styles.rowHead}>
          <FriendAvatar friendId={mine ? r.toId : r.fromId} size="sm" />
          <span className={styles.rowText}>{sentence(r, paid ? 'past' : 'present')}</span>
          <Money value={r.amount} currency={group.currency} trimZeros strong muted={paid} />
        </div>
        {!paid && !mine && upi && !vpa && (
          <p className={styles.fine}>{r.toId === ME_ID ? t('checkout.row.noUpi.mine') : t('checkout.row.noUpi', { name: nameOf(r.toId) })}</p>
        )}
        <div className={styles.rowActions}>
          {!paid && mine && upi && (
            <Button size="md" iconStart={<Wallet />} onClick={() => setSheet({ kind: 'pay', payment, open: true })} aria-label={t('checkout.row.pay.aria', { name: nameOf(r.toId), amount })}>
              {t('checkout.row.pay')}
            </Button>
          )}
          {!paid && !mine && upi && vpa && (
            <Button
              size="md"
              variant="tonal"
              iconStart={<QrIcon />}
              onClick={() => setSheet({ kind: 'qr', payment, open: true })}
              aria-label={t('checkout.row.qr.aria', { from: nameOf(r.fromId), to: friendObjectLabel(r.toId, friendsById[r.toId] ?? null), amount })}
            >
              {t('checkout.row.qr')}
            </Button>
          )}
          {!paid && !mine && upi && !vpa && (
            <Button
              size="md"
              variant="tonal"
              iconStart={<Plus />}
              onClick={() => setSheet({ kind: 'pay', payment, open: true })}
              aria-label={t('checkout.row.addUpi.aria', { name: friendObjectLabel(r.toId, friendsById[r.toId] ?? null) })}
            >
              {t('checkout.row.addUpi')}
            </Button>
          )}
          {paid ? (
            <Button
              size="md"
              variant="tonal"
              iconStart={<Check />}
              aria-pressed
              className={styles.ticked}
              onClick={() => {
                if (r.settlementId === null) return
                untick(r.settlementId)
                toast(t('checkout.toast.unticked', { sentence: sentence(r, 'present'), amount }))
              }}
              aria-label={t('checkout.row.ticked.aria', { sentence: sentence(r, 'past'), amount })}
            >
              {t('checkout.row.ticked')}
            </Button>
          ) : (
            <Button
              size="md"
              variant="secondary"
              iconStart={<Check />}
              aria-pressed={false}
              onClick={() => tick(payment, 'other')}
              aria-label={t('checkout.row.tick.aria', { sentence: sentence(r, 'present'), amount })}
            >
              {t('checkout.row.tick')}
            </Button>
          )}
        </div>
      </li>
    )
  }

  const header = <TopBar onBack={() => goBack(groupPath(group.id))} />
  const eyebrow = `${group.emoji} ${group.name}`

  if (rows.length === 0 && facts.expenseCount === 0) {
    return (
      <Screen header={header} contentClassName={styles.content}>
        <PageTitle eyebrow={eyebrow} title={t('checkout.title')} />
        <EmptyState
          icon={<Check />}
          title={t('checkout.empty.title')}
          text={t('checkout.empty.body')}
          action={
            group.archived ? undefined : (
              <Button iconStart={<Plus />} onClick={() => navigate(newSplitPath({ group: group.id }))}>
                {t('checkout.empty.cta')}
              </Button>
            )
          }
        />
      </Screen>
    )
  }

  const done = progress.open === 0
  const subtitle = done
    ? progress.paid > 0
      ? t('checkout.sub.done')
      : t('checkout.sub.square')
    : progress.paid > 0
      ? t('checkout.sub.some', { paid: progress.paid, total: progress.total, count: progress.open })
      : t('checkout.sub.open', { count: progress.open })
  const dates = tripDates(facts.from, facts.to)
  const upiPayment = sheet?.kind === 'pay' ? upiPaymentForTransfer(sheet.payment, group.currency, friendsById, group.name) : null

  return (
    <Screen header={header} contentClassName={styles.content}>
      <PageTitle eyebrow={eyebrow} title={t('checkout.title')} subtitle={subtitle} />

      {revised && !done && (
        <Banner tone="info" title={t('checkout.revised.title')} onDismiss={() => save(rows, false)}>
          {t('checkout.revised.body')}
        </Banner>
      )}

      {done && (
        <Card padding="lg" className={styles.square} role="region" aria-label={t('checkout.square.aria', { name: group.name })}>
          <SuccessCheck size="md" />
          <p className={styles.squareGroup}>{eyebrow}</p>
          <h2 className={styles.squareTitle}>{t('checkout.square.title')}</h2>
          <p className={styles.fine}>{dates ?? t('checkout.square.body', { name: group.name })}</p>
          <dl className={styles.stats}>
            {facts.expenseCount > 0 && (
              <div className={styles.stat}>
                <dt>{t('checkout.square.spent')}</dt>
                <dd>{money(facts.spent)}</dd>
              </div>
            )}
            <div className={styles.stat}>
              <dt>{t('checkout.square.people')}</dt>
              <dd>{facts.people}</dd>
            </div>
            {progress.paid > 0 && (
              <div className={styles.stat}>
                <dt>{t('checkout.square.payments')}</dt>
                <dd>{progress.paid}</dd>
              </div>
            )}
          </dl>
          <div className={styles.squareActions}>
            <Button block iconStart={<Share2 />} onClick={() => void share()}>
              {t('checkout.share.cta')}
            </Button>
            <Button block variant="secondary" iconStart={<ImageIcon />} onClick={() => setPicture(true)}>
              {t('checkout.share.more')}
            </Button>
          </div>
        </Card>
      )}

      {rows.length > 0 && (
        <section className={styles.block} aria-label={t('checkout.list.aria')}>
          {!done && (
            <>
              <p className={styles.fine}>{upi ? t('checkout.intro') : t('checkout.notRupees')}</p>
              <Progress current={progress.paid} total={progress.total} label={t('checkout.progress', { paid: progress.paid, total: progress.total })} />
            </>
          )}
          {done && <h2 className={styles.heading}>{t('checkout.paid.title')}</h2>}
          <Card padding="none">
            <ul className={styles.rows}>{rows.map(row)}</ul>
          </Card>
        </section>
      )}

      {sheet?.kind === 'pay' && upiPayment && (
        <UpiPaySheet
          open={sheet.open}
          onClose={() => setSheet((s) => s && { ...s, open: false })}
          {...upiPayment}
          onMarkPaid={() => tick(sheet.payment, 'upi')}
        />
      )}
      {sheet?.kind === 'qr' && (
        <QrSheet
          open={sheet.open}
          onClose={() => setSheet((s) => s && { ...s, open: false })}
          payment={sheet.payment}
          group={group}
          onPaid={() => tick(sheet.payment, 'upi')}
        />
      )}
      {picture !== null && <GroupShareSheet group={group} open={picture} onClose={() => setPicture(false)} />}
    </Screen>
  )
}
