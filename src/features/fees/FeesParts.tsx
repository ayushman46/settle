/**
 * Bank charges' sections (FeesScreen): your account's two answers, the questions that settle a
 * charge (one per kind of question and account, answered for all of them at once), what can be
 * claimed per bank, the claims as they go, an ATM refund that came back late (Stuck money claims
 * the ₹100 a day), what's allowed but avoidable, and every charge.
 */
import { useId, useState, type ReactNode } from 'react'
import { ArrowRightLeft, BadgeCheck, Banknote, ChevronDown, CreditCard, FileText, Landmark, MessageSquare, Receipt, ShieldAlert, Smartphone, Wallet } from 'lucide-react'
import { navigate } from '../../app/router'
import { AmountInput, Button, Card, Chip, Money, useToast } from '../../components'
import { addStuck } from '../../data/stuck'
import { useT } from '../../i18n'
import { cx } from '../../lib/cx'
import { haptic } from '../../lib/haptics'
import { parseMoneyInput } from '../../lib/money'
import { stuckPath } from '../stuck/paths'
import { bankName } from '../stuck/letters'
import { answerFindings, dismissClaim, makeClaim, setAccount } from './actions'
import { FeeChargeSheet } from './FeeChargeSheet'
import { useOpenLetter } from './letterContext'
import type { LateReversal } from './read'
import { open as openAmount, type FeeFinding } from './rules'
import { accountKey, accountOf, ACCOUNT_TYPES, type AccountType, type FeeCharge, type FeeKind, type FeesState } from './store'
import {
  accountTail,
  avoidLine,
  dayLabel,
  inr,
  kindLabel,
  owesLine,
  QUESTION_KEYS,
  RULE_REFS,
  whyLine,
  WRONG_IF_YES,
  type ClaimGroup,
  type ClaimView,
  type FeesView,
} from './view'
import styles from './Fees.module.css'

const KIND_ICONS: Readonly<Partial<Record<FeeKind, typeof Landmark>>> = {
  minbal: Wallet,
  atm: Banknote,
  atmDecline: Banknote,
  sms: MessageSquare,
  card: CreditCard,
  neft: ArrowRightLeft,
  rtgs: ArrowRightLeft,
  imps: ArrowRightLeft,
  upi: Smartphone,
  statement: FileText,
  chequeBook: FileText,
  late: Receipt,
}

export function FeeKindIcon({ kind, tone = 'plain' }: { kind: FeeKind; tone?: 'plain' | 'wrong' | 'ask' | 'back' }) {
  const Icon = tone === 'back' ? BadgeCheck : (KIND_ICONS[kind] ?? Landmark)
  return (
    <span className={cx(styles.kindIcon, styles[`tone-${tone}`])} aria-hidden="true">
      <Icon strokeWidth={2.25} />
    </span>
  )
}

function Section({ title, count, children, collapsible = false }: { title: string; count?: number; children: ReactNode; collapsible?: boolean }) {
  const t = useT()
  const id = useId()
  const [open, setOpen] = useState(!collapsible)
  const heading = (
    <>
      <span>{title}</span>
      {count !== undefined && (
        <span aria-hidden="true" className={styles.sectionCount}>
          {count}
        </span>
      )}
    </>
  )
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id} className={styles.sectionTitle}>
        {collapsible ? (
          <button type="button" className={styles.sectionToggle} aria-expanded={open} aria-controls={`${id}-body`} onClick={() => setOpen((o) => !o)}>
            <span>{heading}</span>
            <ChevronDown aria-hidden="true" className={open ? styles.chevronOpen : styles.chevron} />
          </button>
        ) : (
          heading
        )}
      </h2>
      <div id={`${id}-body`} hidden={!open} className={styles.sectionBody}>
        {children}
      </div>
      {count !== undefined && <span className="visually-hidden">{t('fees.kind.count', { count })}</span>}
    </section>
  )
}

/* ---------------------------------------------------------------- your account */

const TYPE_KEYS = {
  regular: 'fees.account.type.regular',
  basic: 'fees.account.type.basic',
  salary: 'fees.account.type.salary',
  minor: 'fees.account.type.minor',
  scholarship: 'fees.account.type.scholarship',
  senior: 'fees.account.type.senior',
  unknown: 'fees.account.type.unknown',
} as const

/** Average balances banks commonly ask for (₹). */
const MAB_PRESETS = [2000, 5000, 10000, 15000, 25000] as const

/** The accounts the charges are on: one card each, its two answers. */
export function AccountSection({ state }: { state: FeesState }) {
  const t = useT()
  const accounts = new Map<string, Pick<FeeCharge, 'bank' | 'account'> & { minbal: boolean }>()
  for (const c of state.charges) {
    const key = accountKey(c.bank, c.account)
    const seen = accounts.get(key)
    accounts.set(key, { bank: c.bank, account: c.account, minbal: (seen?.minbal ?? false) || c.kind === 'minbal' })
  }
  if (accounts.size === 0) return null
  return (
    <Section title={t('fees.section.account')}>
      <p className={styles.fine}>{t('fees.account.why')}</p>
      {[...accounts.entries()].map(([key, a]) => (
        <AccountCard key={key} state={state} bank={a.bank} account={a.account} minbal={a.minbal} />
      ))}
    </Section>
  )
}

function AccountCard({ state, bank, account, minbal }: { state: FeesState; bank: string | null; account: string | null; minbal: boolean }) {
  const t = useT()
  const toast = useToast()
  const id = useId()
  const answers = accountOf(state, { bank, account })
  const [other, setOther] = useState(false)
  const [typed, setTyped] = useState('')
  const name = bankName(bank)
  const tail = accountTail(account)
  const heading = name || tail ? t('fees.account.heading', { bank: name ?? '', account: tail ?? '' }).trim() : t('fees.account.headingAny')
  // Answered: one line with a Change button. Not yet (or changing): the questions.
  const settledWith = (a: { type: AccountType; mab: number | null }): boolean => a.type !== 'unknown' && (!minbal || a.type === 'basic' || a.type === 'scholarship' || a.mab !== null)
  const [editing, setEditing] = useState(() => !settledWith(answers))
  const save = (patch: { type?: AccountType; mab?: number | null }): void => {
    const undo = setAccount(bank, account, patch)
    haptic('tap')
    toast(t('fees.account.saved'), { action: { label: t('common.action.undo'), onAction: undo } })
    if (settledWith({ ...answers, ...patch })) setEditing(false)
  }
  if (!editing) {
    return (
      <Card className={styles.accountDone} aria-labelledby={`${id}-h`}>
        <span className={styles.rowText}>
          <h3 id={`${id}-h`} className={styles.cardTitle}>
            {heading}
          </h3>
          <span className={styles.rowStatus}>{t('fees.account.summary', { type: t(TYPE_KEYS[answers.type]), mab: answers.mab === null ? 'none' : inr(answers.mab) })}</span>
        </span>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)} aria-describedby={`${id}-h`}>
          {t('fees.account.change')}
        </Button>
      </Card>
    )
  }
  return (
    <Card className={styles.account} aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`} className={styles.cardTitle}>
        {heading}
      </h3>
      <fieldset className={styles.choices}>
        <legend className={styles.question}>{t('fees.account.type')}</legend>
        <div className={styles.chips}>
          {ACCOUNT_TYPES.map((type) => (
            <Chip key={type} selected={answers.type === type} onClick={() => save({ type })} aria-pressed={answers.type === type}>
              {t(TYPE_KEYS[type])}
            </Chip>
          ))}
        </div>
      </fieldset>
      {minbal && answers.type !== 'basic' && answers.type !== 'scholarship' && (
        <fieldset className={styles.choices}>
          <legend className={styles.question}>{t('fees.account.mab')}</legend>
          <p className={styles.fine}>{t('fees.account.mab.hint')}</p>
          <div className={styles.chips}>
            {MAB_PRESETS.map((rupees) => (
              <Chip key={rupees} selected={answers.mab === rupees * 100} aria-pressed={answers.mab === rupees * 100} onClick={() => save({ mab: rupees * 100 })}>
                {inr(rupees * 100)}
              </Chip>
            ))}
            <Chip selected={other} aria-pressed={other} onClick={() => setOther((o) => !o)}>
              {t('fees.account.mab.other')}
            </Chip>
            <Chip selected={answers.mab === null && !other} aria-pressed={answers.mab === null && !other} onClick={() => save({ mab: null })}>
              {t('fees.account.mab.none')}
            </Chip>
          </div>
          {other && (
            <div className={styles.otherRow}>
              <AmountInput size="field" currency="INR" label={t('fees.account.mab.label')} value={typed} onChange={setTyped} />
              <Button
                size="md"
                variant="secondary"
                disabled={!(parseMoneyInput(typed, 'INR') ?? 0)}
                onClick={() => {
                  const paise = parseMoneyInput(typed, 'INR')
                  if (paise && paise > 0) {
                    save({ mab: paise })
                    setOther(false)
                  }
                }}
              >
                {t('common.action.save')}
              </Button>
            </div>
          )}
        </fieldset>
      )}
    </Card>
  )
}

/* ---------------------------------------------------------------- one question each */

interface AskGroup {
  key: string
  findings: FeeFinding[]
  total: number
}

/** Questions grouped: the same question about the same account is asked once. */
function askGroups(asks: readonly FeeFinding[]): AskGroup[] {
  const map = new Map<string, AskGroup>()
  for (const f of asks) {
    const key = `${f.question ?? ''}|${f.rule}|${accountKey(f.charge.bank, f.charge.account)}`
    const g = map.get(key) ?? { key, findings: [], total: 0 }
    g.findings.push(f)
    g.total += f.claim
    map.set(key, g)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

export function AskSection({ asks }: { asks: readonly FeeFinding[] }) {
  const t = useT()
  if (asks.length === 0) return null
  const groups = askGroups(asks)
  return (
    <Section title={t('fees.section.ask')} count={asks.length}>
      {groups.map((g) => (
        <AskCard key={g.key} group={g} />
      ))}
    </Section>
  )
}

function AskCard({ group }: { group: AskGroup }) {
  const t = useT()
  const toast = useToast()
  const id = useId()
  const first = group.findings[0]
  if (!first?.question) return null
  const question = first.question
  const keys = group.findings.map((f) => f.key)
  const answer = (yes: boolean | null): void => {
    // "Not sure" (the warning only) asks the bank to show the notice or reverse the charge: it counts as no warning.
    const wrong = yes === null ? true : yes === WRONG_IF_YES[question]
    const undo = answerFindings(keys, wrong)
    haptic(wrong ? 'success' : 'tap')
    toast(t(wrong ? 'fees.answer.toast.wrong' : 'fees.answer.toast.fine'), { tone: wrong ? 'success' : undefined, action: { label: t('common.action.undo'), onAction: undo } })
  }
  return (
    <Card className={styles.ask} aria-labelledby={`${id}-q`}>
      <ul role="list" className={styles.askList}>
        {group.findings.map((f) => (
          <li key={f.key} className={styles.askItem}>
            <FeeKindIcon kind={f.charge.kind} tone="ask" />
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>{kindLabel(f.charge.kind)}</span>
              <span className={styles.rowStatus}>
                {dayLabel(f.charge.date)}
                {bankName(f.charge.bank) ? ` · ${bankName(f.charge.bank)}` : ''}
              </span>
            </span>
            <Money value={f.claim} currency="INR" trimZeros strong />
          </li>
        ))}
      </ul>
      <p id={`${id}-q`} className={styles.question}>
        {t(QUESTION_KEYS[question])}
      </p>
      <p className={styles.fine}>{whyLine(first)}</p>
      <div className={styles.answers} role="group" aria-labelledby={`${id}-q`}>
        {question === 'warned' ? (
          <>
            <Button size="sm" variant="tonal" onClick={() => answer(false)}>
              {t('fees.q.warned.no')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => answer(true)}>
              {t('fees.q.warned.yes')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => answer(null)}>
              {t('fees.q.warned.unsure')}
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="tonal" onClick={() => answer(true)}>
              {t('fees.answer.yes')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => answer(false)}>
              {t('fees.answer.no')}
            </Button>
          </>
        )}
      </div>
      {group.findings.length > 1 && <p className={styles.fine}>{t('fees.answer.all', { count: group.findings.length })}</p>}
    </Card>
  )
}

/* ---------------------------------------------------------------- claim back */

/** One finding in a list: what, when, how much, why — and the rule's reference. */
function FindingRow({ f, onOpen }: { f: FeeFinding; onOpen?: () => void }) {
  const t = useT()
  const more = f.also.length
  const body = (
    <>
      <FeeKindIcon kind={f.charge.kind} tone={f.verdict === 'wrong' ? 'wrong' : 'ask'} />
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{kindLabel(f.charge.kind)}</span>
        <span className={styles.rowStatus}>{dayLabel(f.charge.date)}</span>
        <span className={styles.why}>{whyLine(f)}</span>
        <span className={styles.ref}>
          {t('fees.rule.source', { ref: RULE_REFS[f.rule] })}
          {more > 0 ? ` · ${t('fees.why.more', { count: more })}` : ''}
        </span>
      </span>
      <Money value={f.claim} currency="INR" trimZeros strong className={styles.rowAmount} />
    </>
  )
  return (
    <li className={styles.row}>
      {onOpen ? (
        <button type="button" className={styles.rowMain} onClick={onOpen}>
          {body}
        </button>
      ) : (
        <div className={styles.rowMain}>{body}</div>
      )}
    </li>
  )
}

export function ClaimGroups({ groups }: { groups: readonly ClaimGroup[] }) {
  const t = useT()
  const openLetter = useOpenLetter()
  const [charge, setCharge] = useState<FeeCharge | null>(null)
  if (groups.length === 0) return null
  const claim = (g: ClaimGroup): void => {
    const { claim: made } = makeClaim(
      g.bank,
      g.account,
      g.findings.map((f) => f.charge.id),
      g.amount,
    )
    haptic('tap')
    openLetter({ claimId: made.id, mode: 'bank' })
  }
  return (
    <Section title={t('fees.section.claim')} count={groups.reduce((s, g) => s + g.findings.length, 0)}>
      {groups.map((g) => (
        <Card key={g.key} padding="none" className={styles.claim}>
          <div className={styles.claimHead}>
            <h3 className={styles.cardTitle}>{owesLine(g.bank, g.amount)}</h3>
            <p className={styles.rowStatus}>{t('fees.claim.count', { count: g.findings.length, account: accountTail(g.account) ?? 'none' })}</p>
          </div>
          <ul role="list" className={styles.list}>
            {g.findings.map((f) => (
              <FindingRow key={f.key} f={f} onOpen={() => setCharge(f.charge)} />
            ))}
          </ul>
          <div className={styles.claimActions}>
            <Button block iconStart={<ShieldAlert />} onClick={() => claim(g)}>
              {t('fees.claim.cta', { amount: inr(g.amount) })}
            </Button>
          </div>
        </Card>
      ))}
      <FeeChargeSheet charge={charge} onClose={() => setCharge(null)} />
    </Section>
  )
}

/* ---------------------------------------------------------------- your claims */

export function ClaimsSection({ claims }: { claims: readonly ClaimView[] }) {
  const t = useT()
  const openLetter = useOpenLetter()
  const shown = claims.filter((c) => c.stage !== 'dropped').sort((a, b) => b.claim.updatedAt - a.claim.updatedAt)
  if (shown.length === 0) return null
  return (
    <Section title={t('fees.section.claims')} count={shown.length}>
      {shown.map((c) => (
        <ClaimCard key={c.claim.id} view={c} onSheet={(mode) => openLetter({ claimId: c.claim.id, mode })} />
      ))}
    </Section>
  )
}

function statusLine(c: ClaimView, t: ReturnType<typeof useT>): string {
  const bank = c.claim.steps.find((s) => s.kind === 'bank')
  const ombudsman = c.claim.steps.find((s) => s.kind === 'ombudsman')
  switch (c.stage) {
    case 'ready':
      return t('fees.claim.status.ready')
    case 'raised':
      return t('fees.claim.status.raised', { date: dayLabel(bank?.date ?? ''), until: dayLabel(c.until ?? '') })
    case 'ombudsman':
      return t('fees.claim.status.ombudsman', { last: dayLabel(c.last ?? '') })
    case 'replied':
      return t('fees.claim.status.replied', { date: dayLabel(c.claim.repliedAt ?? ''), last: dayLabel(c.last ?? '') })
    case 'ombudsmanRaised':
      return t('fees.claim.status.ombudsmanRaised', { date: dayLabel(ombudsman?.date ?? '') })
    case 'closed':
      return t('fees.claim.status.closed', { last: dayLabel(c.last ?? '') })
    case 'back':
      return t('fees.claim.status.back', { amount: inr(c.claim.back?.amount ?? 0), date: dayLabel(c.claim.back?.date ?? '') })
    case 'dropped':
      return ''
  }
}

function ClaimCard({ view, onSheet }: { view: ClaimView; onSheet: (mode: 'bank' | 'ombudsman' | 'replied' | 'back') => void }) {
  const t = useT()
  const toast = useToast()
  const { claim, stage } = view
  const done = stage === 'back'
  const drop = (): void => {
    const undo = dismissClaim(claim.id)
    toast(t('fees.claim.dropped'), { action: { label: t('common.action.undo'), onAction: undo } })
  }
  return (
    <Card padding="none" className={cx(styles.claim, done && styles.claimDone)}>
      <div className={styles.claimHead}>
        <h3 className={styles.cardTitle}>{owesLine(claim.bank, claim.amount)}</h3>
        <p className={cx(styles.rowStatus, (stage === 'ombudsman' || stage === 'replied') && styles.urgent, done && styles.good)}>{statusLine(view, t)}</p>
      </div>
      {view.findings.length > 0 && !done && (
        <ul role="list" className={styles.list}>
          {view.findings.map((f) => (
            <FindingRow key={f.key} f={f} />
          ))}
        </ul>
      )}
      {!done && (
        <div className={styles.claimActions}>
          {stage === 'ready' && (
            <>
              <Button block iconStart={<ShieldAlert />} onClick={() => onSheet('bank')}>
                {t('fees.claim.raise')}
              </Button>
              <Button size="sm" variant="ghost" onClick={drop}>
                {t('fees.claim.drop')}
              </Button>
            </>
          )}
          {(stage === 'ombudsman' || stage === 'replied') && (
            <Button block iconStart={<Landmark />} onClick={() => onSheet('ombudsman')}>
              {t('fees.claim.ombudsman')}
            </Button>
          )}
          {stage !== 'ready' && (
            <div className={styles.answers}>
              {(stage === 'raised' || stage === 'ombudsman') && (
                <Button size="sm" variant="ghost" onClick={() => onSheet('bank')}>
                  {t('fees.claim.raiseAgain')}
                </Button>
              )}
              {stage === 'raised' && (
                <Button size="sm" variant="ghost" onClick={() => onSheet('replied')}>
                  {t('fees.claim.replied')}
                </Button>
              )}
              <Button size="sm" variant="tonal" onClick={() => onSheet('back')}>
                {t('fees.claim.back')}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

/* ---------------------------------------------------------------- owed for a wait (Stuck money) */

const RBI_ATM_DAYS = 5

export function LateSection({ late, onDone }: { late: readonly LateReversal[]; onDone: (l: LateReversal) => void }) {
  const t = useT()
  const toast = useToast()
  if (late.length === 0) return null
  const claim = (l: LateReversal): void => {
    const s = addStuck({
      kind: 'failed',
      rail: 'atm',
      party: null,
      merchant: null,
      amount: l.amount,
      date: l.date,
      promisedBy: null,
      ref: null,
      orderId: null,
      bank: null,
      account: null,
      app: null,
      source: 'manual',
      confirmed: true,
      back: { date: l.backOn, amount: l.amount, compensation: 0, parts: [{ date: l.backOn, amount: l.amount, compensation: 0 }] },
    })
    haptic('success')
    toast(t('fees.late.added'), { tone: 'success' })
    onDone(l)
    navigate(stuckPath(s.id))
  }
  return (
    <Section title={t('fees.section.late')}>
      {late.map((l) => {
        const days = Math.max(0, Math.round((Date.parse(l.backOn) - Date.parse(l.date)) / 86_400_000) - RBI_ATM_DAYS)
        return (
          <Card key={`${l.date}-${l.amount}`} className={styles.late}>
            <h3 className={styles.cardTitle}>{t('fees.late.title', { comp: inr(days * 100_00) })}</h3>
            <p className={styles.fine}>{t('fees.late.text', { amount: inr(l.amount), date: dayLabel(l.date), backOn: dayLabel(l.backOn), days })}</p>
            <Button size="md" variant="secondary" onClick={() => claim(l)}>
              {t('fees.late.cta')}
            </Button>
          </Card>
        )
      })}
    </Section>
  )
}

/* ---------------------------------------------------------------- allowed, but avoidable */

export function AvoidSection({ avoidable, state }: { avoidable: FeesView['avoidable']; state: FeesState }) {
  const t = useT()
  const openLetter = useOpenLetter()
  if (avoidable.length === 0) return null
  const minbal = avoidable.find((a) => a.kind === 'minbal')
  const anyMinbal = state.charges.find((c) => c.kind === 'minbal')
  const basicAlready = anyMinbal ? accountOf(state, anyMinbal).type === 'basic' : false
  return (
    <Section title={t('fees.section.avoid')}>
      <Card padding="none">
        <ul role="list" className={styles.list}>
          {avoidable.slice(0, 6).map((a) => (
            <li key={a.kind} className={styles.avoid}>
              <FeeKindIcon kind={a.kind} />
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{kindLabel(a.kind)}</span>
                <span className={styles.rowStatus}>{avoidLine(a.kind, a.amount)}</span>
                {a.kind === 'minbal' && minbal && !basicAlready && (
                  <Button size="sm" variant="secondary" className={styles.avoidCta} onClick={() => openLetter({ claimId: null, mode: 'basic', bank: anyMinbal?.bank ?? null, account: anyMinbal?.account ?? null })}>
                    {t('fees.avoid.minbal.cta')}
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  )
}

/* ---------------------------------------------------------------- every charge */

export function AllCharges({ view }: { view: FeesView }) {
  const t = useT()
  const [charge, setCharge] = useState<FeeCharge | null>(null)
  if (view.byKind.length === 0) return null
  const flagged = new Map(view.findings.map((f) => [f.charge.id, f]))
  return (
    <Section title={t('fees.section.all')} count={view.count} collapsible>
      {view.byKind.map((k) => (
        <Card key={k.kind} padding="none" className={styles.kindCard}>
          <div className={styles.kindHead}>
            <span className={styles.rowTitle}>{kindLabel(k.kind)}</span>
            <Money value={k.amount} currency="INR" trimZeros strong />
          </div>
          <ul role="list" className={styles.list}>
            {k.charges.map((c) => {
              const f = flagged.get(c.id)
              return (
                <li key={c.id} className={styles.row}>
                  <button type="button" className={styles.rowMain} onClick={() => setCharge(c)}>
                    <FeeKindIcon kind={c.kind} tone={f ? (f.verdict === 'wrong' ? 'wrong' : 'ask') : openAmount(c) === 0 ? 'back' : 'plain'} />
                    <span className={styles.rowText}>
                      <span className={styles.rowTitle}>{dayLabel(c.date)}</span>
                      <span className={styles.rowStatus} lang="en">
                        {c.text || kindLabel(c.kind)}
                      </span>
                      {f && <span className={styles.why}>{whyLine(f)}</span>}
                    </span>
                    <Money value={c.amount + c.gst} currency="INR" trimZeros muted={openAmount(c) === 0} className={styles.rowAmount} />
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>
      ))}
      <FeeChargeSheet charge={charge} onClose={() => setCharge(null)} />
    </Section>
  )
}
