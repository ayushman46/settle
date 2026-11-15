import { useMemo, useState } from 'react'
import { CalendarClock, HandCoins, Percent, Printer, Share2, Trash2 } from 'lucide-react'
import { goBack, navigate, useRoute } from '../../app/router'
import { Button, Card, Chip, EmptyState, Money, PageTitle, Screen, TopBar, useToast } from '../../components'
import { useExpense, useExpenses, useFriendsById, useGroups, useMe, useProfile } from '../../data'
import { ME_ID, type Minor } from '../../domain/types'
import { addDays, today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { DateField } from '../../kit/DateField'
import { friendLabel } from '../../kit/friendName'
import { UpiPaySheet } from '../../kit/UpiPaySheet'
import { haptic } from '../../lib/haptics'
import { formatMoney } from '../../lib/money'
import { printPage } from '../../lib/nativeApp'
import { shareResult } from '../../lib/share'
import { outsideName } from '../../share/names'
import { firstName } from '../../share/text'
import { dayLabel, headline, lineText, loanLine, rateLabel, ruleLines, shareMessage } from './byaajText'
import type { Rate } from './engine'
import { LoanNote } from './LoanNote'
import { loanFacts, loanView, recordLoanPayment, type LoanFacts, type LoanView } from './loans'
import { BYAAJ_DETAIL_PATTERN, BYAAJ_PATH } from './paths'
import { PaymentSheet, type PaymentDraft } from './PaymentSheet'
import { RatePicker } from './RatePicker'
import { removeByaaj, setByaaj, setByaajDueOn, setByaajRate, useByaajPlan } from './store'
import styles from './Byaaj.module.css'

const ROUTES = [BYAAJ_DETAIL_PATTERN] as const

/**
 * `/app/byaaj/:id` (the id is the loan's own): interest on one loan. Without a rate yet, it asks
 * for one (one tap). With one: what is due today in a sentence, how it is counted, the statement
 * line by line, "Record a payment" (interest first, then the amount; the amount part goes through
 * the app's normal paid-back path), a message to share and a loan note to print.
 */
export function ByaajDetailScreen() {
  const t = useT()
  const { params } = useRoute(ROUTES)
  const id = params.id ?? ''
  const expense = useExpense(id)
  const groups = useGroups()
  const plan = useByaajPlan(id)
  const facts = useMemo(() => loanFacts(expense, groups), [expense, groups])
  const header = <TopBar onBack={() => goBack(BYAAJ_PATH)} />

  if (!facts) {
    return (
      <Screen header={header} contentClassName={styles.content}>
        <PageTitle title={t('byaaj.title')} />
        <EmptyState
          icon={<Percent />}
          title={t('byaaj.gone.title')}
          text={t('byaaj.gone.text')}
          action={<Button onClick={() => navigate(BYAAJ_PATH, { replace: true })}>{t('byaaj.gone.cta')}</Button>}
        />
      </Screen>
    )
  }
  return plan ? <Loan key={id} facts={facts} /> : <Setup facts={facts} />
}

function useNames(facts: LoanFacts): { name: string; full: string; mine: string } {
  const friendsById = useFriendsById()
  const profile = useProfile()
  const full = friendLabel(facts.friendId, friendsById[facts.friendId] ?? null)
  return { name: firstName(full), full, mine: outsideName(ME_ID, friendsById, profile, '') }
}

/** No rate yet: one tap on a chip adds interest from the loan's date. */
function Setup({ facts }: { facts: LoanFacts }) {
  const t = useT()
  const toast = useToast()
  const { name } = useNames(facts)
  const e = facts.expense
  const header = <TopBar onBack={() => goBack(BYAAJ_PATH)} />
  const amount = facts.open ?? e.total
  const money = (minor: Minor): string => formatMoney(minor, facts.currency, { trimZeros: true })

  if (amount <= 0) {
    return (
      <Screen header={header} contentClassName={styles.content}>
        <PageTitle title={t('byaaj.setup.title')} />
        <EmptyState
          icon={<Percent />}
          title={t('byaaj.setup.closed.title')}
          text={t('byaaj.setup.closed.text')}
          action={<Button onClick={() => navigate(BYAAJ_PATH, { replace: true })}>{t('byaaj.gone.cta')}</Button>}
        />
      </Screen>
    )
  }

  const add = (rate: Rate): void => {
    const undo = setByaaj(e.id, { rate, principal: amount, now: Date.now() })
    haptic('success')
    toast(t('byaaj.toast.added', { rate: rateLabel(rate), date: dayLabel(e.date) }), { tone: 'success', action: { label: t('common.action.undo'), onAction: undo } })
  }

  return (
    <Screen header={header} contentClassName={styles.content}>
      <PageTitle title={t('byaaj.setup.title')} subtitle={t(facts.lent ? 'byaaj.setup.subtitle.lent' : 'byaaj.setup.subtitle.borrowed', { name, amount: money(amount), date: dayLabel(e.date) })} />
      <Card>
        <RatePicker value={null} onPick={add} explicit />
      </Card>
      <p className={styles.fine}>{t(facts.lent ? 'byaaj.rule.parts.lent' : 'byaaj.rule.parts.borrowed')}</p>
      {facts.group && <p className={styles.fine}>{t('byaaj.group.note', { group: facts.group.name })}</p>}
    </Screen>
  )
}

function Loan({ facts }: { facts: LoanFacts }) {
  const t = useT()
  const toast = useToast()
  const me = useMe()
  const friendsById = useFriendsById()
  const expenses = useExpenses()
  const plan = useByaajPlan(facts.expense.id)
  const { name, full, mine } = useNames(facts)
  const [today] = useState(() => todayIso())
  const [sheet, setSheet] = useState(false)
  const [draft, setDraft] = useState<PaymentDraft>({ text: null, date: today, tried: false })
  const [paying, setPaying] = useState<{ amount: Minor; date: string; open: boolean } | null>(null)

  const view: LoanView | null = useMemo(() => (plan ? loanView(plan, facts, expenses, today) : null), [plan, facts, expenses, today])
  if (!plan || !view) return null

  const { statement: s } = view
  const c = facts.currency
  const money = (minor: Minor): string => formatMoney(minor, c, { trimZeros: true })
  const rate: Rate = { bp: plan.bp, per: plan.per }
  const undoable = (message: string, undo: () => void): void => {
    toast(message, { tone: 'success', action: { label: t('common.action.undo'), onAction: undo } })
  }

  const save = (amount: Minor, date: string): void => {
    const outcome = recordLoanPayment(view, { amount, date, now: Date.now() })
    if (!outcome.ok) {
      // More than was due, or nothing: the sheet says so and stays open. Anything else: say it failed.
      if (outcome.reason === 'failed') toast(t('byaaj.toast.failed'), { tone: 'error' })
      else setDraft((d) => ({ ...d, tried: true }))
      return
    }
    haptic('success')
    setSheet(false)
    setDraft({ text: null, date: today, tried: false })
    undoable(t('byaaj.toast.paid', { amount: money(amount), interest: money(outcome.parts.interest), principal: money(outcome.parts.principal) }), outcome.undo)
  }

  const share = async (): Promise<void> => {
    const outcome = await shareResult(shareMessage(view, name), { title: t('byaaj.title') })
    if (outcome === 'copied') toast(t('byaaj.share.copied'), { tone: 'success' })
    else if (outcome === 'failed') toast(t('byaaj.share.failed'), { tone: 'error' })
  }

  const late = plan.dueOn !== null && plan.dueOn < today && !s.cleared

  return (
    <Screen header={<TopBar onBack={() => goBack(BYAAJ_PATH)} />} contentClassName={styles.content}>
      <PageTitle
        title={t(facts.lent ? 'byaaj.detail.title.lent' : 'byaaj.detail.title.borrowed', { name })}
        subtitle={loanLine(s, s.principalStart, c, facts.lent)}
      />

      <Card>
        <section className={styles.status} role="status" aria-label={t('byaaj.status.aria')}>
          <span className={styles.label}>{t('byaaj.total.label')}</span>
          <Money value={s.due} currency={c} size="xl" trimZeros />
          <p className={styles.body}>{headline(view)}</p>
          {plan.dueOn && !s.cleared && <p className={late ? styles.bad : styles.fine}>{t(late ? 'byaaj.dueOn.line.late' : 'byaaj.dueOn.line', { date: dayLabel(plan.dueOn) })}</p>}
        </section>
      </Card>

      {!s.cleared && (
        <div className={styles.actions}>
          <Button block iconStart={<HandCoins />} onClick={() => setSheet(true)}>
            {t('byaaj.pay.cta')}
          </Button>
        </div>
      )}
      <div className={styles.actions}>
        <Button block variant="secondary" iconStart={<Share2 />} onClick={() => void share()}>
          {t('byaaj.share.cta', { name })}
        </Button>
        <Button block variant="secondary" iconStart={<Printer />} onClick={() => printPage(t('byaaj.note.title'))}>
          {t('byaaj.print.cta')}
        </Button>
      </div>

      <section className={styles.block} aria-labelledby="byaaj-rules">
        <h2 id="byaaj-rules" className={styles.heading}>
          {t('byaaj.rules.title')}
        </h2>
        <ul className={styles.rules}>
          {ruleLines(view).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {facts.group && <p className={styles.fine}>{t('byaaj.group.note', { group: facts.group.name })}</p>}
      </section>

      <section className={styles.block} aria-labelledby="byaaj-statement">
        <h2 id="byaaj-statement" className={styles.heading}>
          {t('byaaj.statement.title')}
        </h2>
        <Card padding="none">
          <ol className={styles.lines} aria-label={t('byaaj.statement.aria')}>
            {s.lines.map((line) => {
              const text = lineText(line, view, name)
              return (
                <li key={line.id} className={styles.line}>
                  <span className={styles.lineDate}>{dayLabel(line.date)}</span>
                  <span className={styles.lineTitle}>{text.title}</span>
                  <span className={styles.fine}>{text.detail}</span>
                </li>
              )
            })}
          </ol>
        </Card>
      </section>

      <section className={styles.block} aria-labelledby="byaaj-settings">
        <h2 id="byaaj-settings" className={styles.heading}>
          {t('byaaj.settings.title')}
        </h2>
        <Card>
          <div className={styles.settings}>
            <RatePicker value={rate} onPick={(next) => undoable(t('byaaj.toast.rate', { rate: rateLabel(next) }), setByaajRate(plan.expenseId, next))} />
            <p className={styles.fine}>{t('byaaj.settings.rate.hint')}</p>
            <div className={styles.dateRow}>
              <span className={styles.label}>{t('byaaj.dueOn.label')}</span>
              {plan.dueOn ? (
                <>
                  <DateField
                    label={t('byaaj.dueOn.label')}
                    value={plan.dueOn}
                    min={s.from}
                    max={null}
                    onChange={(date) => undoable(t('byaaj.toast.dueOn', { date: dayLabel(date) }), setByaajDueOn(plan.expenseId, date))}
                  />
                  <Chip size="lg" onClick={() => undoable(t('byaaj.toast.dueOn.none'), setByaajDueOn(plan.expenseId, null))}>
                    {t('byaaj.dueOn.clear')}
                  </Chip>
                </>
              ) : (
                <Chip
                  size="lg"
                  leading={<CalendarClock />}
                  onClick={() => {
                    // A month from today to start from: one tap, then change the day if it isn't that.
                    const date = addDays(today, 30)
                    undoable(t('byaaj.toast.dueOn', { date: dayLabel(date) }), setByaajDueOn(plan.expenseId, date))
                  }}
                >
                  {t('byaaj.dueOn.add')}
                </Chip>
              )}
            </div>
            <p className={styles.fine}>{t('byaaj.dueOn.hint')}</p>
            <Button
              variant="danger"
              size="md"
              iconStart={<Trash2 />}
              onClick={() => {
                const undo = removeByaaj(plan.expenseId)
                undoable(t('byaaj.toast.removed'), undo)
              }}
            >
              {t('byaaj.remove.cta')}
            </Button>
          </div>
        </Card>
      </section>

      <PaymentSheet
        open={sheet}
        onClose={() => setSheet(false)}
        view={view}
        name={name}
        today={today}
        draft={draft}
        onDraft={setDraft}
        onSave={save}
        onPayByUpi={
          facts.lent
            ? undefined
            : (amount, date) => {
                setSheet(false)
                setPaying({ amount, date, open: true })
              }
        }
      />
      {paying && (
        <UpiPaySheet
          open={paying.open}
          onClose={() => setPaying({ ...paying, open: false })}
          payee={{ id: facts.friendId, name, upiId: friendsById[facts.friendId]?.upiId ?? null }}
          payer={{ id: ME_ID, name: t('common.people.you'), color: me.color }}
          amount={paying.amount}
          currency={c}
          // The UPI note stays in English: banks and UPI apps show it as is.
          note="Loan repayment"
          onMarkPaid={() => save(paying.amount, paying.date)}
        />
      )}

      {/* Only on paper: the loan note. Hidden on screen (and from screen readers, who have the page above). */}
      <div className={styles.printArea} aria-hidden="true">
        <LoanNote view={view} lender={facts.lent ? mine : full} borrower={facts.lent ? full : mine} />
      </div>
    </Screen>
  )
}
