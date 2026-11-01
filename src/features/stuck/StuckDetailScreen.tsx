import { useId, useState, type ReactNode } from 'react'
import { ArchiveRestore, Archive, Check, Copy, MoreVertical, Pencil, Trash2, Undo2 } from 'lucide-react'
import { goBack, navigate, useRoute } from '../../app/router'
import { Badge, Banner, BottomSheet, Button, IconButton, List, ListRow, Money, PageTitle, Screen, TopBar, useToast } from '../../components'
import { useStore } from '../../data'
import { stuckStore, type StuckPayment, type StuckStepKind } from '../../data/stores'
import { confirmStuck, deleteStuck, dismissStuck, restoreStuck, updateStuck } from '../../data/stuck'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { copyText } from '../../lib/share'
import { shortDate } from '../recurring/recurringLabels'
import { BackSheet } from './BackSheet'
import { STUCK_PATH, stuckEditPath } from './paths'
import { RaiseSheet } from './RaiseSheet'
import { compensationDue, daysLate, dueBy, nextStep, OMBUDSMAN_WINDOW_DAYS, ombudsmanTooLate, stillOwed, type StuckNext } from './rules'
import { KindIcon } from './StuckParts'
import { accountLine, appLabel, clockOf, inr, knownParty, partyName, railLabel, sectionOf, sourceLabel, stageBadge, stepPlace, type ClockEvent } from './view'
import styles from './Stuck.module.css'

const ROUTES = ['/app/stuck/:id'] as const

/**
 * `/app/stuck/:id` — one stuck payment: how much and who owes it, the clock (the day the money
 * left, the RBI's deadline or the business's own, how late it is and the ₹100 a day that's earned,
 * each complaint, the money back), and "What to do now" with one clear next step — check it left,
 * wait, raise it, take it higher, claim the compensation, or say it's back. Edit, set aside and
 * delete are under ⋮, each with Undo.
 */
export function StuckDetailScreen() {
  const t = useT()
  const { params } = useRoute(ROUTES)
  const id = params.id ?? null
  const payment = useStore(stuckStore, (all) => (id ? (all.find((s) => s.id === id) ?? null) : null))
  if (!payment) {
    return (
      <Screen header={<TopBar onBack={() => goBack(STUCK_PATH)} />}>
        <PageTitle title={t('stuck.detail.gone')} subtitle={t('stuck.detail.gone.text')} />
        <Button onClick={() => navigate(STUCK_PATH, { replace: true })}>{t('stuck.detail.gone.cta')}</Button>
      </Screen>
    )
  }
  return <Detail payment={payment} />
}

interface Raise {
  step: StuckStepKind
  compensationOnly: boolean
}

function Detail({ payment: s }: { payment: StuckPayment }) {
  const t = useT()
  const toast = useToast()
  const day = todayIso()
  const next = nextStep(s, day)
  const section = sectionOf(next.stage)
  const badge = stageBadge(s, next, day)
  const [menu, setMenu] = useState(false)
  const [back, setBack] = useState<{ open: boolean; compensationPaid: boolean }>({ open: false, compensationPaid: false })
  // The last rung opened stays put while its sheet slides away.
  const [raise, setRaise] = useState<Raise | null>(null)
  const [raiseOpen, setRaiseOpen] = useState(false)
  // The way it was paid, unless the title already says it (nobody's name on it).
  const meta = [s.kind === 'failed' && knownParty(s) !== null ? railLabel(s.rail) : null, accountLine(s), appLabel(s.app)].filter(Boolean).join(' · ')

  const openRaise = (step: StuckStepKind, compensationOnly = false): void => {
    haptic('tap')
    setRaise({ step, compensationOnly })
    setRaiseOpen(true)
  }
  const undoable = (message: string, undo: (() => void) | null, tone: 'success' | 'info' = 'success'): void => {
    toast(message, { tone, action: undo ? { label: t('common.action.undo'), onAction: undo } : undefined })
  }
  const setAside = (): void => {
    setMenu(false)
    haptic('tap')
    undoable(t('stuck.aside.toast'), dismissStuck(s.id), 'info')
  }
  const bringBack = (): void => {
    setMenu(false)
    haptic('success')
    undoable(t('stuck.restore.toast'), updateStuck(s.id, { dismissedAt: null }))
  }
  const remove = (): void => {
    setMenu(false)
    const removed = deleteStuck(s.id)
    navigate(STUCK_PATH, { replace: true })
    if (!removed) return
    const name = knownParty(removed)
    undoable(name ? t('stuck.delete.toast', { name }) : t('stuck.delete.toastNoName'), () => restoreStuck(removed), 'info')
  }

  return (
    <Screen
      header={
        <TopBar
          onBack={() => goBack(STUCK_PATH)}
          right={
            <IconButton label={t('stuck.detail.menu')} onClick={() => setMenu(true)}>
              <MoreVertical />
            </IconButton>
          }
        />
      }
      contentClassName={styles.content}
    >
      <header className={styles.detailHero}>
        <KindIcon kind={s.kind} section={section} size="lg" />
        <p className={styles.detailEyebrow}>{s.kind === 'failed' ? t('stuck.kind.failed') : t('stuck.kind.refund')}</p>
        <h1 className={styles.detailTitle} tabIndex={-1}>
          {partyName(s)}
        </h1>
        <div className={styles.detailAmount}>
          <Money value={s.amount} currency="INR" size="xl" trimZeros />
        </div>
        {meta && <p className={styles.detailMeta}>{meta}</p>}
        <Badge tone={badge.tone} size="md">
          {badge.label}
        </Badge>
      </header>

      <NowCard
        payment={s}
        next={next}
        day={day}
        onRaise={openRaise}
        onBack={(compensationPaid) => setBack({ open: true, compensationPaid })}
        onBringBack={bringBack}
        onConfirm={() => {
          haptic('success')
          undoable(t('stuck.check.yes.toast'), confirmStuck(s.id))
        }}
        onNotLeft={() => {
          haptic('tap')
          undoable(t('stuck.check.no.toast'), dismissStuck(s.id), 'info')
        }}
      />

      <Clock events={clockOf(s, day)} />

      <Details payment={s} />

      <BottomSheet open={menu} onClose={() => setMenu(false)} title={partyName(s)}>
        <List>
          <ListRow
            leading={<Pencil aria-hidden="true" />}
            title={t('common.action.edit')}
            onClick={() => {
              setMenu(false)
              navigate(stuckEditPath(s.id))
            }}
          />
          {s.dismissedAt === null ? (
            s.back === null && <ListRow leading={<Archive aria-hidden="true" />} title={t('stuck.detail.aside')} subtitle={t('stuck.detail.aside.text')} onClick={setAside} />
          ) : (
            <ListRow leading={<ArchiveRestore aria-hidden="true" />} title={t('stuck.detail.restore')} onClick={bringBack} />
          )}
          <ListRow leading={<Trash2 aria-hidden="true" />} title={t('common.action.delete')} onClick={remove} />
        </List>
      </BottomSheet>

      <BackSheet open={back.open} compensationPaid={back.compensationPaid} onClose={() => setBack((b) => ({ ...b, open: false }))} payment={s} />
      {raise && <RaiseSheet open={raiseOpen} onClose={() => setRaiseOpen(false)} payment={s} step={raise.step} compensationOnly={raise.compensationOnly} />}
    </Screen>
  )
}

interface NowCardProps {
  payment: StuckPayment
  next: StuckNext
  day: string
  onRaise: (step: StuckStepKind, compensationOnly?: boolean) => void
  /** "It's back" (or, with compensation owed, "They've paid it"). */
  onBack: (compensationPaid: boolean) => void
  onBringBack: () => void
  onConfirm: () => void
  onNotLeft: () => void
}

/** "What to do now": where it stands, in plain words, and the one thing to do about it. */
function NowCard({ payment: s, next, day, onRaise, onBack, onBringBack, onConfirm, onNotLeft }: NowCardProps) {
  const t = useT()
  const headingId = useId()
  const name = partyName(s)
  const amount = inr(s.amount)
  const due = shortDate(dueBy(s))
  const late = daysLate(s, day)
  const owed = stillOwed(s, day).compensation
  const lastStep = s.steps.at(-1) ?? null
  const itsBack = (
    <Button block variant="ghost" iconStart={<Undo2 />} onClick={() => onBack(false)}>
      {t('stuck.now.back')}
    </Button>
  )

  let title: string
  let text: string | null
  let actions: ReactNode = null
  let note: ReactNode = null
  let done = false

  switch (next.stage) {
    case 'check':
      title = t('stuck.now.check.title', { amount })
      text = t('stuck.now.check.text')
      actions = (
        <>
          <Button block onClick={onConfirm}>
            {t('stuck.check.yes')}
          </Button>
          <Button block variant="secondary" onClick={onNotLeft}>
            {t('stuck.check.no')}
          </Button>
        </>
      )
      break
    case 'waiting':
      title = t('stuck.now.waiting.title')
      text = s.kind === 'failed' ? t('stuck.now.waiting.failed', { date: due }) : t('stuck.now.waiting.refund', { name, date: due })
      actions = (
        <Button block variant="secondary" iconStart={<Undo2 />} onClick={() => onBack(false)}>
          {t('stuck.now.back')}
        </Button>
      )
      break
    case 'overdue': {
      const step = next.step ?? (s.kind === 'failed' ? 'bank' : 'merchant')
      if (s.kind === 'failed') {
        title = t('stuck.now.overdue.failed.title', { count: late, amount: inr(compensationDue(s, day)) })
        text = t('stuck.now.overdue.failed.text', { date: due })
      } else {
        title = t('stuck.now.overdue.refund.title', { count: late })
        text = t('stuck.now.overdue.refund.text', { name, date: due })
      }
      actions = (
        <>
          <Button block onClick={() => onRaise(step)}>
            {t('stuck.now.raise', { place: stepPlace(step, s) })}
          </Button>
          {itsBack}
        </>
      )
      break
    }
    case 'raised':
      title = t('stuck.now.raised.title', { place: lastStep ? stepPlace(lastStep.kind, s) : t('stuck.place.bank'), date: shortDate(lastStep?.date ?? day) })
      text = t('stuck.now.raised.text', { date: shortDate(next.until ?? day) })
      actions = (
        <>
          <Button block variant="secondary" iconStart={<Undo2 />} onClick={() => onBack(s.back !== null)}>
            {s.back !== null ? t('stuck.now.paid', { amount: inr(owed) }) : t('stuck.now.back')}
          </Button>
          {lastStep && (
            <Button block variant="ghost" onClick={() => onRaise(lastStep.kind, s.back !== null)}>
              {t('stuck.now.letterAgain')}
            </Button>
          )}
        </>
      )
      break
    case 'escalate': {
      const step = next.step ?? 'ombudsman'
      title = t('stuck.now.escalate.title', { place: stepPlace(step, s) })
      text = t('stuck.now.escalate.text', { was: lastStep ? stepPlace(lastStep.kind, s) : t('stuck.place.bank') })
      if (step === 'ombudsman' && ombudsmanTooLate(s, day)) note = <Banner tone="warning">{t('stuck.now.tooLate', { days: OMBUDSMAN_WINDOW_DAYS })}</Banner>
      actions = (
        <>
          <Button block onClick={() => onRaise(step, s.back !== null)}>
            {t('stuck.now.take', { place: stepPlace(step, s) })}
          </Button>
          {s.back === null ? itsBack : null}
        </>
      )
      break
    }
    case 'escalated':
      title = t('stuck.now.escalated.title', { place: lastStep ? stepPlace(lastStep.kind, s) : t('stuck.place.ombudsman') })
      text = t('stuck.now.escalated.text')
      actions = (
        <Button block variant="secondary" iconStart={<Undo2 />} onClick={() => onBack(s.back !== null)}>
          {s.back !== null ? t('stuck.now.paid', { amount: inr(owed) }) : t('stuck.now.back')}
        </Button>
      )
      break
    case 'compensation':
      title = t('stuck.now.compensation.title', { count: late })
      text = t('stuck.now.compensation.text', { amount: inr(owed) })
      actions = (
        <>
          <Button block onClick={() => onRaise('bank', true)}>
            {t('stuck.now.claim', { amount: inr(owed) })}
          </Button>
          <Button block variant="ghost" iconStart={<Check />} onClick={() => onBack(true)}>
            {t('stuck.now.paidShort')}
          </Button>
        </>
      )
      break
    case 'back': {
      done = true
      const back = s.back
      title = t('stuck.now.done.title')
      text = back
        ? back.compensation > 0
          ? t('stuck.now.done.textPaid', { amount: inr(back.amount), date: shortDate(back.date), compensation: inr(back.compensation) })
          : t('stuck.now.done.text', { amount: inr(back.amount), date: shortDate(back.date) })
        : null
      break
    }
    case 'dismissed':
      title = t('stuck.now.aside.title')
      text = t('stuck.now.aside.text')
      actions = (
        <Button block variant="secondary" iconStart={<ArchiveRestore />} onClick={onBringBack}>
          {t('stuck.detail.restore')}
        </Button>
      )
      break
  }

  return (
    <section className={cx(styles.now, done && styles.nowDone, needsYou(next) && styles.nowUrgent)} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.nowHeading}>
        {t('stuck.now.heading')}
      </h2>
      <p className={styles.nowTitle}>{title}</p>
      {text && <p className={styles.nowText}>{text}</p>}
      {note}
      {actions && <div className={styles.nowActions}>{actions}</div>}
    </section>
  )
}

function needsYou(next: StuckNext): boolean {
  return sectionOf(next.stage) === 'needs'
}

/** The clock: what happened when, how late it is, and what's waited on. */
function Clock({ events }: { events: ClockEvent[] }) {
  const t = useT()
  const headingId = useId()
  return (
    <section className={styles.clockCard} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.cardHeading}>
        {t('stuck.clock.heading')}
      </h2>
      <ol className={styles.clock}>
        {events.map((event) => (
          <li key={event.key} className={cx(styles.event, styles[`event-${event.state}`])}>
            <span className={styles.eventDot} aria-hidden="true" />
            <div className={styles.eventBody}>
              <p className={styles.eventHead}>
                <span className={styles.eventTitle}>{event.title}</span>
                {event.date && <span className={styles.eventDate}>{shortDate(event.date)}</span>}
              </p>
              {event.detail && <p className={styles.eventDetail}>{event.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** What's known about it, with the references a complaint asks for one tap from copied. */
function Details({ payment: s }: { payment: StuckPayment }) {
  const t = useT()
  const toast = useToast()
  const headingId = useId()
  const copy = async (value: string): Promise<void> => {
    if (await copyText(value)) {
      haptic('success')
      toast(t('stuck.detail.copied'), { tone: 'success' })
    } else toast(t('stuck.detail.copyFailed'), { tone: 'error' })
  }
  const rows: Array<{ key: string; label: string; value: string; copyable?: boolean }> = []
  if (s.kind === 'failed') rows.push({ key: 'rail', label: t('stuck.detail.rail'), value: railLabel(s.rail) })
  if (s.party) rows.push({ key: 'party', label: s.kind === 'failed' ? t('stuck.detail.to') : t('stuck.detail.from'), value: s.party })
  rows.push({ key: 'date', label: s.kind === 'failed' ? t('stuck.detail.date.failed') : t('stuck.detail.date.refund'), value: shortDate(s.date) })
  if (s.promisedBy) rows.push({ key: 'promised', label: t('stuck.detail.promised'), value: shortDate(s.promisedBy) })
  const account = accountLine(s)
  if (account) rows.push({ key: 'account', label: t('stuck.detail.account'), value: account })
  const app = appLabel(s.app)
  if (app) rows.push({ key: 'app', label: t('stuck.detail.app'), value: app })
  if (s.ref) rows.push({ key: 'ref', label: t('stuck.detail.ref'), value: s.ref, copyable: true })
  if (s.orderId) rows.push({ key: 'order', label: t('stuck.detail.order'), value: s.orderId, copyable: true })
  rows.push({ key: 'source', label: t('stuck.detail.source'), value: sourceLabel(s.source) })

  return (
    <section className={styles.details} aria-labelledby={headingId}>
      <div className={styles.detailsHead}>
        <h2 id={headingId} className={styles.cardHeading}>
          {t('stuck.detail.heading')}
        </h2>
        <Button size="sm" variant="ghost" iconStart={<Pencil />} onClick={() => navigate(stuckEditPath(s.id))} aria-label={t('stuck.detail.edit.aria')}>
          {t('common.action.edit')}
        </Button>
      </div>
      <dl className={styles.facts}>
        {rows.map((row) => (
          <div key={row.key} className={styles.fact}>
            <dt className={styles.factLabel}>{row.label}</dt>
            <dd className={styles.factValue}>
              <span className={styles.factText}>{row.value}</span>
              {row.copyable && (
                <IconButton label={t('stuck.detail.copy', { what: row.label })} size="sm" onClick={() => void copy(row.value)}>
                  <Copy />
                </IconButton>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
