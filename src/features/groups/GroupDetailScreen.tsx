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
import { BRAND, ME_ID, type Friend, type Group, type Minor, type Settlement } from '../../domain/types'
import { CATEGORY_META } from '../../engine/categories'
import { t as translate, useT } from '../../i18n'
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
import { TRIP_ENABLED } from '../trip/enabled'
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

const TAB_LABELS = { expenses: 'groups.detail.tab.expenses', balances: 'groups.detail.tab.balances', totals: 'groups.detail.tab.totals' } as const

/** The three tabs, labelled in the current language. */
function tabOptions(): ReadonlyArray<SegmentedOption<Tab>> {
  return (['expenses', 'balances', 'totals'] as const).map((value) => ({ value, label: translate(TAB_LABELS[value]) }))
}

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
  const t = useT()
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
    toast(archived ? t('groups.detail.archived.toast', { name: group.name }) : t('groups.detail.unarchived.toast', { name: group.name }), {
      tone: 'success',
      action: archived ? { label: t('common.action.undo'), onAction: () => setGroupArchived(group.id, false) } : undefined,
    })
  }

  const remove = (): void => {
    setSheet(null)
    onLeaving(group)
    const snapshot = deleteGroup(group.id)
    haptic('success')
    goBack(GROUPS_PATH)
    const count = snapshot.expenses.length
    toast(t('groups.detail.deleted.toast', { name: group.name, count }), {
      action: { label: t('common.action.undo'), onAction: () => restoreGroup(snapshot) },
    })
  }

  return (
    <Screen
      header={
        <TopBar
          onBack={() => goBack(GROUPS_PATH)}
          right={
            <span className={styles.topActions}>
              <IconButton label={t('groups.detail.share.aria')} onClick={() => setSheet('share')}>
                <Share2 />
              </IconButton>
              <IconButton label={t('groups.detail.options.aria')} onClick={() => setSheet('menu')}>
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
        <PageTitle
          align="center"
          title={group.name}
          subtitle={`${meta.label} · ${membersLabel(group.memberIds.length)}${TRIP_ENABLED && group.travelCurrency ? ` · ${t('groups.detail.spendingIn', { currency: group.travelCurrency })}` : ''}`}
        />
        <button
          type="button"
          className={styles.members}
          onClick={() => setSheet('members')}
          aria-label={t('groups.detail.members.aria', { names: memberNames.join(', ') })}
        >
          <AvatarStack people={people} max={5} size="sm" />
          <span className={styles.membersLabel} aria-hidden="true">
            {group.memberIds.length > 1 ? t('groups.detail.members') : t('groups.detail.addPeople')}
          </span>
        </button>
      </header>

      {group.archived && (
        <Banner tone="info" title={t('groups.detail.archived.title')} action={{ label: t('groups.detail.unarchive.cta'), onAction: () => archive(false) }}>
          {t('groups.detail.archived.body')}
        </Banner>
      )}

      <StandingCard group={group} standing={standing} onShare={() => setSheet('share')} />

      {ROTATION_ENABLED && <NextRoundCard group={group} expenses={expenses} onPlan={() => setSheet('rotation')} />}

      <SegmentedControl options={tabOptions()} value={tab} onChange={setTab} ariaLabel={t('groups.detail.tabs.aria')} className={styles.tabs} />

      <div className={styles.panel} role="region" aria-label={t(TAB_LABELS[tab])}>
        {tab === 'expenses' && <ExpensesTab group={group} onAdd={addExpense} onPayment={setPayment} />}
        {tab === 'balances' && <BalancesTab group={group} standing={standing} />}
        {tab === 'totals' && <TotalsTab group={group} />}
      </div>

      {/* With no expenses yet, the list's own "Add the first expense" is the way in (the two would overlap). */}
      {!group.archived && !(tab === 'expenses' && expenses.length === 0 && group.settlements.length === 0) && (
        <Fab extended icon={<Plus strokeWidth={2.5} />} label={t('groups.detail.add.cta')} onClick={addExpense} />
      )}

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
  const t = useT()
  const titleId = useId()
  const { mine, spent, expenseCount, settled, transfers } = standing
  const headline =
    mine > 0
      ? t('groups.standing.title.owed')
      : mine < 0
        ? t('groups.standing.title.owe')
        : expenseCount > 0
          ? t('groups.standing.title.square')
          : t('groups.standing.title.none')
  const spentLine =
    expenseCount > 0
      ? t('groups.standing.spent', { amount: formatMoney(spent, group.currency, { trimZeros: true }), count: expenseCount })
      : t('groups.standing.first')
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
        {!settled && mine === 0 && ` · ${t('groups.standing.othersSettling')}`}
      </p>
      {(!settled || expenseCount > 0) && (
        <div className={styles.standingActions}>
          {!settled ? (
            <Button
              variant="accent"
              size="md"
              iconEnd={<ArrowRight />}
              onClick={() => navigate(settleUpPath(group.id))}
              aria-label={t('groups.standing.settle.aria', { count: transfers.length })}
            >
              {t('groups.standing.settle.cta')}
            </Button>
          ) : (
            <Button variant="tonal" size="md" iconStart={<Share2 />} onClick={onShare}>
              {t('groups.share.cta')}
            </Button>
          )}
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ expenses */

function ExpensesTab({ group, onAdd, onPayment }: { group: Group; onAdd: () => void; onPayment: (s: Settlement) => void }) {
  const t = useT()
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
        title={t('groups.expenses.empty.title')}
        text={t('groups.expenses.empty.body', { brand: BRAND.name })}
        action={
          group.archived ? undefined : (
            <Button size="md" iconStart={<Plus />} onClick={onAdd}>
              {t('groups.expenses.empty.cta')}
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
  const t = useT()
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
      aria-label={t('groups.timeline.payment.aria', { sentence, amount, method: METHOD_LABELS[s.method] })}
      leading={
        <span className={styles.paymentIcon} aria-hidden="true">
          <HandCoins strokeWidth={2.25} />
        </span>
      }
      title={sentence}
      subtitle={t('groups.timeline.payment.subtitle', { method: METHOD_LABELS[s.method] })}
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
  const t = useT()
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
        <List aria-label={t('groups.balances.aria')}>
          {rows.map(({ id, amount }) => (
            <BalanceRow key={id} id={id} friend={friendsById[id] ?? null} amount={amount} currency={group.currency} member={group.memberIds.includes(id)} />
          ))}
        </List>
      </Card>
      {standing.settled ? (
        <p className={styles.square}>{standing.expenseCount > 0 ? t('groups.balances.square') : t('groups.balances.empty')}</p>
      ) : (
        <Button block iconEnd={<ArrowRight />} onClick={() => navigate(settleUpPath(group.id))}>
          {t('groups.balances.settle.cta', { count })}
        </Button>
      )}
    </div>
  )
}

function BalanceRow({ id, friend, amount, currency, member }: { id: string; friend: Friend | null; amount: Minor; currency: string; member: boolean }) {
  const t = useT()
  const name = friendLabel(id, friend)
  const me = id === ME_ID
  const words =
    amount > 0
      ? t(me ? 'groups.balances.getBack.me' : 'groups.balances.getBack')
      : amount < 0
        ? t(me ? 'groups.balances.owe.me' : 'groups.balances.owe')
        : t('groups.balances.settled')
  return (
    <ListRow
      leading={<FriendAvatar friend={friend} friendId={id} size="md" />}
      title={name}
      subtitle={member ? words : `${words} · ${t('groups.balances.left')}`}
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
  const t = useT()
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
        title={t('groups.totals.empty.title')}
        text={t('groups.totals.empty.body')}
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
          centerLabel={t('groups.totals.spent')}
          centerValue={money(totals.spent)}
          formatValue={money}
          ariaLabel={t('groups.totals.chart.aria')}
          legend
        />
      </Card>

      <section className={styles.stack} aria-labelledby="group-by-person">
        <SectionHeader id="group-by-person" title={t('groups.totals.byPerson.title')} description={t('groups.totals.byPerson.description')} />
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
                      <span className="visually-hidden">{t('groups.totals.person.share', { amount: money(p.share) })}, </span>
                      {t('groups.totals.person.paid', { amount: money(p.paid) })}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
        <p className={styles.legend} aria-hidden="true">
          <span className={styles.legendShare} /> {t('groups.totals.legend.share')} <span className={styles.legendPaid} /> {t('groups.totals.legend.paid')}
        </p>
      </section>

      {totals.elsewhere > 0 && (
        <p className={styles.note}>
          {t('groups.totals.elsewhere', { count: totals.elsewhere })}
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
  const t = useT()
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
    <BottomSheet open={open} onClose={onClose} eyebrow={group.name} title={t('groups.menu.title')}>
      <List className={styles.menu}>
        {item('details', <Pencil />, t('groups.menu.edit'), t('groups.menu.edit.subtitle'))}
        {item('members', <UserPen />, t('groups.menu.members'), t('groups.menu.members.subtitle'))}
        {item('share', <Share2 />, t('groups.menu.share'), t('groups.menu.share.subtitle'))}
        {group.archived
          ? item('archive', <ArchiveRestore />, t('groups.menu.unarchive'), t('groups.menu.unarchive.subtitle'))
          : item('archive', <Archive />, t('groups.menu.archive'), t('groups.menu.archive.subtitle'))}
        {item('delete', <Trash2 />, t('groups.menu.delete'), t('groups.menu.delete.subtitle'), true)}
      </List>
    </BottomSheet>
  )
}

function DeleteSheet({ group, count, open, onClose, onConfirm }: { group: Group; count: number; open: boolean; onClose: () => void; onConfirm: () => void }) {
  const t = useT()
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('groups.delete.title', { name: group.name })}
      description={t('groups.delete.body', { count })}
      footer={
        <div className={styles.sheetActions}>
          <Button block variant="danger" onClick={onConfirm}>
            {t('groups.delete.cta')}
          </Button>
          <Button block variant="ghost" onClick={onClose}>
            {t('groups.delete.keep.cta')}
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
  const t = useT()
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
    toast(t('groups.payment.removed.toast'), {
      action: {
        label: t('common.action.undo'),
        onAction: () => {
          try {
            recordSettlement(group.id, { fromId: s.fromId, toId: s.toId, amount: s.amount, date: s.date, method: s.method })
          } catch {
            toast(t('groups.payment.restore.error'), { tone: 'error' })
          }
        },
      },
    })
  }

  return (
    <BottomSheet
      open={settlement !== null}
      onClose={onClose}
      eyebrow={t('groups.payment.sheet.eyebrow')}
      title={sentence}
      footer={
        <Button block variant="danger" iconStart={<Trash2 />} onClick={remove}>
          {t('groups.payment.remove.cta')}
        </Button>
      }
    >
      <div className={styles.paymentBody}>
        <Money value={s.amount} currency={group.currency} size="xl" trimZeros className={styles.paymentAmount} />
        <dl className={styles.facts}>
          <div>
            <dt>{t('groups.payment.method')}</dt>
            <dd>{METHOD_LABELS[s.method]}</dd>
          </div>
          <div>
            <dt>{t('groups.payment.date')}</dt>
            <dd>{fullDateLabel(s.date)}</dd>
          </div>
          <div>
            <dt>{t('groups.payment.group')}</dt>
            <dd>{group.name}</dd>
          </div>
        </dl>
        <p className={styles.note}>{t('groups.payment.mistake')}</p>
      </div>
    </BottomSheet>
  )
}
