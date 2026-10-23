import { memo, useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Archive, ArchiveRestore, ArrowRight, Ellipsis, HandCoins, Pencil, Plus, Share2, Trash2, UserPen } from 'lucide-react'
import { goBack, navigate, useRoute, useSearchParams } from '../../app/router'
import {
  AvatarStack,
  Banner,
  BottomSheet,
  Button,
  Card,
  categoryColor,
  DonutChart,
  EmptyState,
  Fab,
  IconButton,
  Illustration,
  List,
  ListRow,
  Money,
  PageTitle,
  Screen,
  SectionHeader,
  SegmentedControl,
  TopBar,
  useToast,
  type SegmentedOption,
} from '../../components'
import {
  deleteGroup,
  deleteSettlement,
  recordSettlement,
  restoreGroup,
  setGroupArchived,
  useExpenses,
  useFriendsById,
  useGroup,
  useGroupBalances,
} from '../../data'
import { ME_ID, type Friend, type Group, type Minor, type Settlement } from '../../domain/types'
import { CATEGORY_META } from '../../engine/categories'
import { ExpenseRow } from '../../kit/index-b'
import { FriendAvatar, friendLabel, friendObjectLabel, fullDateLabel, relativeDateLabel } from '../../kit/index-a'
import { LoadMore } from '../../kit/LoadMore'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { GroupEmoji } from './GroupEmoji'
import { GroupGone } from './GroupGone'
import { GroupShareSheet } from './GroupShareSheet'
import { EditGroupSheet } from './GroupSheets'
import { NextRoundCard } from './NextRoundCard'
import { ROTATION_ENABLED } from './rotation.enabled'
import { RotationSheet } from './RotationSheet'
import {
  groupStanding,
  groupTimeline,
  groupTotals,
  kindMeta,
  membersLabel,
  METHOD_LABELS,
  paymentSentence,
  timelineHead,
  timelineSize,
  type GroupStanding,
  type TimelineEntry,
} from './groupView'
import { expensePath, GROUPS_PATH, newSplitPath, settleUpPath } from './paths'
import { rememberedTimelineLimit, rememberTimelineLimit, TIMELINE_PAGE } from './timelineMemory'
import styles from './GroupDetailScreen.module.css'

const ROUTES = ['/app/groups/:id'] as const

type Tab = 'expenses' | 'balances' | 'totals'

const TAB_LABELS: Readonly<Record<Tab, string>> = { expenses: 'Expenses', balances: 'Balances', totals: 'Totals' }

const TABS: ReadonlyArray<SegmentedOption<Tab>> = (['expenses', 'balances', 'totals'] as const).map((value) => ({
  value,
  label: TAB_LABELS[value],
}))

function tabFrom(value: string | null): Tab {
  return value === 'balances' || value === 'totals' ? value : 'expenses'
}

type Sheet = 'menu' | 'details' | 'members' | 'share' | 'delete' | 'rotation'

/**
 * `/app/groups/:id` — one group: who's in and where you stand, then its expenses and recorded
 * payments by day, everyone's balance, and what it spent on what. Settle up, add an expense,
 * share a summary card, edit, archive or delete (with undo) from here.
 */
export function GroupDetailScreen() {
  const { params } = useRoute(ROUTES)
  const id = params.id ?? ''
  const live = useGroup(id)
  // Keeps the page on screen while it leaves after a delete (the group is already gone).
  const [leaving, setLeaving] = useState<Group | null>(null)
  const group = live ?? (leaving?.id === id ? leaving : null)
  if (!group) return <GroupGone />
  return <GroupDetail key={group.id} group={group} onLeaving={setLeaving} />
}

function GroupDetail({ group, onLeaving }: { group: Group; onLeaving: (group: Group) => void }) {
  const toast = useToast()
  const query = useSearchParams()
  const friendsById = useFriendsById()
  const expenses = useExpenses({ groupId: group.id })
  const standing = useMemo(() => groupStanding(group, expenses), [group, expenses])
  const [tab, setTab] = useState<Tab>(() => tabFrom(query.get('tab')))
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [payment, setPayment] = useState<Settlement | null>(null)
  const meta = kindMeta(group.kind)

  // Discs show everyone's own initials (yours too); the spoken list says "You".
  const people = group.memberIds.map((id) => ({ id, name: friendsById[id]?.name ?? '?', color: friendsById[id]?.color ?? 0 }))
  const memberNames = group.memberIds.map((id) => friendLabel(id, friendsById[id] ?? null))
  const addExpense = (): void => navigate(newSplitPath({ group: group.id }))

  const archive = (archived: boolean): void => {
    setSheet(null)
    setGroupArchived(group.id, archived)
    haptic('success')
    toast(archived ? `${group.name} archived` : `${group.name} is back in your groups`, {
      tone: 'success',
      action: archived ? { label: 'Undo', onAction: () => setGroupArchived(group.id, false) } : undefined,
    })
  }

  const remove = (): void => {
    setSheet(null)
    onLeaving(group)
    const snapshot = deleteGroup(group.id)
    haptic('success')
    goBack(GROUPS_PATH)
    const count = snapshot.expenses.length
    toast(`${group.name} deleted${count > 0 ? ` with ${count} ${count === 1 ? 'expense' : 'expenses'}` : ''}`, {
      action: { label: 'Undo', onAction: () => restoreGroup(snapshot) },
    })
  }

  return (
    <Screen
      header={
        <TopBar
          onBack={() => goBack(GROUPS_PATH)}
          right={
            <span className={styles.topActions}>
              <IconButton label="Share group summary" onClick={() => setSheet('share')}>
                <Share2 />
              </IconButton>
              <IconButton label="Group options" onClick={() => setSheet('menu')}>
                <Ellipsis />
              </IconButton>
            </span>
          }
        />
      }
      contentClassName={cx(styles.content, !group.archived && styles.withFab)}
    >
      <header className={styles.hero}>
        <GroupEmoji emoji={group.emoji} kind={group.kind} size="lg" className={styles.heroEmoji} />
        <PageTitle align="center" title={group.name} subtitle={`${meta.label} · ${membersLabel(group.memberIds.length)}`} />
        <button
          type="button"
          className={styles.members}
          onClick={() => setSheet('members')}
          aria-label={`Members: ${memberNames.join(', ')}. Manage members`}
        >
          <AvatarStack people={people} max={5} size="sm" />
          <span className={styles.membersLabel} aria-hidden="true">
            {group.memberIds.length > 1 ? 'Members' : 'Add people'}
          </span>
        </button>
      </header>

      {group.archived && (
        <Banner tone="info" title="Archived" action={{ label: 'Unarchive', onAction: () => archive(false) }}>
          It’s tucked away from your groups list. Everything is still here.
        </Banner>
      )}

      <StandingCard group={group} standing={standing} onShare={() => setSheet('share')} />

      {ROTATION_ENABLED && <NextRoundCard group={group} expenses={expenses} onPlan={() => setSheet('rotation')} />}

      <SegmentedControl options={TABS} value={tab} onChange={setTab} ariaLabel="Show" className={styles.tabs} />

      <div className={styles.panel} role="region" aria-label={TAB_LABELS[tab]}>
        {tab === 'expenses' && <ExpensesTab group={group} onAdd={addExpense} onPayment={setPayment} />}
        {tab === 'balances' && <BalancesTab group={group} standing={standing} />}
        {tab === 'totals' && <TotalsTab group={group} />}
      </div>

      {!group.archived && <Fab extended icon={<Plus strokeWidth={2.5} />} label="Add expense" onClick={addExpense} />}

      <MenuSheet
        group={group}
        open={sheet === 'menu'}
        onClose={() => setSheet(null)}
        onPick={(next) => (next === 'archive' ? archive(!group.archived) : setSheet(next))}
      />
      <EditGroupSheet group={group} open={sheet === 'details' || sheet === 'members'} section={sheet === 'members' ? 'members' : 'details'} onClose={() => setSheet(null)} />
      <GroupShareSheet group={group} open={sheet === 'share'} onClose={() => setSheet(null)} />
      <DeleteSheet group={group} count={expenses.length} open={sheet === 'delete'} onClose={() => setSheet(null)} onConfirm={remove} />
      <PaymentSheet group={group} settlement={payment} friendsById={friendsById} onClose={() => setPayment(null)} />
      {ROTATION_ENABLED && <RotationSheet group={group} expenses={expenses} open={sheet === 'rotation'} onClose={() => setSheet(null)} />}
    </Screen>
  )
}

/* ------------------------------------------------------------------ where I stand */

function StandingCard({ group, standing, onShare }: { group: Group; standing: GroupStanding; onShare: () => void }) {
  const titleId = useId()
  const { mine, spent, expenseCount, settled, transfers } = standing
  const headline = mine > 0 ? 'You’re owed' : mine < 0 ? 'You owe' : expenseCount > 0 ? 'You’re all square' : 'Nothing spent yet'
  const spentLine =
    expenseCount > 0
      ? `${formatMoney(spent, group.currency, { trimZeros: true })} spent · ${expenseCount} ${expenseCount === 1 ? 'expense' : 'expenses'}`
      : 'Add the first expense — anyone can have paid.'
  return (
    <section className={styles.standing} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.standingLabel}>
        {headline}
      </h2>
      {mine !== 0 && (
        <Money value={Math.abs(mine)} currency={group.currency} size="xl" trimZeros className={cx(styles.standingAmount, mine > 0 && styles.owed)} />
      )}
      <p className={styles.standingLine}>
        {spentLine}
        {!settled && mine === 0 && ` · others still settling`}
      </p>
      {(!settled || expenseCount > 0) && (
        <div className={styles.standingActions}>
          {!settled ? (
            <Button
              variant="accent"
              size="md"
              iconEnd={<ArrowRight />}
              onClick={() => navigate(settleUpPath(group.id))}
              aria-label={`Settle up: ${transfers.length} ${transfers.length === 1 ? 'payment' : 'payments'}`}
            >
              Settle up
            </Button>
          ) : (
            <Button variant="tonal" size="md" iconStart={<Share2 />} onClick={onShare}>
              Share summary
            </Button>
          )}
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ expenses */

function ExpensesTab({ group, onAdd, onPayment }: { group: Group; onAdd: () => void; onPayment: (s: Settlement) => void }) {
  const expenses = useExpenses({ groupId: group.id })
  const days = useMemo(() => groupTimeline(group, expenses), [group, expenses])
  // A page at a time: a long-running flat's hundreds of rows would hold up opening the group.
  const [limit, setLimit] = useState(() => rememberedTimelineLimit(group.id))
  useEffect(() => {
    rememberTimelineLimit(group.id, limit)
  }, [group.id, limit])
  const total = useMemo(() => timelineSize(days), [days])
  const shown = useMemo(() => timelineHead(days, limit), [days, limit])
  if (days.length === 0) {
    return (
      <EmptyState
        size="sm"
        headingLevel={3}
        illustration={<Illustration name="empty-activity" size={136} />}
        title="No expenses yet"
        text="Add what the group spends as you go — whoever paid, Settle keeps the score."
        action={
          group.archived ? undefined : (
            <Button size="md" iconStart={<Plus />} onClick={onAdd}>
              Add the first expense
            </Button>
          )
        }
      />
    )
  }
  return (
    <div className={styles.days}>
      {shown.map((day) => (
        <section key={day.date} className={styles.day}>
          <h3 className={styles.dayTitle}>{relativeDateLabel(day.date)}</h3>
          <Card padding="none">
            <List>
              {day.entries.map((entry) => (
                <TimelineRow key={`${entry.kind}:${entry.id}`} entry={entry} group={group} onPayment={onPayment} />
              ))}
            </List>
          </Card>
        </section>
      ))}
      {total > limit && <LoadMore remaining={total - limit} page={TIMELINE_PAGE} onMore={() => setLimit((n) => n + TIMELINE_PAGE)} />}
    </div>
  )
}

/** One expense or payment; skips re-rendering while its entry is unchanged (say, as more rows load). */
const TimelineRow = memo(function TimelineRow({ entry, group, onPayment }: { entry: TimelineEntry; group: Group; onPayment: (s: Settlement) => void }) {
  const friendsById = useFriendsById()
  if (entry.kind === 'expense') {
    return <ExpenseRow expense={entry.expense} hideGroup onClick={() => navigate(expensePath(entry.expense.id))} />
  }
  const s = entry.settlement
  const sentence = paymentSentence(s.fromId, s.toId, friendLabel(s.fromId, friendsById[s.fromId] ?? null), friendObjectLabel(s.toId, friendsById[s.toId] ?? null))
  const mine = s.toId === ME_ID ? 'in' : s.fromId === ME_ID ? 'out' : 'between'
  const amount = formatMoney(s.amount, group.currency, { trimZeros: true })
  return (
    <ListRow
      onClick={() => onPayment(s)}
      aria-label={`${sentence} ${amount}, ${METHOD_LABELS[s.method]} payment`}
      leading={
        <span className={styles.paymentIcon} aria-hidden="true">
          <HandCoins strokeWidth={2.25} />
        </span>
      }
      title={sentence}
      subtitle={`Payment · ${METHOD_LABELS[s.method]}`}
      trailing={
        <Money
          value={mine === 'out' ? -s.amount : s.amount}
          currency={group.currency}
          sign={mine === 'between' ? 'auto' : 'always'}
          trimZeros
          strong={mine !== 'between'}
          muted={mine === 'between'}
          tone={mine === 'in' ? 'positive' : mine === 'out' ? 'negative' : 'default'}
        />
      }
    />
  )
})

/* ------------------------------------------------------------------ balances */

function BalancesTab({ group, standing }: { group: Group; standing: GroupStanding }) {
  const friendsById = useFriendsById()
  const balances = useGroupBalances(group.id)
  const ids = [...group.memberIds, ...Object.keys(balances).filter((id) => !group.memberIds.includes(id) && balances[id] !== 0)]
  const rows = ids
    .map((id) => ({ id, amount: balances[id] ?? 0 }))
    .sort((a, b) => b.amount - a.amount || ids.indexOf(a.id) - ids.indexOf(b.id))
  const count = standing.transfers.length
  return (
    <div className={styles.stack}>
      <Card padding="none">
        <List aria-label="Balances">
          {rows.map(({ id, amount }) => (
            <BalanceRow key={id} id={id} friend={friendsById[id] ?? null} amount={amount} currency={group.currency} member={group.memberIds.includes(id)} />
          ))}
        </List>
      </Card>
      {standing.settled ? (
        <p className={styles.square}>{standing.expenseCount > 0 ? 'Everyone’s square — nothing to settle.' : 'Balances appear once the first expense is in.'}</p>
      ) : (
        <Button block iconEnd={<ArrowRight />} onClick={() => navigate(settleUpPath(group.id))}>
          Settle up · {count} {count === 1 ? 'payment' : 'payments'}
        </Button>
      )}
    </div>
  )
}

function BalanceRow({ id, friend, amount, currency, member }: { id: string; friend: Friend | null; amount: Minor; currency: string; member: boolean }) {
  const name = friendLabel(id, friend)
  const me = id === ME_ID
  const words = amount > 0 ? (me ? 'get back' : 'gets back') : amount < 0 ? (me ? 'owe' : 'owes') : 'settled up'
  return (
    <ListRow
      leading={<FriendAvatar friend={friend} friendId={id} size="md" />}
      title={name}
      subtitle={member ? words : `${words} · left the group`}
      trailing={
        amount === 0 ? (
          <span className={styles.zero}>—</span>
        ) : (
          <Money value={amount} currency={currency} sign="always" trimZeros strong tone={amount > 0 ? 'positive' : 'negative'} />
        )
      }
    />
  )
}

/* ------------------------------------------------------------------ totals */

function TotalsTab({ group }: { group: Group }) {
  const friendsById = useFriendsById()
  const expenses = useExpenses({ groupId: group.id })
  const totals = useMemo(() => groupTotals(group, expenses), [group, expenses])
  const money = (minor: number) => formatMoney(minor, group.currency, { trimZeros: true })

  if (totals.count === 0) {
    return (
      <EmptyState
        size="sm"
        headingLevel={3}
        illustration={<Illustration name="empty-insights" size={136} />}
        title="Totals appear here"
        text="Once the group spends, see it by category and by person."
      />
    )
  }

  const top = Math.max(1, ...totals.people.map((p) => Math.max(p.share, p.paid)))
  return (
    <div className={styles.stack}>
      <Card padding="lg" className={styles.donutCard}>
        <DonutChart
          data={totals.byCategory.map((c) => ({
            key: c.category,
            value: c.amount,
            color: categoryColor(c.category),
            label: CATEGORY_META[c.category].label,
          }))}
          centerLabel="Spent"
          centerValue={money(totals.spent)}
          formatValue={money}
          ariaLabel="Spending by category"
          legend
        />
      </Card>

      <section className={styles.stack} aria-labelledby="group-by-person">
        <SectionHeader id="group-by-person" title="By person" description="Each person’s share, and what they paid." />
        <Card padding="none">
          <ul role="list" className={styles.people}>
            {totals.people.map((p) => {
              const name = friendLabel(p.friendId, friendsById[p.friendId] ?? null)
              return (
                <li key={p.friendId} className={styles.person}>
                  <FriendAvatar friendId={p.friendId} friend={friendsById[p.friendId] ?? null} size="md" />
                  <div className={styles.personText}>
                    <div className={styles.personTop}>
                      <span className={styles.personName}>{name}</span>
                      <Money value={p.share} currency={group.currency} trimZeros strong />
                    </div>
                    <div className={styles.bars} aria-hidden="true">
                      <span className={styles.shareBar} style={barWidth(p.share, top)} />
                      <span className={styles.paidBar} style={barWidth(p.paid, top)} />
                    </div>
                    <span className={styles.personSub}>
                      <span className="visually-hidden">Share {money(p.share)}, </span>
                      Paid {money(p.paid)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
        <p className={styles.legend} aria-hidden="true">
          <span className={styles.legendShare} /> Share <span className={styles.legendPaid} /> Paid
        </p>
      </section>

      {totals.elsewhere > 0 && (
        <p className={styles.note}>
          Plus {totals.elsewhere} {totals.elsewhere === 1 ? 'expense' : 'expenses'} in another currency, settled person to person.
        </p>
      )}
    </div>
  )
}

/** A bar's width as a share of the longest: a sliver for anything above zero, nothing for zero. */
function barWidth(value: number, top: number): CSSProperties {
  const pct = value > 0 ? Math.max(2, (value / top) * 100) : 0
  return { '--w': `${pct}%` } as CSSProperties
}

/* ------------------------------------------------------------------ sheets */

type MenuPick = 'details' | 'members' | 'share' | 'archive' | 'delete'

function MenuSheet({ group, open, onClose, onPick }: { group: Group; open: boolean; onClose: () => void; onPick: (pick: MenuPick) => void }) {
  const item = (pick: MenuPick, icon: ReactNode, title: string, subtitle?: string, danger = false) => (
    <ListRow
      className={cx(styles.menuRow, danger && styles.danger)}
      leading={
        <span className={cx(styles.menuIcon, danger && styles.dangerIcon)} aria-hidden="true">
          {icon}
        </span>
      }
      title={title}
      subtitle={subtitle}
      onClick={() => onPick(pick)}
    />
  )
  return (
    <BottomSheet open={open} onClose={onClose} eyebrow={group.name} title="Group options">
      <List className={styles.menu}>
        {item('details', <Pencil />, 'Edit group', 'Name, icon, kind and currency')}
        {item('members', <UserPen />, 'Members', 'Add or remove people')}
        {item('share', <Share2 />, 'Share summary', 'Who pays whom, for the group chat')}
        {group.archived
          ? item('archive', <ArchiveRestore />, 'Unarchive', 'Back into your groups list')
          : item('archive', <Archive />, 'Archive', 'Tuck it away — nothing is deleted')}
        {item('delete', <Trash2 />, 'Delete group', 'With all its expenses', true)}
      </List>
    </BottomSheet>
  )
}

function DeleteSheet({ group, count, open, onClose, onConfirm }: { group: Group; count: number; open: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`Delete ${group.name}?`}
      description={
        count > 0
          ? `Its ${count} ${count === 1 ? 'expense goes' : 'expenses go'} too. You can undo straight after.`
          : 'You can undo straight after.'
      }
      footer={
        <div className={styles.sheetActions}>
          <Button block variant="danger" onClick={onConfirm}>
            Delete group
          </Button>
          <Button block variant="ghost" onClick={onClose}>
            Keep it
          </Button>
        </div>
      }
    />
  )
}

function PaymentSheet({
  group,
  settlement,
  friendsById,
  onClose,
}: {
  group: Group
  settlement: Settlement | null
  friendsById: Readonly<Record<string, Friend>>
  onClose: () => void
}) {
  const toast = useToast()
  // Keeps the last payment on show while the sheet slides away.
  const [shown, setShown] = useState<Settlement | null>(settlement)
  if (settlement && settlement !== shown) setShown(settlement)
  const s = settlement ?? shown
  if (!s) return null
  const sentence = paymentSentence(s.fromId, s.toId, friendLabel(s.fromId, friendsById[s.fromId] ?? null), friendObjectLabel(s.toId, friendsById[s.toId] ?? null))

  const remove = (): void => {
    deleteSettlement(group.id, s.id)
    haptic('success')
    onClose()
    toast('Payment removed', {
      action: {
        label: 'Undo',
        onAction: () => {
          try {
            recordSettlement(group.id, { fromId: s.fromId, toId: s.toId, amount: s.amount, date: s.date, method: s.method })
          } catch {
            toast('Couldn’t put it back — the group is gone.', { tone: 'error' })
          }
        },
      },
    })
  }

  return (
    <BottomSheet
      open={settlement !== null}
      onClose={onClose}
      eyebrow="Recorded payment"
      title={sentence}
      footer={
        <Button block variant="danger" iconStart={<Trash2 />} onClick={remove}>
          Remove payment
        </Button>
      }
    >
      <div className={styles.paymentBody}>
        <Money value={s.amount} currency={group.currency} size="xl" trimZeros className={styles.paymentAmount} />
        <dl className={styles.facts}>
          <div>
            <dt>Method</dt>
            <dd>{METHOD_LABELS[s.method]}</dd>
          </div>
          <div>
            <dt>On</dt>
            <dd>{fullDateLabel(s.date)}</dd>
          </div>
          <div>
            <dt>Group</dt>
            <dd>{group.name}</dd>
          </div>
        </dl>
        <p className={styles.note}>Recorded by mistake? Removing it puts the balances back as they were.</p>
      </div>
    </BottomSheet>
  )
}
