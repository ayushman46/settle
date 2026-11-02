import { useEffect, useId, useState, type ReactNode } from 'react'
import { ArchiveRestore, Archive, CalendarPlus, Check, CircleCheck, Copy, MessageSquareReply, MoreVertical, Pencil, SkipForward, Trash2, Undo2 } from 'lucide-react'
import { goBack, navigate, useRoute } from '../../app/router'
import { ActionBar, Badge, Banner, BottomSheet, Button, IconButton, List, ListRow, Money, PageTitle, Screen, SuccessBurst, TopBar, useToast } from '../../components'
import { useStore } from '../../data'
import { stuckStore, type StuckPayment, type StuckStepKind } from '../../data/stores'
import { confirmStuck, deleteStuck, dismissStuck, restoreStuck, updateStuck } from '../../data/stuck'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { copyText } from '../../lib/share'
import { BackSheet } from './BackSheet'
import { DetailNote } from './DetailNote'
import { DetailRemindSheet } from './DetailRemindSheet'
import { DetailReplySheet } from './DetailReplySheet'
import { merchantById } from './merchants'
import { STUCK_PATH, stuckEditPath } from './paths'
import { RaiseSheet } from './RaiseSheet'
import { reminderFor, type StuckReminder } from './reminder'
import {
  backInFull,
  backInPart,
  COMPENSATION_PER_DAY,
  compensationDue,
  daysLate,
  dueBy,
  nextStep,
  OMBUDSMAN_WINDOW_DAYS,
  ombudsmanLastDay,
  ombudsmanTooLate,
  owedForWait,
  stillOwed,
  type StuckNext,
} from './rules'
import { KindIcon } from './StuckParts'
import {
  accountLine,
  appLabel,
  clockOf,
  inr,
  knownParty,
  partyName,
  railLabel,
  refundDueText,
  sectionOf,
  sourceLabel,
  stageBadge,
  stepPlace,
  stuckDate,
  stuckTitle,
  type ClockEvent,
} from './view'
import { WinCard } from './WinCard'
import styles from './Stuck.module.css'

const ROUTES = ['/app/stuck/:id'] as const

/**
 * `/app/stuck/:id` — one stuck payment: how much and who owes it (and what's still to come of a
 * part), the clock (the day the money left, the RBI's deadline or the business's own, how late it
 * is and the ₹100 a day that's earned, each complaint, the money back), and "What to do now" with
 * one clear next step — check it left, wait, raise it, take it higher, claim the compensation, or
 * say it's back — with a calendar reminder for the next date. All back, it's a win to share. Edit,
 * set aside and delete (asked first) are under ⋮, each with Undo.
 */
export function StuckDetailScreen() {
  const t = useT()
  const { params } = useRoute(ROUTES)
  const id = params.id ?? null
  const payment = useStore(stuckStore, (all) => (id ? (all.find((s) => s.id === id) ?? null) : null))
  // Here a moment ago and now gone (an Undo took it back off): the list, not a dead end.
  const [seen, setSeen] = useState(false)
  if (payment && !seen) setSeen(true)
  const vanished = payment === null && seen
  useEffect(() => {
    if (vanished) navigate(STUCK_PATH, { replace: true })
  }, [vanished])
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

/** "They don't answer": a refund not yet past the business can go straight to the next place — no working support is reason enough. */
function skipTo(s: StuckPayment, next: StuckNext): StuckStepKind | null {
  if (s.kind !== 'refund' || s.dismissedAt !== null || backInFull(s)) return null
  if (next.stage === 'escalate' || s.steps.some((x) => x.kind !== 'merchant')) return null
  return merchantById(s.merchant)?.category === 'airline' ? 'airsewa' : 'nch'
}

function Detail({ payment: s }: { payment: StuckPayment }) {
  const t = useT()
  const toast = useToast()
  const day = todayIso()
  const next = nextStep(s, day)
  const section = sectionOf(next.stage)
  const badge = stageBadge(s, next, day)
  const owed = stillOwed(s, day)
  const part = s.dismissedAt === null && backInPart(s) ? s.back : null
  const skip = skipTo(s, next)
  const reminder = reminderFor(s, next, day)
  const [menu, setMenu] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [back, setBack] = useState<{ open: boolean; compensationPaid: boolean }>({ open: false, compensationPaid: false })
  const [celebrate, setCelebrate] = useState(false)
  const [reply, setReply] = useState(false)
  const [remind, setRemind] = useState(false)
  // The last rung opened stays put while its sheet slides away.
  const [raise, setRaise] = useState<Raise | null>(null)
  const [raiseOpen, setRaiseOpen] = useState(false)
  // The way it was paid, unless the title already says it (nobody's name on it).
  const meta = [s.kind === 'failed' && knownParty(s) !== null ? railLabel(s.rail) : null, accountLine(s), appLabel(s.app)].filter(Boolean).join(' · ')
  // Under the amount: what's still to come of a part, or what the bank owes for the wait once it's all back.
  const owedLine = part
    ? t('stuck.detail.partBack', { back: inr(part.amount), rest: inr(owed.money) })
    : owedForWait(next.stage)
      ? t('stuck.detail.owedWait', { owed: inr(owed.compensation) })
      : null

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
  // A fee they won't refund: what came back is what it comes to.
  const keepRest = (): void => {
    setMenu(false)
    if (!part) return
    haptic('tap')
    undoable(t('stuck.detail.keptRest.toast', { amount: inr(part.amount) }), updateStuck(s.id, { amount: part.amount }), 'info')
  }
  const askDelete = (): void => {
    setMenu(false)
    setConfirmDelete(true)
  }
  const remove = (): void => {
    setConfirmDelete(false)
    const removed = deleteStuck(s.id)
    navigate(STUCK_PATH, { replace: true })
    if (!removed) return
    const name = knownParty(removed)
    undoable(name ? t('stuck.delete.toast', { name }) : t('stuck.delete.toastNoName'), () => restoreStuck(removed), 'info')
  }
  const deleteText = [
    s.steps.length > 0 ? t('stuck.delete.textSteps', { count: s.steps.length }) : t('stuck.delete.text'),
    s.dismissedAt === null && !backInFull(s) ? t('stuck.delete.aside') : null,
  ]
    .filter(Boolean)
    .join(' ')

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
        {owedLine && <p className={styles.detailOwed}>{owedLine}</p>}
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
        onReply={() => setReply(true)}
        reminder={reminder}
        onRemind={() => setRemind(true)}
      />

      <Clock events={clockOf(s, day)} />

      <Details payment={s} />

      <DetailNote payment={s} />

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
            !backInFull(s) && <ListRow leading={<Archive aria-hidden="true" />} title={t('stuck.detail.aside')} subtitle={t('stuck.detail.aside.text')} onClick={setAside} />
          ) : (
            <ListRow leading={<ArchiveRestore aria-hidden="true" />} title={t('stuck.detail.restore')} onClick={bringBack} />
          )}
          {part && (
            <ListRow
              leading={<CircleCheck aria-hidden="true" />}
              title={t('stuck.detail.keptRest')}
              subtitle={t('stuck.detail.keptRest.text', { amount: inr(owed.money) })}
              onClick={keepRest}
            />
          )}
          {skip && (
            <ListRow
              leading={<SkipForward aria-hidden="true" />}
              title={t('stuck.other.skip')}
              subtitle={t('stuck.other.skip.text', { place: stepPlace(skip, s) })}
              onClick={() => {
                setMenu(false)
                openRaise(skip)
              }}
            />
          )}
          <ListRow leading={<Trash2 aria-hidden="true" />} title={t('common.action.delete')} onClick={askDelete} />
        </List>
      </BottomSheet>

      <BottomSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t('stuck.delete.title', { name: partyName(s) })}
        description={deleteText}
        footer={
          <ActionBar>
            <Button block variant="danger" iconStart={<Trash2 />} onClick={remove}>
              {t('stuck.delete.confirm')}
            </Button>
            <Button block variant="secondary" onClick={() => setConfirmDelete(false)}>
              {t('stuck.delete.cancel')}
            </Button>
          </ActionBar>
        }
      />

      <BackSheet
        open={back.open}
        compensationPaid={back.compensationPaid}
        onClose={() => setBack((b) => ({ ...b, open: false }))}
        onAllBack={() => setCelebrate(true)}
        payment={s}
      />
      {raise && <RaiseSheet open={raiseOpen} onClose={() => setRaiseOpen(false)} payment={s} step={raise.step} compensationOnly={raise.compensationOnly} />}
      <DetailReplySheet open={reply} onClose={() => setReply(false)} payment={s} />
      {reminder && <DetailRemindSheet open={remind} onClose={() => setRemind(false)} id={s.id} reminder={reminder} />}
      {celebrate && s.back && (
        <SuccessBurst
          title={t('stuck.win.burst')}
          amount={<Money value={s.back.amount + s.back.compensation} currency="INR" size="lg" trimZeros strong />}
          subtitle={stuckTitle(s)}
          onDone={() => setCelebrate(false)}
        />
      )}
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
  /** "My bank replied or said no". */
  onReply: () => void
  /** The next date worth a calendar reminder, or null. */
  reminder: StuckReminder | null
  onRemind: () => void
}

/** "What to do now": where it stands, in plain words, and the one thing to do about it — or, all back, the win. */
function NowCard({ payment: s, next, day, onRaise, onBack, onBringBack, onConfirm, onNotLeft, onReply, reminder, onRemind }: NowCardProps) {
  const t = useT()
  const headingId = useId()
  const amount = inr(s.amount)
  const due = stuckDate(dueBy(s), day)
  const late = daysLate(s, day)
  const owed = stillOwed(s, day)
  const lastStep = s.steps.at(-1) ?? null
  const was = lastStep ? stepPlace(lastStep.kind, s) : t('stuck.place.bank')
  const ombudsman = stepPlace('ombudsman', s)
  // Compensation already paid in part: the rest is what's asked for.
  const paidSoFar = s.back?.compensation ?? 0
  const part = backInPart(s) ? s.back : null
  // A bank that answered without fixing it opens the RBI Ombudsman before its 30 days are up.
  const canReply = lastStep?.kind === 'bank' && s.repliedAt === null

  const itsBack = (variant: 'secondary' | 'ghost') => (
    <Button block variant={variant} iconStart={<Undo2 />} onClick={() => onBack(false)}>
      {part ? t('stuck.detail.now.moreBack') : t('stuck.now.back')}
    </Button>
  )
  const paid = (variant: 'secondary' | 'ghost') => (
    <Button block variant={variant} iconStart={<Check />} onClick={() => onBack(true)}>
      {paidSoFar > 0 ? t('stuck.detail.now.paidRest', { amount: inr(owed.compensation) }) : t('stuck.now.paid', { amount: inr(owed.compensation) })}
    </Button>
  )
  const letterAgain = (compensationOnly: boolean) =>
    lastStep && (
      <Button block variant="ghost" onClick={() => onRaise(lastStep.kind, compensationOnly)}>
        {t('stuck.now.letterAgain')}
      </Button>
    )
  const replied = canReply && (
    <Button block variant="ghost" iconStart={<MessageSquareReply />} onClick={onReply}>
      {t('stuck.reply.cta')}
    </Button>
  )
  // The last day for the RBI Ombudsman, or that it may have passed.
  const ombudsmanNote = (): ReactNode => {
    if (ombudsmanTooLate(s, day)) return <Banner tone="warning">{t('stuck.now.tooLate', { days: OMBUDSMAN_WINDOW_DAYS })}</Banner>
    const last = ombudsmanLastDay(s)
    return last ? <p className={styles.nowText}>{t('stuck.detail.now.lastDay', { date: stuckDate(last, day) })}</p> : null
  }
  const compPart = (): string =>
    t('stuck.detail.now.compPart', { due: inr(compensationDue(s, day)), paid: inr(paidSoFar), rest: inr(owed.compensation) })

  if (next.stage === 'back') return <WinCard payment={s} day={day} />

  let title: string
  let text: string | null
  const lines: string[] = []
  let actions: ReactNode = null
  let note: ReactNode = null

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
    case 'waiting': {
      title = t('stuck.now.waiting.title')
      text = s.kind === 'failed' ? t('stuck.now.waiting.failed', { date: due }) : refundDueText(s, day)
      // No need to wait: asking now is allowed, gently.
      const first = s.kind === 'failed' ? 'bank' : 'merchant'
      actions = (
        <>
          {itsBack('secondary')}
          {lastStep ? (
            letterAgain(false)
          ) : (
            <Button block variant="ghost" onClick={() => onRaise(first)}>
              {t('stuck.detail.now.askEarly', { place: stepPlace(first, s) })}
            </Button>
          )}
        </>
      )
      break
    }
    case 'overdue': {
      const step = next.step ?? (s.kind === 'failed' ? 'bank' : 'merchant')
      if (s.kind === 'failed') {
        const wallet = s.rail === 'wallet'
        title = t(wallet ? 'stuck.now.overdue.failed.title.wallet' : 'stuck.now.overdue.failed.title', { count: late, amount: inr(compensationDue(s, day)) })
        const upi = s.rail === 'upi_person' || s.rail === 'upi_merchant'
        text = t(wallet ? 'stuck.now.overdue.failed.text.wallet' : 'stuck.now.overdue.failed.text', { date: due, place: upi ? t('stuck.place.bankOrApp') : stepPlace('bank', s) })
      } else {
        title = t('stuck.now.overdue.refund.title', { count: late })
        text = refundDueText(s, day)
      }
      actions = (
        <>
          <Button block onClick={() => onRaise(step)}>
            {t('stuck.now.raise', { place: stepPlace(step, s) })}
          </Button>
          {itsBack('ghost')}
        </>
      )
      break
    }
    case 'raised':
      title = t('stuck.now.raised.title', { place: was, date: stuckDate(lastStep?.date ?? day, day) })
      text = t('stuck.now.raised.text', { date: stuckDate(next.until ?? day, day) })
      actions = (
        <>
          {itsBack('secondary')}
          {letterAgain(false)}
          {replied}
        </>
      )
      break
    case 'escalate': {
      const step = next.step ?? 'ombudsman'
      title = t('stuck.now.escalate.title', { place: stepPlace(step, s) })
      text = step === 'ombudsman' && s.repliedAt !== null ? t('stuck.reply.escalate', { date: stuckDate(s.repliedAt, day) }) : t('stuck.now.escalate.text', { was })
      if (step === 'ombudsman') note = ombudsmanNote()
      actions = (
        <>
          <Button block onClick={() => onRaise(step)}>
            {t('stuck.now.take', { place: stepPlace(step, s) })}
          </Button>
          {itsBack('ghost')}
        </>
      )
      break
    }
    case 'escalated':
      title = t('stuck.now.escalated.title', { place: lastStep ? stepPlace(lastStep.kind, s) : ombudsman })
      text = t('stuck.now.escalated.text')
      actions = itsBack('secondary')
      break
    case 'compensation':
      title = t('stuck.now.compensation.title', { count: late })
      text =
        paidSoFar > 0
          ? compPart()
          : s.rail === 'wallet'
            ? t('stuck.now.compensation.text.wallet', { amount: inr(owed.compensation), place: stepPlace('bank', s) })
            : t('stuck.now.compensation.text', { amount: inr(owed.compensation) })
      actions = (
        <>
          <Button block onClick={() => onRaise('bank', true)}>
            {s.rail === 'wallet' ? t('stuck.now.claim.wallet', { amount: inr(owed.compensation), place: stepPlace('bank', s) }) : t('stuck.now.claim', { amount: inr(owed.compensation) })}
          </Button>
          <Button block variant="ghost" iconStart={<Check />} onClick={() => onBack(true)}>
            {paidSoFar > 0 ? t('stuck.detail.now.paidRest', { amount: inr(owed.compensation) }) : t('stuck.now.paidShort')}
          </Button>
        </>
      )
      break
    case 'compensationRaised':
      title = t('stuck.detail.now.compRaised.title', { amount, owed: inr(owed.compensation) })
      text = t('stuck.detail.now.compRaised.text', { date: stuckDate(lastStep?.date ?? day, day), until: stuckDate(next.until ?? day, day) })
      if (paidSoFar > 0) lines.push(compPart())
      actions = (
        <>
          {paid('secondary')}
          {letterAgain(true)}
          {replied}
        </>
      )
      break
    case 'compensationEscalate':
      title = t('stuck.detail.now.compEscalate.title', { owed: inr(owed.compensation), place: ombudsman })
      text = t('stuck.detail.now.compEscalate.text', { amount, count: late, owed: inr(owed.compensation) })
      note = ombudsmanNote()
      actions = (
        <>
          <Button block onClick={() => onRaise('ombudsman', true)}>
            {t('stuck.now.take', { place: ombudsman })}
          </Button>
          {paid('ghost')}
        </>
      )
      break
    case 'compensationEscalated':
      title = t('stuck.now.escalated.title', { place: ombudsman })
      text = t('stuck.detail.now.compEscalated.text', { amount, owed: inr(owed.compensation), place: ombudsman })
      actions = paid('secondary')
      break
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

  // While a complaint is open, the ₹100 a day keeps counting: say so, not just in the clock.
  if ((next.stage === 'raised' || next.stage === 'escalate' || next.stage === 'escalated') && s.kind === 'failed' && compensationDue(s, day) > 0) {
    lines.push(t(s.rail === 'wallet' ? 'stuck.detail.now.owedSoFar.wallet' : 'stuck.detail.now.owedSoFar', { amount: inr(compensationDue(s, day)), perDay: inr(COMPENSATION_PER_DAY) }))
  }
  if (part && next.stage !== 'dismissed') {
    lines.push(t('stuck.detail.now.partBack', { back: inr(part.amount), amount, date: stuckDate(part.date, day), rest: inr(owed.money) }))
  }

  return (
    <section className={cx(styles.now, needsYou(next) && styles.nowUrgent)} aria-labelledby={headingId}>
      <h2 id={headingId} className={styles.nowHeading}>
        {t('stuck.now.heading')}
      </h2>
      <p className={styles.nowTitle}>{title}</p>
      {text && <p className={styles.nowText}>{text}</p>}
      {lines.map((line) => (
        <p key={line} className={styles.nowText}>
          {line}
        </p>
      ))}
      {note}
      {actions && <div className={styles.nowActions}>{actions}</div>}
      {reminder && (
        <Button size="sm" variant="ghost" iconStart={<CalendarPlus />} className={styles.remindCta} onClick={onRemind}>
          {t('stuck.remind.cta', { date: stuckDate(reminder.date, day) })}
        </Button>
      )}
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
                {event.date && <span className={styles.eventDate}>{stuckDate(event.date)}</span>}
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
  rows.push({ key: 'date', label: s.kind === 'failed' ? t('stuck.detail.date.failed') : t('stuck.detail.date.refund'), value: stuckDate(s.date) })
  if (s.promisedBy) rows.push({ key: 'promised', label: t('stuck.detail.promised'), value: stuckDate(s.promisedBy) })
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
