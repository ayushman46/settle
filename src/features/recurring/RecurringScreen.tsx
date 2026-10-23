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
import { t as translate, useT } from '../../i18n'
import { friendLabel } from '../../kit/index-a'
import { formatMoney } from '../../lib/money'
import { useHasFeature, usePro } from '../../pro'
import { openPaywall, withPro } from '../pro/paywall'
import { PaywallHost } from '../pro/PaywallSheet'
import { ProLock } from '../pro/ProLock'
import { RECURRING_PRESETS } from './presets'
import { dueBadgeLabel, dueLabel, monthName, nextLabel, ordinal, standingLine, templateStanding } from './recurringLabels'
import { useSplitNow } from './useSplitNow'
import styles from './RecurringScreen.module.css'

function editorPath(id: string): string {
  return `/app/recurring/${encodeURIComponent(id)}`
}

/**
 * `/app/recurring` (Pro) — rent, Wi-Fi, subscriptions: the ones due now (one tap to split), then
 * every recurring split with when it's next due. A pass that ran out pauses them, but nothing is
 * hidden or deleted.
 */
export function RecurringScreen() {
  const t = useT()
  const unlocked = useHasFeature('recurring')
  const pro = usePro()
  const templates = useRecurring()
  const day = today()
  const due = useDueRecurring(day)
  const { splitNow, moment } = useSplitNow()
  const startNew = (): void => withPro('recurring', () => navigate('/app/recurring/new'))

  const active = templates.filter((tpl) => tpl.active)
  const paused = templates.filter((tpl) => !tpl.active)

  return (
    <Screen header={<TopBar onBack={() => goBack('/app/you')} />} contentClassName={styles.content}>
      <PageTitle title={t('recurring.list.title')} subtitle={t('recurring.list.subtitle')} />

      {!unlocked && templates.length === 0 ? (
        <ProLock feature="recurring" preview={<RecurringSketch />} />
      ) : (
        <>
          {!unlocked && (
            <Banner
              tone="warning"
              title={t(pro.status === 'expired' ? 'recurring.pro.ended.title' : 'recurring.pro.locked.title')}
              action={{ label: t(pro.status === 'expired' ? 'recurring.pro.renew.cta' : 'recurring.pro.see.cta'), onAction: () => openPaywall('recurring') }}
            >
              {t('recurring.list.paused.body')}
            </Banner>
          )}

          {templates.length === 0 ? (
            <EmptyRecurring onNew={startNew} />
          ) : (
            <>
              {due.length > 0 && (
                <section className={styles.section} aria-labelledby="recurring-due">
                  <SectionHeader id="recurring-due" title={t('recurring.list.due.title')} />
                  <div className={styles.dueList}>
                    {due.map((item) => (
                      <DueCard key={item.template.id} due={item} today={day} onSplit={() => splitNow(item.template, item.period)} />
                    ))}
                  </div>
                </section>
              )}
              {active.length > 0 && (
                <section className={styles.section} aria-labelledby="recurring-all">
                  <SectionHeader id="recurring-all" title={t(due.length > 0 ? 'recurring.list.all.title' : 'recurring.list.yours.title')} />
                  <Card padding="none">
                    <List>
                      {active.map((tpl) => (
                        <TemplateRow key={tpl.id} template={tpl} today={day} due={due.find((d) => d.template.id === tpl.id) ?? null} />
                      ))}
                    </List>
                  </Card>
                </section>
              )}
              {paused.length > 0 && (
                <section className={styles.section} aria-labelledby="recurring-paused">
                  <SectionHeader id="recurring-paused" title={t('recurring.list.paused.title')} description={t('recurring.list.paused.description')} />
                  <Card padding="none">
                    <List>
                      {paused.map((tpl) => (
                        <TemplateRow key={tpl.id} template={tpl} today={day} due={null} />
                      ))}
                    </List>
                  </Card>
                </section>
              )}
            </>
          )}
          <Fab extended icon={<Plus strokeWidth={2.5} />} label={t('recurring.list.new.cta')} onClick={startNew} />
        </>
      )}
      {moment}
      <PaywallHost />
    </Screen>
  )
}

function DueCard({ due, today: day, onSplit }: { due: RecurringDue; today: string; onSplit: () => void }) {
  const t = useT()
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
          <p className={styles.dueMonth}>{month}</p>
        </div>
        <Money value={template.total} currency={template.currency} size="lg" strong trimZeros className={styles.dueAmount} />
      </div>
      <p className={styles.dueWhen}>
        <Badge tone={due.overdue ? 'negative' : 'warning'}>{dueLabel(due)}</Badge>
      </p>
      {line && <p className={styles.dueLine}>{line}</p>}
      <div className={styles.dueActions}>
        <Button variant="accent" size="md" onClick={onSplit} aria-label={t('recurring.list.due.split.aria', { title: template.title, month })}>
          {t('recurring.splitNow.cta')}
        </Button>
        <Button variant="ghost" size="md" onClick={() => navigate(editorPath(template.id))} aria-label={t('recurring.list.edit.aria', { title: template.title })}>
          {t('recurring.list.edit.cta')}
        </Button>
      </div>
    </article>
  )
}

function TemplateRow({ template, today: day, due }: { template: RecurringTemplate; today: string; due: RecurringDue | null }) {
  const t = useT()
  const amount = formatMoney(template.total, template.currency, { trimZeros: true })
  const status = !template.active ? (
    <Badge>{t('recurring.list.paused.badge')}</Badge>
  ) : due ? (
    <Badge tone={due.overdue ? 'negative' : 'warning'}>{dueBadgeLabel(due)}</Badge>
  ) : (
    <Badge>{nextLabel(template, day)}</Badge>
  )
  return (
    <ListRow
      leading={<CategoryIcon category={template.category} size="md" />}
      title={template.title}
      subtitle={t('recurring.list.row.subtitle', { amount, day: ordinal(template.dayOfMonth), count: template.participants.length })}
      trailing={status}
      onClick={() => navigate(editorPath(template.id))}
      chevron
    />
  )
}

function EmptyRecurring({ onNew }: { onNew: () => void }) {
  const t = useT()
  return (
    <div className={styles.empty}>
      <EmptyState
        icon={<Repeat />}
        title={t('recurring.list.empty.title')}
        text={t('recurring.list.empty.body')}
        action={
          <Button size="md" iconStart={<Plus />} onClick={onNew}>
            {t('recurring.list.new.cta')}
          </Button>
        }
      />
      <div className={styles.presets} role="group" aria-label={t('recurring.list.presets.aria')}>
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
function sketch(): ReadonlyArray<{ title: string; category: RecurringTemplate['category']; amount: number; when: string }> {
  return [
    { title: translate('recurring.preset.rent'), category: 'rent', amount: 3200000, when: translate('recurring.due.inDays', { count: 3 }) },
    { title: translate('recurring.preset.wifi'), category: 'utilities', amount: 117900, when: translate('recurring.next', { date: ordinal(5) }) },
    { title: translate('recurring.preset.netflix'), category: 'subscription', amount: 64900, when: translate('recurring.next', { date: ordinal(12) }) },
  ]
}

function RecurringSketch() {
  useT()
  return (
    <div className={styles.sketch}>
      {sketch().map((item) => (
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
