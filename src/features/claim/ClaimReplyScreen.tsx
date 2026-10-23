import { useEffect, useState, type ReactNode } from 'react'
import { CircleCheck, Copy, History, Link2Off, ShieldAlert, Trash2, UserRoundPlus } from 'lucide-react'
import { navigate, useLocation } from '../../app/router'
import { ActionBar, Banner, Button, Card, EmptyState, List, ListRow, PageTitle, Screen, Skeleton, TopBar, useToast } from '../../components'
import { DataError, friendsStore, profileStore } from '../../data'
import { addClaimReply, checkClaimReply, onExpenseDeleted, type ReplyCheck } from '../../data/claims'
import type { ClaimPick, ClaimReply, ClaimRound, Expense } from '../../domain/types'
import { claimShare } from '../../engine/claims'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { copyText } from '../../lib/share'
import { claimLinkFromRound, decodeClaimReply, type ClaimReplyPayload } from '../../share/claim'
import { money, pickAmount, pickLine } from './claimView'
import styles from './ClaimReplyScreen.module.css'

type State =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'garbled' }
  | { status: 'checked'; payload: ClaimReplyPayload; check: ReplyCheck }

/** A reply's share as the friend saw it, worked out from the bill on this phone. */
function replyShare(round: ClaimRound, expense: Expense, picks: readonly ClaimPick[], personIndex: number | null): number {
  const friendsById = Object.fromEntries(friendsStore.get().map((f) => [f.id, f]))
  const link = claimLinkFromRound(round, expense, friendsById, profileStore.get())
  const items = link.it.map((it) => ({ name: it.n, amount: it.a, quantity: it.q ?? 1 }))
  const fixed = (link.fix ?? []).map(([i, w]) => [i, w] as const)
  return claimShare({ items, total: link.tot, picks, fixed, personIndex }).share
}

function PickList({ round, expense, reply, dropped }: { round: ClaimRound; expense: Expense; reply: ClaimReply; dropped: readonly number[] }) {
  const t = useT()
  const byId = new Map((expense.bill?.items ?? []).map((item) => [item.id, item]))
  return (
    <Card padding="none">
      <List aria-label={t('claim.reply.picksTitle', { name: reply.name })}>
        {reply.picks.map((pick) => {
          const item = byId.get(round.itemIds[pick.item] ?? '')
          if (!item) return null
          return (
            <ListRow
              key={pick.item}
              title={pickLine(item.name, item.quantity, pick)}
              trailing={<span className={styles.amount}>{money(pickAmount(item.amount, pick), expense.currency)}</span>}
            />
          )
        })}
        {dropped.map((index) => (
          <ListRow key={`gone-${index}`} title={<s className={styles.gone}>{t('claim.reply.noLonger')}</s>} />
        ))}
      </List>
    </Card>
  )
}

function Problem({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action: ReactNode }) {
  return <EmptyState icon={icon} title={title} text={text} action={action} />
}

/**
 * `/app/claims/in#…` — a friend's picks arriving in the organiser's app: checked (signature, round,
 * bill), shown, and added to the round on "Add to the bill". The bill itself only changes when
 * the organiser taps "Update the bill" on the board.
 */
export function ClaimReplyScreen() {
  const t = useT()
  const toast = useToast()
  const { hash } = useLocation()
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  const [decoded, setDecoded] = useState<{ fragment: string; state: State } | null>(null)

  useEffect(() => {
    if (!fragment) return
    let live = true
    void decodeClaimReply(fragment).then((payload) => {
      if (!live) return
      // Checked once, as it arrives: adding it later turns it into "Already added".
      setDecoded({ fragment, state: payload ? { status: 'checked', payload, check: checkClaimReply(payload) } : { status: 'garbled' } })
    })
    return () => {
      live = false
    }
  }, [fragment])

  const state: State = !fragment ? { status: 'empty' } : decoded && decoded.fragment === fragment ? decoded.state : { status: 'loading' }

  const home = () => navigate('/app', { replace: true })
  const openRound = (id: string) => navigate(`/app/claims/${id}`, { replace: true })
  const header = <TopBar onBack={home} />
  const goHome = (
    <Button size="md" onClick={home}>
      {t('claim.reply.goHome')}
    </Button>
  )

  if (state.status === 'loading') {
    return (
      <Screen header={header}>
        <p role="status" className="visually-hidden">
          {t('claim.reply.loading')}
        </p>
        <Skeleton width="60%" height={28} />
        <Skeleton width="90%" height={120} />
      </Screen>
    )
  }
  if (state.status === 'empty') {
    return (
      <Screen header={header}>
        <Problem icon={<Link2Off />} title={t('claim.reply.emptyTitle')} text={t('claim.reply.emptyText')} action={goHome} />
      </Screen>
    )
  }
  if (state.status === 'garbled' || state.check.kind === 'bad_signature') {
    const name = state.status === 'checked' ? state.payload.n : null
    return (
      <Screen header={header}>
        <Problem
          icon={<ShieldAlert />}
          title={t('claim.reply.badTitle')}
          text={name ? t('claim.reply.badText', { name }) : t('claim.reply.badTextAnon')}
          action={goHome}
        />
      </Screen>
    )
  }

  const { check, payload } = state
  if (check.kind === 'unknown_round') {
    return (
      <Screen header={header}>
        <Problem
          icon={<Link2Off />}
          title={t('claim.reply.unknownTitle')}
          text={t('claim.reply.unknownText')}
          action={
            <Button
              size="md"
              iconStart={<Copy />}
              onClick={async () => {
                const ok = await copyText(window.location.href)
                haptic(ok ? 'success' : 'error')
                if (ok) toast(t('claim.board.copied'), { tone: 'success' })
              }}
            >
              {t('claim.reply.copy')}
            </Button>
          }
        />
      </Screen>
    )
  }
  if (check.kind === 'expense_gone') {
    return (
      <Screen header={header}>
        <Problem
          icon={<Trash2 />}
          title={t('claim.reply.goneTitle')}
          action={
            <Button
              size="md"
              onClick={() => {
                onExpenseDeleted(check.round.expenseId)
                home()
              }}
            >
              {t('claim.reply.goHome')}
            </Button>
          }
        />
      </Screen>
    )
  }
  if (check.kind === 'duplicate' || check.kind === 'older') {
    const dup = check.kind === 'duplicate'
    return (
      <Screen header={header}>
        <Problem
          icon={dup ? <CircleCheck /> : <History />}
          title={dup ? t('claim.reply.dupTitle') : t('claim.reply.olderTitle')}
          text={dup ? t('claim.reply.dupText', { name: check.reply.name }) : t('claim.reply.olderText', { name: check.reply.name })}
          action={
            <Button size="md" onClick={() => openRound(check.round.id)}>
              {t('claim.reply.openClaims')}
            </Button>
          }
        />
      </Screen>
    )
  }

  const add = (replace: boolean) => {
    try {
      const result = addClaimReply(payload, { replace })
      if (result.kind !== 'added') {
        haptic('error')
        return
      }
      haptic('success')
      toast(t('claim.reply.added', { name: result.reply.name }), { tone: 'success' })
      openRound(result.round.id)
    } catch (error) {
      if (!(error instanceof DataError)) throw error
      haptic('error')
      toast(error.message, { tone: 'error' })
    }
  }

  if (check.kind === 'needs_confirm') {
    const before = replyShare(check.round, check.expense, check.previous.picks, check.previous.personIndex)
    const after = replyShare(check.round, check.expense, check.next.picks, check.next.personIndex)
    return (
      <Screen
        header={header}
        footer={
          <ActionBar>
            <Button block onClick={() => add(true)}>
              {t('claim.reply.useNew')}
            </Button>
            <Button block variant="ghost" onClick={() => openRound(check.round.id)}>
              {t('claim.reply.keepOld')}
            </Button>
          </ActionBar>
        }
      >
        <PageTitle
          title={t('claim.reply.changedTitle', { name: check.next.name })}
          subtitle={`${money(before, check.expense.currency)} → ${money(after, check.expense.currency)}`}
        />
        {check.changed && <Banner tone="warning">{t('claim.reply.changedBanner', { name: check.next.name })}</Banner>}
        <PickList round={check.round} expense={check.expense} reply={check.next} dropped={check.dropped} />
      </Screen>
    )
  }

  // A new reply.
  const { reply, round, expense } = check
  const share = replyShare(round, expense, reply.picks, reply.personIndex)
  const typedName = reply.personIndex === null
  return (
    <Screen
      header={header}
      footer={
        <ActionBar>
          <Button block iconStart={typedName && !check.existing ? <UserRoundPlus /> : undefined} onClick={() => add(false)}>
            {check.dropped.length > 0 ? t('claim.reply.addRest') : t('claim.reply.add')}
          </Button>
          <Button block variant="ghost" onClick={() => openRound(round.id)}>
            {t('claim.reply.notNow')}
          </Button>
        </ActionBar>
      }
    >
      <PageTitle
        title={t('claim.reply.picksTitle', { name: reply.name })}
        subtitle={reply.nothing ? t('claim.reply.nothing') : `${expense.title} · ${money(share, expense.currency)}`}
      />
      {typedName && !check.existing && <Banner tone="info">{t('claim.reply.newName', { name: reply.name })}</Banner>}
      {typedName && check.existing && <Banner tone="info">{t('claim.reply.matched', { name: check.existing.name })}</Banner>}
      {check.changed && <Banner tone="warning">{t('claim.reply.changedBanner', { name: reply.name })}</Banner>}
      {!reply.nothing && <PickList round={round} expense={expense} reply={reply} dropped={check.dropped} />}
      {reply.paid !== null && <p className={styles.paid}>{t('claim.reply.paidSays', { amount: money(reply.paid, expense.currency) })}</p>}
    </Screen>
  )
}
