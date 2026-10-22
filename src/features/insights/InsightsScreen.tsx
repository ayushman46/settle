import { useMemo, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { goBack, navigate } from '../../app/router'
import {
  BarChart,
  Button,
  Card,
  categoryColor,
  DonutChart,
  EmptyState,
  Illustration,
  List,
  ListRow,
  Money,
  PageTitle,
  Screen,
  SectionHeader,
  TopBar,
} from '../../components'
import { useExpenses, useFriendsById, useProfile } from '../../data'
import { ME_ID, type CategoryId, type Expense } from '../../domain/types'
import { CATEGORY_META } from '../../engine/categories'
import { today } from '../../engine/dates'
import { FriendAvatar, friendLabel } from '../../kit/index-a'
import { formatMoney } from '../../lib/money'
import { useHasFeature } from '../../pro'
import { ProLock } from '../pro/ProLock'
import { initialRange, insightsView, longMonth, MAX_MONTH_BARS, RANGE_OPTIONS, shortMonth, type InsightsView } from './insightsView'
import { RangeChips } from './RangeChips'
import { useCountUp } from './useCountUp'
import styles from './InsightsScreen.module.css'

/**
 * `/app/insights` (Pro) — where my money goes: what I spent (my share, never the whole bills I
 * fronted) for a range, by category, by month and by the people I split with. Worked out on the
 * phone. Free users see a softly blurred sketch behind an honest unlock card.
 */
export function InsightsScreen() {
  const unlocked = useHasFeature('insights')
  return (
    <Screen header={<TopBar onBack={() => goBack('/app/you')} />}>
      <PageTitle title="Insights" subtitle="Where your money goes" />
      {unlocked ? <InsightsBody /> : <LockedInsights />}
    </Screen>
  )
}

function InsightsBody() {
  const expenses = useExpenses()
  const { currency } = useProfile()
  const day = today()
  const [range, setRange] = useState(() => initialRange(expenses, { meId: ME_ID, currency, today: day }))
  const view = useMemo(() => insightsView(expenses, { meId: ME_ID, currency, range, today: day }), [expenses, currency, range, day])
  const option = RANGE_OPTIONS.find((o) => o.value === range) ?? RANGE_OPTIONS[0]!
  const hasAny = expenses.length > 0

  return (
    <>
      <RangeChips label="Time range" options={RANGE_OPTIONS} value={range} onChange={setRange} />
      {view.count === 0 || view.spent === 0 ? (
        <EmptyState
          illustration={<Illustration name="empty-insights" />}
          title={hasAny ? `Nothing ${option.phrase} yet` : 'Your insights start with your first split'}
          text={
            hasAny
              ? 'Splits you’re part of in this range will show up here. Try a longer range.'
              : 'Every split you’re part of shows up here — by category, month and friend.'
          }
          action={
            <Button size="md" onClick={() => navigate('/app/split/new')}>
              Split an expense
            </Button>
          }
        />
      ) : (
        <>
          <SpentCard view={view} currency={currency} phrase={option.phrase} />
          <CategorySection view={view} currency={currency} />
          {view.months.length > 1 && <MonthSection view={view} currency={currency} />}
          {view.people.length > 0 && <PeopleSection view={view} currency={currency} />}
        </>
      )}
      {view.otherCurrencyCount > 0 && (
        <p className={styles.footnote}>
          {view.otherCurrencyCount === 1
            ? `1 expense in another currency isn't counted here — amounts are never converted.`
            : `${view.otherCurrencyCount} expenses in other currencies aren't counted here — amounts are never converted.`}
        </p>
      )}
      <p className={styles.private}>
        <ShieldCheck aria-hidden="true" />
        Worked out on this phone — nothing is uploaded.
      </p>
    </>
  )
}

function money(currency: string): (value: number) => string {
  return (value) => formatMoney(value, currency, { trimZeros: true })
}

function categoryLabel(category: CategoryId): string {
  return CATEGORY_META[category].label
}

function SpentCard({ view, currency, phrase }: { view: InsightsView; currency: string; phrase: string }) {
  const shown = useCountUp(view.spent)
  const label = `You spent ${phrase}`
  return (
    <section className={styles.spent} aria-labelledby="insights-spent">
      <h2 id="insights-spent" className={styles.spentLabel}>
        {label}
      </h2>
      <div className={styles.spentAmount}>
        <span aria-hidden="true">
          <Money value={shown} fitValue={view.spent} currency={currency} size="xl" trimZeros />
        </span>
        <span className="visually-hidden">{formatMoney(view.spent, currency, { trimZeros: true })}</span>
      </div>
      <p className={styles.spentNote}>
        Your share across {view.count} {view.count === 1 ? 'expense' : 'expenses'}
        {view.top && ` · ${view.top.percent}% on ${categoryLabel(view.top.category)}`}
      </p>
      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>You paid up front</dt>
          <dd>{formatMoney(view.paidOut, currency, { trimZeros: true })}</dd>
        </div>
        {view.perMonth !== null && (
          <div className={styles.stat}>
            <dt>About a month</dt>
            <dd>{formatMoney(view.perMonth, currency, { trimZeros: true })}</dd>
          </div>
        )}
      </dl>
    </section>
  )
}

function CategorySection({ view, currency }: { view: InsightsView; currency: string }) {
  const format = money(currency)
  return (
    <section className={styles.section} aria-labelledby="insights-categories">
      <SectionHeader id="insights-categories" title="By category" />
      <Card padding="lg" className={styles.chartCard}>
        <DonutChart
          data={view.byCategory.map((c) => ({
            key: c.category,
            value: c.amount,
            color: categoryColor(c.category),
            label: categoryLabel(c.category),
          }))}
          centerLabel="Spent"
          centerValue={format(view.spent)}
          formatValue={format}
          ariaLabel="Spending by category"
          legend
        />
      </Card>
    </section>
  )
}

function MonthSection({ view, currency }: { view: InsightsView; currency: string }) {
  return (
    <section className={styles.section} aria-labelledby="insights-months">
      <SectionHeader
        id="insights-months"
        title="By month"
        description={view.byMonth.length > MAX_MONTH_BARS ? `The last ${MAX_MONTH_BARS} months` : undefined}
      />
      <Card padding="lg" className={styles.chartCard}>
        <BarChart
          data={view.months.map((m) => ({ key: m.month, label: shortMonth(m.month), longLabel: longMonth(m.month), value: m.amount }))}
          formatValue={money(currency)}
          ariaLabel="Spending by month"
          labelHeader="Month"
        />
      </Card>
    </section>
  )
}

function PeopleSection({ view, currency }: { view: InsightsView; currency: string }) {
  const friendsById = useFriendsById()
  return (
    <section className={styles.section} aria-labelledby="insights-people">
      <SectionHeader id="insights-people" title="Who you split with" description="Your share of what you split with each person" />
      <Card padding="none">
        <List>
          {view.people.map((p) => {
            const friend = friendsById[p.friendId] ?? null
            return (
              <ListRow
                key={p.friendId}
                leading={<FriendAvatar friend={friend} friendId={p.friendId} size="md" />}
                title={friendLabel(p.friendId, friend)}
                subtitle={`${p.count} shared ${p.count === 1 ? 'expense' : 'expenses'}`}
                trailing={<Money value={p.amount} currency={currency} trimZeros strong />}
                onClick={friend ? () => navigate(`/app/friends/${encodeURIComponent(p.friendId)}`) : undefined}
                chevron
              />
            )
          })}
        </List>
      </Card>
    </section>
  )
}

/* ------------------------------------------------------------------ locked (free) */

/** Illustrative numbers for the blurred sketch behind the lock — never the person's data. */
const SAMPLE_CATEGORIES: ReadonlyArray<[CategoryId, number]> = [
  ['food', 4200],
  ['rent', 3000],
  ['transport', 1200],
  ['entertainment', 1000],
  ['other', 600],
]
const SAMPLE_MONTHS: readonly number[] = [52, 64, 48, 71, 58, 83]

function InsightsSketch() {
  return (
    <div className={styles.sketch}>
      <Card padding="lg" className={styles.chartCard}>
        <DonutChart
          data={SAMPLE_CATEGORIES.map(([category, value]) => ({
            key: category,
            value,
            color: categoryColor(category),
            label: categoryLabel(category),
          }))}
          ariaLabel="Sample"
        />
      </Card>
      <Card padding="lg" className={styles.chartCard}>
        <BarChart
          data={SAMPLE_MONTHS.map((value, i) => ({ key: String(i), label: '', value }))}
          formatValue={String}
          ariaLabel="Sample"
        />
      </Card>
    </div>
  )
}

function involvesMe(e: Expense): boolean {
  return e.payerId === ME_ID || (e.shares[ME_ID] ?? 0) > 0
}

function LockedInsights() {
  const expenses = useExpenses()
  const count = expenses.filter(involvesMe).length
  return (
    <ProLock
      feature="insights"
      preview={<InsightsSketch />}
      note={count > 0 ? `You've split ${count} ${count === 1 ? 'expense' : 'expenses'} so far — see where it all went.` : undefined}
    />
  )
}
