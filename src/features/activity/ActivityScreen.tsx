import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Plus, ScanLine } from 'lucide-react'
import { navigate, useSearchParams } from '../../app/router'
import {
  Button,
  Card,
  EmptyState,
  Fab,
  Illustration,
  List,
  ListRow,
  Money,
  PageTitle,
  Screen,
  SectionHeader,
} from '../../components'
import { shallowArrayEqual, useExpenses, useFriendsById, useGroups, useProfile } from '../../data'
import { BRAND, type Expense, type Group } from '../../domain/types'
import { today } from '../../engine/dates'
import { ExpenseRow } from '../../kit/index-b'
import { LoadMore } from '../../kit/LoadMore'
import { formatMoney } from '../../lib/money'
import { BILL_PATH } from '../bill/launch'
import { GroupEmoji } from '../groups/GroupEmoji'
import { ActivityFilters } from './ActivityFilters'
import { ActivitySearch } from './ActivitySearch'
import {
  activityStates,
  filterCounts,
  fold,
  groupByMonth,
  groupStandings,
  isActivityFilter,
  type MonthSection,
  matchesFilter,
  matchesQuery,
  resultsLine,
  type ActivityFilter,
  type GroupStanding,
} from './activityView'
import { ACTIVITY_PAGE, rememberActivityView, rememberedActivityView, type ActivityView } from './viewMemory'
import styles from './ActivityScreen.module.css'

const NEW_SPLIT = '/app/split/new'

function expensePath(id: string): string {
  return `/app/expense/${encodeURIComponent(id)}`
}

/** The view to open on: `?filter=collect` (a link from elsewhere) wins; else where you left off. */
function initialView(filterParam: string | null): ActivityView {
  if (isActivityFilter(filterParam)) return { filter: filterParam, query: '', limit: ACTIVITY_PAGE }
  return rememberedActivityView()
}

/** Groups whose name has every word of the search. */
function groupMatches(group: Group, query: string): boolean {
  const name = fold(group.name)
  return fold(query)
    .split(' ')
    .filter(Boolean)
    .every((term) => name.includes(term))
}

/**
 * `/app/activity` — every expense, newest first, in month sections: search by name, place or
 * amount, and filter to what needs doing (to collect, to pay) or what's done. Group costs that
 * aren't square show as their groups, with a way to settle up.
 */
export function ActivityScreen() {
  const params = useSearchParams()
  const expenses = useExpenses()
  const groups = useGroups()
  const friendsById = useFriendsById()
  const { currency } = useProfile()
  const filterParam = params.get('filter')
  const [view, setView] = useState(() => initialView(filterParam))
  // A link to another filter while this screen stays up (`?filter=pay`) switches to it.
  const [linkedFilter, setLinkedFilter] = useState(filterParam)
  if (filterParam !== linkedFilter) {
    setLinkedFilter(filterParam)
    if (isActivityFilter(filterParam)) setView({ filter: filterParam, query: '', limit: ACTIVITY_PAGE })
  }
  const query = useDeferredValue(view.query)
  const day = today()

  useEffect(() => {
    rememberActivityView(view)
  }, [view])

  const states = useMemo(() => activityStates(expenses, groups), [expenses, groups])
  // Groups that aren't square: settled from the group, so they're listed (and counted) as groups.
  const owedIn = useMemo(() => groupStandings(groups, expenses, 'collect'), [groups, expenses])
  const oweIn = useMemo(() => groupStandings(groups, expenses, 'pay'), [groups, expenses])
  const counts = useMemo(() => {
    const perExpense = filterCounts(expenses, states)
    return { ...perExpense, collect: perExpense.collect + owedIn.length, pay: perExpense.pay + oweIn.length }
  }, [expenses, states, owedIn, oweIn])
  const groupsById = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, g])), [groups])
  const matches = useMemo(
    () =>
      expenses.filter(
        (e) => matchesFilter(e, view.filter, states.get(e.id)) && matchesQuery(e, query, { friendsById, groupsById }),
      ),
    [expenses, view.filter, states, query, friendsById, groupsById],
  )
  const sections = useMemo(() => groupByMonth(matches.slice(0, view.limit), day), [matches, view.limit, day])
  const groupCards = useMemo(() => {
    const list = view.filter === 'collect' ? owedIn : view.filter === 'pay' ? oweIn : []
    return list.filter((s) => groupMatches(s.group, query))
  }, [view.filter, owedIn, oweIn, query])

  const update = (patch: Partial<ActivityView>): void =>
    setView((prev) => ({ ...prev, limit: ACTIVITY_PAGE, ...patch }))

  // Once a second page is in, rows join without the entrance animation: it is meant for the
  // first screenful, and 40 rows starting it at once cost a budget phone most of a page's frame.
  const calm = view.limit > ACTIVITY_PAGE

  const nothing = matches.length === 0 && groupCards.length === 0
  // Only groups to show: their section header says it all, so the line is for screen readers.
  const onlyGroups = matches.length === 0 && groupCards.length > 0
  const line = onlyGroups
    ? `${view.filter === 'collect' ? 'Owed to you' : 'You owe'} in ${groupCards.length} ${groupCards.length === 1 ? 'group' : 'groups'}`
    : resultsLine({ filter: view.filter, query, matches, groups, currency })

  return (
    <Screen contentClassName={styles.content}>
      <PageTitle title="Activity" />

      {expenses.length === 0 ? (
        <FirstRun />
      ) : (
        <>
          <div className={styles.controls}>
            <ActivitySearch value={view.query} onChange={(q) => update({ query: q })} />
            <ActivityFilters value={view.filter} counts={counts} onChange={(filter) => update({ filter })} />
          </div>

          {groupCards.length > 0 && <GroupCards cards={groupCards} filter={view.filter} />}

          {/* Under the group cards: it sums up the splits listed below it. */}
          <p role="status" className={nothing || onlyGroups ? 'visually-hidden' : styles.results}>
            {line}
          </p>

          {nothing ? (
            <NoMatches filter={view.filter} query={query} onShowAll={() => update({ filter: 'all', query: '' })} />
          ) : (
            sections.map((section) => (
              <MonthList
                key={section.period}
                period={section.period}
                label={section.label}
                expenses={section.expenses}
                day={day}
                calm={calm}
              />
            ))
          )}

          {matches.length > view.limit && (
            <LoadMore
              remaining={matches.length - view.limit}
              page={ACTIVITY_PAGE}
              onMore={() => setView((prev) => ({ ...prev, limit: prev.limit + ACTIVITY_PAGE }))}
            />
          )}
        </>
      )}

      <Fab extended icon={<Plus strokeWidth={2.5} />} label="New split" onClick={() => navigate(NEW_SPLIT)} />
    </Screen>
  )
}

interface MonthListProps extends MonthSection {
  day: string
  calm: boolean
}

/**
 * One month of the list. Memoised on its rows (the same expenses, in order): loading the next
 * page re-renders only the month it lands in, not every month and row already on screen.
 */
const MonthList = memo(
  function MonthList({ period, label, expenses, day, calm }: MonthListProps) {
    return (
      <section className={styles.month} aria-labelledby={`activity-${period}`}>
        <h2 id={`activity-${period}`} className={styles.monthTitle}>
          {label}
        </h2>
        <Card padding="none">
          <List className={calm ? styles.calm : undefined}>
            {expenses.map((e: Expense) => (
              <ActivityRow key={e.id} expense={e} day={day} />
            ))}
          </List>
        </Card>
      </section>
    )
  },
  (a, b) =>
    a.period === b.period && a.label === b.label && a.day === b.day && a.calm === b.calm && shallowArrayEqual(a.expenses, b.expenses),
)

/**
 * One expense in the list. Memoised: loading the next page (or typing a search) re-renders only
 * the rows that changed, not the hundreds already on screen. `day` is today's date, so "Today" /
 * "Yesterday" labels move on at midnight.
 */
const ActivityRow = memo(function ActivityRow({ expense }: { expense: Expense; day: string }) {
  return <ExpenseRow expense={expense} showDate onClick={() => navigate(expensePath(expense.id))} />
})

/** Nothing split yet: what this tab is for, and two ways to start. */
function FirstRun() {
  return (
    <EmptyState
      illustration={<Illustration name="empty-activity" />}
      title="Your splits will live here"
      text="Every expense you split shows up here, newest first — with who's paid you back and who hasn't."
      action={
        <>
          <Button size="md" iconStart={<Plus />} onClick={() => navigate(NEW_SPLIT)}>
            Split an amount
          </Button>
          <Button size="md" variant="secondary" iconStart={<ScanLine />} onClick={() => navigate(BILL_PATH)}>
            Scan a bill
          </Button>
        </>
      }
    />
  )
}

const EMPTY_FILTER: Readonly<Record<ActivityFilter, { title: string; text: string }>> = {
  all: { title: 'No expenses yet', text: 'Split something and it shows up here.' },
  collect: { title: 'Nothing to collect', text: "Everyone's paid you back. Nice." },
  pay: { title: "You're all square", text: "You don't owe anyone right now." },
  bills: { title: 'No bills yet', text: `Snap a restaurant bill and ${BRAND.name} splits it item by item.` },
  groups: { title: 'No group expenses yet', text: 'Trips, flats, couples — keep shared costs together in a group.' },
  settled: { title: 'Nothing settled yet', text: "Splits land here once everyone's squared up." },
}

function NoMatches({ filter, query, onShowAll }: { filter: ActivityFilter; query: string; onShowAll: () => void }) {
  const q = query.trim()
  if (q) {
    return (
      <EmptyState
        size="sm"
        title={`No matches for “${q}”`}
        text="Try a name, a place or an amount."
        action={
          <Button size="md" variant="secondary" onClick={onShowAll}>
            Show all activity
          </Button>
        }
      />
    )
  }
  const copy = EMPTY_FILTER[filter]
  const action =
    filter === 'bills' ? (
      <Button size="md" variant="secondary" iconStart={<ScanLine />} onClick={() => navigate(BILL_PATH)}>
        Scan a bill
      </Button>
    ) : filter === 'groups' ? (
      <Button size="md" variant="secondary" onClick={() => navigate('/app/groups')}>
        Go to groups
      </Button>
    ) : undefined
  return <EmptyState size="sm" title={copy.title} text={copy.text} action={action} />
}

/** Groups that aren't square: their costs settle together, so they're settled from the group. */
function GroupCards({ cards, filter }: { cards: readonly GroupStanding[]; filter: ActivityFilter }) {
  const owed = filter === 'collect'
  return (
    <section className={styles.month} aria-labelledby="activity-in-groups">
      <SectionHeader
        id="activity-in-groups"
        title={owed ? 'Owed to you in groups' : 'You owe in groups'}
        description="Group costs settle up together."
      />
      <Card padding="none">
        <List>
          {cards.map(({ group, balance }) => {
            const amount = formatMoney(Math.abs(balance), group.currency, { trimZeros: true })
            const phrase = balance > 0 ? `You're owed ${amount}` : `You owe ${amount}`
            return (
              <ListRow
                key={group.id}
                leading={<GroupEmoji emoji={group.emoji} kind={group.kind} />}
                title={group.name}
                subtitle="Settle up"
                trailing={
                  <Money
                    value={balance}
                    currency={group.currency}
                    sign="always"
                    trimZeros
                    strong
                    tone={balance > 0 ? 'positive' : 'negative'}
                  />
                }
                chevron
                aria-label={`${group.name}: ${phrase}. Settle up`}
                onClick={() => navigate(`/app/groups/${encodeURIComponent(group.id)}/settle`)}
              />
            )
          })}
        </List>
      </Card>
    </section>
  )
}
