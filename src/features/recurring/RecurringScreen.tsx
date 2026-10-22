import { Plus, Repeat } from 'lucide-react'
import { goBack, navigate } from '../../app/router'
import {
  Badge,
  Banner,
  Button,
  Card,
  CategoryIcon,
  Chip,
  EmptyState,
  Fab,
  List,
  ListRow,
  Money,
  PageTitle,
  Screen,
  SectionHeader,
  TopBar,
} from '../../components'
import { useDueRecurring, useFriendsById, useRecurring } from '../../data'
import type { RecurringTemplate } from '../../domain/types'
import { today } from '../../engine/dates'
import type { RecurringDue } from '../../engine/recurring'
import { friendLabel } from '../../kit/index-a'
import { formatMoney } from '../../lib/money'
import { useHasFeature, usePro } from '../../pro'
import { openPaywall, withPro } from '../pro/paywall'
import { PaywallHost } from '../pro/PaywallSheet'
import { ProLock } from '../pro/ProLock'
import { RECURRING_PRESETS } from './presets'
import { dueLabel, monthName, nextLabel, repeatsLabel, standingLine, templateStanding } from './recurringLabels'
import { useSplitNow } from './useSplitNow'
import styles from './RecurringScreen.module.css'

function editorPath(id: string): string {
  return `/app/recurring/${encodeURIComponent(id)}`
}

function peopleCount(template: RecurringTemplate): string {
  const n = template.participants.length
  return `${n} ${n === 1 ? 'person' : 'people'}`
}

/**
 * `/app/recurring` (Pro) — rent, Wi-Fi, subscriptions: the ones due now (one tap to split), then
 * every recurring split with when it's next due. A pass that ran out pauses them, but nothing is
 * hidden or deleted.
 */
export function RecurringScreen() {
  const unlocked = useHasFeature('recurring')
  const pro = usePro()
  const templates = useRecurring()
  const day = today()
  const due = useDueRecurring(day)
  const { splitNow, moment } = useSplitNow()
  const startNew = (): void => withPro('recurring', () => navigate('/app/recurring/new'))

  const active = templates.filter((t) => t.active)
  const paused = templates.filter((t) => !t.active)

  return (
    <Screen header={<TopBar onBack={() => goBack('/app/you')} />} contentClassName={styles.content}>
      <PageTitle title="Recurring splits" subtitle="Rent, Wi-Fi, subscriptions — set them once, split them each month." />

      {!unlocked && templates.length === 0 ? (
        <ProLock feature="recurring" preview={<RecurringSketch />} />
      ) : (
        <>
          {!unlocked && (
            <Banner
              tone="warning"
              title={pro.status === 'expired' ? 'Your Pro pass has ended' : 'Recurring splits are part of Pro'}
              action={{ label: pro.status === 'expired' ? 'Renew Pro' : 'See Pro', onAction: () => openPaywall('recurring') }}
            >
              They're paused for now — all still here, nothing deleted. Edit them any time; splitting them needs Pro.
            </Banner>
          )}

          {templates.length === 0 ? (
            <EmptyRecurring onNew={startNew} />
          ) : (
            <>
              {due.length > 0 && (
                <section className={styles.section} aria-labelledby="recurring-due">
                  <SectionHeader id="recurring-due" title="Due now" />
                  <div className={styles.dueList}>
                    {due.map((item) => (
                      <DueCard key={item.template.id} due={item} today={day} onSplit={() => splitNow(item.template, item.period)} />
                    ))}
                  </div>
                </section>
              )}
              {active.length > 0 && (
                <section className={styles.section} aria-labelledby="recurring-all">
                  <SectionHeader id="recurring-all" title={due.length > 0 ? 'All recurring splits' : 'Your recurring splits'} />
                  <Card padding="none">
                    <List>
                      {active.map((t) => (
                        <TemplateRow key={t.id} template={t} today={day} due={due.find((d) => d.template.id === t.id) ?? null} />
                      ))}
                    </List>
                  </Card>
                </section>
              )}
              {paused.length > 0 && (
                <section className={styles.section} aria-labelledby="recurring-paused">
                  <SectionHeader id="recurring-paused" title="Paused" description="No reminders until you switch them back on." />
                  <Card padding="none">
                    <List>
                      {paused.map((t) => (
                        <TemplateRow key={t.id} template={t} today={day} due={null} />
                      ))}
                    </List>
                  </Card>
                </section>
              )}
            </>
          )}
          <Fab extended icon={<Plus strokeWidth={2.5} />} label="New recurring split" onClick={startNew} />
        </>
      )}
      {moment}
      <PaywallHost />
    </Screen>
  )
}

function DueCard({ due, today: day, onSplit }: { due: RecurringDue; today: string; onSplit: () => void }) {
  const { template, period } = due
  const friendsById = useFriendsById()
  const payerName = friendLabel(template.payerId, friendsById[template.payerId] ?? null)
  const line = standingLine(templateStanding(template), template.currency, payerName)
  const month = monthName(period, day)
  const titleId = `due-${template.id}`
  return (
    <article className={styles.dueCard} aria-labelledby={titleId}>
      <div className={styles.dueTop}>
        <CategoryIcon category={template.category} size="md" />
        <div className={styles.dueText}>
          <h3 id={titleId} className={styles.dueTitle}>
            {template.title}
          </h3>
          <p className={styles.dueWhen}>
            <Badge tone={due.overdue ? 'negative' : 'warning'}>{dueLabel(due)}</Badge>
            <span>{month}</span>
          </p>
        </div>
        <Money value={template.total} currency={template.currency} size="lg" strong trimZeros className={styles.dueAmount} />
      </div>
      {line && <p className={styles.dueLine}>{line}</p>}
      <div className={styles.dueActions}>
        <Button variant="accent" size="md" onClick={onSplit} aria-label={`Split ${template.title} for ${month} now`}>
          Split now
        </Button>
        <Button variant="ghost" size="md" onClick={() => navigate(editorPath(template.id))} aria-label={`Edit ${template.title}`}>
          Edit
        </Button>
      </div>
    </article>
  )
}

function TemplateRow({ template, today: day, due }: { template: RecurringTemplate; today: string; due: RecurringDue | null }) {
  const amount = formatMoney(template.total, template.currency, { trimZeros: true })
  const status = !template.active ? (
    <Badge>Paused</Badge>
  ) : due ? (
    <Badge tone={due.overdue ? 'negative' : 'warning'}>{dueLabel(due)}</Badge>
  ) : (
    <Badge>{nextLabel(template, day)}</Badge>
  )
  return (
    <ListRow
      leading={<CategoryIcon category={template.category} size="md" />}
      title={template.title}
      subtitle={`${amount} · ${repeatsLabel(template.dayOfMonth).toLowerCase()} · ${peopleCount(template)}`}
      trailing={status}
      onClick={() => navigate(editorPath(template.id))}
      chevron
    />
  )
}

function EmptyRecurring({ onNew }: { onNew: () => void }) {
  return (
    <div className={styles.empty}>
      <EmptyState
        icon={<Repeat />}
        title="Set it once, split it every month"
        text="Settle reminds you when each one is due, and splits it in one tap."
        action={
          <Button size="md" iconStart={<Plus />} onClick={onNew}>
            New recurring split
          </Button>
        }
      />
      <div className={styles.presets} role="group" aria-label="Quick start">
        {RECURRING_PRESETS.map((preset) => (
          <Chip
            key={preset.id}
            leading={<CategoryIcon category={preset.category} size="sm" />}
            onClick={() => withPro('recurring', () => navigate(`/app/recurring/new?preset=${preset.id}`))}
          >
            {preset.title}
          </Chip>
        ))}
      </div>
    </div>
  )
}

/** Illustrative cards for the blurred sketch behind the lock — never the person's data. */
const SKETCH: ReadonlyArray<{ title: string; category: RecurringTemplate['category']; amount: number; when: string }> = [
  { title: 'Rent', category: 'rent', amount: 3200000, when: 'Due in 3 days' },
  { title: 'Wi-Fi', category: 'utilities', amount: 117900, when: 'Next: 5th' },
  { title: 'Netflix', category: 'subscription', amount: 64900, when: 'Next: 12th' },
]

function RecurringSketch() {
  return (
    <div className={styles.sketch}>
      {SKETCH.map((item) => (
        <div key={item.title} className={styles.sketchRow}>
          <CategoryIcon category={item.category} size="md" />
          <span className={styles.sketchText}>
            <span className={styles.sketchTitle}>{item.title}</span>
            <span className={styles.sketchWhen}>{item.when}</span>
          </span>
          <Money value={item.amount} currency="INR" trimZeros strong />
        </div>
      ))}
    </div>
  )
}
