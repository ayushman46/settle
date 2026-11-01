import { useId, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, ClipboardPaste, Landmark, Plus, Scale } from 'lucide-react'
import { goBack, navigate } from '../../app/router'
import { Button, Card, EmptyState, IconButton, Money, PageTitle, Screen, TopBar, useToast } from '../../components'
import { useStore } from '../../data'
import { stuckStore, type StuckPayment } from '../../data/stores'
import { confirmStuck, dismissStuck } from '../../data/stuck'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { useCountUp } from '../../kit/motion'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { STUCK_NEW_PATH, stuckPath } from './paths'
import { summarize, type StuckSummary } from './rules'
import { StuckAlertsCard } from './StuckAlertsCard'
import { KindIcon } from './StuckParts'
import { StuckPasteSheet } from './StuckPasteSheet'
import { groupStuck, inr, partyName, statusLine, type StuckEntry, type StuckSection } from './view'
import styles from './Stuck.module.css'

/**
 * `/app/stuck` — "Stuck money": what banks and shops owe you (payments that failed but took the
 * money, refunds that haven't come), with what the wait has earned you under the RBI's rules and
 * what you've got back. What needs you comes first — a failed payment to check is a Yes or a No
 * right in its row — then what's on its way, what came back, and what was set aside. Add one, or
 * paste the bank's SMS and Settle fills it in.
 */
export function StuckScreen() {
  const t = useT()
  const list = useStore(stuckStore, (all) => all)
  const day = todayIso()
  const summary = useMemo(() => summarize(list, day), [list, day])
  const groups = useMemo(() => groupStuck(list, day), [list, day])
  const [pasting, setPasting] = useState(false)

  const header = (
    <TopBar
      onBack={() => goBack('/app')}
      right={
        <IconButton label={t('stuck.add.aria')} onClick={() => navigate(STUCK_NEW_PATH)}>
          <Plus />
        </IconButton>
      }
    />
  )

  if (list.length === 0) {
    return (
      <Screen header={header} contentClassName={styles.content}>
        <PageTitle title={t('stuck.title')} />
        <EmptyState
          icon={<Landmark />}
          title={t('stuck.empty.title')}
          text={t('stuck.empty.text')}
          action={
            <div className={styles.emptyActions}>
              <Button block iconStart={<Plus />} onClick={() => navigate(STUCK_NEW_PATH)}>
                {t('stuck.empty.add')}
              </Button>
              <Button block variant="secondary" iconStart={<ClipboardPaste />} onClick={() => setPasting(true)}>
                {t('stuck.empty.paste')}
              </Button>
            </div>
          }
        />
        <RuleNote />
        <StuckAlertsCard />
        <StuckPasteSheet open={pasting} onClose={() => setPasting(false)} />
      </Screen>
    )
  }

  return (
    <Screen header={header} contentClassName={styles.content}>
      <PageTitle title={t('stuck.title')} />
      <SummaryHero summary={summary} />
      <div className={styles.listActions}>
        <Button size="md" iconStart={<Plus />} onClick={() => navigate(STUCK_NEW_PATH)}>
          {t('stuck.list.add')}
        </Button>
        <Button size="md" variant="secondary" iconStart={<ClipboardPaste />} onClick={() => setPasting(true)}>
          {t('stuck.list.paste')}
        </Button>
      </div>
      <StuckAlertsCard />
      <Section section="needs" entries={groups.needs} day={day} />
      <Section section="onway" entries={groups.onway} day={day} />
      <Section section="back" entries={groups.back} day={day} />
      <Section section="aside" entries={groups.aside} day={day} collapsible />
      <StuckPasteSheet open={pasting} onClose={() => setPasting(false)} />
    </Screen>
  )
}

/** The rule, in one line: "Banks must put a failed UPI payment to a person back the next day…". */
function RuleNote() {
  const t = useT()
  return (
    <p className={styles.rule}>
      <Scale aria-hidden="true" className={styles.ruleIcon} />
      <span>{t('stuck.rule')}</span>
    </p>
  )
}

/** The hero: what banks and shops owe you, what the wait has earned, and what came back. */
function SummaryHero({ summary }: { summary: StuckSummary }) {
  const t = useT()
  const headingId = useId()
  const owedOnly = summary.stuck === 0 && summary.compensation > 0
  const headline = owedOnly ? summary.compensation : summary.stuck
  const shown = useCountUp(headline, { step: 100 })
  const counting = shown !== headline
  const calm = headline === 0
  const extra = summary.compensation > 0 && !owedOnly

  return (
    <section aria-labelledby={headingId} className={styles.hero}>
      <h2 id={headingId} className="visually-hidden">
        {t('stuck.summary.heading')}
      </h2>
      {calm ? (
        <p className={styles.heroCalm}>{t('stuck.summary.calm')}</p>
      ) : (
        <div className={styles.heroTop}>
          <p className={styles.heroLabel}>{owedOnly ? t('stuck.summary.labelWait') : t('stuck.summary.label')}</p>
          {counting && <span className="visually-hidden">{inr(headline)}</span>}
          <div aria-hidden={counting || undefined}>
            <Money value={shown} fitValue={headline} currency="INR" size="xl" trimZeros className={styles.heroAmount} />
          </div>
        </div>
      )}
      {(extra || summary.recovered > 0) && (
        <dl className={styles.heroTotals}>
          {extra && (
            <div className={styles.heroTotal}>
              <dt className={styles.heroTotalLabel}>{t('stuck.summary.wait')}</dt>
              <dd className={cx(styles.heroTotalValue, styles.heroAccent)}>{t('stuck.summary.plus', { amount: inr(summary.compensation) })}</dd>
            </div>
          )}
          {summary.recovered > 0 && (
            <div className={styles.heroTotal}>
              <dt className={styles.heroTotalLabel}>{t('stuck.summary.recovered')}</dt>
              <dd className={styles.heroTotalValue}>{inr(summary.recovered)}</dd>
            </div>
          )}
        </dl>
      )}
      {summary.act > 0 && (
        <p className={styles.heroFoot}>
          <span className={styles.heroDot} aria-hidden="true" />
          {t('stuck.summary.act', { count: summary.act })}
        </p>
      )}
    </section>
  )
}

const SECTION_TITLES = {
  needs: 'stuck.section.needs',
  onway: 'stuck.section.onway',
  back: 'stuck.section.back',
  aside: 'stuck.section.aside',
} as const

function Section({ section, entries, day, collapsible = false }: { section: StuckSection; entries: StuckEntry[]; day: string; collapsible?: boolean }) {
  const t = useT()
  const id = useId()
  const [open, setOpen] = useState(!collapsible)
  if (entries.length === 0) return null
  const title: ReactNode = (
    <>
      {t(SECTION_TITLES[section])}{' '}
      <span className={styles.sectionCount}>{entries.length}</span>
    </>
  )
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id} className={styles.sectionTitle}>
        {collapsible ? (
          <button type="button" className={styles.sectionToggle} aria-expanded={open} aria-controls={`${id}-body`} onClick={() => setOpen((o) => !o)}>
            <span>{title}</span>
            <ChevronDown aria-hidden="true" className={open ? styles.chevronOpen : styles.chevron} />
          </button>
        ) : (
          title
        )}
      </h2>
      <div id={`${id}-body`} hidden={!open}>
        <Card padding="none">
          <ul role="list" className={styles.list}>
            {entries.map((entry) => (
              <Row key={entry.payment.id} entry={entry} section={section} day={day} />
            ))}
          </ul>
        </Card>
      </div>
    </section>
  )
}

function Row({ entry, section, day }: { entry: StuckEntry; section: StuckSection; day: string }) {
  const id = useId()
  const t = useT()
  const toast = useToast()
  const { payment: s, next } = entry
  const name = partyName(s)
  const line = statusLine(s, next, day)
  const urgent = next.stage === 'overdue' || next.stage === 'escalate' || next.stage === 'compensation'

  const yes = (p: StuckPayment): void => {
    const undo = confirmStuck(p.id)
    haptic('success')
    toast(t('stuck.check.yes.toast'), { tone: 'success', action: undo ? { label: t('common.action.undo'), onAction: undo } : undefined })
  }
  const no = (p: StuckPayment): void => {
    const undo = dismissStuck(p.id)
    haptic('tap')
    toast(t('stuck.check.no.toast'), { action: undo ? { label: t('common.action.undo'), onAction: undo } : undefined })
  }

  return (
    <li className={styles.row}>
      <button type="button" className={styles.rowMain} onClick={() => navigate(stuckPath(s.id))}>
        <KindIcon kind={s.kind} section={section} />
        <span className={styles.rowText}>
          <span id={`${id}-name`} className={styles.rowTitle}>
            {name}
          </span>{' '}
          <span id={`${id}-status`} className={cx(styles.rowStatus, urgent && styles.rowUrgent, section === 'back' && styles.rowBack)}>{line}</span>
        </span>{' '}
        <Money value={s.amount} currency="INR" strong={section !== 'aside'} muted={section === 'aside'} trimZeros className={styles.rowAmount} />
      </button>
      {next.stage === 'check' && (
        // The pair is named by its row ("Zepto · Did ₹249 leave your account?"), so each button keeps its visible words as its name.
        <div className={styles.rowActions} role="group" aria-labelledby={`${id}-name ${id}-status`}>
          <Button size="sm" variant="tonal" onClick={() => yes(s)}>
            {t('stuck.check.yes.short')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => no(s)}>
            {t('stuck.check.no.short')}
          </Button>
        </div>
      )}
    </li>
  )
}
