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
  const { params } = useRoute(ROUTES)
  const id = params.id ?? null
  const found = useExpense(id)
  // Keeps the page on screen while it leaves after a delete (the expense is already gone).
  const [deleted, setDeleted] = useState<Expense | null>(null)
  const expense = found ?? (deleted !== null && deleted.id === id ? deleted : null)

  if (!expense) {
    return (
      <Screen header={<TopBar onBack={() => goBack('/app/activity')} />}>
        <PageTitle title="This expense is gone" subtitle="It may have been deleted — on this phone or in another tab." />
        <Button className={styles.gone} onClick={() => navigate('/app/activity', { replace: true })}>
          See activity
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
    const undo = { label: 'Undo', onAction: () => setPaidBack(expense.id, friendId, !paid) }
    if (paid && progress.peopleCount > 0 && progress.outstanding === 0) {
      haptic('success')
      const message =
        expense.payerId === ME_ID ? `Everyone’s paid — all ${money(progress.total)} is back` : `All settled with ${firstName(payerName)}`
      toast(message, { tone: 'success', action: undo })
      return
    }
    const who = friendId === ME_ID ? 'You' : nameOf(friendId)
    const verb = friendId === ME_ID ? 'are' : 'is'
    toast(paid ? `${who} ${verb} marked as paid` : `${who} ${verb} marked as not paid yet`, { action: undo })
  }

  const markAllPaid = (): void => {
    setMoreOpen(false)
    const ticked = owingIds(expense)
    setAllPaidBack(expense.id, true)
    haptic('success')
    toast(`Everyone’s paid — all ${money(collectProgress(expense).total)} is back`, {
      tone: 'success',
      action: {
        label: 'Undo',
        onAction: () => {
          for (const id of ticked) setPaidBack(expense.id, id, false)
        },
      },
    })
  }

  const edit = (): void => {
    setMoreOpen(false)
    if (expense.kind === 'bill' && expense.bill && expense.bill.items.length > 0) openBill({ kind: 'edit', expenseId: expense.id })
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
      toast(`${removed.title} deleted`, { action: { label: 'Undo', onAction: () => restoreExpense(removed) } })
    }
    goBack(back)
  }

  const primary = (() => {
    switch (action.kind) {
      case 'group':
        return (
          <Button block iconStart={<UsersRound />} onClick={() => navigate(`/app/groups/${encodeURIComponent(action.group.id)}/settle`)}>
            Settle up in {action.group.name}
          </Button>
        )
      case 'pay':
        return (
          <Button block variant="accent" iconStart={<QrCode />} onClick={() => setUpi({ friendId: ME_ID, open: true })}>
            Pay {firstName(payerName)} {money(action.amount)}
          </Button>
        )
      case 'mark-paid':
        return (
          <Button block variant="accent" iconStart={<CheckCheck />} onClick={() => togglePaid(ME_ID, true)}>
            I’ve paid {firstName(payerName)} back
          </Button>
        )
      case 'share':
        return (
          <Button block iconStart={<Share2 />} onClick={() => setShareOpen(true)}>
            {action.payLink ? 'Share pay link' : 'Share'}
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
              <IconButton label={`Edit ${expense.title}`} onClick={edit}>
                <Pencil />
              </IconButton>
              <IconButton label="More options" aria-haspopup="dialog" onClick={() => setMoreOpen(true)}>
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
              <Button variant="secondary" aria-label="Share" onClick={() => setShareOpen(true)} className={styles.shareButton}>
                <Share2 aria-hidden="true" />
              </Button>
            </div>
          )}
        </ActionBar>
      }
      contentClassName={styles.content}
    >
      <ExpenseHero expense={expense} payerName={payerName} group={group} standing={standing} />

      <CollectCard expense={expense} />

      <section className={styles.section} aria-labelledby="expense-shares">
        <SectionHeader
          id="expense-shares"
          title="Everyone’s share"
          action={canMarkAll ? { label: 'Mark all paid', onClick: markAllPaid } : undefined}
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
          <SectionHeader id="expense-note" title="Note" />
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
      />
    </Screen>
  )
}
