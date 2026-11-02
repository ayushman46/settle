import { useId, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { ClipboardPaste, FileSpreadsheet, Landmark, Lock, Scale } from 'lucide-react'
import { goBack } from '../../app/router'
import { Banner, Button, EmptyState, Money, PageTitle, Screen, TopBar, useToast } from '../../components'
import { today as todayIso } from '../../engine/dates'
import { useT } from '../../i18n'
import { haptic } from '../../lib/haptics'
import { STATEMENT_ACCEPT } from '../whospaid/statementFile'
import { FeeAlertsCard } from './FeeAlertsCard'
import { LetterSheetHost } from './FeeLetterSheet'
import { FeePasteSheet } from './FeePasteSheet'
import { FeesClear } from './FeesClear'
import { AccountSection, AllCharges, AskSection, AvoidSection, ClaimGroups, ClaimsSection, LateSection } from './FeesParts'
import { checkStatementFile, type LateReversal, type StatementCheck } from './read'
import { useFees } from './store'
import { dayLabel, feesView, inr } from './view'
import styles from './Fees.module.css'

/** What the last statement read said, until another is read. */
type ReadNote = { tone: 'info' | 'success' | 'warning' | 'error'; text: string; untrusted?: boolean }

function noteFor(check: StatementCheck, t: ReturnType<typeof useT>): ReadNote {
  if (check.kind === 'unreadable') return { tone: 'error', text: t(check.oldXls ? 'fees.read.oldXls' : 'fees.read.unreadable') }
  if (check.kind === 'empty') return { tone: 'info', text: t('fees.read.empty') }
  const added = check.result.added.length
  if (added === 0 && check.result.known.length > 0) return { tone: 'info', text: t('fees.read.nothingNew') }
  return {
    tone: added > 0 ? 'success' : 'info',
    text: t('fees.read.found', { count: added, lines: check.lines, from: dayLabel(check.from ?? ''), to: dayLabel(check.to ?? '') }),
    untrusted: !check.trusted,
  }
}

/**
 * `/app/fees` — Bank charges: a statement (or the bank's SMS) read on the phone, every charge in it
 * checked against the RBI's rules, and what breaks one claimed back — the letter to the bank, then
 * the RBI Ombudsman after its 30 days. What needs one answer comes first, then what can be claimed,
 * the claims as they go, what's owed for a late ATM refund, what's allowed but avoidable, and every
 * charge.
 */
export function FeesScreen() {
  const t = useT()
  const toast = useToast()
  const state = useFees((s) => s)
  const day = todayIso()
  const view = useMemo(() => feesView(state, day), [state, day])
  const fileRef = useRef<HTMLInputElement>(null)
  const [reading, setReading] = useState(false)
  const [note, setNote] = useState<ReadNote | null>(null)
  const [late, setLate] = useState<LateReversal[]>([])
  const [pasting, setPasting] = useState(false)
  const headingId = useId()

  const pick = (): void => fileRef.current?.click()

  const read = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
      haptic('error')
      setNote({ tone: 'error', text: t('fees.read.pdf') })
      return
    }
    setReading(true)
    try {
      const check = await checkStatementFile(file)
      const next = noteFor(check, t)
      setNote(next)
      if (check.kind === 'read') {
        setLate(check.lateReversals)
        haptic(check.result.added.length > 0 ? 'success' : 'tap')
        if (check.result.added.length > 0) toast(next.text, { tone: 'success', action: { label: t('common.action.undo'), onAction: check.result.undo } })
      } else haptic('error')
    } finally {
      setReading(false)
    }
  }

  const input = (
    <input ref={fileRef} type="file" accept={`${STATEMENT_ACCEPT},.pdf,application/pdf`} hidden onChange={(e) => void read(e)} aria-label={t('fees.check.cta')} />
  )
  const header = <TopBar onBack={() => goBack('/app')} />
  const readBanner = note && (
    <Banner tone={note.tone} onDismiss={() => setNote(null)}>
      {note.text}
      {note.untrusted ? ` ${t('fees.read.untrusted')}` : ''}
    </Banner>
  )

  if (state.charges.length === 0 && state.checks.length === 0) {
    return (
      <Screen header={header} contentClassName={styles.content}>
        <PageTitle title={t('fees.title')} />
        {input}
        <EmptyState
          icon={<Landmark />}
          title={t('fees.empty.title')}
          text={t('fees.empty.text')}
          action={
            <div className={styles.emptyActions}>
              <Button block iconStart={<FileSpreadsheet />} loading={reading} onClick={pick}>
                {t('fees.check.cta')}
              </Button>
              <Button block variant="secondary" iconStart={<ClipboardPaste />} onClick={() => setPasting(true)}>
                {t('fees.paste.cta')}
              </Button>
            </div>
          }
        />
        {readBanner}
        <p className={styles.fine}>{t('fees.check.formats')}</p>
        <section className={styles.how} aria-labelledby={`${headingId}-how`}>
          <h2 id={`${headingId}-how`} className={styles.howTitle}>
            {t('fees.how.title')}
          </h2>
          <p className={styles.howText}>{t('fees.how.text')}</p>
        </section>
        <Privacy />
        <FeeAlertsCard />
        <FeePasteSheet open={pasting} onClose={() => setPasting(false)} />
      </Screen>
    )
  }

  return (
    <Screen header={header} contentClassName={styles.content}>
      <LetterSheetHost>
      <PageTitle title={t('fees.title')} />
      {input}
      <Hero view={view} />
      <div className={styles.listActions}>
        <Button size="md" iconStart={<FileSpreadsheet />} loading={reading} onClick={pick}>
          {t('fees.check.again')}
        </Button>
        <Button size="md" variant="secondary" iconStart={<ClipboardPaste />} onClick={() => setPasting(true)}>
          {t('fees.paste.cta')}
        </Button>
      </div>
      {readBanner}
      <AccountSection state={state} />
      <AskSection asks={view.asks} />
      <ClaimGroups groups={view.groups} />
      <ClaimsSection claims={view.claims} />
      <LateSection late={late} onDone={(done) => setLate((all) => all.filter((l) => l !== done))} />
      <AvoidSection avoidable={view.avoidable} state={state} />
      <AllCharges view={view} />
      <RuleNote />
      <Privacy />
      <FeeAlertsCard />
      <FeesClear />
      <FeePasteSheet open={pasting} onClose={() => setPasting(false)} />
      </LetterSheetHost>
    </Screen>
  )
}

/** The dark card: what the bank owes you, or the charges checked when nothing breaks a rule. */
function Hero({ view }: { view: ReturnType<typeof feesView> }) {
  const t = useT()
  const id = useId()
  const owed = view.owed > 0
  return (
    <section aria-labelledby={id} className={styles.hero}>
      <h2 id={id} className="visually-hidden">
        {t('fees.title')}
      </h2>
      <div className={styles.heroTop}>
        <p className={styles.heroLabel}>{owed ? t('fees.hero.owed') : t('fees.hero.checked')}</p>
        <Money value={owed ? view.owed : view.total} currency="INR" size="xl" trimZeros className={owed ? styles.heroAmount : undefined} />
        <p className={styles.heroSub}>{owed ? t('fees.hero.owedSub', { count: view.owedCount }) : t('fees.hero.checkedSub', { count: view.count })}</p>
      </div>
      <dl className={styles.heroTotals}>
        {view.from && view.to && (
          <div className={styles.heroTotal}>
            <dt className={styles.heroTotalLabel}>{t('fees.hero.period', { from: dayLabel(view.from), to: dayLabel(view.to) })}</dt>
            <dd className={styles.heroTotalValue}>{t('fees.hero.total', { amount: inr(view.total) })}</dd>
          </div>
        )}
        {view.back > 0 && (
          <div className={styles.heroTotal}>
            <dt className={styles.heroTotalLabel}>{t('fees.section.claims')}</dt>
            <dd className={styles.heroTotalValue}>{t('fees.hero.back', { amount: inr(view.back) })}</dd>
          </div>
        )}
      </dl>
      {view.asks.length > 0 && (
        <p className={styles.heroFoot}>
          <span className={styles.heroDot} aria-hidden="true" />
          {t('fees.hero.ask', { count: view.asks.length })}
        </p>
      )}
    </section>
  )
}

function RuleNote() {
  const t = useT()
  return (
    <p className={styles.rule}>
      <Scale aria-hidden="true" className={styles.ruleIcon} />
      <span>{t('fees.tagline')}</span>
    </p>
  )
}

function Privacy() {
  const t = useT()
  return (
    <p className={styles.rule}>
      <Lock aria-hidden="true" className={styles.ruleIcon} />
      <span>{t('fees.privacy')}</span>
    </p>
  )
}

