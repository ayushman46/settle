import { useId, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { Check, ChevronDown, ClipboardPaste, FileSpreadsheet, Images, ShieldCheck, Sparkles } from 'lucide-react'
import { goBack, navigate } from '../../app/router'
import { ActionBar, Banner, Button, Card, Chip, EmptyState, Money, PageTitle, Screen, Skeleton, SuccessCheck, TopBar, useToast } from '../../components'
import { setPaidBack, useExpenses, useFriends, useFriendsById, useStore } from '../../data'
import { payerAliasesStore } from '../../data/stores'
import { today } from '../../engine/dates'
import { useT, type MessageKey } from '../../i18n'
import { FriendAvatar, friendLabel } from '../../kit/index-a'
import { haptic } from '../../lib/haptics'
import { prepareImage } from '../../lib/image'
import { formatMoney } from '../../lib/money'
import { shortDate } from '../recurring/recurringLabels'
import { matchPayments, type Credit, type MatchOption, type Proposal, type Reason } from './match'
import { creditsFromSms } from './sms'
import { applyMatches, knownReferences, MAX_SCREENSHOTS, mergeScreenshots, openDues, payersFor, readHistoryScreenshot, undoMatches, type Applied } from './sources'
import { parseDelimited, parseHtmlTable, readStatement } from './statement'
import { readXlsx } from './xlsx'
import styles from './WhosPaid.module.css'

type Step =
  | { kind: 'pick'; problem: MessageKey | null }
  | { kind: 'reading'; done: number; total: number }
  | { kind: 'review'; proposals: Proposal[]; skipped: number; trusted: boolean; source: Credit['source'] }
  | { kind: 'done'; marked: number }

const REASON_KEYS: Record<Reason, MessageKey> = {
  alias: 'whospaid.reason.alias',
  upi: 'whospaid.reason.upi',
  upiMasked: 'whospaid.reason.upiMasked',
  upiName: 'whospaid.reason.upiName',
  name: 'whospaid.reason.name',
  initials: 'whospaid.reason.initials',
  amount: 'whospaid.reason.amount',
  unique: 'whospaid.reason.unique',
  several: 'whospaid.reason.several',
  part: 'whospaid.reason.part',
  over: 'whospaid.reason.over',
}

const STATEMENT_ACCEPT = '.csv,.tsv,.txt,.xls,.xlsx,text/csv,text/plain,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Rows of a statement file, whatever kind it is (read on this phone). */
async function rowsOf(file: File): Promise<string[][] | null> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  // .xlsx: a ZIP ("PK").
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return readXlsx(bytes)
  // Old binary .xls (OLE): not readable here.
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf) return null
  const text = new TextDecoder().decode(bytes)
  return /<table[\s>]/i.test(text) ? parseHtmlTable(text) : parseDelimited(text)
}

/**
 * `/app/whos-paid` — "Who's paid?": bring in what you received (your UPI app's history screenshots,
 * a bank statement, or bank SMS) and Settle ticks off everyone who paid you back, in one go. The
 * statement and SMS never leave the phone; screenshots are read by the AI and not kept. Clear
 * matches are ticked for you, doubtful ones ask with one tap, and nothing is marked until you say.
 */
export function WhosPaidScreen() {
  const t = useT()
  const toast = useToast()
  const expenses = useExpenses()
  const friends = useFriends()
  const friendsById = useFriendsById()
  const aliases = useStore(payerAliasesStore, (all) => all)
  const dues = useMemo(() => openDues(expenses), [expenses])
  const [step, setStep] = useState<Step>({ kind: 'pick', problem: null })
  const [picked, setPicked] = useState<Record<string, string | null>>({})
  const [smsOpen, setSmsOpen] = useState(false)
  const [smsText, setSmsText] = useState('')
  const shotsRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const smsId = useId()
  const owedTotal = dues.reduce((sum, d) => sum + d.amount, 0)
  const owing = new Set(dues.map((d) => d.friendId)).size
  const money = (minor: number) => formatMoney(minor, 'INR', { trimZeros: true })
  const nameOf = (id: string) => friendLabel(id, friendsById[id] ?? null)

  const review = (credits: Credit[], skipped: number, trusted: boolean, source: Credit['source']) => {
    if (credits.length === 0) {
      setStep({ kind: 'pick', problem: source === 'sms' ? 'whospaid.problem.noSms' : 'whospaid.problem.noCredits' })
      return
    }
    const result = matchPayments(credits, dues, payersFor(friends, aliases), knownReferences())
    setPicked(Object.fromEntries(result.proposals.map((p) => [p.credit.id, p.tier === 'matched' ? (p.options[0]?.key ?? null) : null])))
    setStep({ kind: 'review', proposals: result.proposals, skipped, trusted, source })
  }

  const readShots = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])].slice(0, MAX_SCREENSHOTS)
    event.target.value = ''
    if (files.length === 0) return
    setStep({ kind: 'reading', done: 0, total: files.length })
    const shots: Credit[][] = []
    let skipped = 0
    let failure: string | null = null
    for (const [i, file] of files.entries()) {
      try {
        const image = await prepareImage(file)
        // Only the upload is needed: the preview of the original is never shown here.
        URL.revokeObjectURL(image.previewUrl)
        const read = await readHistoryScreenshot(image.dataUrl, today(), i)
        if (read.ok) {
          shots.push(read.credits)
          skipped += read.skipped
        } else failure ??= read.code
      } catch {
        failure ??= 'unreadable'
      }
      setStep({ kind: 'reading', done: i + 1, total: files.length })
    }
    if (shots.length === 0) {
      setStep({ kind: 'pick', problem: failure === 'not_a_history' ? 'whospaid.problem.notHistory' : failure === 'not_configured' ? 'whospaid.problem.offline' : 'whospaid.problem.unreadable' })
      return
    }
    review(mergeScreenshots(shots), skipped, true, 'screenshot')
  }

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setStep({ kind: 'reading', done: 0, total: 1 })
    const rows = await rowsOf(file).catch(() => null)
    const read = rows ? readStatement(rows) : null
    if (!read) {
      setStep({ kind: 'pick', problem: rows === null ? 'whospaid.problem.fileType' : 'whospaid.problem.noStatement' })
      return
    }
    review(read.credits, read.debits, read.trusted, 'statement')
  }

  const readSms = () => {
    const { credits } = creditsFromSms(smsText, today())
    review(credits, 0, true, 'sms')
  }

  if (dues.length === 0 && step.kind !== 'done') {
    return (
      <Screen header={<TopBar onBack={() => goBack('/app')} />}>
        <PageTitle title={t('whospaid.title')} />
        <EmptyState icon={<Check />} title={t('whospaid.empty.title')} text={t('whospaid.empty.text')} action={<Button onClick={() => navigate('/app')}>{t('whospaid.home')}</Button>} />
      </Screen>
    )
  }

  if (step.kind === 'done') {
    const left = new Map<string, number>()
    for (const due of dues) left.set(due.friendId, (left.get(due.friendId) ?? 0) + due.amount)
    return (
      <Screen header={<TopBar onBack={() => goBack('/app')} />} contentClassName={styles.content}>
        <div className={styles.done}>
          <SuccessCheck size="lg" />
          <h1 className={styles.doneTitle} tabIndex={-1}>
            {t('whospaid.done.title', { count: step.marked })}
          </h1>
        </div>
        {left.size > 0 && (
          <Card padding="none">
            <p className={styles.leftTitle}>{t('whospaid.done.left', { count: left.size })}</p>
            <ul className={styles.list}>
              {[...left].map(([friendId, amount]) => (
                <li key={friendId} className={styles.leftRow}>
                  <FriendAvatar friendId={friendId} size="sm" />
                  <span className={styles.leftName}>{nameOf(friendId)}</span>
                  <Money value={amount} currency="INR" trimZeros />
                  <Button
                    size="sm"
                    variant="tonal"
                    onClick={() => {
                      const theirs = dues.filter((d) => d.friendId === friendId)
                      for (const due of theirs) setPaidBack(due.expenseId, due.friendId, true)
                      haptic('success')
                      toast(t('whospaid.cash.toast', { name: nameOf(friendId) }), {
                        tone: 'success',
                        action: { label: t('whospaid.undo'), onAction: () => theirs.forEach((due) => setPaidBack(due.expenseId, due.friendId, false)) },
                      })
                    }}
                  >
                    {t('whospaid.cash.cta')}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Button variant="secondary" onClick={() => navigate('/app')}>
          {t('whospaid.home')}
        </Button>
      </Screen>
    )
  }

  if (step.kind === 'reading') {
    return (
      <Screen header={<TopBar onBack={() => setStep({ kind: 'pick', problem: null })} />} contentClassName={styles.content}>
        <PageTitle title={t('whospaid.title')} />
        <p role="status" className={styles.reading}>
          {step.total > 1 ? t('whospaid.reading.many', { done: Math.min(step.done + 1, step.total), total: step.total }) : t('whospaid.reading.one')}
        </p>
        <div className={styles.skeletons}>
          <Skeleton width="100%" height={64} />
          <Skeleton width="100%" height={64} />
          <Skeleton width="100%" height={64} />
        </div>
      </Screen>
    )
  }

  if (step.kind === 'review') {
    const byKey = new Map<string, MatchOption>()
    for (const p of step.proposals) for (const o of p.options) byKey.set(`${p.credit.id}\u0000${o.key}`, o)
    const chosen = step.proposals.flatMap((p) => {
      const key = picked[p.credit.id]
      const option = key ? byKey.get(`${p.credit.id}\u0000${key}`) : undefined
      return option ? [{ credit: p.credit, option }] : []
    })
    const usedDues = new Map<string, string>()
    for (const { credit, option } of chosen) for (const due of option.dues) usedDues.set(due.id, credit.id)
    const groups = {
      matched: step.proposals.filter((p) => p.tier === 'matched'),
      check: step.proposals.filter((p) => p.tier === 'check'),
      unmatched: step.proposals.filter((p) => p.tier === 'unmatched'),
      other: step.proposals.filter((p) => p.tier === 'unconfirmed' || p.tier === 'known'),
    }
    const received = step.proposals.length
    const confirm = () => {
      const applied: Applied = applyMatches(chosen)
      haptic('success')
      toast(t('whospaid.marked.toast', { count: applied.dues.length }), {
        tone: 'success',
        action: { label: t('whospaid.undo'), onAction: () => undoMatches(applied) },
      })
      setStep({ kind: 'done', marked: chosen.length })
    }
    const row = (proposal: Proposal) => (
      <ReviewRow
        key={proposal.credit.id}
        proposal={proposal}
        picked={picked[proposal.credit.id] ?? null}
        takenBy={(option) => option.dues.map((d) => usedDues.get(d.id)).find((id) => id !== undefined && id !== proposal.credit.id) ?? null}
        onPick={(key) => setPicked((all) => ({ ...all, [proposal.credit.id]: key }))}
        nameOf={nameOf}
      />
    )
    return (
      <Screen
        header={<TopBar onBack={() => setStep({ kind: 'pick', problem: null })} />}
        footer={
          <ActionBar>
            <Button block disabled={chosen.length === 0} onClick={confirm}>
              {t('whospaid.confirm', { count: chosen.length })}
            </Button>
          </ActionBar>
        }
        contentClassName={styles.content}
      >
        <PageTitle
          title={t('whospaid.review.title', { count: received })}
          subtitle={groups.matched.length === 0 ? t('whospaid.review.subtitle.none') : t('whospaid.review.subtitle', { count: groups.matched.length })}
        />
        {!step.trusted && <Banner tone="warning" title={t('whospaid.untrusted.title')}>{t('whospaid.untrusted.text')}</Banner>}
        {groups.matched.length > 0 && <Section title={t('whospaid.section.matched', { count: groups.matched.length })}>{groups.matched.map(row)}</Section>}
        {groups.check.length > 0 && (
          <Section title={t('whospaid.section.check', { count: groups.check.length })} hint={t('whospaid.section.check.hint')}>
            {groups.check.map(row)}
          </Section>
        )}
        {groups.unmatched.length > 0 && (
          <Section title={t('whospaid.section.unmatched', { count: groups.unmatched.length })} hint={t('whospaid.section.unmatched.hint')} collapsible>
            {groups.unmatched.map(row)}
          </Section>
        )}
        {(groups.other.length > 0 || step.skipped > 0) && (
          <p className={styles.fine}>
            {[
              groups.other.some((p) => p.tier === 'unconfirmed') ? t('whospaid.unconfirmed', { count: groups.other.filter((p) => p.tier === 'unconfirmed').length }) : null,
              groups.other.some((p) => p.tier === 'known') ? t('whospaid.known', { count: groups.other.filter((p) => p.tier === 'known').length }) : null,
              step.skipped > 0 ? t('whospaid.skipped', { count: step.skipped }) : null,
            ]
              .filter(Boolean)
              .join(' ')}
          </p>
        )}
        {step.source === 'screenshot' && <p className={styles.fine}>{t('whospaid.otherApps')}</p>}
      </Screen>
    )
  }

  return (
    <Screen header={<TopBar onBack={() => goBack('/app')} />} contentClassName={styles.content}>
      <PageTitle title={t('whospaid.title')} subtitle={t('whospaid.subtitle', { count: owing, amount: money(owedTotal) })} />
      {step.problem && (
        <Banner tone="warning" title={t('whospaid.problem.title')}>
          {t(step.problem)}
        </Banner>
      )}

      <Source
        icon={<Images />}
        title={t('whospaid.source.shots.title')}
        text={t('whospaid.source.shots.text')}
        badge={t('whospaid.badge.ai')}
        ai
        action={
          <>
            <Button block onClick={() => shotsRef.current?.click()}>
              {t('whospaid.source.shots.cta')}
            </Button>
            <input ref={shotsRef} type="file" accept="image/*" multiple hidden onChange={(e) => void readShots(e)} aria-label={t('whospaid.source.shots.cta')} />
          </>
        }
      />
      <Source
        icon={<FileSpreadsheet />}
        title={t('whospaid.source.file.title')}
        text={t('whospaid.source.file.text')}
        badge={t('whospaid.badge.phone')}
        action={
          <>
            <Button block variant="secondary" onClick={() => fileRef.current?.click()}>
              {t('whospaid.source.file.cta')}
            </Button>
            <input ref={fileRef} type="file" accept={STATEMENT_ACCEPT} hidden onChange={(e) => void readFile(e)} aria-label={t('whospaid.source.file.cta')} />
          </>
        }
      />
      <Source
        icon={<ClipboardPaste />}
        title={t('whospaid.source.sms.title')}
        text={t('whospaid.source.sms.text')}
        badge={t('whospaid.badge.phone')}
        action={
          smsOpen ? (
            <div className={styles.paste}>
              <label htmlFor={smsId} className={styles.pasteLabel}>
                {t('whospaid.source.sms.label')}
              </label>
              <textarea id={smsId} className={styles.area} rows={6} value={smsText} autoComplete="off" autoCapitalize="off" spellCheck={false} onChange={(e) => setSmsText(e.target.value)} />
              <Button block variant="secondary" disabled={smsText.trim() === ''} onClick={readSms}>
                {t('whospaid.source.sms.read')}
              </Button>
            </div>
          ) : (
            <Button block variant="secondary" onClick={() => setSmsOpen(true)}>
              {t('whospaid.source.sms.cta')}
            </Button>
          )
        }
      />
    </Screen>
  )
}

function Source({ icon, title, text, badge, ai = false, action }: { icon: ReactNode; title: string; text: string; badge: string; ai?: boolean; action: ReactNode }) {
  return (
    <Card className={styles.source}>
      <div className={styles.sourceHead}>
        <span className={styles.sourceIcon} aria-hidden="true">
          {icon}
        </span>
        <div className={styles.sourceText}>
          <h2 className={styles.sourceTitle}>{title}</h2>
          <p className={styles.sourceBody}>{text}</p>
          <p className={ai ? styles.badgeAi : styles.badgePhone}>
            {ai ? <Sparkles aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
            <span>{badge}</span>
          </p>
        </div>
      </div>
      {action}
    </Card>
  )
}

function Section({ title, hint, collapsible = false, children }: { title: string; hint?: string; collapsible?: boolean; children: ReactNode }) {
  const id = useId()
  const [open, setOpen] = useState(!collapsible)
  return (
    <section className={styles.section} aria-labelledby={id}>
      {collapsible ? (
        <button type="button" className={styles.sectionToggle} aria-expanded={open} aria-controls={`${id}-body`} onClick={() => setOpen((o) => !o)}>
          <h2 id={id} className={styles.sectionTitle}>
            {title}
          </h2>
          <ChevronDown aria-hidden="true" className={open ? styles.chevronOpen : styles.chevron} />
        </button>
      ) : (
        <h2 id={id} className={styles.sectionTitle}>
          {title}
        </h2>
      )}
      {hint && <p className={styles.sectionHint}>{hint}</p>}
      <div id={`${id}-body`} hidden={!open}>
        <ul className={styles.list}>{children}</ul>
      </div>
    </section>
  )
}

interface ReviewRowProps {
  proposal: Proposal
  picked: string | null
  /** Another payment already settles one of this option's dues (its id), or null. */
  takenBy: (option: MatchOption) => string | null
  onPick: (key: string | null) => void
  nameOf: (friendId: string) => string
}

function ReviewRow({ proposal, picked, takenBy, onPick, nameOf }: ReviewRowProps) {
  const t = useT()
  const { credit, options, tier } = proposal
  const money = (minor: number) => formatMoney(minor, 'INR', { trimZeros: true })
  const label = (option: MatchOption) => {
    const titles = option.dues.map((d) => d.title).join(', ')
    const owed = option.dues.reduce((sum, d) => sum + d.amount, 0)
    if (option.kind === 'part') return t('whospaid.option.part', { name: nameOf(option.friendId), title: titles, due: money(owed) })
    if (option.kind === 'over') return t('whospaid.option.over', { name: nameOf(option.friendId), title: titles, due: money(owed) })
    if (option.kind === 'several') return t('whospaid.option.several', { name: nameOf(option.friendId), count: option.dues.length })
    return t('whospaid.option.one', { name: nameOf(option.friendId), title: titles })
  }
  const current = options.find((o) => o.key === picked) ?? null
  return (
    <li className={styles.row}>
      <div className={styles.rowHead}>
        <div className={styles.rowText}>
          <span className={styles.printed}>{credit.name ?? t('whospaid.noName')}</span>
          <span className={styles.meta}>{[credit.date ? shortDate(credit.date) : null, credit.utr ? `UPI ${credit.utr.slice(-4)}` : null].filter(Boolean).join(' · ')}</span>
        </div>
        <Money value={credit.amount} currency="INR" strong trimZeros />
      </div>
      {tier === 'matched' && current ? (
        <label className={styles.tick}>
          <input type="checkbox" checked onChange={() => onPick(null)} />
          <FriendAvatar friendId={current.friendId} size="xs" />
          <span>{label(current)}</span>
        </label>
      ) : tier === 'matched' && options[0] ? (
        <label className={styles.tick}>
          <input type="checkbox" checked={false} onChange={() => onPick(options[0]?.key ?? null)} />
          <FriendAvatar friendId={options[0].friendId} size="xs" />
          <span>{label(options[0])}</span>
        </label>
      ) : options.length > 0 ? (
        <div role="radiogroup" aria-label={t('whospaid.which', { amount: money(credit.amount) })} className={styles.choices}>
          {options.map((option) => {
            const taken = takenBy(option) !== null && option.key !== picked
            return (
              <Chip key={option.key} className={styles.choice} role="radio" aria-checked={option.key === picked} selected={option.key === picked} disabled={taken} onClick={() => onPick(option.key === picked ? null : option.key)}>
                {label(option)}
              </Chip>
            )
          })}
          <Chip className={styles.choice} role="radio" aria-checked={picked === null} selected={picked === null} onClick={() => onPick(null)}>
            {t('whospaid.option.none')}
          </Chip>
        </div>
      ) : null}
      {current && (
        <p className={styles.reasons}>
          {current.reasons.map((reason) => t(REASON_KEYS[reason], { count: current.dues.length })).join(' · ')}
          {current.learnName && ` · ${t('whospaid.learn', { printed: current.learnName, name: nameOf(current.friendId) })}`}
        </p>
      )}
    </li>
  )
}
