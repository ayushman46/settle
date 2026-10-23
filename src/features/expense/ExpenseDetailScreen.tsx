import { useEffect, useState } from 'react'
import { CheckCheck, EllipsisVertical, Pencil, QrCode, Share2, UsersRound } from 'lucide-react'
import { goBack, navigate, useRoute } from '../../app/router'
import { ActionBar, Button, Card, IconButton, PageTitle, Screen, SectionHeader, TopBar, useToast } from '../../components'
import {
  deleteExpense,
  restoreExpense,
  setAllPaidBack,
  setPaidBack,
  useExpense,
  useFriendsById,
  useGroup,
  useGroups,
} from '../../data'
import { BRAND, ME_ID, type Expense } from '../../domain/types'
import { collectProgress } from '../../engine/balances'
import { useT } from '../../i18n'
import { friendLabel } from '../../kit/index-a'
import { CollectCard, NudgeSheet, ShareList, ShareSheet, upiPaymentForShare, UpiPaySheet, usePayLink } from '../../kit/index-b'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { firstName } from '../../share/text'
import { openBill } from '../bill/launch'
import { openPaywall } from '../pro/paywall'
import { BillBreakdown } from './BillBreakdown'
import { ExpenseActionsSheet } from './ExpenseActionsSheet'
import { ExpenseHero } from './ExpenseHero'
import { extensionEditPath, extraExpenseActions } from './extensionActions'
import { ExpenseExtensions } from './extensions'
import { addedLine, owingIds, primaryAction, standingPill } from './expenseView'
import styles from './ExpenseDetailScreen.module.css'

const ROUTES = ['/app/expense/:id'] as const

/**
 * `/app/expense/:id` — one expense and getting paid for it: a receipt-style header (what, when,
 * how much, who paid, where you stand), how much has come back, everyone's share with paid ticks
 * (undoable), UPI QR codes, nudges and — for itemized bills — the bill itself. The main action
 * shares one pay link with the group (or pays the payer when you owe); the ⋮ menu edits,
 * duplicates, marks everyone paid or deletes (with undo).
 */
export function ExpenseDetailScreen() {
  const t = useT()
  const { params } = useRoute(ROUTES)
  const id = params.id ?? null
  const found = useExpense(id)
  // Keeps the page on screen while it leaves after a delete (the expense is already gone).
  const [deleted, setDeleted] = useState<Expense | null>(null)
  const expense = found ?? (deleted !== null && deleted.id === id ? deleted : null)

  if (!expense) {
    return (
      <Screen header={<TopBar onBack={() => goBack('/app/activity')} />}>
        <PageTitle title={t('expense.gone.title')} subtitle={t('expense.gone.subtitle')} />
        <Button className={styles.gone} onClick={() => navigate('/app/activity', { replace: true })}>
          {t('expense.gone.cta')}
        </Button>
      </Screen>
    )
  }
  return <ExpenseDetail key={expense.id} expense={expense} onDeleting={setDeleted} />
}

interface Opened {
  friendId: string
  open: boolean
}

interface ExpenseDetailProps {
  expense: Expense
  onDeleting: (expense: Expense) => void
}

function ExpenseDetail({ expense, onDeleting }: ExpenseDetailProps) {
  const t = useT()
  const toast = useToast()
  const friendsById = useFriendsById()
  const groups = useGroups()
  const group = useGroup(expense.groupId)
  // Sheets stay mounted while they close, so their exit animation keeps its content.
  const [upi, setUpi] = useState<Opened | null>(null)
  const [nudge, setNudge] = useState<Opened | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const nameOf = (id: string) => friendLabel(id, friendsById[id] ?? null)
  const money = (minor: number) => formatMoney(minor, expense.currency, { trimZeros: true })
  const payerName = nameOf(expense.payerId)
  const standing = standingPill(expense, payerName, groups)
  const action = primaryAction(expense, groups)
  const owing = owingIds(expense)
  const canMarkAll = expense.payerId === ME_ID && action.kind === 'share' && owing.length > 0
  const back = group ? `/app/groups/${encodeURIComponent(group.id)}` : '/app/activity'
  const { link } = usePayLink(expense, { enabled: nudge?.open === true })
  const payment = upi ? upiPaymentForShare(expense, upi.friendId, friendsById) : null

  // The tab names the expense ("Dinner at Toit · Settle"), after the shell's generic title.
  useEffect(() => {
    document.title = `${expense.title} · ${BRAND.name}`
  }, [expense.title])

  /** Ticks `friendId` off (or back on), with Undo — and a cheer when the last one comes in. */
  const togglePaid = (friendId: string, paid: boolean): void => {
    const next = setPaidBack(expense.id, friendId, paid)
    const progress = collectProgress(next)
    const undo = { label: t('expense.toast.undo'), onAction: () => setPaidBack(expense.id, friendId, !paid) }
    if (paid && progress.peopleCount > 0 && progress.outstanding === 0) {
      haptic('success')
      const message =
        expense.payerId === ME_ID
          ? t('expense.toast.allBack', { amount: money(progress.total) })
          : t('expense.toast.allSettled', { name: firstName(payerName) })
      toast(message, { tone: 'success', action: undo })
      return
    }
    const vars = { who: friendId === ME_ID ? 'me' : 'other', name: nameOf(friendId) }
    toast(t(paid ? 'expense.toast.markedPaid' : 'expense.toast.markedUnpaid', vars), { action: undo })
  }

  const markAllPaid = (): void => {
    setMoreOpen(false)
    const ticked = owingIds(expense)
    setAllPaidBack(expense.id, true)
    haptic('success')
    toast(t('expense.toast.allBack', { amount: money(collectProgress(expense).total) }), {
      tone: 'success',
      action: {
        label: t('expense.toast.undo'),
        onAction: () => {
          for (const id of ticked) setPaidBack(expense.id, id, false)
        },
      },
    })
  }

  const edit = (): void => {
    setMoreOpen(false)
    const elsewhere = extensionEditPath(expense)
    if (elsewhere) navigate(elsewhere)
    else if (expense.kind === 'bill' && expense.bill && expense.bill.items.length > 0) openBill({ kind: 'edit', expenseId: expense.id })
    else navigate(`/app/split/${encodeURIComponent(expense.id)}/edit`)
  }

  const duplicate = (): void => {
    setMoreOpen(false)
    navigate(`/app/split/new?from=duplicate&of=${encodeURIComponent(expense.id)}`)
  }

  const remove = (): void => {
    setMoreOpen(false)
    onDeleting(expense)
    const removed = deleteExpense(expense.id)
    if (removed) {
      toast(t('expense.toast.deleted', { title: removed.title }), { action: { label: t('expense.toast.undo'), onAction: () => restoreExpense(removed) } })
    }
    goBack(back)
  }

  const primary = (() => {
    switch (action.kind) {
      case 'group':
        return (
          <Button block iconStart={<UsersRound />} onClick={() => navigate(`/app/groups/${encodeURIComponent(action.group.id)}/settle`)}>
            {t('expense.primary.group.cta', { group: action.group.name })}
          </Button>
        )
      case 'pay':
        return (
          <Button block variant="accent" iconStart={<QrCode />} onClick={() => setUpi({ friendId: ME_ID, open: true })}>
            {t('expense.primary.pay.cta', { name: firstName(payerName), amount: money(action.amount) })}
          </Button>
        )
      case 'mark-paid':
        return (
          <Button block variant="accent" iconStart={<CheckCheck />} onClick={() => togglePaid(ME_ID, true)}>
            {t('expense.primary.markPaid.cta', { name: firstName(payerName) })}
          </Button>
        )
      case 'share':
        return (
          <Button block iconStart={<Share2 />} onClick={() => setShareOpen(true)}>
            {t(action.payLink ? 'expense.primary.payLink.cta' : 'expense.primary.share.cta')}
          </Button>
        )
    }
  })()

  return (
    <Screen
      header={
        <TopBar
          onBack={() => goBack(back)}
          right={
            <span className={styles.topActions}>
              <IconButton label={t('expense.edit.aria', { title: expense.title })} onClick={edit}>
                <Pencil />
              </IconButton>
              <IconButton label={t('expense.more.aria')} aria-haspopup="dialog" onClick={() => setMoreOpen(true)}>
                <EllipsisVertical />
              </IconButton>
            </span>
          }
        />
      }
      footer={
        <ActionBar>
          {action.kind === 'share' ? (
            primary
          ) : (
            <div className={styles.footerRow}>
              {primary}
              <Button variant="secondary" aria-label={t('expense.share.aria')} onClick={() => setShareOpen(true)} className={styles.shareButton}>
                <Share2 aria-hidden="true" />
              </Button>
            </div>
          )}
        </ActionBar>
      }
      contentClassName={styles.content}
    >
      <ExpenseHero expense={expense} payerName={payerName} group={group} standing={standing} />

      <ExpenseExtensions expense={expense} />

      <CollectCard expense={expense} />

      <section className={styles.section} aria-labelledby="expense-shares">
        <SectionHeader
          id="expense-shares"
          title={t('expense.shares.title')}
          action={canMarkAll ? { label: t('expense.shares.markAll.cta'), onClick: markAllPaid } : undefined}
        />
        <Card padding="none">
          <ShareList
            expense={expense}
            onTogglePaid={togglePaid}
            onPayUpi={(friendId) => setUpi({ friendId, open: true })}
            onNudge={(friendId) => setNudge({ friendId, open: true })}
          />
        </Card>
      </section>

      <BillBreakdown expense={expense} />

      {expense.note && (
        <section className={styles.section} aria-labelledby="expense-note">
          <SectionHeader id="expense-note" title={t('expense.note.title')} />
          <Card className={styles.note}>
            <p className={styles.noteText}>{expense.note}</p>
          </Card>
        </section>
      )}

      <p className={styles.small}>{addedLine(expense)}</p>

      {payment && upi && (
        <UpiPaySheet
          open={upi.open}
          onClose={() => setUpi({ ...upi, open: false })}
          {...payment}
          onMarkPaid={() => togglePaid(upi.friendId, true)}
        />
      )}

      {nudge && (
        <NudgeSheet
          open={nudge.open}
          onClose={() => setNudge({ ...nudge, open: false })}
          friend={friendsById[nudge.friendId] ?? null}
          amount={expense.shares[nudge.friendId] ?? 0}
          currency={expense.currency}
          title={expense.title}
          link={link}
        />
      )}

      <ShareSheet expense={expense} open={shareOpen} onClose={() => setShareOpen(false)} onUpgrade={() => openPaywall('clean_cards')} />

      <ExpenseActionsSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title={expense.title}
        itemized={expense.kind === 'bill' && (expense.bill?.items.length ?? 0) > 0}
        onEdit={edit}
        onDuplicate={duplicate}
        onMarkAllPaid={canMarkAll ? markAllPaid : undefined}
        onDelete={remove}
        extra={extraExpenseActions(expense, { close: () => setMoreOpen(false) })}
      />
    </Screen>
  )
}
