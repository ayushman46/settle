import { useId, useMemo, type ReactNode, type Ref } from 'react'
import { ArrowRight, CheckCheck, HandCoins, PenLine } from 'lucide-react'
import { navigate } from '../../app/router'
import { Avatar, Button, CategoryIcon, Money, useToast } from '../../components'
import { setPaidBack, useExpenses, useFriends, useGroups } from '../../data'
import { ME_ID, type Friend } from '../../domain/types'
import { categoryFromText } from '../../engine/categories'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { settleWithFriend } from '../friends/friendBalance'
import { LEND_ENABLED } from '../lend/enabled'
import { matchFriend, settleOffer, type SettleOffer } from './sms/matchFriend'
import type { SmsTxn } from './sms/parseSms'
import { refLabel, txnMetaLine, txnTitle } from './sms/smsView'
import styles from './TxnCard.module.css'

export interface TxnCardProps {
  txn: SmsTxn
  today: string
  /** Split it (the debit's prefill); `focusAmount` lands with the amount field focused; `title` replaces the payee. */
  onSplit: (opts: { focusAmount: boolean; title?: string }) => void
  /** Leave (money in: nothing to split). */
  onDone: () => void
  /** The card's first control — focused after a read. */
  ref?: Ref<HTMLButtonElement>
}

const inr = (amount: number): string => formatMoney(amount, 'INR', { trimZeros: true })

/** Where to note an udhaar (S4's screen reads these; if it ignores them the user fills it in). */
function udhaarPath(friendId: string, amount: number): string {
  const q = new URLSearchParams({ dir: 'lent', friend: friendId, amount: String(amount), what: 'cash' })
  return `/app/lend?${q.toString()}`
}

/**
 * One transaction read from an SMS: a payment you made (split it — or, paid to a friend you owed
 * exactly that, mark it settled), or money that came in (a friend paying you back exactly what
 * they owed → mark them paid; a refund; anything else needs nothing).
 */
export function TxnCard({ txn, today, onSplit, onDone, ref }: TxnCardProps) {
  const t = useT()
  const toast = useToast()
  const friends = useFriends()
  const expenses = useExpenses()
  const groups = useGroups()
  const titleId = useId()

  const match = useMemo(() => matchFriend(txn, friends, ME_ID), [txn, friends])
  const friend: Friend | null = match ? (friends.find((f) => f.id === match.friendId) ?? null) : null
  const offer = useMemo<SettleOffer | null>(
    () => (match ? settleOffer(txn, match, expenses, groups, ME_ID) : null),
    [txn, match, expenses, groups],
  )

  const amount = inr(txn.amount)
  const meta = txnMetaLine(txn, today)
  const ref12 = refLabel(txn)

  const settle = (): void => {
    if (!offer || !friend) return
    let undo: () => void
    let message: string
    if (offer.kind === 'all') {
      undo = settleWithFriend(friend.id, offer.sources, { method: 'upi', date: txn.date ?? today })
      message = t('sharein.card.settled.toast', { name: friend.name })
    } else {
      setPaidBack(offer.mark.expenseId, offer.mark.debtorId, true)
      undo = () => {
        try {
          setPaidBack(offer.mark.expenseId, offer.mark.debtorId, false)
        } catch {
          // Deleted since: nothing to untick.
        }
      }
      message = t('sharein.card.markedOne.toast', { title: offer.title })
    }
    haptic('success')
    toast(message, { tone: 'success', action: { label: t('common.action.undo'), onAction: undo } })
    navigate('/app')
  }

  /* ---------------------------------------------------------------- money in */
  if (txn.dir === 'credit') {
    if (friend && offer) {
      return (
        <Card titleId={titleId} leading={<Avatar name={friend.name} color={friend.color} size="md" />} title={t('sharein.card.friendPaid.title', { name: friend.name, amount })} meta={meta} refText={ref12}>
          <Offer
            text={t('sharein.card.friendOwed', { name: friend.name, amount })}
            action={
              <Button ref={ref} block variant="accent" iconStart={<CheckCheck />} onClick={settle}>
                {offer.kind === 'one' ? t('sharein.card.markOne.cta', { title: offer.title }) : t('sharein.card.markPaid.cta', { name: friend.name })}
              </Button>
            }
          />
        </Card>
      )
    }
    const name = friend?.name ?? txn.name
    const title = txn.refund
      ? txn.name
        ? t('sharein.card.refund.title', { name: txn.name, amount })
        : t('sharein.card.refund.titleNoName', { amount })
      : name
        ? t('sharein.card.in.title', { amount, name })
        : t('sharein.card.in.titleNoName', { amount })
    const body = txn.refund
      ? t('sharein.card.refund.body')
      : friend
        ? t('sharein.card.in.nothingOpen', { name: friend.name })
        : t('sharein.card.in.body')
    return (
      <Card
        titleId={titleId}
        leading={friend ? <Avatar name={friend.name} color={friend.color} size="md" /> : <span className={styles.inIcon} aria-hidden="true"><HandCoins /></span>}
        title={title}
        meta={meta}
        refText={ref12}
      >
        <p className={styles.body}>{body}</p>
        <div className={styles.actions}>
          <Button ref={ref} block variant="secondary" onClick={onDone}>
            {t('sharein.card.done.cta')}
          </Button>
        </div>
      </Card>
    )
  }

  /* ---------------------------------------------------------------- a payment you made */
  const udhaar =
    LEND_ENABLED && friend ? (
      <Button block variant="ghost" iconStart={<HandCoins />} onClick={() => navigate(udhaarPath(friend.id, txn.amount))}>
        {t('sharein.card.udhaar.cta')}
      </Button>
    ) : null

  if (friend && offer) {
    return (
      <Card titleId={titleId} leading={<Avatar name={friend.name} color={friend.color} size="md" />} title={t('sharein.card.paidFriend.title', { name: friend.name, amount })} meta={meta} refText={ref12}>
        <Offer
          text={t('sharein.card.owedFriend', { name: friend.name, amount })}
          action={
            <Button ref={ref} block variant="accent" iconStart={<CheckCheck />} onClick={settle}>
              {offer.kind === 'one' ? t('sharein.card.markOne.cta', { title: offer.title }) : t('sharein.card.settle.cta')}
            </Button>
          }
        />
        <div className={styles.actions}>
          <Button block variant="ghost" onClick={() => onSplit({ focusAmount: false, title: friend.name })}>
            {t('sharein.card.splitInstead.cta')}
          </Button>
          {udhaar}
        </div>
      </Card>
    )
  }

  const title = friend?.name ?? txnTitle(txn)
  const category = categoryFromText(txn.name ?? txn.vpa ?? '') ?? 'other'
  return (
    <Card
      titleId={titleId}
      leading={friend ? <Avatar name={friend.name} color={friend.color} size="md" /> : <CategoryIcon category={category} size="md" />}
      title={title}
      amount={txn.amount}
      meta={meta}
      refText={ref12}
    >
      <div className={styles.actions}>
        <Button ref={ref} block iconEnd={<ArrowRight strokeWidth={2.5} />} onClick={() => onSplit({ focusAmount: false, title: friend?.name })}>
          {t('sharein.card.split.cta')}
        </Button>
        <Button block variant="ghost" iconStart={<PenLine />} onClick={() => onSplit({ focusAmount: true, title: friend?.name })}>
          {t('sharein.card.edit.cta')}
        </Button>
        {udhaar}
      </div>
    </Card>
  )
}

interface CardProps {
  titleId: string
  leading: ReactNode
  title: string
  /** Shown big beside the title (a plain debit). */
  amount?: number
  meta: string
  refText: string | null
  children: ReactNode
}

function Card({ titleId, leading, title, amount, meta, refText, children }: CardProps) {
  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <header className={styles.top}>
        {leading}
        <div className={styles.heading}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {meta && <p className={styles.meta}>{meta}</p>}
          {refText && <p className={styles.ref}>{refText}</p>}
        </div>
        {amount !== undefined && <Money value={amount} currency="INR" size="lg" strong trimZeros className={styles.amount} />}
      </header>
      {children}
    </section>
  )
}

function Offer({ text, action }: { text: string; action: ReactNode }) {
  return (
    <div className={styles.offer}>
      <p className={styles.offerText}>
        <CheckCheck aria-hidden="true" className={styles.offerIcon} />
        <span>{text}</span>
      </p>
      {action}
    </div>
  )
}
