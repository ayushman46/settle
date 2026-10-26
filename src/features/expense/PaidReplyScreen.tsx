import { useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, HelpCircle, Link2Off, Wallet } from 'lucide-react'
import { goBack, navigate, useLocation } from '../../app/router'
import { ActionBar, Button, Card, Screen, Skeleton, TopBar, useToast } from '../../components'
import { setPaidBack, useExpense, useFriendsById, useProfile } from '../../data'
import type { Expense } from '../../domain/types'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { copyText } from '../../lib/share'
import { decodePaidReply, formatUtr, type PaidReplyPayload } from '../../share/paidReply'
import { expensePath } from '../home/homeLinks'
import { whoPaid } from './paidReplyView'
import styles from './PaidReplyScreen.module.css'

type Decoded = { hash: string; reply: PaidReplyPayload | null }

function useReply(hash: string): Decoded | 'loading' | 'empty' {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  const [decoded, setDecoded] = useState<Decoded | null>(null)
  useEffect(() => {
    if (!fragment) return
    let live = true
    void decodePaidReply(fragment).then((reply) => {
      if (live) setDecoded({ hash: fragment, reply })
    })
    return () => {
      live = false
    }
  }, [fragment])
  if (!fragment) return 'empty'
  if (!decoded || decoded.hash !== fragment) return 'loading'
  return decoded
}

/**
 * `/app/paid#…` — a friend's "I've paid" reply to a pay link arrives: find the split and the
 * person, say what they paid and how (with the UPI reference to check in your bank app), and tick
 * them off in one tap — with Undo. Already ticked, not on this phone, or garbled: it says so.
 */
export function PaidReplyScreen() {
  const t = useT()
  const { hash } = useLocation()
  const state = useReply(hash)
  return (
    <Screen header={<TopBar onBack={() => goBack('/app')} title={t('expense.paidReply.screen')} />} contentClassName={styles.content}>
      {state === 'loading' && (
        <div className={styles.loading}>
          <p role="status" className="visually-hidden">
            {t('expense.paidReply.loading')}
          </p>
          <Skeleton shape="md" width={64} height={64} />
          <Skeleton width="70%" height={28} />
          <Skeleton width="50%" height={16} />
        </div>
      )}
      {state === 'empty' && (
        <Outcome icon={<Link2Off />} title={t('expense.paidReply.empty.title')} text={t('expense.paidReply.empty.text')}>
          <Button block onClick={() => navigate('/app', { replace: true })}>
            {t('expense.paidReply.home')}
          </Button>
        </Outcome>
      )}
      {state !== 'loading' && state !== 'empty' && <ReplyState key={state.hash} reply={state.reply} />}
    </Screen>
  )
}

function Outcome({ icon, title, text, tone = 'neutral', children }: { icon: ReactNode; title: string; text?: string; tone?: 'neutral' | 'warning' | 'positive'; children?: ReactNode }) {
  return (
    <section className={styles.outcome} aria-labelledby="paid-reply-title">
      <span className={`${styles.outcomeIcon} ${styles[tone]}`} aria-hidden="true">
        {icon}
      </span>
      <h1 id="paid-reply-title" className={styles.title} tabIndex={-1}>
        {title}
      </h1>
      {text && <p className={styles.text}>{text}</p>}
      {children && <div className={styles.actions}>{children}</div>}
    </section>
  )
}

function ReplyState({ reply }: { reply: PaidReplyPayload | null }) {
  const t = useT()
  const expense = useExpense(reply?.e ?? null)
  if (!reply) {
    return (
      <Outcome icon={<AlertTriangle />} tone="warning" title={t('expense.paidReply.bad.title')} text={t('expense.paidReply.bad.text')}>
        <Button block variant="secondary" onClick={() => navigate('/app', { replace: true })}>
          {t('expense.paidReply.home')}
        </Button>
      </Outcome>
    )
  }
  if (!expense) return <Missing reply={reply} />
  return <Found reply={reply} expense={expense} />
}

/** The split isn't here: deleted, or opened on another phone (or outside the installed app on iPhone). */
function Missing({ reply }: { reply: PaidReplyPayload }) {
  const t = useT()
  const toast = useToast()
  const amount = formatMoney(reply.a, reply.c, { trimZeros: true })
  return (
    <Outcome icon={<HelpCircle />} title={t('expense.paidReply.missing.title')} text={t('expense.paidReply.missing.text', { name: reply.n, amount, title: reply.t })}>
      <Button
        block
        variant="secondary"
        onClick={async () => {
          const ok = await copyText(window.location.href)
          toast(ok ? t('expense.paidReply.copied') : t('expense.paidReply.copyFailed'), { tone: ok ? 'success' : 'error' })
        }}
      >
        {t('expense.paidReply.copy')}
      </Button>
      <Button block variant="ghost" onClick={() => navigate('/app', { replace: true })}>
        {t('expense.paidReply.home')}
      </Button>
    </Outcome>
  )
}

function Found({ reply, expense }: { reply: PaidReplyPayload; expense: Expense }) {
  const t = useT()
  const toast = useToast()
  const friendsById = useFriendsById()
  const profile = useProfile()
  const friendId = whoPaid(expense, reply, friendsById, profile)
  const money = (minor: number) => formatMoney(minor, expense.currency, { trimZeros: true })
  const open = () => navigate(expensePath(expense.id), { replace: true })

  if (friendId === null) {
    return (
      <Outcome icon={<HelpCircle />} title={t('expense.paidReply.unknown.title')} text={t('expense.paidReply.unknown.text', { name: reply.n, title: expense.title })}>
        <Button block onClick={open}>
          {t('expense.paidReply.open')}
        </Button>
      </Outcome>
    )
  }

  const name = reply.n
  if (expense.paidBack[friendId] !== undefined) {
    return (
      <Outcome icon={<CheckCircle2 />} tone="positive" title={t('expense.paidReply.already.title', { name })} text={t('expense.paidReply.already.text', { title: expense.title })}>
        <Button block onClick={open}>
          {t('expense.paidReply.open')}
        </Button>
      </Outcome>
    )
  }

  const share = expense.shares[friendId] ?? 0
  const sameCurrency = reply.c === expense.currency
  const how =
    reply.h === 'cash'
      ? t('expense.paidReply.cash')
      : reply.r
        ? t('expense.paidReply.upiRef', { ref: formatUtr(reply.r) })
        : t('expense.paidReply.upi')
  const differs = !sameCurrency || reply.a !== share

  const tick = (): void => {
    setPaidBack(expense.id, friendId, true)
    haptic('success')
    toast(t('expense.toast.markedPaid', { who: 'other', name: friendsById[friendId]?.name ?? name }), {
      tone: 'success',
      action: { label: t('expense.toast.undo'), onAction: () => setPaidBack(expense.id, friendId, false) },
    })
    open()
  }

  return (
    <>
      <Card className={styles.split}>
        <span className={styles.splitIcon} aria-hidden="true">
          <Wallet />
        </span>
        <span className={styles.splitTitle}>{t('expense.paidReply.for', { title: expense.title })}</span>
      </Card>
      <Outcome icon={<HelpCircle />} title={t('expense.paidReply.new.title', { name, amount: formatMoney(reply.a, reply.c, { trimZeros: true }) })} text={how}>
        {differs && <p className={styles.differs}>{t('expense.paidReply.differs', { share: money(share) })}</p>}
      </Outcome>
      <ActionBar>
        <Button block onClick={tick}>
          {t('expense.paidReply.yes', { name })}
        </Button>
        <Button block variant="secondary" onClick={open}>
          {t('expense.paidReply.notYet')}
        </Button>
      </ActionBar>
    </>
  )
}
