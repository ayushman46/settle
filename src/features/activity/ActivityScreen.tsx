import { memo, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type FocusEvent, type ReactNode } from 'react'
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
import { useT, type MessageKey } from '../../i18n'
import { ExpenseRow } from '../../kit/index-b'
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
import {
  initialRange,
  nextRange,
  noteRowHeights,
  requestWindowCheck,
  rowHeight,
  rowOffsets,
  watchViewport,
  type Range,
} from './rowWindow'
import { FIRST_SCREEN_ROWS, rememberActivityView, rememberedActivityView, type ActivityView } from './viewMemory'
import styles from './ActivityScreen.module.css'

const NEW_SPLIT = '/app/split/new'

function expensePath(id: string): string {
  return `/app/expense/${encodeURIComponent(id)}`
}

/** The view to open on: `?filter=collect` (a link from elsewhere) wins; else where you left off. */
function initialView(filterParam: string | null): ActivityView {
  if (isActivityFilter(filterParam)) return { filter: filterParam, query: '' }
  return rememberedActivityView()
}

/** Where each month starts in the whole list (row index). */
function firstRowOf(sections: readonly MonthSection[]): number[] {
  const firsts: number[] = []
  let first = 0
  for (const section of sections) {
    firsts.push(first)
    first += section.expenses.length
  }
  return firsts
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
  const t = useT()
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
    if (isActivityFilter(filterParam)) setView({ filter: filterParam, query: '' })
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
  // Every month of the history is laid out — rows near the screen rendered, the rest blank space
  // of the same height — so any part of it is one small render away (see MonthList).
  const sections = useMemo(() => groupByMonth(matches, day), [matches, day])
  const firstRows = useMemo(() => firstRowOf(sections), [sections])
  const groupCards = useMemo(() => {
    const list = view.filter === 'collect' ? owedIn : view.filter === 'pay' ? oweIn : []
    return list.filter((s) => groupMatches(s.group, query))
  }, [view.filter, owedIn, oweIn, query])

  const update = (patch: Partial<ActivityView>): void => setView((prev) => ({ ...prev, ...patch }))

  const nothing = matches.length === 0 && groupCards.length === 0
  // Only groups to show: their section header says it all, so the line is for screen readers.
  const onlyGroups = matches.length === 0 && groupCards.length > 0
  const line = onlyGroups
    ? t(view.filter === 'collect' ? 'activity.results.owedInGroups' : 'activity.results.oweInGroups', { count: groupCards.length })
    : resultsLine({ filter: view.filter, query, matches, groups, currency })

  return (
    <Screen contentClassName={styles.content}>
      <PageTitle title={t('activity.title')} />

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
            sections.map((section, i) => (
              <MonthList
                key={section.period}
                period={section.period}
                label={section.label}
                expenses={section.expenses}
                first={firstRows[i] ?? 0}
                day={day}
              />
            ))
          )}
        </>
      )}

      <Fab extended icon={<Plus strokeWidth={2.5} />} label={t('activity.newSplit.cta')} onClick={() => navigate(NEW_SPLIT)} />
    </Screen>
  )
}

interface MonthListProps extends MonthSection {
  /** This month's first row in the whole list (the first screen renders the list's first rows). */
  first: number
  day: string
}

/** Which rows of a month are in the DOM: a window near the screen, plus a focused row outside it. */
interface RowWindow {
  range: Range
  /** A row with focus that has scrolled out of `range`, kept rendered so focus isn't lost. */
  keep: string | null
}

/** A run of rows not in the DOM: blank space of their height, hidden from assistive tech. */
function Gap({ height }: { height: number }) {
  return <li aria-hidden="true" data-gap="" className={styles.gap} style={{ height }} />
}

/**
 * One month of the list, windowed: its heading and card are always there (headings still lead
 * through the whole history and the page has its full height, so Back lands where you were),
 * but only rows near the screen are in the DOM; the rest are blank space of their measured (or
 * typical) height. A focused row stays rendered wherever it scrolls, and tabbing or reading on
 * scrolls the next rows into the window. Memoised on its rows (the same expenses, in order).
 */
const MonthList = memo(
  function MonthList({ period, label, expenses, first, day }: MonthListProps) {
    const list = useRef<HTMLUListElement>(null)
    const [win, setWin] = useState<RowWindow>(() => ({
      range: initialRange(first, expenses.length, FIRST_SCREEN_ROWS),
      keep: null,
    }))
    // Rows that join after the first screen skip the entrance animation (it is for the first screenful).
    const [calm, setCalm] = useState(false)
    const focused = useRef<string | null>(null)
    const latest = useRef({ expenses, win })
    useLayoutEffect(() => {
      latest.current = { expenses, win }
    })

    // Follows the page's scroll: moves the window when the rows near the screen change.
    useEffect(() => {
      const check = (): void => {
        const ul = list.current
        if (!ul) return
        const { expenses: rows, win: current } = latest.current
        const offsets = rowOffsets(rows.map((e) => rowHeight(e.id)))
        const range = nextRange(current.range, offsets, ul.getBoundingClientRect().top, window.innerHeight)
        const at = focused.current === null ? -1 : rows.findIndex((e) => e.id === focused.current)
        const keep = at !== -1 && (at < range[0] || at >= range[1]) ? focused.current : null
        if (range === current.range && keep === current.keep) return
        setWin({ range, keep })
        if (range !== current.range) setCalm(true)
      }
      const stop = watchViewport(check)
      requestWindowCheck()
      return stop
    }, [])

    // The rows in the DOM, in order, with blank space for the runs between them.
    // (Clamped: the month may have just lost rows to a filter; the next check moves the window.)
    const range: Range = [Math.min(win.range[0], expenses.length), Math.min(win.range[1], expenses.length)]
    const keepAt = win.keep === null ? -1 : expenses.findIndex((e) => e.id === win.keep)
    const segments: Range[] = [range]
    if (keepAt !== -1 && (keepAt < range[0] || keepAt >= range[1])) {
      segments.push([keepAt, keepAt + 1])
      segments.sort((a, b) => a[0] - b[0])
    }
    const shown: Expense[] = []
    const parts: ReactNode[] = []
    let cursor = 0
    for (const [start, end] of segments) {
      if (start >= end) continue
      if (start > cursor) parts.push(<Gap key={`gap-${cursor}`} height={gapHeight(expenses, cursor, start)} />)
      for (let i = start; i < end; i += 1) {
        const e = expenses[i]
        if (!e) continue
        shown.push(e)
        parts.push(<ActivityRow key={e.id} expense={e} day={day} />)
      }
      cursor = end
    }
    if (cursor < expenses.length) parts.push(<Gap key={`gap-${cursor}`} height={gapHeight(expenses, cursor, expenses.length)} />)

    // After each render: measure the rows now in the DOM, and have every month re-check what's
    // near the screen (a change in height here moves the months below).
    useLayoutEffect(() => {
      const ul = list.current
      if (!ul) return
      const heights: [string, number][] = []
      let index = 0
      for (const child of ul.children) {
        if (child.hasAttribute('data-gap')) continue
        const id = shown[index]?.id
        index += 1
        if (id !== undefined) heights.push([id, (child as HTMLElement).offsetHeight])
      }
      noteRowHeights(document.documentElement.clientWidth, heights)
      requestWindowCheck()
    })

    /** Remembers which row has focus (by the row's place among the rows in the DOM). */
    const onFocus = (event: FocusEvent<HTMLUListElement>): void => {
      const row = event.target instanceof Element ? event.target.closest('li') : null
      const ul = list.current
      if (!row || !ul) return
      let index = 0
      for (const child of ul.children) {
        if (child === row) break
        if (!child.hasAttribute('data-gap')) index += 1
      }
      focused.current = shown[index]?.id ?? null
    }
    const onBlur = (event: FocusEvent<HTMLUListElement>): void => {
      const next = event.relatedTarget
      if (!(next instanceof Node) || !list.current?.contains(next)) focused.current = null
    }

    return (
      <section className={styles.month} aria-labelledby={`activity-${period}`}>
        <h2 id={`activity-${period}`} className={styles.monthTitle}>
          {label}
        </h2>
        <Card padding="none">
          <List ref={list} className={calm ? styles.calm : undefined} onFocus={onFocus} onBlur={onBlur}>
            {parts}
          </List>
        </Card>
      </section>
    )
  },
  (a, b) =>
    a.period === b.period && a.label === b.label && a.first === b.first && a.day === b.day && shallowArrayEqual(a.expenses, b.expenses),
)

/** The height of rows `from` to `to - 1` (measured, else typical). */
function gapHeight(expenses: readonly Expense[], from: number, to: number): number {
  let height = 0
  for (let i = from; i < to; i += 1) {
    const e = expenses[i]
    if (e) height += rowHeight(e.id)
  }
  return height
}

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
  const t = useT()
  return (
    <EmptyState
      illustration={<Illustration name="empty-activity" />}
      title={t('activity.firstRun.title')}
      text={t('activity.firstRun.body')}
      action={
        <>
          <Button size="md" iconStart={<Plus />} onClick={() => navigate(NEW_SPLIT)}>
            {t('activity.firstRun.split.cta')}
          </Button>
          <Button size="md" variant="secondary" iconStart={<ScanLine />} onClick={() => navigate(BILL_PATH)}>
            {t('activity.firstRun.scan.cta')}
          </Button>
        </>
      }
    />
  )
}

const EMPTY_FILTER: Readonly<Record<ActivityFilter, { title: MessageKey; text: MessageKey }>> = {
  all: { title: 'activity.empty.all.title', text: 'activity.empty.all.body' },
  collect: { title: 'activity.empty.collect.title', text: 'activity.empty.collect.body' },
  pay: { title: 'activity.empty.pay.title', text: 'activity.empty.pay.body' },
  bills: { title: 'activity.empty.bills.title', text: 'activity.empty.bills.body' },
  groups: { title: 'activity.empty.groups.title', text: 'activity.empty.groups.body' },
  settled: { title: 'activity.empty.settled.title', text: 'activity.empty.settled.body' },
}

function NoMatches({ filter, query, onShowAll }: { filter: ActivityFilter; query: string; onShowAll: () => void }) {
  const t = useT()
  const q = query.trim()
  if (q) {
    return (
      <EmptyState
        size="sm"
        title={t('activity.noMatches.title', { query: q })}
        text={t('activity.noMatches.body')}
        action={
          <Button size="md" variant="secondary" onClick={onShowAll}>
            {t('activity.noMatches.cta')}
          </Button>
        }
      />
    )
  }
  const copy = EMPTY_FILTER[filter]
  const action =
    filter === 'bills' ? (
      <Button size="md" variant="secondary" iconStart={<ScanLine />} onClick={() => navigate(BILL_PATH)}>
        {t('activity.empty.scan.cta')}
      </Button>
    ) : filter === 'groups' ? (
      <Button size="md" variant="secondary" onClick={() => navigate('/app/groups')}>
        {t('activity.empty.groups.cta')}
      </Button>
    ) : undefined
  return <EmptyState size="sm" title={t(copy.title)} text={t(copy.text, { brand: BRAND.name })} action={action} />
}

/** Groups that aren't square: their costs settle together, so they're settled from the group. */
function GroupCards({ cards, filter }: { cards: readonly GroupStanding[]; filter: ActivityFilter }) {
  const t = useT()
  const owed = filter === 'collect'
  return (
    <section className={styles.month} aria-labelledby="activity-in-groups">
      <SectionHeader
        id="activity-in-groups"
        title={t(owed ? 'activity.groups.owed.title' : 'activity.groups.owe.title')}
        description={t('activity.groups.description')}
      />
      <Card padding="none">
        <List>
          {cards.map(({ group, balance }) => {
            const amount = formatMoney(Math.abs(balance), group.currency, { trimZeros: true })
            return (
              <ListRow
                key={group.id}
                leading={<GroupEmoji emoji={group.emoji} kind={group.kind} />}
                title={group.name}
                subtitle={t('activity.groups.row.subtitle')}
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
                aria-label={t(balance > 0 ? 'activity.groups.row.owed.aria' : 'activity.groups.row.owe.aria', { group: group.name, amount })}
                onClick={() => navigate(`/app/groups/${encodeURIComponent(group.id)}/settle`)}
              />
            )
          })}
        </List>
      </Card>
    </section>
  )
}
