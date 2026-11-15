import { useId, useMemo, useState } from 'react'
import { Undo2 } from 'lucide-react'
import { goBack } from '../../app/router'
import { AmountInput, Banner, BottomSheet, Button, Card, Chip, useToast } from '../../components'
import { useExpense, useFriendsById, useGroups } from '../../data'
import { ME_ID, type Expense } from '../../domain/types'
import { isSettledInGroup } from '../../engine/balances'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { DateField, FriendAvatar, friendLabel } from '../../kit/index-a'
import { haptic } from '../../lib/haptics'
import { commaIsDecimal, formatMoney, parseMoneyInput, toInputString } from '../../lib/money'
import { expensePath, groupPath } from '../groups/paths'
import { useShared } from '../groupsync/store'
import { applyRefund, refundDateText, takeOffRefund, type ApplyIssue } from './actions'
import { canTakeOff, planRefund, refundsOn, type RefundCompanion, type RefundRecord } from './engine'
import { useRefunds } from './store'
import styles from './Refund.module.css'

export interface RefundSheetProps {
  expenseId: string
  open: boolean
  onClose: () => void
  /**
   * Called with the expense just before a full refund takes it out of the expenses, so the page
   * showing it can keep it on screen while it closes (the expense page does the same for Delete).
   */
  onRemoving?: (expense: Expense) => void
}

/**
 * "Got money back on this?": how much (all of it unless you say), who got it (whoever paid unless
 * you say) and when. It shows what each person's share becomes before anything is saved; saving
 * brings everyone's share down in the same proportion, with Undo. Null for a loan or a missing expense.
 */
export function RefundSheet({ expenseId, open, onClose, onRemoving }: RefundSheetProps) {
  const t = useT()
  const toast = useToast()
  const expense = useExpense(expenseId)
  const groups = useGroups()
  const friendsById = useFriendsById()
  const records = useRefunds()
  const shared = useShared(expense?.groupId)
  const whoId = useId()
  const previewId = useId()
  const [text, setText] = useState('')
  const [toId, setToId] = useState('')
  const [date, setDate] = useState(todayIso)
  // Fresh, prefilled choices each time the sheet opens: all of it, to whoever paid, today.
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open && expense) {
      setText(toInputString(expense.total, expense.currency, { trimZeros: true }))
      setToId(expense.payerId)
      setDate(todayIso())
    }
  }
  const past = useMemo(() => (expense ? refundsOn(records, expense.id) : []), [records, expense])
  if (!expense || expense.kind === 'loan') return null

  const currency = expense.currency
  const money = (paise: number): string => formatMoney(paise, currency, { trimZeros: true })
  const nameOf = (id: string): string => friendLabel(id, friendsById[id] ?? null)
  const group = expense.groupId ? (groups.find((g) => g.id === expense.groupId) ?? null) : null
  const inGroup = isSettledInGroup(expense, groups)
  const people = [...new Set([expense.payerId, ...expense.participants.map((p) => p.friendId), ...(group?.memberIds ?? [])])]
  const who = people.includes(toId) ? toId : expense.payerId
  const today = todayIso()

  const amount = parseMoneyInput(text, currency)
  const plan = amount === null ? null : planRefund(expense, { amount, toId: who, noteLine: '', inGroup })
  const ready = plan !== null && plan.ok
  const half = Math.floor(expense.total / 2)

  const failText = (issue: ApplyIssue): string =>
    issue === 'gone' ? t('refund.failed.gone') : issue === 'full' ? t('refund.failed.full') : issue === 'stuck' ? t('refund.failed.stuck') : t('refund.failed')

  const save = (): void => {
    if (amount === null || !plan?.ok) return
    if (plan.kind === 'remove') onRemoving?.(expense)
    const result = applyRefund(expense.id, { amount, toId: who, date })
    if (!result.ok) {
      haptic('error')
      toast(failText(result.issue), { tone: 'error' })
      return
    }
    haptic('success')
    onClose()
    toast(
      result.plan.kind === 'remove' ? t('refund.done.remove', { title: expense.title }) : t('refund.done.lower', { amount: money(amount), title: expense.title, total: money(result.plan.newTotal) }),
      { tone: 'success', action: { label: t('common.action.undo'), onAction: result.undo } },
    )
    // All of it came back: the expense's own page has nothing left to show.
    if (result.plan.kind === 'remove' && typeof window !== 'undefined' && window.location.pathname === expensePath(expense.id)) {
      goBack(expense.groupId ? groupPath(expense.groupId) : '/app/activity')
    }
  }

  const takeOff = (record: RefundRecord): void => {
    const undo = takeOffRefund(record.id)
    if (!undo) {
      haptic('error')
      toast(t('refund.failed'), { tone: 'error' })
      return
    }
    haptic('tap')
    toast(t('refund.takenOff', { title: record.before.title, amount: formatMoney(record.before.total, record.currency, { trimZeros: true }) }), {
      action: { label: t('common.action.undo'), onAction: undo },
    })
  }

  const companionLine = (c: RefundCompanion): string => {
    const vars = { lender: nameOf(c.lenderId), borrower: nameOf(c.borrowerId), amount: money(c.amount) }
    if (c.kind === 'holder') {
      if (c.borrowerId === ME_ID) return t('refund.preview.holder.youGot', vars)
      if (c.lenderId === ME_ID) return t('refund.preview.holder.yourMoney', vars)
      return t('refund.preview.holder', vars)
    }
    if (c.lenderId === ME_ID) return t('refund.preview.overpaid.you', vars)
    if (c.borrowerId === ME_ID) return t('refund.preview.overpaid.toYou', vars)
    return t('refund.preview.overpaid', vars)
  }

  const error = amount !== null && plan && !plan.ok && plan.issue === 'too_much' ? t('refund.sheet.tooMuch', { amount: money(expense.total) }) : undefined
  const cta = ready ? t('refund.sheet.save', { amount: money(plan.amount) }) : (error ?? t('refund.sheet.missing'))

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('refund.sheet.title')}
      eyebrow={`${expense.title} · ${money(expense.total)}`}
      size="tall"
      footer={
        <Button block disabled={!ready} onClick={save}>
          {cta}
        </Button>
      }
    >
      <div className={styles.sheet}>
        <p className={styles.body}>{t('refund.sheet.body')}</p>

        {past.length > 0 && (
          <section className={styles.block} aria-label={t('refund.past.title')}>
            <h3 className={styles.label}>{t('refund.past.title')}</h3>
            {past.map((record, i) => {
              const vars = { amount: formatMoney(record.amount, record.currency, { trimZeros: true }), date: refundDateText(record.date), name: nameOf(record.toId) }
              const removable = canTakeOff(record, records, [expense])
              return (
                <div key={record.id} className={styles.past}>
                  <span className={styles.body}>{record.toId === record.before.payerId ? t('refund.past.line', vars) : t('refund.past.line.to', vars)}</span>
                  {removable ? (
                    <Button size="md" variant="ghost" onClick={() => takeOff(record)} aria-label={t('refund.past.takeOff.aria', { amount: vars.amount })}>
                      {t('refund.past.takeOff')}
                    </Button>
                  ) : (
                    <span className={styles.fine}>{i === 0 ? t('refund.past.locked') : t('refund.past.earlier')}</span>
                  )}
                </div>
              )
            })}
          </section>
        )}

        <section className={styles.block}>
          <AmountInput
            size="field"
            label={t('refund.sheet.amount')}
            currency={currency}
            value={text}
            onChange={setText}
            commaGroups={!commaIsDecimal(currency)}
            enterKeyHint="done"
            error={error}
          />
          <div className={styles.chips}>
            <Chip size="lg" selected={amount === expense.total} onClick={() => setText(toInputString(expense.total, currency, { trimZeros: true }))}>
              {t('refund.sheet.all', { amount: money(expense.total) })}
            </Chip>
            {half > 0 && half * 2 === expense.total && (
              <Chip size="lg" selected={amount === half} onClick={() => setText(toInputString(half, currency, { trimZeros: true }))}>
                {t('refund.sheet.half', { amount: money(half) })}
              </Chip>
            )}
          </div>
        </section>

        <section className={styles.block} aria-labelledby={whoId}>
          <h3 id={whoId} className={styles.label}>
            {t('refund.sheet.who')}
          </h3>
          <div className={styles.chips} role="group" aria-labelledby={whoId}>
            {people.map((id) => (
              <Chip key={id} size="lg" selected={id === who} onClick={() => setToId(id)} leading={<FriendAvatar friendId={id} size="xs" />}>
                <span className={styles.chipName}>{id === expense.payerId ? t('refund.sheet.who.paid', { name: nameOf(id) }) : nameOf(id)}</span>
              </Chip>
            ))}
          </div>
        </section>

        <DateField value={date} onChange={setDate} label={t('refund.sheet.date')} min={expense.date <= today ? expense.date : undefined} />

        {ready && (
          <section className={styles.block} aria-labelledby={previewId} role="status">
            <h3 id={previewId} className={styles.label}>
              {t('refund.preview.title')}
            </h3>
            {plan.kind === 'remove' ? (
              <>
                <p className={styles.body}>{t('refund.preview.remove', { title: expense.title })}</p>
                {shared && <Banner tone="warning">{t('refund.preview.remove.shared', { title: expense.title })}</Banner>}
              </>
            ) : (
              <>
                <p className={styles.body}>{t('refund.preview.lower', { title: expense.title, amount: money(plan.newTotal), was: money(expense.total) })}</p>
                <Card padding="none" tone="sunken">
                  <ul className={styles.rows}>
                    {Object.entries(plan.shares).map(([id, share]) => {
                      const was = expense.shares[id] ?? 0
                      return (
                        <li key={id} className={styles.share}>
                          <span className={styles.name}>{nameOf(id)}</span>
                          <span className={styles.value}>
                            {share === was ? t('refund.preview.share.same', { amount: money(share) }) : t('refund.preview.share', { amount: money(share), was: money(was) })}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </Card>
              </>
            )}
            {plan.companions.map((c) => (
              <p key={`${c.kind}:${c.lenderId}:${c.borrowerId}`} className={styles.fine}>
                {companionLine(c)}
              </p>
            ))}
          </section>
        )}
      </div>
    </BottomSheet>
  )
}

export interface RefundButtonProps {
  expenseId: string
  /** See `RefundSheetProps.onRemoving`. */
  onRemoving?: (expense: Expense) => void
}

/** On the expense page: "Got money back?" opens the refund sheet. Null for a loan (not spending) and for a missing expense. */
export function RefundButton({ expenseId, onRemoving }: RefundButtonProps) {
  const t = useT()
  const expense = useExpense(expenseId)
  const [open, setOpen] = useState(false)
  if (!expense || expense.kind === 'loan') return null
  return (
    <>
      <Button variant="secondary" size="md" iconStart={<Undo2 />} onClick={() => setOpen(true)}>
        {t('refund.button')}
      </Button>
      <RefundSheet expenseId={expenseId} open={open} onClose={() => setOpen(false)} onRemoving={onRemoving} />
    </>
  )
}
