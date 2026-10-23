import { useMemo, useState, type ReactNode } from 'react'
import { Share2 } from 'lucide-react'
import { goBack, useRoute } from '../../app/router'
import { Button, Card, Money, PageTitle, Screen, SectionHeader, SuccessBurst, SuccessCheck, TopBar, useToast } from '../../components'
import { DataError, recordSettlement, useExpenses, useFriendsById, useGroup } from '../../data'
import { BRAND, ME_ID, type Group, type Settlement } from '../../domain/types'
import type { Transfer } from '../../engine/balances'
import { today } from '../../engine/dates'
import { useT } from '../../i18n'
import { friendLabel, friendObjectLabel } from '../../kit/index-a'
import { NudgeSheet, TransferRow, UpiPaySheet, upiPaymentForTransfer } from '../../kit/index-b'
import { haptic } from '../../lib/haptics'
import { GroupGone } from './GroupGone'
import { GroupShareSheet } from './GroupShareSheet'
import { groupStanding, METHOD_LABELS, paymentSentence } from './groupView'
import { groupPath } from './paths'
import { RecordPaymentSheet, type RecordedPayment } from './RecordPaymentSheet'
import styles from './SettleUpScreen.module.css'

const ROUTES = ['/app/groups/:id/settle'] as const

/**
 * `/app/groups/:id/settle` — the fewest payments that square everyone up. Yours to pay (by UPI,
 * straight from here), yours to collect (with a friendly reminder) and the ones between others;
 * each recorded once the money has moved, in full or in part. When nothing's left: a celebration.
 */
export function SettleUpScreen() {
  const { params } = useRoute(ROUTES)
  const group = useGroup(params.id)
  if (!group) return <GroupGone />
  return <SettleUp key={group.id} group={group} />
}

interface Moment {
  title: string
  subtitle: string
  amount: ReactNode
}

function SettleUp({ group }: { group: Group }) {
  const tr = useT()
  const toast = useToast()
  const friendsById = useFriendsById()
  const expenses = useExpenses({ groupId: group.id })
  const standing = useMemo(() => groupStanding(group, expenses), [group, expenses])
  const [recording, setRecording] = useState<Transfer | null>(null)
  // The last payment stays with its sheet while it slides away.
  const [paying, setPaying] = useState<OpenFor | null>(null)
  const [reminding, setReminding] = useState<OpenFor | null>(null)
  const [sharing, setSharing] = useState(false)
  const [moment, setMoment] = useState<Moment | null>(null)
  const back = (): void => goBack(groupPath(group.id))

  const { transfers } = standing
  const youPay = transfers.filter((t) => t.fromId === ME_ID)
  const youGet = transfers.filter((t) => t.toId === ME_ID)
  const between = transfers.filter((t) => t.fromId !== ME_ID && t.toId !== ME_ID)
  const upi = group.currency === 'INR'
  const nameOf = (id: string) => friendLabel(id, friendsById[id] ?? null)

  const record = (t: Transfer, payment: RecordedPayment): void => {
    let settlement: Settlement
    try {
      settlement = recordSettlement(group.id, { fromId: t.fromId, toId: t.toId, amount: payment.amount, date: payment.date, method: payment.method })
    } catch (error) {
      if (!(error instanceof DataError)) throw error
      haptic('error')
      toast(tr('groups.settle.error'), { tone: 'error' })
      return
    }
    setRecording(null)
    setPaying((p) => p && { ...p, open: false })
    const allSquare = groupStanding({ ...group, settlements: [...group.settlements, settlement] }, expenses).settled
    const sentence = paymentSentence(t.fromId, t.toId, nameOf(t.fromId), friendObjectLabel(t.toId, friendsById[t.toId] ?? null))
    setMoment({
      title: allSquare ? tr('groups.settle.done.title') : tr('groups.settle.recorded.title'),
      subtitle: allSquare ? tr('groups.settle.done.subtitle', { name: group.name }) : `${sentence} · ${METHOD_LABELS[payment.method]}`,
      amount: <Money value={payment.amount} currency={group.currency} size="lg" trimZeros strong />,
    })
  }

  const row = (t: Transfer) => {
    const mine = t.fromId === ME_ID
    const owedToMe = t.toId === ME_ID
    return (
      <TransferRow
        key={`${t.fromId}>${t.toId}`}
        transfer={t}
        currency={group.currency}
        onPay={mine && upi ? () => setPaying({ transfer: t, open: true }) : undefined}
        onRemind={owedToMe ? () => setReminding({ transfer: t, open: true }) : undefined}
        onRecord={() => setRecording(t)}
      />
    )
  }

  const section = (id: string, title: string, description: string, list: Transfer[]) =>
    list.length > 0 && (
      <section className={styles.section} aria-labelledby={id}>
        <SectionHeader id={id} title={title} description={description} />
        <Card padding="none" className={styles.rows}>
          {list.map(row)}
        </Card>
      </section>
    )

  const count = transfers.length
  const payment = paying ? upiPaymentForTransfer(paying.transfer, group.currency, friendsById, group.name) : null

  return (
    <Screen header={<TopBar onBack={back} />} contentClassName={styles.content}>
      <PageTitle
        eyebrow={`${group.emoji} ${group.name}`}
        title={tr('groups.settle.title')}
        subtitle={count > 0 ? tr('groups.settle.subtitle', { count }) : undefined}
      />

      {count === 0 ? (
        <div className={styles.square}>
          <SuccessCheck size="lg" />
          <h2 className={styles.squareTitle}>{standing.expenseCount > 0 ? tr('groups.settle.square.title') : tr('groups.settle.empty.title')}</h2>
          <p className={styles.squareText}>
            {standing.expenseCount > 0 ? tr('groups.settle.square.body', { name: group.name }) : tr('groups.settle.empty.body', { brand: BRAND.name })}
          </p>
          <div className={styles.squareActions}>
            <Button onClick={back}>{tr('groups.settle.back.cta', { name: group.name })}</Button>
            {standing.expenseCount > 0 && (
              <Button variant="secondary" iconStart={<Share2 />} onClick={() => setSharing(true)}>
                {tr('groups.share.cta')}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          {section('settle-pay', tr('groups.settle.youPay.title'), upi ? tr('groups.settle.youPay.upi') : tr('groups.settle.youPay.other'), youPay)}
          {section('settle-get', tr('groups.settle.youGet.title'), tr('groups.settle.youGet.description'), youGet)}
          {section('settle-between', tr('groups.settle.between.title'), tr('groups.settle.between.description'), between)}
          <p className={styles.hint}>{tr('groups.settle.hint')}</p>
        </>
      )}

      <RecordPaymentSheet transfer={recording} currency={group.currency} onClose={() => setRecording(null)} onRecord={record} />
      {payment && paying && (
        <UpiPaySheet
          open={paying.open}
          onClose={() => setPaying((p) => p && { ...p, open: false })}
          {...payment}
          onMarkPaid={() => record(paying.transfer, { amount: paying.transfer.amount, method: 'upi', date: today() })}
        />
      )}
      {reminding && (
        <NudgeSheet
          open={reminding.open}
          onClose={() => setReminding((r) => r && { ...r, open: false })}
          friend={friendsById[reminding.transfer.fromId] ?? null}
          amount={reminding.transfer.amount}
          currency={group.currency}
          title={group.name}
          link={null}
        />
      )}
      <GroupShareSheet group={group} open={sharing} onClose={() => setSharing(false)} />
      {moment && <SuccessBurst title={moment.title} subtitle={moment.subtitle} amount={moment.amount} onDone={() => setMoment(null)} />}
    </Screen>
  )
}

interface OpenFor {
  transfer: Transfer
  open: boolean
}
