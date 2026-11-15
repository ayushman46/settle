import { useState } from 'react'
import { Check, Pencil, QrCode, UsersRound, Wallet } from 'lucide-react'
import { goBack, useRoute } from '../../app/router'
import { Button, Card, EmptyState, Money, PageTitle, Screen, SectionHeader, SuccessCheck, TopBar, useToast } from '../../components'
import { DataError, useExpenses, useFriendsById, useGroup } from '../../data'
import { ME_ID, type Group, type Settlement } from '../../domain/types'
import { today } from '../../engine/dates'
import { useT } from '../../i18n'
import { relativeDateLabel } from '../../kit/dateLabel'
import { friendLabel, friendObjectLabel } from '../../kit/friendName'
import { UpiPaySheet } from '../../kit/UpiPaySheet'
import { upiPaymentForTransfer } from '../../kit/upiPayment'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { GroupGone } from '../groups/GroupGone'
import { groupPath } from '../groups/paths'
import type { UnitBalance, UnitTransfer } from './engine'
import { HOUSEHOLDS_ROUTE } from './paths'
import { recordUnitPayment, undoUnitPayment, useUnitPayments, type UnitPayment } from './store'
import { membersLine, paidSentence, paySentence, unitLabel } from './unitText'
import { UnitsSheet } from './UnitsSheet'
import { useHouseholds } from './useUnits'
import styles from './Units.module.css'

const ROUTES = [HOUSEHOLDS_ROUTE] as const

/** How many other people a payment's "Also settles …" line names before "and 2 more". */
const NAMED = 3

/**
 * `/app/groups/:id/households`: the group settled household by household. "The Sharmas pay the
 * Khans ₹3,400": one payment between the two people who pay for them, by UPI from here or marked
 * as paid; recording it also evens out everyone inside both households, so every member shows as
 * settled on every other page. Undo takes all of it back.
 */
export function HouseholdsScreen() {
  const { params } = useRoute(ROUTES)
  const group = useGroup(params.id)
  if (!group) return <GroupGone />
  return <Households key={group.id} group={group} />
}

function Households({ group }: { group: Group }) {
  const t = useT()
  const toast = useToast()
  const expenses = useExpenses({ groupId: group.id })
  const friendsById = useFriendsById()
  const { rows, transfers, people, any } = useHouseholds(group)
  const recorded = useUnitPayments(group.id)
  const [editing, setEditing] = useState(false)
  // The last payment stays with its sheet while it slides away.
  const [paying, setPaying] = useState<{ transfer: UnitTransfer; open: boolean } | null>(null)
  const back = (): void => goBack(groupPath(group.id))
  const money = (paise: number): string => formatMoney(paise, group.currency, { trimZeros: true })
  const nameOf = (id: string): string => friendLabel(id, people.friendsById[id] ?? null)
  const objectOf = (id: string): string => friendObjectLabel(id, people.friendsById[id] ?? null)
  const upi = group.currency === 'INR'

  const record = (transfer: UnitTransfer, method: Settlement['method']): void => {
    const fromName = unitLabel(transfer.from, people)
    const toName = unitLabel(transfer.to, people)
    let payment: UnitPayment
    try {
      payment = recordUnitPayment({ group, expenses, transfer, fromName, toName, method, date: today() })
    } catch (error) {
      if (!(error instanceof DataError)) throw error
      haptic('error')
      toast(t('units.record.failed'), { tone: 'error' })
      return
    }
    haptic('success')
    toast(t('units.recorded', { sentence: paidSentence(fromName, toName), amount: money(payment.amount) }), {
      tone: 'success',
      action: { label: t('common.action.undo'), onAction: () => void undoUnitPayment(group.id, payment.id) },
    })
  }

  const takeBack = (payment: UnitPayment): void => {
    const restore = undoUnitPayment(group.id, payment.id)
    haptic('tap')
    toast(
      t('units.done.undone', { sentence: paidSentence(payment.fromName, payment.toName), amount: money(payment.amount) }),
      restore ? { action: { label: t('units.done.restore'), onAction: restore } } : undefined,
    )
  }

  const header = <TopBar onBack={back} />
  const title = <PageTitle eyebrow={`${group.emoji} ${group.name}`} title={t('units.screen.title')} subtitle={t('units.screen.subtitle')} />
  const sheet = <UnitsSheet group={group} open={editing} onClose={() => setEditing(false)} link={false} />

  if (group.memberIds.length < 2) {
    return (
      <Screen header={header} contentClassName={styles.content}>
        {title}
        <EmptyState
          icon={<UsersRound />}
          title={t('units.screen.alone.title')}
          text={t('units.screen.alone.body', { group: group.name })}
          action={<Button onClick={back}>{t('units.screen.alone.cta', { group: group.name })}</Button>}
        />
      </Screen>
    )
  }

  if (!any) {
    return (
      <Screen header={header} contentClassName={styles.content}>
        {title}
        <EmptyState
          icon={<UsersRound />}
          title={t('units.screen.empty.title')}
          text={t('units.screen.empty.body')}
          action={<Button onClick={() => setEditing(true)}>{t('units.screen.empty.cta')}</Button>}
        />
        {sheet}
      </Screen>
    )
  }

  /** Who hands the money to whom, when either side is more than one person. */
  const payersLine = (transfer: UnitTransfer): string | null => {
    const { from, to } = transfer
    if (!from.household && !to.household) return null
    if (from.payerId === ME_ID) return t('units.row.payers.you', { to: objectOf(to.payerId) })
    if (to.payerId === ME_ID) return t('units.row.payers.toYou', { from: nameOf(from.payerId) })
    return t('units.row.payers', { from: nameOf(from.payerId), to: objectOf(to.payerId) })
  }

  /** Everyone else in the two households: recording this payment brings each of them to zero. */
  const alsoLine = (transfer: UnitTransfer): string | null => {
    const others = [...transfer.from.memberIds, ...transfer.to.memberIds].filter((id) => id !== transfer.from.payerId && id !== transfer.to.payerId)
    if (others.length === 0) return null
    const names = others.slice(0, NAMED).map(objectOf).join(', ')
    return others.length > NAMED ? t('units.row.also.more', { names, count: others.length - NAMED }) : t('units.row.also', { names })
  }

  const standing = (row: UnitBalance): { text: string; tone: 'owes' | 'owed' | 'square' } => {
    if (row.net < 0) return { text: t('units.balance.owes', { amount: money(-row.net) }), tone: 'owes' }
    if (row.net > 0) return { text: t('units.balance.owed', { amount: money(row.net) }), tone: 'owed' }
    return { text: t('units.balance.square'), tone: 'square' }
  }

  const shown = recorded.filter((payment) => group.settlements.some((s) => s.id === payment.mainId)).reverse()
  const payment = paying
    ? upiPaymentForTransfer({ fromId: paying.transfer.from.payerId, toId: paying.transfer.to.payerId, amount: paying.transfer.amount }, group.currency, friendsById, group.name)
    : null

  return (
    <Screen header={header} contentClassName={styles.content}>
      {title}

      {transfers.length === 0 ? (
        <div className={styles.square} role="status">
          <SuccessCheck size="lg" />
          <h2 className={styles.squareTitle}>{expenses.length > 0 ? t('units.screen.square.title') : t('units.screen.nothing.title')}</h2>
          <p className={styles.fine}>{expenses.length > 0 ? t('units.screen.square.body', { group: group.name }) : t('units.screen.nothing.body', { group: group.name })}</p>
        </div>
      ) : (
        <section className={styles.section} aria-labelledby="units-pay">
          <SectionHeader id="units-pay" title={t('units.screen.pay.title')} description={t('units.screen.pay.body')} />
          <Card padding="none">
            <ul className={styles.rows}>
              {transfers.map((transfer) => {
                const sentence = paySentence(transfer.from, transfer.to, people)
                const amount = money(transfer.amount)
                const payers = payersLine(transfer)
                const also = alsoLine(transfer)
                const mine = transfer.from.payerId === ME_ID
                const toMe = transfer.to.payerId === ME_ID
                return (
                  <li key={`${transfer.from.id}>${transfer.to.id}`}>
                    <div className={styles.transfer} role="group" aria-label={t('units.row.aria', { sentence, amount })}>
                      <div className={styles.transferHead}>
                        <div className={styles.transferText}>
                          <p className={styles.sentence}>{sentence}</p>
                          {payers && <p className={styles.fine}>{payers}</p>}
                          {also && <p className={styles.fine}>{also}</p>}
                        </div>
                        <Money value={transfer.amount} currency={group.currency} size="lg" strong trimZeros tone={mine ? 'negative' : toMe ? 'positive' : 'default'} className={styles.amount} />
                      </div>
                      <div className={styles.actions}>
                        {mine && upi && (
                          <Button size="md" iconStart={<Wallet />} onClick={() => setPaying({ transfer, open: true })}>
                            {t('units.row.pay', { amount })}
                          </Button>
                        )}
                        {toMe && upi && (
                          <Button size="md" variant="secondary" iconStart={<QrCode />} onClick={() => setPaying({ transfer, open: true })}>
                            {t('units.row.collect')}
                          </Button>
                        )}
                        <Button
                          size="md"
                          variant={mine && upi ? 'secondary' : 'tonal'}
                          iconStart={<Check />}
                          onClick={() => record(transfer, 'other')}
                          aria-label={t('units.row.markPaid.aria', { sentence, amount })}
                        >
                          {t('units.row.markPaid')}
                        </Button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        </section>
      )}

      <section className={styles.section} aria-labelledby="units-each">
        <SectionHeader id="units-each" title={t('units.balances.title')} />
        <Card padding="none">
          <ul className={styles.rows}>
            {rows.map((row) => {
              const { text, tone } = standing(row)
              return (
                <li key={row.unit.id} className={styles.balance}>
                  <span className={styles.who}>
                    <span className={styles.name}>{unitLabel(row.unit, people)}</span>
                    {row.unit.household && <span className={styles.fine}>{membersLine(row.unit, people)}</span>}
                    {row.unit.household && (
                      <span className={styles.fine}>{row.unit.payerId === ME_ID ? t('units.balance.payer.you') : t('units.balance.payer', { name: nameOf(row.unit.payerId) })}</span>
                    )}
                  </span>
                  <span className={styles.standing} data-tone={tone}>
                    {text}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
        <Button variant="secondary" size="md" iconStart={<Pencil />} className={styles.edit} onClick={() => setEditing(true)}>
          {t('units.screen.edit')}
        </Button>
      </section>

      {shown.length > 0 && (
        <section className={styles.section} aria-labelledby="units-done">
          <SectionHeader id="units-done" title={t('units.done.title')} />
          <Card padding="none">
            <ul className={styles.rows}>
              {shown.map((p) => {
                const sentence = paidSentence(p.fromName, p.toName)
                return (
                  <li key={p.id} className={styles.balance}>
                    <span className={styles.who}>
                      <span className={styles.name}>{t('units.recorded', { sentence, amount: money(p.amount) })}</span>
                      <span className={styles.fine}>{relativeDateLabel(p.date)}</span>
                      {p.withinIds.length > 0 && <span className={styles.fine}>{t('units.done.within', { count: p.withinIds.length })}</span>}
                    </span>
                    <Button size="md" variant="ghost" onClick={() => takeBack(p)} aria-label={t('units.done.undo.aria', { sentence, amount: money(p.amount) })}>
                      {t('units.done.undo')}
                    </Button>
                  </li>
                )
              })}
            </ul>
          </Card>
        </section>
      )}

      {payment && paying && (
        <UpiPaySheet
          open={paying.open}
          onClose={() => setPaying((p) => p && { ...p, open: false })}
          {...payment}
          onMarkPaid={() => {
            setPaying((p) => p && { ...p, open: false })
            record(paying.transfer, 'upi')
          }}
        />
      )}
      {sheet}
    </Screen>
  )
}
