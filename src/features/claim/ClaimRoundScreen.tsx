import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleCheck, Circle, CircleDashed, Copy, Lock, MessageCircle, Share2, TriangleAlert, Trash2 } from 'lucide-react'
import { navigate, useLocation, useRoute, useSearchParams } from '../../app/router'
import {
  ActionBar,
  Avatar,
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  List,
  ListRow,
  PageTitle,
  Screen,
  SectionHeader,
  TopBar,
  useToast,
} from '../../components'
import {
  ExpenseError,
  DataError,
  updateProfile,
  useClaimRound,
  useExpense,
  useFriendsById,
  useProfile,
} from '../../data'
import { applyClaimRound, onExpenseDeleted, roundBoard, roundHasNews, setClaimDecision, setOwnPicks, type ApplyResult } from '../../data/claims'
import { ME_ID, type ClaimDecision, type ClaimReply } from '../../domain/types'
import { claimShare, resolveRow, type ClaimRow } from '../../engine/claims'
import { useT } from '../../i18n'
import { formatBillDate } from '../../lib/format'
import { haptic } from '../../lib/haptics'
import { copyText, shareResult } from '../../lib/share'
import { friendLabel } from '../../kit/friendName'
import { UpiIdForm } from '../../kit/UpiIdForm'
import { claimLinkFromRound, encodeClaimLink, type ClaimLinkPayload } from '../../share/claim'
import { whatsappUrl } from '../../share/links'
import { BillUpdatedSheet } from './BillUpdatedSheet'
import { boardPortion, boardRowView, claimShareText, decisionWords, money, nudgeText, type BoardIcon } from './claimView'
import { ItemPicker, type PickerItem } from './ItemPicker'
import { PasteReplySheet } from './PasteReplySheet'
import { picksToChoices, choicesToPicks, type ItemChoice } from './picks'
import { ResolveSheet, type ResolvePerson } from './ResolveSheet'
import styles from './ClaimRoundScreen.module.css'

const ROUTES = ['/app/claims/:id'] as const

const ICONS: Record<BoardIcon, typeof CircleCheck> = { check: CircleCheck, alert: TriangleAlert, dashed: CircleDashed, circle: Circle, lock: Lock }

/** The items a friend picks from, as the claim page shows them (for the organiser's own picks). */
function pickerItems(link: ClaimLinkPayload, organiser: string, personIndex: number): PickerItem[] {
  return link.it.map((it, index) => {
    const fix = link.fix?.find(([i]) => i === index)
    if (!fix) return { name: it.n, amount: it.a, q: it.q }
    const own = fix[1].find(([p]) => p === personIndex)
    const sum = fix[1].reduce((s, [, w]) => s + w, 0)
    return { name: it.n, amount: it.a, q: it.q, fixed: { by: organiser, yours: own && sum > 0 ? boardPortion({ n: BigInt(own[1]), d: BigInt(sum) }, 1) : null } }
  })
}

function shareOf(link: ClaimLinkPayload, picks: ClaimReply['picks'], personIndex: number | null): number {
  const items = link.it.map((it) => ({ name: it.n, amount: it.a, quantity: it.q ?? 1 }))
  const fixed = (link.fix ?? []).map(([i, w]) => [i, w] as const)
  return claimShare({ items, total: link.tot, picks, fixed, personIndex }).share
}

/**
 * `/app/claims/:id` — the organiser's board for one claim link: share it, see who replied and what
 * they picked, sort out the items whose claims don't add up, then "Update the bill".
 */
export function ClaimRoundScreen() {
  const t = useT()
  const toast = useToast()
  const { params } = useRoute(ROUTES)
  const { path: pathname } = useLocation()
  const search = useSearchParams()
  const round = useClaimRound(params.id)
  const expense = useExpense(round?.expenseId)
  const friendsById = useFriendsById()
  const profile = useProfile()

  const [linkUrl, setLinkUrl] = useState<string | null>(null)
  const wantsShare = search.get('share') === '1'
  // Arriving from "Let everyone pick their own" (`?share=1`) without a UPI ID: ask for it first —
  // once the address has lost `?share=1` (below), since a navigation closes any sheet already open.
  const [upiOpen, setUpiOpen] = useState(() => wantsShare && !!expense && expense.currency === 'INR' && expense.payerId === ME_ID && !profile.upiId)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [ownOpen, setOwnOpen] = useState(false)
  const [ownChoices, setOwnChoices] = useState<Record<number, ItemChoice>>({})
  const [resolving, setResolving] = useState<number | null>(null)
  const [resolveOpen, setResolveOpen] = useState(false)
  const [applied, setApplied] = useState<ApplyResult | null>(null)
  const [appliedOpen, setAppliedOpen] = useState(false)
  const whatsappRef = useRef<HTMLAnchorElement>(null)
  const arrived = useRef(false)

  const link = useMemo(
    () => (round && expense?.bill ? claimLinkFromRound(round, expense, friendsById, profile) : null),
    [round, expense, friendsById, profile],
  )

  useEffect(() => {
    if (!link) return
    let live = true
    void encodeClaimLink(link).then((url) => {
      if (live) setLinkUrl(url)
    })
    return () => {
      live = false
    }
  }, [link])

  // Then straight to sharing (once): the address loses `?share=1` and focus goes to WhatsApp.
  useEffect(() => {
    if (arrived.current || !wantsShare || !round || !expense) return
    arrived.current = true
    navigate(pathname, { replace: true })
    if (!upiOpen) setTimeout(() => whatsappRef.current?.focus(), 50)
  }, [wantsShare, round, expense, pathname, upiOpen])

  const header = <TopBar onBack={() => navigate(round ? `/app/expense/${round.expenseId}` : '/app', { replace: true })} />

  if (!round) {
    return (
      <Screen header={<TopBar onBack={() => navigate('/app', { replace: true })} />}>
        <EmptyState
          icon={<Trash2 />}
          title={t('claim.board.notFound')}
          text={t('claim.board.notFoundText')}
          action={
            <Button size="md" onClick={() => navigate('/app', { replace: true })}>
              {t('claim.board.goHome')}
            </Button>
          }
        />
      </Screen>
    )
  }
  if (!expense || !expense.bill || !link) {
    return (
      <Screen header={header}>
        <EmptyState
          icon={<Trash2 />}
          title={t('claim.board.billGone')}
          text={t('claim.board.billGoneText')}
          action={
            <Button
              size="md"
              onClick={() => {
                onExpenseDeleted(round.expenseId)
                navigate('/app', { replace: true })
              }}
            >
              {t('claim.board.goHome')}
            </Button>
          }
        />
      </Screen>
    )
  }

  const bill = expense.bill
  const currency = expense.currency
  const itemsById = new Map(bill.items.map((item) => [item.id, item]))
  const name = (id: string) => friendLabel(id, friendsById[id])
  const organiser = link.to.n
  const everyone = expense.participants.map((p) => p.friendId)
  const rows = roundBoard(round)
  const shareText = linkUrl ? claimShareText(expense.title, expense.total, currency, linkUrl) : ''

  /* ---------------------------------------------------------------- people */
  const active = round.replies.filter((r) => r.state === 'active')
  const replyOf = (friendId: string) => active.find((r) => r.friendId === friendId)
  const extraReplies = active.filter((r) => !round.peopleIds.includes(r.friendId))
  const replied = round.peopleIds.slice(1).filter((id) => replyOf(id)).length + extraReplies.length
  const ownShare = shareOf(link, round.ownPicks, 0)

  const personRow = (friendId: string, reply: ClaimReply | undefined, isNew: boolean) => {
    const friend = friendsById[friendId]
    const label = name(friendId)
    const subtitle = !reply
      ? t('claim.board.waiting')
      : reply.nothing
        ? t('claim.board.nothing')
        : t('claim.board.picked', { n: reply.picks.length, amount: money(shareOf(link, reply.picks, reply.personIndex), currency) })
    const trailing = !reply ? (
      linkUrl ? (
        <a
          className={styles.pill}
          href={whatsappUrl(nudgeText(label, expense.title, linkUrl), friend?.phone)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('claim.board.nudgeLabel', { name: label })}
        >
          {t('claim.board.nudge')}
        </a>
      ) : null
    ) : reply.nothing ? null : reply.paid !== null ? (
      <Badge tone="positive">{t('claim.board.paid')}</Badge>
    ) : (
      <Badge tone="warning">{t('claim.board.notPaid')}</Badge>
    )
    return (
      <ListRow
        key={friendId}
        leading={<Avatar name={label} color={friend?.color ?? 0} size="md" />}
        title={
          <span className={styles.personTitle}>
            {label}
            {isNew && (
              <Badge tone="accent" size="sm">
                {t('claim.board.new')}
              </Badge>
            )}
          </span>
        }
        subtitle={subtitle}
        trailing={trailing}
      />
    )
  }

  /* ---------------------------------------------------------------- items */
  const rowWords = (row: ClaimRow, quantity: number): string => {
    const parts = row.claims.map((c) => `${name(c.friendId)} ${boardPortion(c.part, quantity)}`)
    const suffix = Number.isInteger(quantity) && quantity >= 2 && row.claims.length > 0 ? ` (of ${quantity})` : ''
    return parts.join(' · ') + suffix
  }
  const views = rows
    .filter((row) => itemsById.has(round.itemIds[row.index] ?? ''))
    .map((row) => {
      const itemId = round.itemIds[row.index] ?? ''
      const item = itemsById.get(itemId)!
      const decision = round.decisions[itemId]
      const resolved = resolveRow(row, decision, everyone) !== null
      const view = boardRowView(row, item.quantity, decision, resolved)
      const fixedNames =
        row.status === 'fixed'
          ? Object.keys(bill.assignments[itemId] ?? {})
              .map((id) => name(id))
              .join(' · ')
          : ''
      const subtitle = row.status === 'fixed' ? fixedNames : view.decided && decision ? decisionWords(decision) : rowWords(row, item.quantity)
      return { row, itemId, item, decision, view, subtitle }
    })
  const open = views.filter((v) => v.view.needsYou).length
  const sorted = views.length - open
  const news = roundHasNews(round)
  const resolvingView = views.find((v) => v.row.index === resolving) ?? null

  const people: ResolvePerson[] = everyone.map((id) => ({ id, name: name(id), color: friendsById[id]?.color ?? 0, phone: friendsById[id]?.phone ?? null }))

  const update = () => {
    try {
      const result = applyClaimRound(round.id)
      haptic('success')
      setApplied(result)
      setAppliedOpen(true)
    } catch (error) {
      if (!(error instanceof ExpenseError) && !(error instanceof DataError)) throw error
      haptic('error')
      toast(t('claim.board.updateFailed'), { tone: 'error' })
    }
  }

  const copy = async () => {
    if (!linkUrl) return
    const ok = await copyText(linkUrl)
    haptic(ok ? 'success' : 'error')
    toast(ok ? t('claim.board.copied') : t('claim.board.copyFailed'), { tone: ok ? 'success' : 'error' })
  }

  const subtitle = [expense.title, money(expense.total, currency), formatBillDate(expense.date)].filter(Boolean).join(' · ')

  return (
    <Screen
      header={header}
      footer={
        <ActionBar hint={!news ? t('claim.board.nothingNew') : open > 0 ? t('claim.board.openHint', { n: open }) : undefined}>
          <Button block disabled={!news} onClick={update}>
            {t('claim.board.update')}
          </Button>
        </ActionBar>
      }
    >
      <PageTitle title={t('claim.board.title')} subtitle={subtitle} />

      <Card className={styles.share}>
        <h2 className={styles.shareTitle}>{t('claim.board.shareTitle')}</h2>
        <p className={styles.shareText}>{t('claim.board.shareText')}</p>
        <div className={styles.shareButtons}>
          <a
            ref={whatsappRef}
            className={styles.whatsapp}
            href={linkUrl ? whatsappUrl(shareText) : undefined}
            aria-disabled={!linkUrl || undefined}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => haptic('tap')}
          >
            <MessageCircle aria-hidden="true" strokeWidth={2.25} />
            {t('claim.board.whatsapp')}
          </a>
          <div className={styles.shareRow}>
            <Button variant="secondary" size="md" iconStart={<Share2 />} disabled={!linkUrl} onClick={() => void shareResult(shareText, { mode: 'share', title: expense.title })}>
              {t('claim.board.more')}
            </Button>
            <Button variant="ghost" size="md" iconStart={<Copy />} disabled={!linkUrl} onClick={() => void copy()}>
              {t('claim.board.copy')}
            </Button>
          </div>
        </div>
        <p className={styles.privacy}>{t('claim.board.privacy')}</p>
      </Card>

      <section className={styles.section} aria-labelledby="claim-people-title">
        <SectionHeader id="claim-people-title" title={t('claim.board.people')} action={{ label: t('claim.board.paste'), onClick: () => setPasteOpen(true) }} />
        <Card padding="none">
          <List aria-label={t('claim.board.people')}>
            <ListRow
              leading={<Avatar name={organiser} color={friendsById[ME_ID]?.color ?? 0} size="md" />}
              title={t('claim.board.you')}
              subtitle={round.ownPicks.length === 0 ? t('claim.board.pickOwn') : t('claim.board.picked', { n: round.ownPicks.length, amount: money(ownShare, currency) })}
              trailing={
                <Button
                  size="sm"
                  variant={round.ownPicks.length === 0 ? 'primary' : 'secondary'}
                  onClick={() => {
                    setOwnChoices(picksToChoices(round.ownPicks, link.it.map((it) => it.q)))
                    setOwnOpen(true)
                  }}
                >
                  {round.ownPicks.length === 0 ? t('claim.board.pick') : t('claim.board.edit')}
                </Button>
              }
            />
            {round.peopleIds.slice(1).map((id) => personRow(id, replyOf(id), false))}
            {extraReplies.map((r) => personRow(r.friendId, r, r.personIndex === null))}
          </List>
        </Card>
        {replied === 0 && round.ownPicks.length === 0 && <p className={styles.hint}>{t('claim.board.noReplies')}</p>}
      </section>

      <section className={styles.section} aria-labelledby="claim-items-title">
        <SectionHeader
          id="claim-items-title"
          title={t('claim.board.items')}
          description={open > 0 ? t('claim.board.summary', { sorted, open }) : t('claim.board.summaryDone', { sorted })}
        />
        <Card padding="none">
          <List aria-label={t('claim.board.items')}>
            {views.map(({ row, item, view, subtitle: sub }) => {
              const Icon = ICONS[view.icon]
              const clickable = view.needsYou || view.decided
              return (
                <ListRow
                  key={item.id}
                  leading={<Icon aria-hidden="true" className={styles[`icon_${view.tone}`]} strokeWidth={2.25} />}
                  title={item.name}
                  subtitle={
                    <>
                      <span className={styles[`status_${view.tone}`]}>{view.label}</span>
                      {sub && <span> · {sub}</span>}
                      {view.needsYou && <span className="visually-hidden">, {t('claim.board.needsYou')}</span>}
                    </>
                  }
                  trailing={<span className={styles.amount}>{money(item.amount, currency)}</span>}
                  onClick={
                    clickable
                      ? () => {
                          setResolving(row.index)
                          setResolveOpen(true)
                        }
                      : undefined
                  }
                  chevron={clickable}
                />
              )
            })}
          </List>
        </Card>
      </section>

      <ResolveSheet
        open={resolveOpen}
        onClose={() => setResolveOpen(false)}
        row={resolvingView?.row ?? null}
        item={resolvingView ? { name: resolvingView.item.name, amount: resolvingView.item.amount, quantity: resolvingView.item.quantity } : null}
        currency={currency}
        decision={resolvingView?.decision}
        people={people}
        claimsWords={resolvingView ? resolvingView.row.claims.map((c) => `${name(c.friendId)} ${boardPortion(c.part, resolvingView.item.quantity)}`).join(' · ') : ''}
        claimerNames={resolvingView ? [...new Set(resolvingView.row.claims.map((c) => name(c.friendId)))] : []}
        billTitle={expense.title}
        claimLink={linkUrl}
        onDecide={(decision: ClaimDecision | null) => {
          if (!resolvingView) return
          setClaimDecision(round.id, resolvingView.itemId, decision)
          haptic('select')
        }}
      />

      <BottomSheet
        open={ownOpen}
        onClose={() => setOwnOpen(false)}
        title={t('claim.own.title')}
        size="tall"
        footer={
          <Button
            block
            onClick={() => {
              setOwnPicks(round.id, choicesToPicks(ownChoices, link.it.map((it) => it.q)))
              haptic('success')
              setOwnOpen(false)
              toast(t('claim.own.saved'), { tone: 'success' })
            }}
          >
            {t('claim.own.save')}
          </Button>
        }
      >
        <ItemPicker
          items={pickerItems(link, organiser, 0)}
          currency={currency}
          choices={ownChoices}
          onChange={(index, choice) => setOwnChoices((c) => ({ ...c, [index]: choice }))}
        />
      </BottomSheet>

      <BottomSheet open={upiOpen && !wantsShare} onClose={() => setUpiOpen(false)} title={t('claim.upi.title')} description={t('claim.upi.text')}>
        <UpiIdForm
          ownerId={ME_ID}
          ownerName={organiser}
          submitLabel={t('claim.upi.save')}
          autoFocus
          onSave={(upiId) => {
            updateProfile({ upiId })
            haptic('success')
            setUpiOpen(false)
          }}
        />
        <Button variant="ghost" block className={styles.skip} onClick={() => setUpiOpen(false)}>
          {t('claim.upi.skip')}
        </Button>
      </BottomSheet>

      <PasteReplySheet open={pasteOpen} onClose={() => setPasteOpen(false)} />

      <BillUpdatedSheet
        open={appliedOpen}
        onClose={() => setAppliedOpen(false)}
        onSeeBill={() => {
          setAppliedOpen(false)
          navigate(`/app/expense/${expense.id}`)
        }}
        expense={applied?.expense ?? expense}
        gaps={applied?.gaps ?? []}
        openItems={applied?.openItems ?? 0}
        friendsById={friendsById}
        profile={profile}
      />
    </Screen>
  )
}
